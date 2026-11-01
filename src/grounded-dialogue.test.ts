import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { MemoryStore, validEvidenceIds } from './memory.js';
import { activeKnowledge } from './knowledge-store.js';
import { renderGroundedAnswer, executeGroundedCatalog } from './grounded-dialogue.js';
import { retrieveEvidence, publicEvidence, conversationEvidence, type Evidence } from './grounded-evidence.js';
import { executeCatalogQuery, parseCatalogQuery } from './catalog-query.js';
import { courseFields } from './course-reader.js';
import { neutralFailureReply, DemoFailure } from './diagnostics.js';
import { createTerminalLineSimulation } from './terminal-line-simulation.js';

const enrollment = () => activeKnowledge().find(k => k.id === 'enroll')!;
function factory(plans: any[], contexts: string[]) {
  return async (manager?: import('@earendil-works/pi-coding-agent').SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager, conversationMode: 'grounded' });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context)); const plan = plans.shift(); assert.ok(plan, 'unexpected model call');
      const failureMessages: Record<string, string> = { 'provider-fail': '429 private fixture', 'json-generation-error': 'json_validate_failed', 'network-fail': 'Network connection failed' };
      const errorMessage = typeof plan === 'string' ? failureMessages[plan] : undefined;
      const fail = !!errorMessage, truncated = plan === 'output-length', empty = plan === 'empty-answer';
      const message: AssistantMessage = { role: 'assistant', content: fail || empty ? [] : [{ type: 'text', text: truncated ? '{"intent":"answer","reply":"unfinished' : JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: fail ? 'error' : truncated ? 'length' : 'stop',
        errorMessage, timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream();
      if (fail) stream.push({ type: 'error', reason: 'error', error: message }); else stream.push({ type: 'done', reason: 'stop', message }); return stream;
    }; return session;
  };
}
function fixture(plans: any[]) {
  const root = mkdtempSync(join(tmpdir(), 'grounded-test-')), contexts: string[] = [], store = new MemoryStore(join(root, 'memory'));
  const core = new CustomerCore(factory(plans, contexts), 2000, undefined, undefined, store, undefined, undefined, undefined, undefined, 'grounded');
  const client = core.client({ channel: 'terminal', scope: 'grounded-test', user: 'A' });
  return { core, client, contexts, store, root, async send(prompt: string) { let answer = ''; await client.send(prompt, { text: s => answer += s, status() {} }); return answer.trim(); },
    async close() { await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); } };
}

test('retrieves evidence with a contextual query and composes an English answer instead of selecting a FAQ reply', async () => {
  const entry = enrollment();
  const f = fixture([{ intent: 'lookup', query: 'enrollment instructions', ids: ['faq:enroll'] },
    { intent: 'answer', reply: 'Choose a course on the website and register. Create an account first if needed.',
      evidence: [{ id: 'faq:enroll', quote: entry.text }], sourceLabel: 'Sources' }]);
  try {
    const answer = await f.send('How do I sign up for a training course?');
    assert.match(answer, /^Choose a course/); assert.match(answer, /https:\/\/cbtumu.net\/faq\//);
    assert.equal(f.contexts.length, 2);
    assert.match(f.contexts[0], /Reply naturally in the user's language/);
    assert.doesNotMatch(f.contexts[0], /Available knowledge topics/);
    assert.match(f.contexts[1], /faq:enroll/);
  } finally { await f.close(); }
});

test('unknown and reactions preserve the user language without CBTU links, identity boilerplate or keyword overrides', async () => {
  const f = fixture([{ intent: 'unknown', reply: "I don't have that information." },
    { intent: 'unknown', reply: 'その情報は持っていません。' }, { intent: 'chat', reply: 'ค่อย ๆ เลือกได้ครับ' }]);
  try {
    for (const prompt of ['What is in my kitchen right now?', '私の部屋には何がありますか？', 'เยอะเลยนะ จำไม่ไหวเลย']) {
      const answer = await f.send(prompt); assert.doesNotMatch(answer, /https?:|CBTU|FAQ|ยังไม่ได้บันทึก/);
    }
    const memory = JSON.parse(await f.client.memory!()); assert.deepEqual(memory.profile, {}); assert.deepEqual(memory.longTerm, []);
  } finally { await f.close(); }
});

test('renderer rejects unseen IDs, invented quotes, reply URLs, false completed actions and references on unknown', () => {
  const docs = new Map<string, Evidence>([['seen', { id: 'seen', title: 'Known fact', text: 'Only a public fact.', url: 'https://cbtumu.net/faq/' }]]);
  for (const plan of [
    { intent: 'answer', reply: 'A fact', evidence: [{ id: 'missing', quote: 'public fact' }] },
    { intent: 'answer', reply: 'A fact', evidence: [{ id: 'seen', quote: 'invented fact' }] },
    { intent: 'chat', reply: 'See https://cbtumu.net/faq/' },
    { intent: 'chat', reply: 'บันทึกข้อมูลแล้วครับ' },
    { intent: 'unknown', reply: 'Unknown', evidence: [{ id: 'seen', quote: 'public fact' }] },
  ]) assert.throws(() => renderGroundedAnswer(plan, docs));
});

test('bad evidence gets at most one repair; a retrieved source cannot grant a memory write', async () => {
  const bad = { intent: 'answer', reply: 'Invented fact', evidence: [{ id: 'fake', quote: 'not supplied' }] };
  const f = fixture([bad, bad]);
  try { await assert.rejects(f.send('Tell me a fact'), /หลักฐาน/); assert.equal(f.contexts.length, 2); assert.equal(JSON.parse(await f.client.memory!()).recent.length, 0); }
  finally { await f.close(); }
  const g = fixture([{ intent: 'lookup', query: 'สมัคร' },
    { intent: 'memory', action: 'save', explicit: true, entries: [{ kind: 'long_term', value: 'ชอบออนไลน์', source: 'current', quote: 'ชอบออนไลน์' }] },
    { intent: 'unknown', reply: 'I do not have that information.' }]);
  try { await g.send('What can you find?'); assert.deepEqual(JSON.parse(await g.client.memory!()).longTerm, []); assert.equal(g.contexts.length, 3); }
  finally { await g.close(); }
});

test('catalog operations remain host-executed but the reply can be composed in another language', async () => {
  const f = fixture([{ intent: 'catalog_query', operation: 'list', scope: 'search', query: 'AI', limit: 3 },
    { intent: 'answer', reply: 'The snapshot contains 12 AI-related entries; the first three include AI for Research, AI for Work, and AI Agent for ALL.',
      evidence: [{ id: 'turn:catalog', quote: 'พบ 12 รายการ แสดง 1–3' }] }]);
  try {
    const answer = await f.send('Show AI courses, please.'); assert.match(answer, /^The snapshot/); assert.match(answer, /https:\/\/cbtumu.net\//);
    const memory = JSON.parse(await f.client.memory!()); assert.equal(memory.catalog.matchedIds.length, 12); assert.equal(memory.catalog.shownIds.length, 3);
    assert.doesNotMatch(memory.recent.at(-1).assistant, /"intent"/);
  } finally { await f.close(); }
});

test('explicit memory writes/recall retain consent guards in the experimental conversation', async () => {
  const save = { intent: 'memory', action: 'save', explicit: true, entries: [{ kind: 'long_term', value: 'ชอบออนไลน์', source: 'current', quote: 'ชอบออนไลน์' }] };
  const f = fixture([save, { intent: 'memory', action: 'recall' }, save]);
  try {
    assert.match(await f.send('ช่วยจำว่าฉันชอบออนไลน์'), /บันทึกแล้ว/);
    assert.match(await f.send('จำอะไรได้บ้าง'), /ชอบออนไลน์/);
    assert.doesNotMatch(await f.send('จำได้ไหมว่าฉันชอบออนไลน์'), /บันทึกแล้ว/);
    assert.deepEqual(JSON.parse(await f.client.memory!()).longTerm, ['ชอบออนไลน์']);
  } finally { await f.close(); }
});

test('lexical retrieval only returns bounded published documents and leaves a no-match query empty', () => {
  const docs = publicEvidence();
  const found = retrieveEvidence('ทวีศักดิ์ สมานชื่น ประวัติ', docs);
  assert.ok(found.some(d => d.id.startsWith('person:'))); assert.ok(found.length <= 6); assert.ok(found.every(d => d.text.length <= 2400));
  assert.deepEqual(retrieveEvidence('unmatchablefixtureterm', docs), []);
  assert.ok(retrieveEvidence('enroll', docs).some(d => d.id === 'faq:enroll'));
  assert.equal(retrieveEvidence('any translated expression', docs, 6, ['faq:enroll'])[0].id, 'faq:enroll');
});

test('default direct/group adapters preserve channel gates and never attach FAQ on unknown or service failure', async () => {
  for (const mode of ['line-direct', 'line-group'] as const) {
    const root = mkdtempSync(join(tmpdir(), 'grounded-line-')), contexts: string[] = [];
    const sim = createTerminalLineSimulation({ root, mode, timeoutMs: 1000,
      factory: factory([{ intent: 'unknown', reply: "I don't know that." }, 'provider-fail'], contexts) });
    const send = async (prompt: string) => { let text = ''; await sim.client.send(prompt, { text: s => text += s, status() {} }); return text; };
    try {
      assert.equal((await send('Unknown question')).trim(), "I don't know that.");
      assert.doesNotMatch(await send('Try again'), /https?:|faq/i);
      const help = await send('/help'); assert.match(help, mode === 'line-group' ? /กรุณาใช้แชตส่วนตัว/ : /LINE OA/);
    } finally { await sim.dispose(); rmSync(root, { recursive: true, force: true }); }
  }
});


test('ten-course listing can cite twelve exact passages from one source without being rejected', () => {
  const text = executeCatalogQuery({ operation: 'list', scope: 'search', query: 'AI', limit: 10 }).answer!;
  const quotes = [text.split('\n')[0], ...text.split('\n').filter(line => /^\d+\. /.test(line)), text.split('\n').at(-1)!];
  assert.equal(quotes.length, 12);
  const docs = new Map<string, Evidence>([['turn:catalog', { id: 'turn:catalog', title: 'Listing', text, url: 'https://cbtumu.net/coursenew/dataanalysiswithai/' }]]);
  const plan = { intent: 'answer', reply: 'พบคอร์ส AI 12 รายการครับ', evidence: quotes.map(quote => ({ id: 'turn:catalog', quote })) };
  const answer = renderGroundedAnswer(plan, docs);
  assert.match(answer, /12 รายการ/);
  assert.equal((answer.match(/https:\/\//g) ?? []).length, 1);
  // Check every passage, including entries beyond the old six-item limit.
  assert.throws(() => renderGroundedAnswer({ ...plan, evidence: [...plan.evidence, { id: 'turn:catalog', quote: 'invented after the first six references' }] }, docs), /exact substring/);
  assert.throws(() => renderGroundedAnswer({ ...plan, evidence: Array.from({ length: 33 }, () => plan.evidence[0]) }, docs), /1-32/);
  const seven = new Map(Array.from({ length: 7 }, (_, i) => [String(i), { id: String(i), title: 'Doc', text: 'Verified passage.' }]));
  assert.throws(() => renderGroundedAnswer({ ...plan, evidence: [...seven.keys()].map(id => ({ id, quote: 'Verified passage.' })) }, seven), /six distinct/);
});

test('repair explains the precise violated bound instead of asking for the same invalid output again', async () => {
  const f = fixture([{ intent: 'chat', reply: 'Hello', sourceLabel: 'x'.repeat(41) }, { intent: 'chat', reply: 'Hello' }]);
  try {
    assert.equal(await f.send('Hi'), 'Hello');
    assert.match(f.contexts[1], /Source label must contain at most 40 characters/);
  } finally { await f.close(); }
});

test('short target reply retains the pending instructor field and actual previous clarification in context', async () => {
  const f = fixture([{ intent: 'chat', reply: 'ต้องการทราบผู้สอนของหลักสูตรไหนครับ?' },
    { intent: 'catalog_query', operation: 'read', scope: 'search', query: 'AI', fields: ['instructors'], limit: 3 },
    { intent: 'answer', reply: 'AI for Research มีผู้สอนชื่อ ผศ. ดร.ทวีศักดิ์ สมานชื่นครับ',
      evidence: [{ id: 'turn:catalog', quote: 'วิทยากร: ผศ. ดร.ทวีศักดิ์ สมานชื่น' }] }]);
  try {
    await f.send('ผู้สอนคือใคร');
    const answer = await f.send('ai'); assert.match(answer, /ทวีศักดิ์/); assert.doesNotMatch(answer, /ไม่กลับมา|ยังไม่มีข้อมูล/);
    assert.match(f.contexts[1], /ต้องการทราบผู้สอนของหลักสูตรไหน/);
    assert.deepEqual(JSON.parse(await f.client.memory!()).catalog.readFields, ['instructors']);
  } finally { await f.close(); }
});

test('experimental operational errors distinguish validation, timeout, quota and network without leaking private errors or FAQ links', () => {
  const cases = [
    ['ยังตรวจรูปแบบหรือหลักฐานคำตอบไม่ผ่าน', /หลักฐาน/], ['Model request timed out after 1000 ms.', /เกินกำหนด/],
    ['Model rate limit reached (HTTP 429). private-fixture', /โควตา/], ['Model network connection failed. private-fixture', /เชื่อมต่อ/],
    ['จำนวนครั้งเรียกโมเดลไม่พอสำหรับค้นและตอบ', /จำนวนครั้ง/],
  ] as const;
  for (const [message, expected] of cases) {
    const answer = neutralFailureReply(new DemoFailure(message)); assert.match(answer, expected); assert.doesNotMatch(answer, /private-fixture|https?:|FAQ/);
  }
  assert.doesNotMatch(neutralFailureReply(new Error('private-fixture')), /private-fixture/);
});


test('unused field projections do not invalidate a listing; read still enforces its public projection schema', () => {
  const plan = { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'Canva', fields: Object.keys(courseFields), limit: 10 };
  const output = executeGroundedCatalog(plan, command => executeCatalogQuery(parseCatalogQuery(command, 'model')).answer!);
  assert.match(output, /สร้างสื่อสวยด้วย Canva/);
  assert.equal(plan.fields.length, Object.keys(courseFields).length, 'normalization does not mutate the model plan');
  assert.throws(() => executeGroundedCatalog({ ...plan, operation: 'read' }, () => { assert.fail('invalid read must not execute'); }), /1-5 distinct fields/);
});

test('an exact long quote is accepted without truncation while any invented suffix still fails verification', () => {
  const text = executeCatalogQuery({ operation: 'list', scope: 'all', limit: 10 }).answer!;
  assert.ok(text.length > 800);
  const docs = new Map<string, Evidence>([['turn:catalog', { id: 'turn:catalog', title: 'Listing', text }]]);
  const plan = { intent: 'answer', reply: 'แสดงรายการตามข้อมูลที่เก็บไว้ครับ', evidence: [{ id: 'turn:catalog', quote: text }] };
  assert.match(renderGroundedAnswer(plan, docs), /แสดงรายการ/);
  assert.throws(() => renderGroundedAnswer({ ...plan, evidence: [{ id: 'turn:catalog', quote: text + 'invented suffix' }] }, docs), /exact substring/);
});

test('broad browsing followed by a subject reply executes despite an unused full field projection', async () => {
  const f = fixture([{ intent: 'chat', reply: 'สนใจด้านไหนครับ?' },
    { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'Canva', fields: Object.keys(courseFields), limit: 3 },
    { intent: 'answer', reply: 'มีหลักสูตรสร้างสื่อสวยด้วย Canva ในข้อมูลครับ',
      evidence: [{ id: 'turn:catalog', quote: 'สร้างสื่อสวยด้วย Canva' }] }]);
  try {
    await f.send('มีคอร์สอะไรบ้าง');
    assert.match(await f.send('canva'), /สร้างสื่อสวยด้วย Canva/);
    assert.equal(f.contexts.length, 3);
  } finally { await f.close(); }
});


function evidenceInLastRequest(rawContext: string): Evidence[] {
  const context = JSON.parse(rawContext);
  const content = context.messages.filter((m: any) => m.role === 'user').at(-1).content;
  const text = typeof content === 'string' ? content : content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  const line = text.split('\n').find((s: string) => s.startsWith('Evidence DATA'));
  return JSON.parse(line.slice(line.indexOf(': ') + 2, -1));
}
const researchAnswer = () => ({ intent: 'answer', reply: 'Research มีวิทยากรชื่อ ผศ. ดร.ทวีศักดิ์ สมานชื่นครับ',
  evidence: [{ id: 'course:cbtu-02', quote: 'instructors: ผศ. ดร.ทวีศักดิ์ สมานชื่น' }] });

test('research followed by who-teaches reuses still-published evidence without a second lookup', async () => {
  const f = fixture([{ intent: 'lookup', query: 'AI for Research', ids: ['course:cbtu-02'] }, researchAnswer(), researchAnswer()]);
  try {
    await f.send('research');
    assert.deepEqual(JSON.parse(await f.client.memory!()).evidenceIds, ['course:cbtu-02']);
    assert.match(await f.send('ใครสอน'), /ทวีศักดิ์/);
    assert.equal(f.contexts.length, 3, 'follow-up requires only the answer model call');
    assert.ok(evidenceInLastRequest(f.contexts[2]).some(d => d.id === 'course:cbtu-02' && d.text.includes('instructors: ผศ. ดร.ทวีศักดิ์')));
    assert.deepEqual(JSON.parse(await f.client.memory!()).profile, {});
  } finally { await f.close(); }
});

test('evidence pointers survive compaction and reopening while reset and identity boundaries clear their use', async () => {
  const plans = [{ intent: 'lookup', query: 'AI for Research', ids: ['course:cbtu-02'] }, researchAnswer(),
    ...Array.from({ length: 13 }, () => ({ intent: 'chat', reply: 'ครับ' })), researchAnswer()];
  const f = fixture(plans); let reopened: CustomerCore | undefined;
  try {
    await f.send('research');
    for (let i = 0; i < 13; i++) await f.send('คุยต่ออีกนิด');
    assert.ok(JSON.parse(await f.client.memory!()).compactions > 0);
    await f.core.dispose();
    reopened = new CustomerCore(factory(plans, f.contexts), 2000, undefined, undefined, f.store, undefined, undefined, undefined, undefined, 'grounded');
    const client = reopened.client({ channel: 'terminal', scope: 'grounded-test', user: 'A' });
    let answer = ''; await client.send('ใครสอน', { text: s => answer += s, status() {} });
    assert.match(answer, /ทวีศักดิ์/);
    assert.ok(evidenceInLastRequest(f.contexts.at(-1)!).some(d => d.id === 'course:cbtu-02'));
    await client.reset!(); assert.equal(JSON.parse(await client.memory!()).evidenceIds, undefined);
    plans.push({ intent: 'unknown', reply: 'Which course do you mean?' });
    await client.send('ใครสอน', { text() {}, status() {} });
    assert.ok(!evidenceInLastRequest(f.contexts.at(-1)!).some(d => d.id === 'course:cbtu-02'));
    plans.push({ intent: 'unknown', reply: 'Which course do you mean?' });
    await reopened.client({ channel: 'terminal', scope: 'grounded-test', user: 'B' }).send('ใครสอน', { text() {}, status() {} });
    assert.ok(!evidenceInLastRequest(f.contexts.at(-1)!).some(d => d.id === 'course:cbtu-02'));
  } finally { await reopened?.dispose(); await f.close(); }
});

test('conversation evidence uses current published records, never resurrects retired IDs, and rejects unsafe pointer metadata', () => {
  const doc: Evidence = { id: 'course:cbtu-02', title: 'Current record', text: 'Current teacher.', url: 'https://cbtumu.net/research/' };
  assert.deepEqual(conversationEvidence([doc], ['course:cbtu-02']).map(d => d.text), ['Current teacher.']);
  assert.deepEqual(conversationEvidence([], ['course:cbtu-02'], 'Old answer https://cbtumu.net/research/'), []);
  assert.deepEqual(conversationEvidence([doc], [], 'Earlier answer https://cbtumu.net/research/').map(d => d.id), ['course:cbtu-02']);
  for (const value of [['host:capabilities'], ['../../private'], Array(7).fill('course:cbtu-02'), ['course:cbtu-02', 'course:cbtu-02']]) assert.equal(validEvidenceIds(value), false);
  assert.equal(validEvidenceIds(['course:cbtu-02']), true);
});

test('new retrieval replaces previous public evidence rather than mixing an obsolete result into the answer', async () => {
  const f = fixture([{ intent: 'lookup', query: 'AI for Research', ids: ['course:cbtu-02'] }, researchAnswer(),
    { intent: 'catalog_query', operation: 'list', scope: 'search', query: 'Canva', limit: 1 },
    { intent: 'answer', reply: 'พบหลักสูตรสร้างสื่อสวยด้วย Canva ครับ', evidence: [{ id: 'turn:catalog', quote: 'สร้างสื่อสวยด้วย Canva' }] }]);
  try {
    await f.send('research'); await f.send('เปลี่ยนเป็น Canva');
    assert.ok(!evidenceInLastRequest(f.contexts.at(-1)!).some(d => d.id === 'course:cbtu-02'));
    assert.deepEqual(JSON.parse(await f.client.memory!()).evidenceIds, ['course:cbtu-07']);
  } finally { await f.close(); }
});


test('truncated composition returns the current validated catalog result without leaking partial JSON or repeating the read', async () => {
  const f = fixture([{ intent: 'catalog_query', operation: 'list', scope: 'all', limit: 3 }, 'output-length']);
  try {
    const answer = await f.send('มีคอร์สออะไรบ้าง');
    assert.match(answer, /พบ 20 รายการ/); assert.match(answer, /Data Analysis with AI/);
    assert.doesNotMatch(answer, /unfinished|รูปแบบคำตอบไม่สมบูรณ์/);
    assert.equal(f.contexts.length, 2);
    const memory = JSON.parse(await f.client.memory!());
    assert.equal(memory.catalog.shownIds.length, 3); assert.ok(memory.evidenceIds.length > 0);
    assert.doesNotMatch(memory.recent.at(-1).assistant, /unfinished/);
  } finally { await f.close(); }
});

test('invalid composed evidence also falls back only to the current validated read result', async () => {
  const f = fixture([{ intent: 'catalog_query', operation: 'list', scope: 'search', query: 'Canva', limit: 1 },
    { intent: 'answer', reply: 'Invented text', evidence: [{ id: 'forged', quote: 'never provided' }] }]);
  try {
    const answer = await f.send('Canva'); assert.match(answer, /สร้างสื่อสวยด้วย Canva/); assert.doesNotMatch(answer, /Invented text/);
    assert.equal(f.contexts.length, 2);
  } finally { await f.close(); }
});

test('empty/truncated/JSON-generation failures before retrieval get at most one short repair', async () => {
  for (const failure of ['output-length', 'empty-answer', 'json-generation-error']) {
    const f = fixture([failure, { intent: 'chat', reply: 'สนใจด้านไหนครับ?' }]);
    try {
      assert.equal(await f.send('มีหลักสูตรอะไรบ้าง'), 'สนใจด้านไหนครับ?');
      assert.equal(f.contexts.length, 2); assert.match(f.contexts[1], /COMPLETE SHORT JSON/);
    } finally { await f.close(); }
  }
  const g = fixture(['output-length', 'output-length']);
  try { await assert.rejects(g.send('ขอดูหลักสูตร'), /output token budget/); assert.equal(g.contexts.length, 2); assert.equal(JSON.parse(await g.client.memory!()).recent.length, 0); }
  finally { await g.close(); }
});

test('format repair after public lookup keeps its evidence and never retries quota or network errors', async () => {
  const f = fixture([{ intent: 'lookup', query: 'AI for Research', ids: ['course:cbtu-02'] }, 'output-length', researchAnswer()]);
  try { assert.match(await f.send('research'), /ทวีศักดิ์/); assert.equal(f.contexts.length, 3); }
  finally { await f.close(); }
  for (const failure of ['provider-fail', 'network-fail']) {
    const g = fixture([failure]);
    try { await assert.rejects(g.send('ขอดูหลักสูตร')); assert.equal(g.contexts.length, 1); }
    finally { await g.close(); }
  }
});

test('a later failed turn cannot fall back to an earlier course result or commit a partial new selection', async () => {
  const f = fixture([{ intent: 'catalog_query', operation: 'list', scope: 'search', query: 'Canva', limit: 1 },
    { intent: 'answer', reply: 'พบหลักสูตร Canva ครับ', evidence: [{ id: 'turn:catalog', quote: 'สร้างสื่อสวยด้วย Canva' }] },
    'output-length', 'output-length']);
  try {
    await f.send('Canva'); const before = JSON.parse(await f.client.memory!());
    await assert.rejects(f.send('ขอถามเรื่องใหม่'), /output token budget/);
    assert.deepEqual(JSON.parse(await f.client.memory!()), before);
  } finally { await f.close(); }
  const g = fixture([{ intent: 'catalog_query', operation: 'list', scope: 'all', limit: 3 }, 'provider-fail']);
  try {
    await assert.rejects(g.send('มีหลักสูตรอะไรบ้าง'), /429/);
    assert.equal(g.contexts.length, 2); const memory = JSON.parse(await g.client.memory!());
    assert.equal(memory.catalog, undefined); assert.equal(memory.evidenceIds, undefined); assert.equal(memory.recent.length, 0);
  } finally { await g.close(); }
});
