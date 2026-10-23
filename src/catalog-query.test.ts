import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { MemoryStore } from './memory.js';
import { LineAdapter } from './line.js';
import { routeCatalog, executeCatalogQuery, parseCatalogQuery, recoverCatalogState, validCatalogState, type CatalogState } from './catalog-query.js';

test('real failed LINE question sequence: list, prices, shorter, paging, price ranking and total count retain correct scope', () => {
  let state: CatalogState | undefined;
  const send = (query: string) => {
    const result = routeCatalog(query, state);
    assert.ok(result?.answer, query); state = result.state ?? state;
    assert.ok(validCatalogState(state)); assert.ok(result.answer.length < 4500);
    return result.answer;
  };
  assert.match(send('มีหลักสูตร ai อะไรบ้าง'), /พบ \d+ รายการ/);
  const ai = [...state!.shownIds]; const totalAI = state!.matchedIds.length;
  assert.ok(totalAI > 5);
  assert.doesNotMatch(send('ขอราคาแต่ละตัวด้วย'), /ยังไม่พบหลักสูตร/);
  assert.deepEqual(state!.shownIds, ai);
  assert.match(send('ทำไมตรวจสอบราคาไม่ได้ละ'), /แสดงราคาที่หน้าเว็บเคยระบุได้/);
  assert.deepEqual(state!.shownIds, ai, 'a complaint must not change the filter to an incidental topic word');
  assert.match(send('เขียนสรุปกระชับหน่อย'), /สรุปรายการก่อนหน้า/);
  assert.deepEqual(state!.shownIds, ai);
  send('ขอดูมากกว่า 5 ได้ไหม'); assert.equal(state!.shownIds.length, 6); assert.equal(state!.matchedIds.length, totalAI);
  const firstPage = [...state!.shownIds];
  send('ดูต่อ'); assert.ok(state!.shownIds.every(id => !firstPage.includes(id)));
  send('data'); assert.ok(state!.matchedIds.length > 3);
  assert.match(send('อะไรแพงที่สุด'), /Mini Data Science รุ่นที่ 10[\s\S]*28,000 THB/);
  assert.match(send('ดูราคาได้ไหม'), /28,000 THB/);
  assert.match(send('อ้าวตอบราคาไม่ได้เหรอ'), /28,000 THB/);
  assert.match(send('มีทัั้งหดมกี่หลักสูตร'), /19 หลักสูตร \+ 1 bundle รวม 20 รายการ/);
  assert.equal(state!.matchedIds.length, 20);
  assert.match(send('ดูราคาทั้งหมด'), /ราคาใน snapshot/);
});

test('catalog aggregate operations distinguish missing prices, all/previous/search and finite pagination', () => {
  const full = executeCatalogQuery({ operation: 'list', scope: 'all', limit: 10 });
  assert.equal(full.state!.shownIds.length, 10); assert.equal(full.state!.matchedIds.length, 20);
  const next = executeCatalogQuery({ operation: 'more', scope: 'previous' }, full.state);
  assert.equal(next.state!.shownIds.length, 10);
  assert.match(executeCatalogQuery({ operation: 'more', scope: 'previous' }, next.state).answer!, /แสดงครบ 20/);
  const sorted = executeCatalogQuery({ operation: 'sort_price', scope: 'all', order: 'desc', limit: 1 });
  assert.match(sorted.answer!, /Mini Data Science รุ่นที่ 10/); assert.match(sorted.answer!, /ไม่มีราคา.*ไม่รวม/);
  const missing = executeCatalogQuery({ operation: 'price', scope: 'search', query: 'AI Agent for ALL' });
  assert.match(missing.answer!, /ไม่พบราคา \(ไม่ถือว่าฟรี\)/);
  assert.throws(() => parseCatalogQuery({ operation: 'delete', scope: 'all' }));
  assert.throws(() => parseCatalogQuery({ operation: 'list', scope: 'all', limit: 100 }));
  assert.throws(() => parseCatalogQuery({ operation: 'list', scope: 'search' }));
  assert.equal(validCatalogState({ ...full.state, matchedIds: ['other-user'] }), false);
});

test('legacy bounded history recovers course context; no private data or unrelated records are needed', () => {
  const oldAnswer = routeCatalog('มีหลักสูตร ai อะไรบ้าง')!.answer!;
  const recovered = recoverCatalogState([
    { user: 'มีหลักสูตร ai อะไรบ้าง', assistant: oldAnswer },
    { user: 'ขอราคาแต่ละตัวด้วย', assistant: 'ยังไม่พบหลักสูตรที่ตรง' },
  ])!;
  assert.ok(recovered.matchedIds.length > recovered.shownIds.length);
  const prices = routeCatalog('ขอราคาแต่ละตัวด้วย', recovered)!;
  assert.match(prices.answer!, /ราคาใน snapshot/);
  assert.deepEqual(prices.state!.shownIds, recovered.shownIds);
});

test('signed LINE failed-question replay returns prices/counts and keeps dedupe', async () => {
  const core = new CustomerCore(semanticFactory([]), 1000);
  const replies: string[] = [], secret = 'history-replay-test';
  const adapter = new LineAdapter({ core, secret, account: 'fixture', dryRun: false, allowedUsers: new Set(['A']),
    reply: async (_token, text) => { replies.push(text); } });
  try {
    for (const [index, text] of ['มีหลักสูตร ai อะไรบ้าง', 'ขอราคาแต่ละตัวด้วย', 'มีทัั้งหดมกี่หลักสูตร'].entries()) {
      const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: `replay-${index}`, replyToken: 'mock-reply',
        source: { type: 'user', userId: 'A' }, message: { type: 'text', text } }] }));
      const signature = createHmac('sha256', secret).update(raw).digest('base64');
      assert.equal(adapter.accept(raw, signature), 200); await adapter.drain();
      assert.equal(adapter.accept(raw, signature), 200); await adapter.drain();
    }
    assert.equal(replies.length, 3); assert.match(replies[1], /ราคาใน snapshot/);
    assert.match(replies[2], /19 หลักสูตร \+ 1 bundle/);
  } finally { adapter.close(); await core.dispose(); }
});

function semanticFactory(prompts: string[]) {
  return async (manager?: SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      const user = context.messages.filter(m => m.role === 'user').at(-1);
      const prompt = typeof user?.content === 'string' ? user.content : user?.content.filter(p => p.type === 'text').map(p => p.text).join('') ?? '';
      prompts.push(prompt);
      // These non-keyword paraphrases must go through semantic planning, not ad hoc routes.
      const plan = prompt.startsWith('ทำได้แค่ 3 เองเหรอ') ? { intent: 'catalog_query', operation: 'list', scope: 'previous', limit: 10 }
        : prompt.startsWith('3 ก็ได้') ? { intent: 'catalog_query', operation: 'list', scope: 'previous', limit: 3 }
        : { intent: 'chat', reply: 'คุยกันต่อได้ครับ' };
      const message: AssistantMessage = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message }); return stream;
    };
    return session;
  };
}

test('semantic plans execute host queries; catalog state survives mixed chat/compaction/restart and resets per identity', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cbot-catalog-context-'));
  let store = new MemoryStore(dir); const prompts: string[] = [];
  let core = new CustomerCore(semanticFactory(prompts), 1000, undefined, undefined, store);
  const identity = { channel: 'line' as const, scope: 'fixture:direct', user: 'A' };
  let client = core.client(identity);
  const send = async (query: string) => { let text = ''; await client.send(query, { text: s => { text += s; }, status: () => {} }); return text; };
  try {
    await send('มีหลักสูตร ai อะไรบ้าง');
    assert.match(await send('ทำได้แค่ 3 เองเหรอ'), /แสดง 1–10/);
    assert.match(await send('3 ก็ได้'), /แสดง 1–3/);
    assert.ok(prompts.every(p => p.includes('Catalog conversation DATA')));
    assert.ok(prompts.every(p => !p.includes('html_sha256') && !p.includes('price.displayed_amount')));
    for (let i = 0; i < 16; i++) await send('คุยเล่นกัน');
    const before = JSON.parse(await client.memory!());
    assert.ok(before.compactions > 0); assert.ok(before.catalog.matchedIds.length > 3);
    assert.match(await send('ขอราคาแต่ละตัวด้วย'), /ราคาใน snapshot/);
    const other = core.client({ ...identity, user: 'B' });
    assert.equal(JSON.parse(await other.memory!()).catalog, undefined);
    await core.dispose(); store.close(); store = new MemoryStore(dir);
    core = new CustomerCore(semanticFactory(prompts), 1000, undefined, undefined, store); client = core.client(identity);
    assert.match(await send('ขอราคาแต่ละตัวด้วย'), /ราคาใน snapshot/);
    await client.reset!(); assert.equal(JSON.parse(await client.memory!()).catalog, undefined);
    await send('มีหลักสูตร ai อะไรบ้าง');
    await client.forget!(await client.requestForget!());
    assert.equal(JSON.parse(await client.memory!()).catalog, undefined);
  } finally { await core.dispose(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});
