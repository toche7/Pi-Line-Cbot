import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { courseCatalog } from './course-catalog.js';
import { courseBriefs, briefCard } from './course-briefs.js';
import { routeCatalog, validCatalogState, type CatalogState } from './catalog-query.js';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { MemoryStore } from './memory.js';

test('reviewed briefs cover every course, keep real topics/provenance and distinguish inferred work from taught outcomes', () => {
  assert.equal(courseBriefs.length, 20);
  for (const b of courseBriefs) {
    const raw = courseCatalog.courses.find(c => c.id === b.id)!;
    assert.ok(b.topics.length <= 5); assert.ok(b.topics.every(t => raw.topics?.includes(t)));
    assert.equal(b.evidence.source, raw.canonical_url);
    assert.equal(b.evidence.workExamplesBasis, 'inference_from_documented_topics_not_guaranteed_outcomes');
    assert.equal(b.prerequisites, raw.prerequisites_th); assert.deepEqual(b.price, raw.price);
    if (raw.detail_access === 'public') { assert.ok(b.workExamples.length >= 1); assert.ok(b.outcomes.length <= 2); }
    else { assert.deepEqual(b.workExamples, []); assert.deepEqual(b.outcomes, []); }
    const card = briefCard(raw);
    assert.ok(card.length < 700); assert.doesNotMatch(card, /ราคาแสดง|is_current|retrieved_at|ข้อความสถานะ|Enrollment|Add to Cart/);
  }
  assert.ok(courseBriefs.find(b => b.id === 'cbtu-06')!.topics.includes('PivotTable'));
});

test('job-first advice asks one stage at a time and does not pad weakly related choices', () => {
  let state: CatalogState | undefined;
  const send = (q: string) => { const r = routeCatalog(q, state)!; state = r.state; assert.ok(validCatalogState(state)); return r.answer!; };
  assert.match(send('ยังไม่รู้จะเรียนอะไร ช่วยแนะนำหน่อย'), /ช่วยงานอะไร/);
  assert.equal(state!.advice!.stage, 'goal');
  assert.match(send('อยากใช้ Excel สรุปยอดขาย'), /พื้นฐาน/);
  assert.equal(state!.advice!.stage, 'background');
  assert.match(send('เคยใช้ Excel เบื้องต้น แต่ไม่เขียนโปรแกรม'), /เวลาเรียน/);
  const answer = send('วันละ30นาที ชอบวิดีโอตามสะดวก');
  assert.equal(state!.advice!.stage, 'ready');
  assert.match(answer, /Microsoft Excel/); assert.match(answer, /PivotTable/);
  assert.doesNotMatch(answer, /AI Agents in Action|ราคา|Add to Cart|Last Updated|ข้อความสถานะ/);
  assert.match(answer, /เว็บยังไม่ระบุ/); // Missing prerequisite is not converted into beginner eligibility.
  assert.ok(answer.length < 900);
  assert.match(send('Excel หัวข้ออะไรบ้าง'), /PivotTable/);
  assert.doesNotMatch(send('Excel ต้องมีพื้นฐานไหม'), /เริ่มจากศูนย์ได้แน่นอน/);
  assert.match(send('Excel เรียนกี่ชั่วโมง'), /เว็บยังไม่ระบุระยะเวลา/);
  assert.match(send('Excel ราคาเท่าไร'), /1,000 THB/);
  assert.equal(routeCatalog('เหนื่อยจัง', state), undefined);
});

test('advice state persists through restart and remains isolated; reset/forget clear answers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-advice-'));
  let store = new MemoryStore(root);
  const factory = async (manager?: SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    modelRuntime.streamSimple = () => { throw new Error('Host-only advice must not call model'); };
    return session;
  };
  let core = new CustomerCore(factory, 1000, undefined, undefined, store);
  const identity = { channel: 'line' as const, scope: 'fixture:direct', user: 'A' };
  let client = core.client(identity);
  const send = async (q: string) => { let text = ''; await client.send(q, { text: s => { text += s; }, status: () => {} }); return text; };
  try {
    await send('ช่วยแนะนำหลักสูตร'); await send('อยากใช้ Excel สรุปยอดขาย');
    await core.dispose(); store.close(); store = new MemoryStore(root);
    core = new CustomerCore(factory, 1000, undefined, undefined, store); client = core.client(identity);
    assert.equal(JSON.parse(await client.memory!()).catalog.advice.stage, 'background');
    assert.equal(JSON.parse(await core.client({ ...identity, user: 'B' }).memory!()).catalog, undefined);
    assert.match(await send('เคยใช้ Excel แต่ไม่เขียนโปรแกรม'), /เวลาเรียน/);
    assert.match(await send('สะดวกวิดีโอวันละ30นาที'), /Microsoft Excel/);
    await client.reset!(); assert.equal(JSON.parse(await client.memory!()).catalog, undefined);
    await send('ช่วยแนะนำหลักสูตร');
    await client.forget!(await client.requestForget!()); assert.equal(JSON.parse(await client.memory!()).catalog, undefined);
  } finally { await core.dispose(); store.close(); rmSync(root, { recursive: true, force: true }); }
});
