import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConversationMonitor, monitorHandler, type MonitorEvent } from './monitor.js';
import { LineAdapter } from './line.js';

test('monitor persists bounded history with restrictive permissions and removes expired history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monitor-'));
  try {
    const m = new ConversationMonitor(dir);
    const base: MonitorEvent = { id: 'e', account: 'oa', userId: 'u', direction: 'in', text: '<script>secret</script>', status: 'received', at: new Date().toISOString() };
    m.record({ ...base, at: '2000-01-01T00:00:00.000Z' }); m.record(base);
    assert.deepEqual(new ConversationMonitor(dir).snapshot().events, [base]);
    assert.equal(statSync(join(dir, 'monitor.json')).mode & 0o777, 0o600);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
    assert.equal(m.snapshot().pushEnabled, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('monitor rejects foreign hosts, origins, mutations and webhook paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monitor-'));
  try {
    const handler = monitorHandler(new ConversationMonitor(dir));
    function request(url: string, host = '127.0.0.1:3001', origin?: string, method = 'GET') {
      let status = 0, body = '';
      handler({ url, method, headers: { host, origin } } as IncomingMessage,
        { writeHead(n: number) { status = n; return this; }, end(s = '') { body = s; } } as unknown as ServerResponse);
      return { status, body };
    }
    assert.equal(request('/api/monitor').status, 200);
    assert.equal(request('/api/monitor', 'attacker.invalid').status, 403);
    assert.equal(request('/api/monitor', undefined, 'https://attacker.invalid').status, 403);
    assert.equal(request('/api/monitor', undefined, undefined, 'POST').status, 405);
    assert.equal(request('/webhook/line').status, 404);
    assert.match(request('/').body, /createTextNode/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('monitor observes only verified fresh allowlisted messages and distinguishes delivery outcomes', async () => {
  for (const mode of ['sent', 'failed', 'dry'] as const) {
    const observations: MonitorEvent[] = [];
    const adapter = new LineAdapter({ secret: 'fixture', account: 'oa', allowedUsers: new Set(['u']), dryRun: mode === 'dry',
      observe: e => observations.push(e), core: { client: () => ({ send: async (_text, out) => { out.text('answer'); }, abort: async () => {} }) },
      reply: async () => { if (mode === 'failed') throw new Error('private'); } });
    const body = Buffer.from(JSON.stringify({ events: ['u', 'blocked'].map(userId => ({ type: 'message', webhookEventId: userId, replyToken: 'private-token', source: { type: 'user', userId }, message: { type: 'text', text: 'question' } })) }));
    const signature = createHmac('sha256', 'fixture').update(body).digest('base64');
    assert.equal(adapter.accept(body, 'invalid'), 401);
    adapter.accept(body, signature); adapter.accept(body, signature); await adapter.drain();
    assert.deepEqual(observations.map(e => e.status), ['received', mode === 'sent' ? 'replied' : mode === 'failed' ? 'reply_failed_no_retry' : 'dry_run_no_send']);
    assert.doesNotMatch(JSON.stringify(observations), /private-token|blocked/);
    adapter.close();
  }
});
