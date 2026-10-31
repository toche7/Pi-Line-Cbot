import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { identityAnswer, renderKnowledge, renderDialogue, unknownAnswer } from './knowledge.js';
import { runNaturalChat } from './natural-chat.js';
import { runChat } from './chat.js';
import { parseCatalogQuery, CatalogQueryValidationError } from './catalog-query.js';

// Tests of host routing, context delivery and isolation with a fake transport.
// These scripted plans do NOT measure live-model intent accuracy or naturalness.
function fixture(plans: object[], mode?: 'rules-first' | 'model-first') {
  const contexts: string[] = [];
  const core = new CustomerCore(async (manager, settings) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager, settings });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context.messages));
      const plan = plans.shift();
      assert.ok(plan, 'unexpected model request');
      const message: AssistantMessage = {
        role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream();
      stream.push({ type: 'done', reason: 'stop', message });
      return stream;
    };
    return session;
  }, 2000, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mode);
  const client = core.client({ channel: 'terminal', scope: 'natural-test', user: 'A' });
  return { core, contexts, client, async send(prompt: string) {
    let answer = '';
    await client.send(prompt, { text: value => { answer += value; }, status() {} });
    return answer.trim();
  } };
}

test('natural experiment sends negation/correction/greeting to model instead of keyword FAQ; keeps actual host facts in context', async () => {
  const f = fixture([
    { intent: 'knowledge', topic: 'receipt', reply: 'เลขบัญชีที่แต่งขึ้น 1234567890' },
    { intent: 'chat', reply: 'เข้าใจครับ อยากถามเรื่องไหนครับ' },
    { intent: 'chat', reply: 'สวัสดีครับ วันนี้เป็นอย่างไรบ้าง' },
  ], 'model-first');
  try {
    assert.equal(await f.send('ขอใบเสร็จ'), renderKnowledge('receipt'));
    assert.equal(await f.send('ไม่ได้ถามเรื่องใบเสร็จ'), 'เข้าใจครับ อยากถามเรื่องไหนครับ');
    assert.equal(await f.send('hi'), 'สวัสดีครับ วันนี้เป็นอย่างไรบ้าง');
    assert.equal(f.contexts.length, 3);
    assert.match(f.contexts[0], /Experimental conversation routing/);
    assert.match(f.contexts[1], /Host answer after commit/);
    assert.match(f.contexts[1], /เมนู Payment/);
    assert.doesNotMatch(await f.client.memory!(), /1234567890/);
  } finally { await f.core.dispose(); }
});

test('natural experiment lets model interpret ambiguous follow-up and laughter without automatically repeating FAQ or paging courses', async () => {
  const f = fixture([
    { intent: 'knowledge', topic: 'receipt' },
    { intent: 'chat', reply: 'อยากให้ขยายความส่วนไหนครับ' },
    { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'AI', limit: 3 },
    { intent: 'chat', reply: 'ครับผม' },
  ], 'model-first');
  try {
    await f.send('ขอใบเสร็จ');
    assert.equal(await f.send('แล้วอันนั้นทำยังไง'), 'อยากให้ขยายความส่วนไหนครับ');
    await f.send('ขอรายการหลักสูตร AI');
    const before = JSON.parse(await f.client.memory!());
    assert.equal(await f.send('555'), 'ครับผม');
    const after = JSON.parse(await f.client.memory!());
    assert.deepEqual(after.catalog, before.catalog);
    assert.equal(f.contexts.length, 4);
  } finally { await f.core.dispose(); }
});

test('natural experiment does not preempt a correction mentioning a course with catalog keyword routing', async () => {
  const f = fixture([{ intent: 'chat', reply: 'เข้าใจแล้วครับ ลองเล่าประเด็นที่ต้องการได้เลย' }], 'model-first');
  try {
    assert.equal(await f.send('ไม่ได้อยากสมัครคอร์ส Excel แค่อยากคุย'), 'เข้าใจแล้วครับ ลองเล่าประเด็นที่ต้องการได้เลย');
    assert.equal(f.contexts.length, 1);
  } finally { await f.core.dispose(); }
});

test('legacy low-level core retains rule-based FAQ and greetings without model requests', async () => {
  const f = fixture([]);
  try {
    assert.equal(await f.send('ขอใบเสร็จ'), renderKnowledge('receipt'));
    assert.equal(await f.send('แล้วอันนั้นทำยังไง'), renderKnowledge('receipt'));
    assert.equal(await f.send('hi'), identityAnswer);
    assert.equal(f.contexts.length, 0);
  } finally { await f.core.dispose(); }
});

test('natural catalog reaction repairs guarded chat in the same budget instead of silently rendering not-found', async () => {
  const f = fixture([
    { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'AI', limit: 5 },
    { intent: 'catalog_query', operation: 'list', scope: 'all', limit: 10 },
    { intent: 'chat', reply: 'มีหลักสูตรให้เลือกหลายแบบเลยครับ อยากให้ช่วยคัดให้ไหมครับ' },
    { intent: 'chat', reply: 'อยากให้ช่วยคัดเหลือสัก 2–3 ตัวตามงานที่ทำไหมครับ' },
  ], 'model-first');
  try {
    await f.send('มีอะไรเกี่ยวกับ ai บ้าง');
    await f.send('มีหลักสูตรอะไรบ้าง');
    const before = JSON.parse(await f.client.memory!());
    const reply = await f.send('เยอะเลยนะ');
    assert.equal(reply, 'อยากให้ช่วยคัดเหลือสัก 2–3 ตัวตามงานที่ทำไหมครับ');
    assert.notEqual(reply, unknownAnswer);
    assert.equal(f.contexts.length, 4);
    assert.match(f.contexts[3], /Conversational repair only/);
    assert.match(f.contexts[3], /Original message: เยอะเลยนะ/);
    assert.match(f.contexts[3], /Host answer after commit|Host-rendered answer/);
    assert.match(f.contexts[3], /พบ 20 รายการ/);
    assert.deepEqual(JSON.parse(await f.client.memory!()).catalog, before.catalog);
  } finally { await f.core.dispose(); }
});

test('natural chat repair remains bounded and keeps factual guards intact', async () => {
  const bad = { intent: 'chat', reply: 'มีหลักสูตรใหม่ ราคา 999 บาทครับ' };
  const f = fixture([bad, bad], 'model-first');
  try {
    await assert.rejects(f.send('เยอะเลยนะ'), /ยังเรียบเรียงคำตอบคุยทั่วไป/);
    assert.equal(f.contexts.length, 2);
    assert.equal(JSON.parse(await f.client.memory!()).recent.length, 0);
    assert.equal(renderDialogue(JSON.stringify(bad)), unknownAnswer);
  } finally { await f.core.dispose(); }
});

test('conversational repair cannot change intent and execute a catalog action instead', async () => {
  const f = fixture([
    { intent: 'chat', reply: 'มีหลักสูตรให้เลือกหลายแบบเลยครับ' },
    { intent: 'catalog_query', operation: 'list', scope: 'all', limit: 10 },
  ], 'model-first');
  try {
    await assert.rejects(f.send('เยอะเลยนะ'), /ยังเรียบเรียงคำตอบคุยทั่วไป/);
    const memory = JSON.parse(await f.client.memory!());
    assert.equal(memory.recent.length, 0);
    assert.equal(memory.catalog, undefined);
    assert.equal(f.contexts.length, 2);
  } finally { await f.core.dispose(); }
});

test('exact live catalog plan with empty filters executes once in experiment; default parser remains strict', async () => {
  const plan = { intent: 'catalog_query', operation: 'list', scope: 'all', query: '', fields: ['name'], filters: [], limit: 10, order: 'asc' };
  assert.throws(() => parseCatalogQuery(plan), /Invalid catalog operation/);
  assert.equal(parseCatalogQuery(plan, 'model').filters, undefined);
  assert.deepEqual(plan.filters, [], 'normalization must not mutate the model object');
  const f = fixture([plan], 'model-first');
  try {
    assert.match(await f.send('ขอดูหลักสูตรหน่อย'), /พบ 20 รายการ แสดง 1–10/);
    assert.equal(f.contexts.length, 1);
  } finally { await f.core.dispose(); }
});

test('model catalog parser preserves real filters and still rejects invalid fields/limits; repair gets catalog-specific instructions', async () => {
  const plan = { intent: 'catalog_query', operation: 'list', scope: 'all', filters: [{ field: 'instructors', value: 'ทวีศักดิ์' }], limit: 3 };
  assert.deepEqual(parseCatalogQuery(plan, 'model').filters, plan.filters);
  for (const change of [{ limit: 20 }, { fields: ['private_key'] }, { filters: [{ field: 'instructors', value: '' }] }]) {
    assert.throws(() => parseCatalogQuery({ ...plan, ...change }, 'model'), CatalogQueryValidationError);
  }
  const f = fixture([{ ...plan, limit: 20 }, plan], 'model-first');
  try {
    assert.ok(await f.send('ขอดูหลักสูตรของอาจารย์ทวีศักดิ์'));
    assert.equal(f.contexts.length, 2);
    assert.match(f.contexts[1], /Catalog command repair only/);
    assert.match(f.contexts[1], /not placeholders/);
  } finally { await f.core.dispose(); }
});

test('repeated invalid catalog plans report a command error instead of blaming JSON or suggesting reset', async () => {
  const plan = { intent: 'catalog_query', operation: 'list', scope: 'all', limit: 20 };
  for (const second of [plan, { intent: 'chat', reply: 'ลองบอกชื่อที่สนใจมาครับ' }]) {
    const f = fixture([plan, second], 'model-first');
    try {
      await assert.rejects(f.send('ขอดูหลักสูตรหน่อย'), error => {
        assert.match((error as Error).message, /คำสั่งค้นหลักสูตร/);
        assert.doesNotMatch((error as Error).message, /รูปแบบคำตอบ|reset/);
        return true;
      });
      assert.equal(f.contexts.length, 2);
      assert.equal(JSON.parse(await f.client.memory!()).recent.length, 0);
    } finally { await f.core.dispose(); }
  }
});

test('natural check runs SDK initialization in temp and preserves source files/cwd without inference or importing private stores', async () => {
  const original = process.cwd(), project = mkdtempSync(join(tmpdir(), 'natural-project-'));
  let text = '';
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } });
  try {
    mkdirSync(join(project, '.line-memory'));
    const sentinel = join(project, '.line-memory', 'private.json');
    writeFileSync(sentinel, 'PRIVATE_SENTINEL_NOT_FOR_EXPERIMENT');
    process.chdir(project);
    await runNaturalChat({ checkOnly: true, output });
    assert.equal(process.cwd(), realpathSync(project));
    assert.equal(readFileSync(sentinel, 'utf8'), 'PRIVATE_SENTINEL_NOT_FOR_EXPERIMENT');
    assert.doesNotMatch(text, /PRIVATE_SENTINEL/);
    assert.match(text, /model-first/);
    assert.match(text, /ไม่เรียกโมเดล/);
    assert.match(text, /ไม่มี LINE transport/);
  } finally { process.chdir(original); rmSync(project, { recursive: true, force: true }); }
});

test('temporary CLI help and exit label requests/memory as temporary without sending any model turn', async () => {
  let text = '';
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } });
  await runChat({
    async send() { assert.fail('help/exit must not send a turn'); }, async abort() {},
    async requestForget() { return 'challenge'; }, async forget() {}, requestsEnabled: true,
  }, 1000, Readable.from(['/help\n/exit\n']), output, output, { temporary: true });
  assert.match(text, /พื้นที่ทดลองชั่วคราว/);
  assert.match(text, /ข้อมูลชั่วคราวจะถูกลบ/);
  assert.doesNotMatch(text, /ระบบกลาง|ยังอยู่สำหรับครั้งถัดไป/);
});

test('a model cannot enable request capabilities by choosing a host topic when request support is absent', async () => {
  const f = fixture([{ intent: 'knowledge', topic: 'host:course-requests', reply: 'รับคำขอได้แล้ว' }], 'model-first');
  try {
    assert.equal(await f.send('จองได้เหรอ'), unknownAnswer);
    assert.doesNotMatch(f.contexts[0], /prepareBookingRequest/);
    assert.equal(f.client.requestsEnabled, false);
  } finally { await f.core.dispose(); }
});
