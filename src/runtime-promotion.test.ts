import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { createCustomerCore } from './customer-runtime.js';
import { MemoryStore } from './memory.js';
import type { ChatClient } from './core.js';

function scripted(plans: object[], contexts: string[], grounded = true) {
  return async (manager?: SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager, conversationMode: grounded ? 'grounded' : undefined });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context));
      const plan = plans.shift(); assert.ok(plan, 'unexpected provider call');
      const message: AssistantMessage = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message }); return stream;
    };
    return session;
  };
}
async function send(client: ChatClient, prompt: string) {
  let text = ''; await client.send(prompt, { text: value => text += value, status() {} }); return text;
}

test('ordinary factory defaults to grounded catalog evidence and honest unknown without an opt-in flag', async () => {
  const contexts: string[] = [], logs: any[] = [];
  const core = createCustomerCore({ log: record => logs.push(record), factory: scripted([
    { intent: 'catalog_query', operation: 'read', scope: 'search', query: 'AI for All', fields: ['instructors', 'price'] },
    { intent: 'answer', reply: 'AI for All เรียนฟรี ไม่มีค่าใช้จ่าย ผู้สอนคือ ผศ.ดร. ทวีศักดิ์ สมานชื่นครับ',
      evidence: [{ id: 'turn:catalog', quote: 'วิทยากร: ผศ.ดร. ทวีศักดิ์ สมานชื่น' }] },
    { intent: 'unknown', reply: 'ยังไม่มีข้อมูลเรื่องนี้ครับ' },
  ], contexts) });
  try {
    assert.equal(core.neutralFallback, true); assert.equal(core.faqWithoutModel, false);
    const client = core.client({ channel: 'terminal', scope: 'promotion', user: 'A' });
    const answer = await send(client, 'AI for All ราคาเท่าไร ใครสอน');
    assert.match(answer, /เรียนฟรี ไม่มีค่าใช้จ่าย/); assert.match(answer, /ทวีศักดิ์ สมานชื่น/);
    assert.doesNotMatch(answer, /คำยืนยัน|แชตโครงการ/);
    const unknown = await send(client, 'ในห้องครัวของฉันตอนนี้มีคนกี่คน');
    assert.equal(unknown.trim(), 'ยังไม่มีข้อมูลเรื่องนี้ครับ'); assert.doesNotMatch(unknown, /https?:|FAQ|CBTU/);
    assert.match(contexts[0], /Do not force a factual question into a prepared FAQ answer/);
    assert.ok(logs.some(record => record.dialogueMode === 'grounded'));
    assert.equal(contexts.length, 3);
  } finally { await core.dispose(); }
});

test('switching the default routing preserves existing memory and keeps another identity isolated', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-promotion-memory-'));
  const identity = { channel: 'terminal' as const, scope: 'local', user: 'A' };
  let store = new MemoryStore(join(root, 'memory'));
  let core = createCustomerCore({ experimentalGrounding: false, store,
    factory: scripted([{ intent: 'chat', reply: 'เรื่องค้างเดิมคือการเรียนวันเสาร์ครับ' }], [], false) });
  const contexts: string[] = [];
  try {
    await send(core.client(identity), 'ฉันชื่อ Promotion-73');
    await send(core.client(identity), 'คุยเรื่องการเรียนวันเสาร์');
    await core.dispose(); store.close();
    store = new MemoryStore(join(root, 'memory'));
    core = createCustomerCore({ store, factory: scripted([
      { intent: 'chat', reply: 'คุยเรื่องการเรียนวันเสาร์ต่อได้ครับ' },
      { intent: 'chat', reply: 'สวัสดีครับ' },
    ], contexts) });
    assert.match(await core.client(identity).memory!(), /Promotion-73/);
    assert.match(await send(core.client(identity), 'คุยต่อจากเมื่อกี้'), /วันเสาร์/);
    assert.match(contexts[0], /Promotion-73/); assert.match(contexts[0], /เรื่องค้างเดิมคือการเรียนวันเสาร์/);
    await send(core.client({ ...identity, user: 'B' }), 'สวัสดี');
    assert.doesNotMatch(contexts[1], /Promotion-73|เรื่องค้างเดิมคือการเรียนวันเสาร์/);
  } finally { await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); }
});
