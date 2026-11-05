import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { createDemo } from './agent.js';
import { createCustomerCore as createRuntimeCore } from './customer-runtime.js';
import { CourseRequests, CourseRequestStore, requestCapabilityAnswer, requestCapabilityTopic } from './course-requests.js';
import { ConversationControl, conversationKey } from './conversation-control.js';
import { DemoFailure } from './diagnostics.js';
import { LineAdapter } from './line.js';
import { LineGroupStore } from './line-groups.js';
import { LineGroupReplies } from './line-group-replies.js';
import { MemoryStore } from './memory.js';
import type { SettingsBinding } from './response-settings.js';
import { capabilitiesTopic, renderCapabilities } from './capabilities.js';

// Retain coverage of the previous routing path explicitly while production defaults to grounded.
const createCustomerCore = (options: Parameters<typeof createRuntimeCore>[0] = {}) =>
  createRuntimeCore({ experimentalGrounding: false, ...options });

function factory(plans: object[], contexts: string[]) {
  return async (manager?: SessionManager, settings?: SettingsBinding) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager, settings });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context.messages));
      const plan = plans.shift();
      assert.ok(plan, 'host commands must not consume model calls');
      const message: AssistantMessage = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream();
      stream.push({ type: 'done', reason: 'stop', message });
      return stream;
    };
    return session;
  };
}

test('retained previous runtime uses model-first routing while preserving persistent memory, request confirmation and identity isolation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'customer-runtime-'));
  const contexts: string[] = [], logs: object[] = [];
  const requestsStore = new CourseRequestStore(join(root, 'requests'));
  const requests = new CourseRequests(requestsStore);
  const plans = [
    { intent: 'catalog_query', operation: 'list', scope: 'all', filters: [], limit: 3 },
    { intent: 'chat', reply: 'อยากให้ช่วยคัดเหลือสัก 2–3 ตัวไหมครับ' },
    { intent: 'chat', reply: 'คุณชื่อ Integrated-73 ครับ' },
    { intent: 'chat', reply: 'สวัสดีครับ' },
  ];
  const identity = { channel: 'terminal' as const, scope: 'local', user: 'A' };
  let store = new MemoryStore(join(root, 'memory'));
  const create = () => createCustomerCore({ store, requests, factory: factory(plans, contexts), log: value => logs.push(value) });
  let core = create();
  const send = async (text: string, user = 'A') => {
    let answer = '';
    await core.client({ ...identity, user }).send(text, { text: value => { answer += value; }, status() {} });
    return answer;
  };
  try {
    assert.equal(core.faqWithoutModel, false);
    await send('ฉันชื่อ Integrated-73');
    assert.match(await send('ขอดูหลักสูตรหน่อย'), /พบ 20 รายการ แสดง 1–3/);
    assert.match(await send('เยอะเลยนะ'), /ช่วยคัด/);
    const preview = await send('/book AI for Research');
    const token = preview.match(/confirm-request ([A-F0-9]+)/)?.[1];
    assert.ok(token); assert.equal(requestsStore.list().length, 0);
    await send('/confirm-request ' + token);
    assert.equal(requestsStore.list().length, 1);
    assert.deepEqual(requestsStore.list()[0].owner, identity);
    await core.dispose(); store.close();
    store = new MemoryStore(join(root, 'memory')); core = create();
    assert.match(await send('ฉันชื่ออะไร'), /Integrated-73/);
    assert.match(contexts[2], /Integrated-73/);
    assert.match(contexts[2], /ช่วยคัด/);
    assert.equal(requestsStore.list().length, 1);
    await send('hi', 'B');
    assert.doesNotMatch(contexts[3], /Integrated-73|ช่วยคัด/);
    assert.equal(contexts.length, 4);
    assert.ok(logs.some(value => (value as { dialogueMode?: string }).dialogueMode === 'model-first'));
  } finally { await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('signed direct LINE retains previous model-first coverage and retains host help, requests, waiting, pause/release and memory reset', async () => {
  const root = mkdtempSync(join(tmpdir(), 'line-customer-runtime-'));
  const store = new MemoryStore(join(root, 'memory'));
  const requestStore = new CourseRequestStore(join(root, 'requests'));
  const control = new ConversationControl(join(root, 'control'));
  const contexts: string[] = [], replies: string[] = [];
  const core = createCustomerCore({ store, requests: new CourseRequests(requestStore),
    factory: factory([
      { intent: 'catalog_query', operation: 'list', scope: 'all', filters: [], limit: 3 },
      { intent: 'chat', reply: 'ช่วยคัดตามงานที่ทำให้ได้นะครับ' },
    ], contexts), humanSupport: identity => ({ waiting: !!control.mode(conversationKey('oa', identity.user)).waiting }) });
  const adapter = new LineAdapter({ core, control, secret: 'test-only', account: 'oa', dryRun: false,
    allowedUsers: new Set(['A']), reply: async (_token, text) => { replies.push(text); } });
  let index = 0;
  const send = async (text: string) => {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: 'event-' + index++, replyToken: 'fake',
      source: { type: 'user', userId: 'A' }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', 'test-only').update(raw).digest('base64')), 200);
    await adapter.drain(); return replies.at(-1)!;
  };
  try {
    assert.match(await send('/help'), /คำสั่งซีบอต/);
    await send('ฉันชื่อ LINE-Integrated');
    assert.match(await send('ขอดูหลักสูตรหน่อย'), /พบ 20 รายการ/);
    assert.match(await send('เยอะเลยนะ'), /ช่วยคัด/);
    const preview = await send('/contact เรื่องทดสอบใน temp');
    const token = preview.match(/confirm-request ([A-F0-9]+)/)?.[1];
    assert.ok(token); assert.equal(requestStore.list().length, 0);
    await send('/confirm-request ' + token);
    assert.equal(requestStore.list().length, 1);
    assert.equal(requestStore.list()[0].owner.scope, 'oa:direct');
    const key = conversationKey('oa', 'A');
    control.change(key, true, 0);
    const before = replies.length;
    await send('ข้อความระหว่างรับช่วง');
    assert.equal(replies.length, before);
    await control.release(key, 1, async () => {});
    assert.match(await send('/memory'), /LINE-Integrated/);
    await send('ขอคุยกับเจ้าหน้าที่');
    assert.ok(control.mode(key).waiting);
    await send('/reset');
    assert.equal(control.mode(key).waiting, undefined);
    assert.match(await send('/memory'), /LINE-Integrated/);
    assert.equal(contexts.length, 2);
  } finally { adapter.close(); await adapter.drain(); await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('direct LINE failure message no longer promises model-free FAQ for ordinary model-first runtime', async () => {
  const replies: string[] = [];
  const core = createCustomerCore({ factory: async () => { throw new DemoFailure('Model rate limit reached (HTTP 429).'); } });
  const adapter = new LineAdapter({ core, secret: 'test-only', account: 'oa', allowedUsers: new Set(['A']), dryRun: false,
    reply: async (_token, text) => { replies.push(text); } });
  try {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: 'rate-limit', replyToken: 'fake',
      source: { type: 'user', userId: 'A' }, message: { type: 'text', text: 'สวัสดี' } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', 'test-only').update(raw).digest('base64')), 200);
    await adapter.drain();
    assert.match(replies[0], /โควตา/);
    assert.match(replies[0], /https:\/\/cbtumu.net\/faq\//);
    assert.doesNotMatch(replies[0], /ยังถาม FAQ ได้/);
  } finally { adapter.close(); await core.dispose(); }
});

test('signed LINE booking draft yields to capability questions and reactions without losing selection or creating a record', async () => {
  const root = mkdtempSync(join(tmpdir(), 'line-booking-dialogue-'));
  const requestStore = new CourseRequestStore(join(root, 'requests'));
  const requests = new CourseRequests(requestStore), contexts: string[] = [], replies: string[] = [];
  const core = createCustomerCore({ requests, factory: factory([
    { intent: 'chat', reply: 'รับคำขอจองให้ทีมงานได้หลังยืนยันครับ แต่ยังสมัครเรียนแทนไม่ได้' },
    { intent: 'identity' },
    { intent: 'chat', reply: 'สงสัยส่วนไหนครับ ถามต่อได้เลย' },
  ], contexts) });
  const adapter = new LineAdapter({ core, account: 'oa', secret: 'test-only', dryRun: false, allowedUsers: new Set(['A']),
    reply: async (_token, text) => { replies.push(text); } });
  let index = 0;
  const send = async (text: string) => {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: 'booking-' + index++, replyToken: 'fake',
      source: { type: 'user', userId: 'A' }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', 'test-only').update(raw).digest('base64')), 200);
    await adapter.drain(); return replies.at(-1)!;
  };
  try {
    assert.match(await send('/book'), /ต้องการขอจองหลักสูตรไหน/);
    assert.match(await send('จองได้แต่สมัครไม่ได้ใช่ไหม'), /ยังสมัครเรียนแทนไม่ได้/);
    assert.match(await send('เธอทำอะไรได้บ้าง'), /\/book/);
    assert.match(await send('อ้าว'), /สงสัยส่วนไหน/);
    assert.equal(contexts.length, 3);
    for (const context of contexts) {
      assert.match(context, /Host-provided request capabilities/);
      assert.match(context, /booking-course/);
    }
    assert.equal(requestStore.list().length, 0);
    const preview = await send('Excel');
    assert.match(preview, /Microsoft Excel/);
    assert.equal(requestStore.list().length, 0);
    const token = preview.match(/confirm-request ([A-F0-9]+)/)?.[1];
    assert.ok(token);
    await send('/confirm-request ' + token);
    assert.equal(requestStore.list().length, 1);
    assert.equal(contexts.length, 3, 'selection/confirmation remain host actions');
  } finally { adapter.close(); await core.dispose(); rmSync(root, { recursive: true, force: true }); }
});

test('ordinary Terminal entrypoint opens help/memory/exit in an isolated cwd without invoking a model turn', () => {
  const root = mkdtempSync(join(tmpdir(), 'ordinary-chat-cli-'));
  try {
    const child = spawnSync(process.execPath, [resolve('dist/main.js'), '--chat'], {
      cwd: root, encoding: 'utf8', input: '/help\n/memory\n/exit\n', timeout: 15000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /Conversation routing: grounded/);
    assert.match(child.stdout, /คำสั่งซีบอตใน Terminal/);
    assert.match(child.stdout, /จบแชตแล้ว/);
    assert.doesNotMatch(child.stderr, /กำลังส่งข้อความและรอคำตอบ/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('booking capability facts use the same host answer across typo/repeated questions and cannot be overridden by a model denial', async () => {
  const root = mkdtempSync(join(tmpdir(), 'booking-capability-'));
  const store = new CourseRequestStore(join(root, 'requests')), requests = new CourseRequests(store);
  const contexts: string[] = [];
  const mock = factory([
    { intent: 'identity' },
    { intent: 'knowledge', topic: requestCapabilityTopic.id, reply: 'จองไม่ได้ สมัครผ่านบอตไม่ได้เท่านั้น' },
    { intent: 'knowledge', topic: requestCapabilityTopic.id, reply: 'จองสำเร็จและชำระเงินแล้ว' },
  ], contexts);
  const core = createCustomerCore({ requests, factory: async (manager, binding) => {
    const session = await mock(manager, binding);
    assert.match(session.systemPrompt, /Application capabilities are different from model tool permissions/);
    assert.match(session.systemPrompt, /CAN prepare a booking\/contact REQUEST/);
    return session;
  } });
  const client = core.client({ channel: 'line', scope: 'fixture:direct', user: 'A' });
  const send = async (q: string) => { let answer = ''; await client.send(q, { text: s => answer += s, status() {} }); return answer.trim(); };
  try {
    assert.match(await send('เธอทำอะไรได้บ้าง'), /\/book/);
    assert.equal(await send('จองได้เรหอ'), requestCapabilityAnswer);
    assert.equal(await send('อะเหรอตกลงจองได้หรือจองไมไ่ด้'), requestCapabilityAnswer);
    assert.match(contexts[2], /prepareBookingRequest/);
    assert.match(contexts[2], /confirmSeat/);
    assert.match(contexts[2], /รับคำขอจองได้/);
    assert.equal(store.list().length, 0);
    assert.equal(requests.support({ channel: 'line', scope: 'fixture:direct', user: 'A' }).pendingStage, undefined);
  } finally { await core.dispose(); rmSync(root, { recursive: true, force: true }); }
});

test('what-can-you-do renders enabled customer capabilities and help rather than the identity paragraph, per channel', async () => {
  const root = mkdtempSync(join(tmpdir(), 'capabilities-summary-'));
  const requests = new CourseRequests(new CourseRequestStore(join(root, 'requests')));
  for (const channel of ['terminal', 'line'] as const) {
    const contexts: string[] = [];
    const core = createCustomerCore({ requests, factory: factory([
      { intent: 'knowledge', topic: capabilitiesTopic.id, reply: 'ส่งข่าวและชำระเงินให้ได้แล้ว' },
    ], contexts), humanSupport: channel === 'line' ? () => ({ waiting: false }) : undefined });
    try {
      let reply = '';
      await core.client({ channel, scope: channel === 'line' ? 'oa:direct' : 'local', user: 'A' }).send('ทำไรได้บ้าง', { text: s => reply += s, status() {} });
      for (const item of ['ค้น', 'เปรียบเทียบ', 'รับคำขอจอง', 'ความจำ', '/help', 'ชำระเงิน', 'ยืนยันที่นั่งแทนไม่ได้']) assert.ok(reply.includes(item), item);
      assert.doesNotMatch(reply, /ชื่ออังกฤษ|ส่งข่าวและชำระเงินให้ได้แล้ว/);
      if (channel === 'line') assert.match(reply, /ขอคุยกับเจ้าหน้าที่/);
      else assert.doesNotMatch(reply, /ขอคุยกับเจ้าหน้าที่/);
      assert.match(contexts[0], /Host-provided conversation capabilities/);
      assert.equal(requests.support({ channel, scope: channel === 'line' ? 'oa:direct' : 'local', user: 'A' }).pendingStage, undefined);
    } finally { await core.dispose(); }
  }
  try {
    const group = renderCapabilities({ channel: 'line', commands: false, requests: false, humanSupport: false });
    assert.doesNotMatch(group, /\/help|รับคำขอจอง|ขอคุยกับเจ้าหน้าที่|ดูความจำ/);
    assert.equal(requests.store.list().length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capability summary cannot advertise request support that is not wired in the current runtime', async () => {
  const core = createCustomerCore({ factory: factory([{ intent: 'knowledge', topic: capabilitiesTopic.id }], []) });
  try {
    let reply = '';
    await core.client({ channel: 'terminal', scope: 'local', user: 'A' }).send('ช่วยอะไรได้บ้าง', { text: s => reply += s, status() {} });
    assert.match(reply, /\/help/);
    assert.doesNotMatch(reply, /รับคำขอจอง|เจ้าหน้าที่เพื่อรอรับช่วง/);
  } finally { await core.dispose(); }
});


test('group runtime shares semantic capability routing, refers private services, and retains isolated memory and slash blocking', async () => {
  const root = mkdtempSync(join(tmpdir(), 'group-capabilities-'));
  const contexts: string[] = [], replies: string[] = [];
  const groupId = 'C' + 'a'.repeat(32), userId = 'U' + 'b'.repeat(32);
  const directMemory = new MemoryStore(join(root, 'direct-memory'));
  const groupMemory = new MemoryStore(join(root, 'group-memory'));
  const requestStore = new CourseRequestStore(join(root, 'requests'));
  const requests = new CourseRequests(requestStore);
  const direct = createCustomerCore({ store: directMemory, requests, factory: factory([], []) });
  const group = createCustomerCore({ store: groupMemory, factory: factory([
    { intent: 'knowledge', topic: capabilitiesTopic.id, reply: 'จองสำเร็จในกลุ่มแล้ว' },
    { intent: 'memory', action: 'recall' },
    { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'AI', limit: 3 },
  ], contexts), privateChatCapabilities: { requests: true, commands: true, humanSupport: true } });
  const rooms = new LineGroupStore(join(root, 'rooms'), 'oa');
  rooms.observe({ groupId, type: 'join', at: new Date().toISOString() }); rooms.enableCallWord(groupId);
  const adapter = new LineGroupReplies(rooms, group, 'oa', false, async (_token, reply) => { replies.push(reply); });
  let sequence = 0;
  const send = async (text: string) => {
    adapter.accept({ type: 'message', webhookEventId: 'cap-' + sequence++, replyToken: 'fake-only',
      source: { type: 'group', groupId, userId }, message: { type: 'text', text: 'ซีบอต ' + text } }, undefined);
    await adapter.drain(); return replies.at(-1)!;
  };
  try {
    await direct.client({ channel: 'line', scope: 'oa:direct', user: userId }).send('ฉันชื่อ Private-Fixture', { text() {}, status() {} });
    const summary = await send('เธอทำอะไรได้บ้าง');
    assert.match(summary, /ค้น.*เปรียบเทียบ/);
    const [here, privateOnly] = summary.split('ส่วนบริการต่อไปนี้ ให้ทัก LINE ส่วนตัวกับซีบอตครับ');
    assert.ok(privateOnly); assert.doesNotMatch(here, /คำขอจอง|ดูความจำ|ขอคุยกับเจ้าหน้าที่|\/help/);
    for (const feature of ['คำขอจอง', 'ดูความจำ', '/help', 'เจ้าหน้าที่', 'ยืนยันที่นั่งแทนไม่ได้']) assert.ok(privateOnly.includes(feature), feature);
    assert.doesNotMatch(summary, /จองสำเร็จในกลุ่มแล้ว|Private-Fixture/);
    assert.equal(group.faqWithoutModel, false);
    const callCount = contexts.length;
    assert.match(await send('/book Excel'), /กรุณาใช้แชตส่วนตัว/);
    assert.equal(contexts.length, callCount);
    assert.match(await send('จำอะไรได้บ้าง'), /ยังไม่มีข้อมูล/);
    assert.match(await send('มีคอร์ส AI อะไรบ้าง'), /AI for Research/);
    assert.doesNotMatch(contexts.join(''), /Private-Fixture/);
    assert.match(contexts[0], /Experimental conversation routing/);
    assert.match(contexts[0], /privateChat/);
    assert.equal(requestStore.list().length, 0);
  } finally {
    adapter.close(); await group.dispose(); await direct.dispose(); directMemory.close(); groupMemory.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('private-chat referral only advertises supplied direct services and never appears in Terminal/direct summaries', () => {
  const group = renderCapabilities({ channel: 'line', commands: false, requests: false, humanSupport: false,
    privateChat: { requests: false, commands: true, humanSupport: false } });
  assert.match(group, /LINE ส่วนตัว/); assert.match(group, /\/help/);
  assert.doesNotMatch(group, /คำขอจอง|เจ้าหน้าที่/);
  for (const channel of ['terminal', 'line'] as const) {
    assert.doesNotMatch(renderCapabilities({ channel, commands: true, requests: false, humanSupport: false,
      privateChat: { requests: true, commands: true, humanSupport: true } }), /ส่วนบริการต่อไปนี้|คำขอจอง|เจ้าหน้าที่/);
  }
});
