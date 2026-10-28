import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { Script } from 'node:vm';
import { CustomerStore, CustomerError, customerId, localActor } from './customers.js';
import { ConversationMonitor, type MonitorEvent } from './monitor.js';
import { CourseRequestStore, type CourseRequest } from './course-requests.js';
import { adminHandler, adminPage } from './admin.js';

const event = (account = 'test-oa', userId = 'test-person'): MonitorEvent => ({ id: 'test-event', account, userId, at: new Date().toISOString(), direction: 'in', text: 'fixture-only', status: 'received' });
const sources = () => ({ events: [event(), event('other-oa'), event('test-oa', 'second-person')], requests: [] as CourseRequest[] });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cbtu-customers-'));
  const store = new CustomerStore(join(root, 'customers'));
  const source = sources(); let snapshot = store.snapshot(source);
  const id = snapshot.customers[0].id;
  return { root, store, source, id, get: () => (snapshot = store.snapshot(source)),
    change(action: string, data: object, target = id) { store.mutate({ revision: store.snapshot(source).revision, action, id: target, data }); return store.snapshot(source); },
    clean() { rmSync(root, { recursive: true, force: true }); } };
}

test('registry discovers only actual monitor/request identities, isolates OA/channel, and persists after history expires', () => {
  const f = fixture();
  try {
    assert.equal(f.get().customers.length, 3);
    const identity = { channel: 'line' as const, scope: 'test-oa:direct', user: 'test-person' };
    assert.equal(f.id, customerId(identity));
    assert.notEqual(f.id, customerId({ ...identity, channel: 'terminal' }));
    const request = { owner: { ...identity, channel: 'terminal' }, id: 'fixture-request' } as CourseRequest;
    const snapshot = f.store.snapshot({ events: [event()], requests: [request] });
    assert.equal(snapshot.customers.length, 4);
    assert.equal(snapshot.customers.find(c => c.identity.channel === 'terminal')?.requestCount, 1);
    assert.equal(snapshot.customers.find(c => c.id === f.id)?.requestCount, 0);
    const restarted = new CustomerStore(join(f.root, 'customers')).snapshot({ events: [], requests: [] });
    assert.equal(restarted.customers.length, 4);
    assert.ok(restarted.customers.every(c => c.lastContactAt === null && c.displayName === null && c.consent === 'unknown'));
    assert.equal(restarted.authenticated, false); assert.equal(restarted.actor, localActor); assert.equal(restarted.pushEnabled, false);
    assert.equal(statSync(join(f.root, 'customers')).mode & 0o777, 0o700);
    assert.equal(statSync(join(f.root, 'customers/customers.json')).mode & 0o777, 0o600);
  } finally { f.clean(); }
});

test('profile edits track field provenance, preserve unknowns and reject invalid email/stale whole-form overwrite', () => {
  const f = fixture();
  try {
    const previous = f.get();
    const profile = { ...previous.customers[0].profile, nickname: 'ชื่อจากทีม' };
    f.change('profile.update', { profile, source: 'ทีมตั้งชื่อเรียก', reference: 'ชื่อที่ทีมใช้ดูแล' });
    const snapshot = f.get(), c = snapshot.customers[0];
    assert.equal(c.profile.nickname, 'ชื่อจากทีม'); assert.equal(c.provenance.nickname?.source, 'ทีมตั้งชื่อเรียก');
    assert.equal(c.provenance.email, undefined); assert.equal(c.profile.email, '');
    assert.equal(c.profileHistory[0].value, ''); assert.equal(snapshot.customers[1].profile.nickname, '');
    assert.throws(() => f.store.mutate({ revision: previous.revision, action: 'profile.update', id: f.id, data: { profile, source: 'ลูกค้าแจ้ง', reference: '' } }), (e: any) => e.status === 409);
    assert.throws(() => f.change('profile.update', { profile: { ...profile, email: 'wrong' }, source: 'ลูกค้าแจ้ง', reference: '' }), /อีเมล/);
    assert.throws(() => f.change('profile.update', { profile: { ...profile, fullName: 'ห้ามเหมารวมที่มา' }, source: 'ทีมตั้งชื่อเรียก', reference: '' }), /เฉพาะชื่อ/);
    assert.deepEqual(f.get().customers[0], c);
  } finally { f.clean(); }
});

test('notes keep customer statements separate from observations with server actor/time, edit revisions and deletion trail', () => {
  const f = fixture();
  try {
    f.change('note.add', { kind: 'customer', text: '<img src=x onerror=alert(1)> ลูกค้าแจ้ง', reference: 'บทสนทนาที่ทีมระบุ', actor: 'ปลอมชื่อ', createdAt: '2000-01-01' });
    const note = f.get().customers[0].notes[0];
    assert.equal(note.actor, localActor); assert.notEqual(note.createdAt, '2000-01-01');
    f.change('note.update', { noteId: note.id, kind: 'observation', text: 'ข้อสังเกตของทีม', reference: '' });
    let edited = f.get().customers[0].notes[0];
    assert.equal(edited.kind, 'observation'); assert.equal(edited.revisions[0].text, note.text); assert.equal(edited.revisions[0].kind, 'customer');
    assert.ok(edited.updatedAt);
    f.change('note.delete', { noteId: note.id });
    edited = f.get().customers[0].notes[0]; assert.ok(edited.deletedAt); assert.equal(edited.text, 'ข้อสังเกตของทีม');
    assert.throws(() => f.change('note.update', { noteId: note.id, kind: 'customer', text: 'revive', reference: '' }), /ไม่พบโน้ต/);
    assert.throws(() => f.change('note.add', { kind: 'prediction', text: 'เดาซื้อ', reference: '' }), /ประเภท/);
    assert.throws(() => f.change('note.add', { kind: 'customer', text: ' ', reference: '' }), /กรอก/);
    assert.equal(f.get().customers[1].notes.length, 0);
    assert.deepEqual(readdirSync(f.root), ['customers']); // No memory, monitor or requests writes.
  } finally { f.clean(); }
});

test('manual groups support many memberships, atomic bulk add/remove, tags, duplicate validation and safe group deletion', () => {
  const f = fixture();
  try {
    f.change('group.create', { name: 'กลุ่มหนึ่ง', description: '' });
    f.change('group.create', { name: 'กลุ่มสอง', description: 'หมวดหมู่ในระบบ' });
    const [one, two] = f.get().groups;
    assert.throws(() => f.change('group.create', { name: 'กลุ่มหนึ่ง', description: '' }), /ชื่อนี้/);
    f.change('memberships.update', { groupIds: [one.id, two.id] });
    f.change('tags.update', { tags: ['AI', 'AI', 'Excel'] });
    assert.deepEqual(f.get().customers[0].tags, ['AI', 'Excel']);
    const other = f.get().customers[1].id;
    f.change('group.members', { customerIds: [other] }, one.id);
    assert.deepEqual(f.get().customers[0].groupIds, [two.id]);
    assert.deepEqual(f.get().customers[1].groupIds, [one.id]);
    assert.throws(() => f.change('group.members', { customerIds: ['unknown'] }, one.id), /ไม่พบลูกค้า/);
    assert.throws(() => f.change('memberships.update', { groupIds: ['unknown'] }), /ไม่พบกลุ่ม/);
    f.change('group.update', { name: 'ชื่อใหม่', description: 'แก้แล้ว' }, two.id);
    f.change('group.delete', {}, two.id);
    const s = f.get(); assert.equal(s.customers.length, 3); assert.deepEqual(s.customers[0].groupIds, []); assert.deepEqual(s.customers[0].tags, ['AI', 'Excel']);
    assert.ok(s.customers.every(c => c.consent === 'unknown'));
  } finally { f.clean(); }
});

test('subscription requires evidence and retains every confirmed state without creating consent through groups/tags', () => {
  const f = fixture();
  try {
    assert.throws(() => f.change('consent.update', { status: 'subscribed', evidence: '' }), /กรอก/);
    assert.throws(() => f.change('consent.update', { status: 'unsubscribed', evidence: ' ' }), /กรอก/);
    f.change('consent.update', { status: 'subscribed', evidence: 'ข้อความยืนยันรับข่าวที่ทีมตรวจแล้ว' });
    f.change('consent.update', { status: 'unsubscribed', evidence: 'ข้อความขอยกเลิก' });
    f.change('consent.update', { status: 'unknown', evidence: 'ยังตรวจสอบที่มาไม่ได้' });
    const c = f.get().customers[0]; assert.equal(c.consent, 'unknown'); assert.equal(c.consentHistory.length, 3);
    assert.ok(c.consentHistory.every(h => h.actor === localActor && Number.isFinite(Date.parse(h.at))));
  } finally { f.clean(); }
});

test('corrupted/symlink stores and competing writes fail closed without replacing existing records', () => {
  const f = fixture();
  try {
    const file = join(f.root, 'customers/customers.json'), before = readFileSync(file, 'utf8');
    const second = new CustomerStore(join(f.root, 'customers'));
    const old = second.snapshot(f.source).revision;
    f.change('tags.update', { tags: ['first'] });
    assert.throws(() => second.mutate({ revision: old, action: 'tags.update', id: f.id, data: { tags: ['second'] } }), (e: any) => e.status === 409);
    assert.deepEqual(f.get().customers[0].tags, ['first']);
    writeFileSync(join(f.root, 'customers/.write-lock'), '');
    assert.throws(() => f.get(), (e: any) => e.status === 409);
    rmSync(join(f.root, 'customers/.write-lock'));
    writeFileSync(file, '{broken');
    assert.throws(() => new CustomerStore(join(f.root, 'customers')), (e: any) => e.status === 503);
    assert.equal(readFileSync(file, 'utf8'), '{broken');
    writeFileSync(file, before);
    const linked = join(f.root, 'linked'); symlinkSync(join(f.root, 'customers'), linked);
    assert.throws(() => new CustomerStore(linked), /Unsafe/);
  } finally { f.clean(); }
});

test('integrated admin JavaScript parses and keeps five main tabs, same-origin endpoints and safe text rendering', () => {
  const html = adminPage('fixture-token');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  assert.doesNotThrow(() => new Script(script));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 5);
  for (const label of ['ภาพรวม', 'บทสนทนา', 'ลูกค้าและกลุ่ม', 'งานรอดูแล', 'ส่งข่าว']) assert.ok(html.includes(label));
  assert.ok(html.includes("fetch('/api/customers'")); assert.ok(html.includes('n.textContent=text'));
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(html, /127\.0\.0\.1:3002|<iframe/);
});

test('customer HTTP writes require exact host, same origin, token and JSON; malformed input and persistence errors are explicit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'customer-http-'));
  const monitor = new ConversationMonitor(join(root, 'monitor')), requests = new CourseRequestStore(join(root, 'requests')), customers = new CustomerStore(join(root, 'customers'));
  monitor.record(event()); const monitorBefore = readFileSync(join(root, 'monitor/monitor.json'), 'utf8');
  const server = createServer(adminHandler(monitor, requests, customers));
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number }, url = 'http://127.0.0.1:' + address.port;
    const html = await (await fetch(url)).text(), token = html.match(/const CUSTOMER_CSRF_TOKEN="([a-f0-9]+)"/)![1];
    let state = await (await fetch(url + '/api/customers')).json();
    const payload = { action: 'note.add', id: state.customers[0].id, revision: state.revision, data: { kind: 'customer', text: 'fixture-only', reference: '' } };
    const headers = { Origin: url, 'Content-Type': 'application/json', 'X-Customer-Token': token };
    const post = (h: Record<string, string>, body = JSON.stringify(payload)) => fetch(url + '/api/customers', { method: 'POST', headers: h, body });
    assert.equal((await post({ 'Content-Type': 'application/json' })).status, 403);
    assert.equal((await post({ ...headers, Origin: 'http://foreign.invalid' })).status, 403);
    assert.equal((await post({ ...headers, 'X-Customer-Token': 'wrong' })).status, 403);
    assert.equal((await post({ ...headers, 'Content-Type': 'text/plain' })).status, 403);
    assert.equal((await post(headers, '{broken')).status, 400);
    assert.equal((await post(headers, 'x'.repeat(33000))).status, 413);
    assert.equal((await post({ ...headers, 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    const foreignStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(url + '/api/customers', { headers: { Host: 'foreign.invalid' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(foreignStatus, 403);
    assert.equal((await post(headers)).status, 200);
    assert.equal((await post(headers)).status, 409); // No duplicate note on replay.
    state = await (await fetch(url + '/api/customers')).json(); assert.equal(state.customers[0].notes.length, 1);
    assert.equal((await fetch(url + '/api/customers', { method: 'DELETE', headers })).status, 405);
    assert.equal((await fetch(url + '/api/monitor')).status, 200); assert.equal((await fetch(url + '/api/requests')).status, 200);
    assert.equal(readFileSync(join(root, 'monitor/monitor.json'), 'utf8'), monitorBefore); assert.deepEqual(requests.list(), []);
    writeFileSync(join(root, 'customers/customers.json'), '{broken');
    const response = await fetch(url + '/api/customers'); assert.equal(response.status, 503); assert.match((await response.json()).error, /อ่านทะเบียน/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
});
