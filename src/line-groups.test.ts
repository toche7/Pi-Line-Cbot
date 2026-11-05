import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { LineGroupStore, LineGroupService, lineGroupsHandler } from './line-groups.js';
import { LineAdapter } from './line.js';
import { adminPage } from './admin.js';
import { Script } from 'node:vm';

const groupId = 'C' + 'a'.repeat(32), otherId = 'C' + 'b'.repeat(32), userId = 'U' + 'c'.repeat(32);
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'line-rooms-')); let now = Date.now();
  const store = new LineGroupStore(root, 'oa', () => now);
  return { root, store, now: () => now, advance: (ms: number) => { now += ms; }, clean: () => rmSync(root, { recursive: true, force: true }) };
}
test('existing captured room loads without fabricated history; group records persist separate messages, dedupe and lifecycle', () => {
  const f = setup();
  try {
    writeFileSync(join(f.root, groupId + '.json'), JSON.stringify({ groupId, seenAt: new Date(f.now()).toISOString() }), { mode: 0o600 });
    assert.deepEqual(f.store.list()[0].messages, []);
    const at = new Date(f.now()).toISOString();
    f.store.observe({ groupId, eventId: 'one', type: 'message', userId, text: 'actual fixture text', at });
    f.store.observe({ groupId, eventId: 'one', type: 'message', userId, text: 'duplicate text', at });
    f.store.saveName(groupId, 'ชื่อห้อง fixture');
    f.store.observe({ groupId, type: 'join', at });
    assert.equal(f.store.list()[0].status, 'joined');
    f.advance(1000); f.store.observe({ groupId, type: 'leave', at: new Date(f.now()).toISOString() });
    f.store.observe({ groupId, eventId: 'one', type: 'message', text: 'old redelivery', at });
    let room = new LineGroupStore(f.root, 'oa', f.now).list()[0];
    assert.equal(room.status, 'left'); assert.equal(room.messages?.length, 1); assert.equal(room.name, 'ชื่อห้อง fixture');
    assert.equal(statSync(join(f.root, groupId + '.json')).mode & 0o777, 0o600);
    assert.equal(new LineGroupStore(f.root, 'other-oa', f.now).list().length, 0);
    f.advance(91 * 86400000); room = f.store.list()[0]; assert.deepEqual(room.messages, []);
    f.store.observe({ groupId, type: 'message', eventId: 'new', text: 'กลับเข้ามา', at: new Date(f.now()).toISOString() });
    assert.equal(f.store.list()[0].status, 'observed'); assert.equal(f.store.list()[0].leftAt, undefined);
    writeFileSync(join(f.root, groupId + '.json'), '{broken');
    assert.throws(() => f.store.list()); assert.equal(readFileSync(join(f.root, groupId + '.json'), 'utf8'), '{broken');
  } finally { f.clean(); }
});

test('only signed group events reach read-only group storage, never direct monitor, model, customer or reply', async () => {
  const f = setup(); let replies = 0, coreCalls = 0, directEvents = 0;
  const adapter = new LineAdapter({ secret: 'fixture', account: 'oa', allowedUsers: new Set([userId]), dryRun: false,
    observeGroup: e => f.store.observe(e), observe: () => directEvents++, core: { client: () => { coreCalls++; throw Error('unexpected'); } }, reply: async () => { replies++; } });
  const raw = Buffer.from(JSON.stringify({ events: [
    { type: 'message', webhookEventId: 'one', timestamp: f.now(), source: { type: 'group', groupId, userId }, message: { type: 'text', text: '<script>group fixture</script>' }, replyToken: 'do-not-use' },
    { type: 'message', mode: 'standby', webhookEventId: 'standby', source: { type: 'group', groupId }, message: { type: 'text', text: 'standby must not store' } },
    { type: 'message', source: { type: 'group', groupId: '../../escape' }, message: { type: 'text', text: 'bad' } },
  ] }));
  try {
    assert.equal(adapter.accept(raw, 'bad'), 401); assert.equal(f.store.list().length, 0);
    const sig = createHmac('sha256', 'fixture').update(raw).digest('base64');
    assert.equal(adapter.accept(raw, sig), 200); adapter.accept(raw, sig); await adapter.drain();
    const room = f.store.list()[0]; assert.equal(room.messages?.length, 1); assert.equal(room.messages?.[0].userId, userId);
    assert.equal(replies + coreCalls + directEvents, 0); assert.doesNotMatch(readFileSync(join(f.root, groupId + '.json'), 'utf8'), /do-not-use|standby/);
  } finally { adapter.close(); f.clean(); }
});

test('room summary uses fixed GET, verifies group identity, caches names and retains last good name on errors', async () => {
  const f = setup(); let calls = 0, fail = false;
  try {
    f.store.observe({ groupId, type: 'join', at: new Date(f.now()).toISOString() });
    const service = new LineGroupService(f.store, 'fixture-token', (async (url: any, init: any) => {
      calls++; assert.equal(url, 'https://api.line.me/v2/bot/group/' + groupId + '/summary'); assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer fixture-token'); assert.equal(init.redirect, 'error');
      return new Response(JSON.stringify({ groupId: fail ? otherId : groupId, groupName: 'ชื่อห้องจาก LINE fixture', pictureUrl: 'https://example.invalid' }));
    }) as typeof fetch, f.now);
    const first = await service.snapshot(); assert.equal(first.rooms[0].name, 'ชื่อห้องจาก LINE fixture'); assert.equal(first.replyEnabled, false); assert.equal(first.pushEnabled, false);
    await service.snapshot(); assert.equal(calls, 1);
    fail = true; f.advance(86400001); await service.snapshot(); assert.equal(calls, 2); assert.equal(f.store.list()[0].name, 'ชื่อห้องจาก LINE fixture');
    await service.snapshot(); assert.equal(calls, 2);
    await assert.rejects(service.refreshName(otherId));
    f.store.observe({ groupId, type: 'leave', at: new Date(f.now()).toISOString() });
    await assert.rejects(service.refreshName(groupId), /ออกจากห้อง/);
    assert.doesNotMatch(JSON.stringify(first), /fixture-token|example.invalid/);
  } finally { f.clean(); }
});

test('room API enforces local access, CSRF and refresh-only operations; integrated script parses', async () => {
  const f = setup(); f.store.observe({ groupId, type: 'join', at: new Date().toISOString() });
  const service = new LineGroupService(f.store, 'token', (async () => new Response(JSON.stringify({ groupId, groupName: 'ห้องทดสอบ' }))) as typeof fetch);
  const handler = lineGroupsHandler(service, 'csrf'), server = createServer(handler);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
    const state = await (await fetch(url)).json(); assert.equal(state.rooms.length, 1);
    assert.equal((await fetch(url, { headers: { Origin: 'https://foreign.invalid' } })).status, 403);
    const headers = { Origin: url, 'Content-Type': 'application/json', 'X-Customer-Token': 'csrf' };
    const post = (body: string, h = headers) => fetch(url, { method: 'POST', headers: h, body });
    assert.equal((await post('{}', { ...headers, 'X-Customer-Token': 'bad' })).status, 403);
    assert.equal((await post('{broken')).status, 400);
    assert.equal((await post(JSON.stringify({ action: 'send', groupId, text: 'must not send' }))).status, 400);
    assert.equal((await post(JSON.stringify({ action: 'refresh-name', groupId: otherId }))).status, 404);
    assert.equal((await post(JSON.stringify({ action: 'refresh-name', groupId }))).status, 200);
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 405);
    const html = adminPage('fixture'); new Script(html.match(/<script>([\s\S]*?)<\/script>/)![1]);
    assert.ok(html.includes('/api/line-groups')); assert.equal((html.match(/id="tab-[^"]+"[^>]*role="tab"/g) ?? []).length, 5);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); f.clean(); }
});

test('room mode revisions persist independently of incoming messages, reject stale changes and departed rooms', () => {
  const f=setup();try{
    f.store.observe({groupId,type:'join',at:new Date(f.now()).toISOString()});
    const saved=f.store.setReplyMode(groupId,'cbot','initial','staff:owner');
    f.store.observe({groupId,type:'message',eventId:'keep',userId,text:'retain context',at:new Date(f.now()).toISOString()});
    assert.equal(f.store.modeRevision(groupId),saved.revision);
    assert.throws(()=>f.store.setReplyMode(groupId,'off','initial'),/เปลี่ยนโหมด/);
    f.store.setReplyMode(groupId,'off',saved.revision);
    const restored=new LineGroupStore(f.root,'oa',f.now);
    assert.equal(restored.replyMode(groupId),undefined);assert.equal(restored.list()[0].messages?.[0].text,'retain context');
    assert.throws(()=>restored.setReplyMode(groupId,'invalid' as any,restored.modeRevision(groupId)),/ไม่ถูกต้อง/);
    f.advance(1);restored.observe({groupId,type:'leave',at:new Date(f.now()).toISOString()});
    assert.throws(()=>restored.setReplyMode(groupId,'mention',restored.modeRevision(groupId)),/ออกจากห้อง/);
  }finally{f.clean()}
});
