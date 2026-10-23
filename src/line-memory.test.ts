import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHmac, createHash } from 'node:crypto';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { createDemo } from './agent.js';
import { CustomerCore, type Identity } from './core.js';
import { MemoryStore } from './memory.js';
import { LineAdapter } from './line.js';
import { LineConversations } from './line-memory.js';

const secret = 'local-test-only';
const key = (oa: string, user = 'A') => JSON.stringify(['line', `${oa}:direct`, user]);
const sign = (raw: Buffer) => createHmac('sha256', secret).update(raw).digest('base64');
const output = { text: (_s: string) => {}, status: (_s: string) => {} };
function factory(contexts: string[]) {
  return async (manager?: SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context.messages));
      const message: AssistantMessage = {
        role: 'assistant', content: [{ type: 'text', text: '{"intent":"chat","reply":"รับทราบครับ"}' }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message }); return stream;
    };
    return session;
  };
}
let eventIndex = 0;
function fixture(core: CustomerCore, oa = 'OA-one') {
  const replies: string[] = [];
  const adapter = new LineAdapter({ core, secret, account: oa, allowedUsers: new Set(['A', 'B']), dryRun: false,
    reply: async (_token, text) => { replies.push(text); },
  });
  return { adapter, replies, async send(text: string, user = 'A') {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: `event-${++eventIndex}`,
      replyToken: 'offline-reply-placeholder', source: { type: 'user', userId: user }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, sign(raw)), 200); await adapter.drain(); return replies.at(-1)!;
  } };
}

test('LINE signed events persist profile/recent/summary across restart; OA/user/channel stores are isolated', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-line-memory-'));
  const lineDir = join(root, 'line'), terminalDir = join(root, 'terminal');
  let clock = Date.now();
  let store = new MemoryStore(lineDir, () => clock);
  let core = new CustomerCore(factory([]), 1000, undefined, () => clock, store);
  let one = fixture(core), two = fixture(core, 'OA-two');
  const contexts: string[] = [];
  let terminalStore: MemoryStore | undefined, terminalCore: CustomerCore | undefined;
  try {
    // Another process opens its independent Terminal store while LINE's lock is held.
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import {MemoryStore,emptyMemory} from ${JSON.stringify(resolve('dist/memory.js'))};const s=new MemoryStore(${JSON.stringify(terminalDir)});try{const m=emptyMemory(Date.now());m.profile.name='Terminal-only';s.save(${JSON.stringify(JSON.stringify(['terminal', 'local', 'A']))},m)}finally{s.close()}`,
    ], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    terminalStore = new MemoryStore(terminalDir);
    terminalCore = new CustomerCore(factory([]), 1000, undefined, undefined, terminalStore);
    await one.send('ฉันชื่อ LINE-A');
    await one.send('ฉันสนใจ AI');
    await one.send('เป้าหมายการเรียนของฉันคือ สร้างบอต');
    await one.send('ช่วยจำระยะยาวว่า ชอบตัวอย่างภาษาไทย');
    await one.send('พรุ่งนี้ยังต้องติดตาม pending-LINE-only');
    for (let i = 0; i < 32; i++) await one.send(i % 2 ? 'สมัครสมาชิกอย่างไร' : 'สวัสดี');
    await one.send('ฉันชื่อ LINE-B', 'B'); await two.send('ฉันชื่อ Other-OA');
    const memory = store.load(key('OA-one'));
    assert.equal(memory.profile.name, 'LINE-A');
    assert.equal(memory.profile.interests, 'AI'); assert.equal(memory.profile.goals, 'สร้างบอต');
    assert.ok(memory.compactions >= 3); assert.ok(memory.recent.length <= 12);
    assert.match(JSON.stringify(memory.summary), /pending-LINE-only/);
    assert.equal((JSON.parse(await terminalCore.client({ channel: 'terminal', scope: 'local', user: 'A' }).memory!())).profile.name, 'Terminal-only');
    assert.doesNotMatch(await one.send('/memory'), /Terminal-only|Other-OA|LINE-B/);
    one.adapter.close(); two.adapter.close(); await core.dispose(); store.close();
    clock += 86400000;
    store = new MemoryStore(lineDir, () => clock);
    core = new CustomerCore(factory(contexts), 1000, undefined, () => clock, store);
    one = fixture(core); two = fixture(core, 'OA-two');
    const view = await one.send('/memory');
    assert.match(view, /LINE-A/); assert.match(view, /ชอบตัวอย่างภาษาไทย/); assert.match(view, /pending-LINE-only/);
    assert.ok(view.length <= 4500);
    await one.send('ฉันชื่ออะไร');
    assert.match(contexts.at(-1)!, /LINE-A|pending-LINE-only/);
    assert.doesNotMatch(contexts.at(-1)!, /Terminal-only|LINE-B|Other-OA/);
    await two.send('ฉันชื่ออะไร'); assert.doesNotMatch(contexts.at(-1)!, /LINE-A|pending-LINE-only|Terminal-only/);
    await one.send('/reset');
    const reset = store.load(key('OA-one'));
    assert.equal(reset.profile.name, 'LINE-A'); assert.deepEqual(reset.longTerm, ['ชอบตัวอย่างภาษาไทย']);
    assert.deepEqual(reset.recent, []); assert.deepEqual(reset.summary.pending, []); assert.equal(reset.lastTopic, undefined);
    await one.send('/forget');
    assert.match(await one.send('/confirm-forget', 'B'), /ต้องใช้/);
    assert.match(await two.send('/confirm-forget'), /ต้องใช้/);
    assert.equal(store.load(key('OA-one')).profile.name, 'LINE-A');
    await one.send('/cancel'); assert.match(await one.send('/confirm-forget'), /ต้องใช้/);
    await one.send('/forget'); await one.send('สวัสดี'); assert.match(await one.send('/confirm-forget'), /ต้องใช้/);
    await one.send('/forget'); await one.send('/memory'); assert.match(await one.send('/confirm-forget'), /ต้องใช้/);
    await one.send('/forget');
    one.adapter.close(); one = fixture(core); // Restarting the adapter cannot reuse a challenge.
    assert.match(await one.send('/confirm-forget'), /ต้องใช้/);
    await one.send('/forget'); assert.match(await one.send('/confirm-forget'), /ลืมทั้งหมดแล้ว/);
    const deletedFile = createHash('sha256').update(key('OA-one')).digest('hex') + '.json';
    assert.ok(!readdirSync(lineDir).includes(deletedFile));
    assert.equal(store.load(key('OA-one', 'B')).profile.name, 'LINE-B');
    assert.equal(store.load(key('OA-two')).profile.name, 'Other-OA');
    one.adapter.close(); two.adapter.close(); await core.dispose(); store.close();
    store = new MemoryStore(lineDir, () => clock); core = new CustomerCore(factory([]), 1000, undefined, () => clock, store);
    one = fixture(core); two = fixture(core, 'OA-two');
    const forgotten = store.load(key('OA-one'));
    assert.deepEqual(forgotten.profile, {}); assert.deepEqual(forgotten.recent, []); assert.deepEqual(forgotten.summary.pending, []);
    assert.equal(terminalStore.load(JSON.stringify(['terminal', 'local', 'A'])).profile.name, 'Terminal-only');
  } finally {
    one.adapter.close(); two.adapter.close(); await core.dispose(); store.close();
    await terminalCore?.dispose(); terminalStore?.close(); rmSync(root, { recursive: true, force: true });
  }
});

test('LINE forget confirmation expires; memory reads enforce retention without touching another channel', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-line-expiry-'));
  let clock = Date.now(); const store = new MemoryStore(root, () => clock);
  const core = new CustomerCore(factory([]), 1000, undefined, () => clock, store);
  const conversations = new LineConversations(core, () => clock);
  const identity: Identity = { channel: 'line', scope: 'OA:direct', user: 'A' };
  let reply = '';
  const send = async (text: string) => { reply = ''; await conversations.send(identity, text, { ...output, text: s => { reply += s; } }); return reply; };
  try {
    await send('ฉันชื่อ Expiry-A'); await send('/forget'); clock += 61000;
    assert.match(await send('/confirm-forget'), /หมดอายุ/);
    assert.match(await send('/memory'), /Expiry-A/);
    clock += 91 * 86400000;
    assert.doesNotMatch(await send('/memory'), /Expiry-A/);
    assert.equal(readdirSync(root).filter(n => n.endsWith('.json')).length, 0);
  } finally { conversations.close(); await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); }
});
