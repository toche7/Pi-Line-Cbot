import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CourseRequestStore, CourseRequests, type CourseRequest } from './course-requests.js';
import { requestsAdminHandler } from './requests-admin.js';
import { CustomerCore, type Identity } from './core.js';
import { MemoryStore } from './memory.js';
import { LineAdapter } from './line.js';
import { commandHelp } from './command-help.js';

const owner: Identity = { channel: 'line', scope: 'fixture:direct', user: 'A' };
const token = (text: string) => { const match = text.match(/\/confirm-request ([A-F0-9]{8})/); assert.ok(match, text); return match[1]; };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cbot-requests-')); let clock = Date.now();
  const store = new CourseRequestStore(join(root, 'requests'), () => clock), requests = new CourseRequests(store, () => clock);
  return { root, store, requests, send: (q: string, who = owner) => requests.handle(who, q), tick: (ms: number) => { clock += ms; },
    close: () => rmSync(root, { recursive: true, force: true }) };
}

test('booking requires a reviewed fresh confirmation and persists one immutable central request with no dispatch', () => {
  const f = fixture();
  try {
    const preview = f.send('อยากจองคอร์ส Excel')!;
    assert.match(preview, /Microsoft Excel/); assert.match(preview, /ยังไม่ส่งอีเมล\/LINE/);
    assert.equal(f.store.list().length, 0);
    assert.match(f.send('ยืนยัน')!, /ยังไม่ได้บันทึกคำขอ/); assert.equal(f.store.list().length, 0);
    const confirm = '/confirm-request ' + token(preview);
    assert.match(f.send(confirm)!, /บันทึกคำขอในระบบกลางแล้ว/);
    assert.match(f.send(confirm)!, /บันทึกคำขอในระบบกลางแล้ว/);
    const records = new CourseRequestStore(f.store.root).list(); assert.equal(records.length, 1);
    const r = records[0]; assert.equal(r.course!.id, 'cbtu-06'); assert.equal(r.kind, 'booking');
    assert.equal(r.status, 'pending_team'); assert.deepEqual(r.delivery, { channel: null, status: 'not_selected' });
    assert.match(r.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(statSync(join(f.store.root, r.id + '.json')).mode & 0o777, 0o600);
    assert.equal(statSync(f.store.root).mode & 0o777, 0o700);
    assert.match(f.send('/cancel-request')!, /คำขอที่บันทึกแล้ว/); assert.equal(f.store.list().length, 1);
    assert.match(f.send('/requests')!, new RegExp(r.id));
  } finally { f.close(); }
});

test('ambiguous courses and contact notes are explicit; edits invalidate old consent; secrets are refused', () => {
  const f = fixture();
  try {
    assert.match(f.send('/book n8n')!, /เลือกหลักสูตร/);
    const preview = f.send('2')!, old = token(preview); assert.match(preview, /Workshop/);
    const edited = f.send('/request-note ต้องการสอบถามรอบเรียน')!, updated = token(edited);
    assert.notEqual(old, updated); assert.match(f.send('/confirm-request ' + old)!, /รหัสไม่ถูกต้อง/);
    f.send('/confirm-request ' + updated); assert.equal(f.store.list()[0].message, 'ต้องการสอบถามรอบเรียน');
    assert.match(f.send('/contact')!, /ฝากเรื่องอะไร/);
    const note = f.send('ต้องการสอบถามเรื่องการจอง Excel')!; assert.match(note, /ฝากเรื่องให้ทีมงาน/);
    f.send('/confirm-request ' + token(note)); assert.equal(f.store.list().filter(r => r.kind === 'contact').length, 1);
    const count = f.store.list().length;
    assert.match(f.send('/contact API_KEY=private-fixture-secret')!, /กรุณาไม่ใส่/);
    assert.match(f.send('/book Quantum Computing')!, /หลักสูตรไหน/);
    assert.match(f.send('/cancel-request')!, /ยกเลิกฉบับร่าง/);
    assert.equal(f.store.list().length, count);
    assert.doesNotMatch(readdirSync(f.store.root).map(n => readFileSync(join(f.store.root, n), 'utf8')).join(''), /private-fixture-secret/);
  } finally { f.close(); }
});

test('confirmation is bound to user/OA/channel and expires; a restart discards unsigned drafts', () => {
  const f = fixture();
  try {
    const code = token(f.send('/book Canva')!);
    for (const other of [{ ...owner, user: 'B' }, { ...owner, scope: 'other:direct' }, { ...owner, channel: 'terminal' as const }]) {
      assert.match(f.send('/confirm-request ' + code, other)!, /ไม่มีคำขอ/); assert.deepEqual(f.store.list(other), []);
    }
    assert.match(new CourseRequests(f.store).handle(owner, '/confirm-request ' + code)!, /ไม่มีคำขอ/);
    f.tick(5 * 60_000 + 1); assert.match(f.send('/confirm-request ' + code)!, /ไม่มีคำขอ/);
    assert.equal(f.store.list().length, 0);
    const second = token(f.send('/book Excel')!); f.send('ขอคุยเรื่องอื่นก่อน');
    assert.match(f.send('/confirm-request ' + second)!, /ไม่มีคำขอ/);
  } finally { f.close(); }
});

test('failed and ambiguous writes never falsely confirm; retry is idempotent and cannot overwrite another owner', () => {
  const f = fixture();
  class FaultStore extends CourseRequestStore {
    fail = true;
    override save(row: CourseRequest) { const saved = super.save(row); if (this.fail) throw new Error('private error'); return saved; }
  }
  try {
    const store = new FaultStore(f.store.root), requests = new CourseRequests(store);
    const code = token(requests.handle(owner, '/contact ขอคำแนะนำจากทีมงาน')!);
    assert.match(requests.handle(owner, '/confirm-request ' + code)!, /ยังยืนยันการบันทึกไม่ได้/);
    assert.equal(store.list().length, 1); store.fail = false;
    assert.match(requests.handle(owner, '/confirm-request ' + code)!, /บันทึกคำขอในระบบกลางแล้ว/);
    assert.equal(store.list().length, 1);
    const original = store.list()[0];
    assert.throws(() => store.save({ ...original, owner: { ...owner, user: 'B' } }));
    assert.deepEqual(store.list()[0], original);
    const copy = new CourseRequestStore(store.root); assert.deepEqual(copy.list()[0], original);
  } finally { f.close(); }
});

test('shared store retains separate writers and prunes only expired records; forget also removes expired own data', () => {
  const f = fixture();
  try {
    f.send('/confirm-request ' + token(f.send('/book Excel')!));
    const b = { ...owner, user: 'B' }, other = new CourseRequests(new CourseRequestStore(f.store.root));
    other.handle(b, '/confirm-request ' + token(other.handle(b, '/contact ขอให้ติดต่อกลับ')!));
    assert.equal(f.store.list().length, 2);
    f.requests.forget(owner); assert.equal(f.store.list().length, 1); assert.equal(f.store.list()[0].owner.user, 'B');
    const row = f.store.list()[0]; row.createdAt = new Date(Date.now() - 91 * 86400000).toISOString();
    writeFileSync(join(f.store.root, row.id + '.json'), JSON.stringify(row));
    f.requests.forget(b); assert.deepEqual(readdirSync(f.store.root), []);
  } finally { f.close(); }
});

test('signed LINE intake uses no model, preserves memory/context, resets drafts and confirmed forget removes only own requests', async () => {
  const f = fixture(), memory = new MemoryStore(join(f.root, 'memory')); let calls = 0;
  const core = new CustomerCore(async () => { calls++; throw new Error('Intake must not call model'); }, 1000, undefined, undefined, memory, undefined, f.requests);
  const replies: string[] = [], secret = 'request-test-only'; let event = 0;
  const adapter = new LineAdapter({ core, secret, account: 'fixture', allowedUsers: new Set(['A', 'B']), dryRun: false,
    reply: async (_token, text) => { replies.push(text); } });
  const send = async (text: string, userId = 'A', id = `request-${event++}`) => {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: id, replyToken: 'mock-only', source: { type: 'user', userId }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', secret).update(raw).digest('base64')), 200); await adapter.drain(); return replies.at(-1)!;
  };
  try {
    const code = token(await send('/book Excel'));
    await send('/confirm-request ' + code, 'A', 'dedupe-request'); await send('/confirm-request ' + code, 'A', 'dedupe-request');
    assert.equal(f.store.list().length, 1); assert.doesNotMatch(await send('/requests', 'B'), /Microsoft Excel/);
    assert.match(await send('/help'), /\/book/); assert.equal(calls, 0);
    assert.deepEqual(JSON.parse(await core.client(owner).memory!()).recent, []);
    const old = token(await send('/book Canva')); await send('/reset');
    assert.match(await send('/confirm-request ' + old), /ไม่มีคำขอ/); assert.equal(f.store.list().length, 1);
    assert.match(await send('/forget'), /คำขอในระบบกลาง/); await send('/cancel');
    assert.equal(f.store.list().length, 1); await send('/forget'); await send('/confirm-forget');
    assert.equal(f.store.list().length, 0); assert.equal(calls, 0);
    assert.doesNotMatch(commandHelp('line', { send: async () => {}, abort: async () => {} }), /\/book/);
  } finally { adapter.close(); await core.dispose(); memory.close(); f.close(); }
});

test('central admin is read-only, loopback/same-origin only and renders request text as data', () => {
  const f = fixture();
  try {
    const note = '<img src=x onerror=alert(1)>'; f.send('/confirm-request ' + token(f.send('/contact ' + note)!));
    const handler = requestsAdminHandler(f.store);
    const call = (url: string, host = '127.0.0.1:3002', method = 'GET', origin?: string) => {
      let code = 0, body = ''; const res = { writeHead(n: number) { code = n; return this; }, end(text = '') { body = text; } };
      handler({ url, method, headers: { host, ...(origin ? { origin } : {}) } } as IncomingMessage, res as unknown as ServerResponse); return { code, body };
    };
    assert.equal(call('/', 'evil.test').code, 403); assert.equal(call('/api/requests', undefined, 'GET', 'https://evil.test').code, 403);
    assert.equal(call('/api/requests', undefined, 'POST').code, 405);
    const api = call('/api/requests'); assert.equal(api.code, 200); assert.equal(JSON.parse(api.body).requests[0].message, note);
    assert.equal(JSON.parse(api.body).deliveryEnabled, false);
    const html = call('/'); assert.equal(html.code, 200); assert.doesNotMatch(html.body, /<img src=x/); assert.doesNotMatch(html.body, /innerHTML/);
  } finally { f.close(); }
});
