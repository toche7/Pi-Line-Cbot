import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LineAdapter, lineReply, validSignature, webhookHandler } from './line.js';
import { DemoFailure } from './diagnostics.js';

const secret = 'test-only-channel-placeholder';
const sign = (body: Buffer) => createHmac('sha256', secret).update(body).digest('base64');
const event = (id = 'event-1', user = 'allowed') => ({
  type: 'message', webhookEventId: id, replyToken: 'test-reply-placeholder',
  source: { type: 'user', userId: user }, message: { type: 'text', text: 'ขอใบเสร็จ' },
});

test('LINE distinguishes rate-limited fallback from successful FAQ without exposing errors', async () => {
  const replies: string[] = [];
  const logs: object[] = [];
  const adapter = new LineAdapter({ secret, account: 'test', dryRun: false, allowedUsers: new Set(['allowed']),
    core: { client: () => ({ send: async (prompt, out) => {
      if (prompt === 'สมัครสมาชิกอย่างไร') { out.text('FAQ สมัครสมาชิก'); return; }
      throw new DemoFailure('429 private-provider-fixture authorization-placeholder');
    }, abort: async () => {} }) },
    reply: async (_token, text) => { replies.push(text); }, log: value => logs.push(value),
  });
  for (const [id, text] of [['rate-limit', 'คุยกัน'], ['faq', 'สมัครสมาชิกอย่างไร']]) {
    const raw = Buffer.from(JSON.stringify({ events: [{ ...event(id), message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, sign(raw)), 200); await adapter.drain();
  }
  assert.match(replies[0], /โควตา.*FAQ/);
  assert.equal(replies[1], 'FAQ สมัครสมาชิก');
  assert.deepEqual(logs.map(r => (r as { outcome: string }).outcome), ['core_failed', 'replied_fallback', 'replied']);
  assert.match(JSON.stringify(logs), /model_rate_limit/);
  assert.doesNotMatch(JSON.stringify({ logs, replies }), /private-provider|authorization-placeholder|test-reply/);
});

test('LINE hides unknown exception details and identifies timeout fallback', async () => {
  for (const error of [new Error('https://private.invalid/token-secret'), new DemoFailure('Model request timed out after 25000 ms.')]) {
    let reply = ''; const logs: object[] = [];
    const adapter = new LineAdapter({ secret, account: 'test', dryRun: false, allowedUsers: new Set(['allowed']),
      core: { client: () => ({ send: async () => { throw error; }, abort: async () => {} }) },
      reply: async (_token, text) => { reply = text; }, log: value => logs.push(value),
    });
    const raw = Buffer.from(JSON.stringify({ events: [event()] }));
    adapter.accept(raw, sign(raw)); await adapter.drain();
    assert.doesNotMatch(JSON.stringify({ reply, logs }), /private.invalid|token-secret/);
    assert.match(reply, error instanceof DemoFailure ? /นานเกินไป/ : /ยังตอบไม่ได้/);
  }
});

test('LINE verifies raw bytes before parsing; mock reply, dedupe and user isolation', async () => {
  const identities: unknown[] = [];
  const replies: string[] = [];
  const logs: object[] = [];
  const adapter = new LineAdapter({ secret, account: 'test-oa', dryRun: false, allowedUsers: new Set(['allowed', 'second']),
    core: { client(identity) { identities.push(identity); return { send: async (_q, out) => { out.text('คำตอบจำลอง'); }, abort: async () => {} }; } },
    reply: async (_token, text) => { replies.push(text); }, log: r => logs.push(r),
  });
  const raw = Buffer.from(JSON.stringify({ events: [event()] }));
  assert.equal(adapter.accept(raw, undefined), 401);
  assert.equal(adapter.accept(raw, sign(Buffer.from('different'))), 401);
  assert.equal(validSignature(Buffer.concat([raw, Buffer.from(' ')]), sign(raw), secret), false);
  assert.equal(adapter.accept(Buffer.from('bad json'), sign(Buffer.from('bad json'))), 400);
  assert.equal(identities.length, 0);
  // Exercise HTTP raw-body collection with split chunks, without starting a public listener.
  const request = Readable.from([raw.subarray(0, 10), raw.subarray(10)]) as IncomingMessage;
  request.url = '/webhook/line'; request.method = 'POST'; request.headers = { 'x-line-signature': sign(raw) };
  let code = 0;
  const response = { writeHead(n: number) { code = n; return this; }, end() {} } as unknown as ServerResponse;
  await webhookHandler(adapter)(request, response);
  assert.equal(code, 200);
  assert.equal(adapter.accept(raw, sign(raw)), 200);
  await adapter.drain();
  assert.deepEqual(replies, ['คำตอบจำลอง']);
  const next = Buffer.from(JSON.stringify({ events: [event('e2', 'second'), event('e3', 'blocked'), { ...event('e4'), source: { type: 'group', groupId: 'g', userId: 'allowed' } }] }));
  adapter.accept(next, sign(next)); await adapter.drain();
  assert.equal(identities.length, 2);
  assert.notDeepEqual(identities[0], identities[1]);
  assert.doesNotMatch(JSON.stringify(logs), /test-reply|allowed|ขอใบเสร็จ|test-only-channel/);
  const empty = Buffer.from('{"events":[]}');
  assert.equal(adapter.accept(empty, sign(empty)), 200);
});

test('LINE dry-run sends nothing and failed replies are not retried automatically', async () => {
  let calls = 0;
  const options = { secret, account: 'test', allowedUsers: new Set(['allowed']),
    core: { client: () => ({ send: async (_p: string, out: { text: (s: string) => void }) => { out.text('ok'); }, abort: async () => {} }) },
    reply: async () => { calls++; throw new Error('simulated'); },
  };
  const raw = Buffer.from(JSON.stringify({ events: [event()] }));
  const dry = new LineAdapter({ ...options, dryRun: true });
  dry.accept(raw, sign(raw)); await dry.drain(); assert.equal(calls, 0);
  const liveMock = new LineAdapter({ ...options, dryRun: false });
  liveMock.accept(raw, sign(raw)); await liveMock.drain();
  liveMock.accept(raw, sign(raw)); await liveMock.drain(); assert.equal(calls, 1);
});

test('reply client uses fixed LINE endpoint with bounded plain text and mocked fetch only', async () => {
  const calls: unknown[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.line.me/v2/bot/message/reply');
    assert.equal(init?.method, 'POST');
    const body = JSON.parse(init?.body as string);
    assert.equal(body.replyToken, 'reply-placeholder');
    assert.equal(body.messages[0].text.length, 4500);
    calls.push(body);
    return new Response('{}', { status: 200 });
  };
  await lineReply('access-placeholder', fakeFetch)('reply-placeholder', 'a'.repeat(6000));
  assert.equal(calls.length, 1);
});
