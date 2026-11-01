import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { courseCatalog } from './course-catalog.js';
import { selectCatalog, retrieveCourses, renderCatalog, renderCatalogPlan, catalogContext, catalogTopicForAnswer } from './catalog.js';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { LineAdapter } from './line.js';

function modelFactory(requests: { candidates: string[]; prompt: string }[], fail = false) {
  return async (manager?: SessionManager) => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      const user = context.messages.filter(m => m.role === 'user').at(-1);
      const prompt = typeof user?.content === 'string' ? user.content : user?.content.filter(p => p.type === 'text').map(p => p.text).join('') ?? '';
      const data = prompt.match(/Host retrieved public course candidates[^\n]*?: (\[.*\])\nFor a general course description/s)?.[1];
      const candidates = data ? JSON.parse(data).map((c: { id: string }) => c.id) : [];
      requests.push({ candidates, prompt });
      const message: AssistantMessage = {
        role: 'assistant', provider: model.provider, model: model.id, api: model.api,
        content: fail ? [] : [{ type: 'text', text: JSON.stringify(candidates.length ? { intent: 'catalog', courseIds: candidates, reply: 'ราคาแต่ง 999999 บาท เปิดรับสมัครทันที' } : { intent: 'chat', reply: 'อยู่คุยกับคุณครับ' }) }],
        stopReason: fail ? 'error' : 'stop', errorMessage: fail ? '429 Please try again in 10s' : undefined, timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream();
      if (fail) stream.push({ type: 'error', reason: 'error', error: message });
      else stream.push({ type: 'done', reason: 'stop', message });
      return stream;
    };
    return session;
  };
}

test('catalog snapshot retains provenance, protected/null fields and unverified offers', () => {
  const rows = courseCatalog.courses;
  assert.equal(rows.length, 20); assert.equal(rows.filter(c => c.record_type === 'course').length, 19);
  assert.equal(new Set(rows.map(c => c.canonical_url)).size, 20);
  assert.match(courseCatalog.sourceSha256, /^[a-f0-9]{64}$/);
  for (const c of rows) {
    assert.match(c.canonical_url, /^https:\/\/cbtumu.net\//);
    assert.ok(Number.isFinite(Date.parse(c.provenance.retrieved_at)));
    assert.ok(c.field_sources['price,enrollment']);
    assert.equal(c.enrollment.is_live_availability_verified, false); assert.equal(c.price.is_current_offer_verified, false);
  }
  const protectedCourse = rows.find(c => c.id === 'cbtu-18')!;
  assert.equal(protectedCourse.description_th, null); assert.equal(protectedCourse.price.displayed_amount, null);
  assert.match(renderCatalog(selectCatalog('Basic Prompt Engineering Update')!), /ล็อก|รหัสผ่าน/);
});

test('retrieval supports aliases, ambiguity, Thai/English, comparison and contextual follow-ups without intercepting chat', () => {
  assert.equal(selectCatalog('เอ็กเซล')?.courses[0].id, 'cbtu-06');
  assert.equal(selectCatalog('Excel price')?.field, 'price');
  assert.ok(selectCatalog('Python')!.courses.some(c => c.topics?.some(t => t.includes('Python'))));
  assert.equal(selectCatalog('อยากคุยเล่นเรื่อง AI'), undefined);
  assert.deepEqual(selectCatalog('n8n')?.courses.map(c => c.id), ['cbtu-09', 'cbtu-10']);
  assert.equal(selectCatalog('n8n')?.kind, 'ambiguous');
  assert.equal(selectCatalog('Basic Prompt Engineering')?.courses.length, 3);
  assert.equal(selectCatalog('Basic Prompt Engineering 2026')?.courses[0].id, 'cbtu-11');
  assert.equal(selectCatalog('Mini Data Science รุ่นที่ 11')?.kind, 'not_found');
  const ambiguous = selectCatalog('n8n')!;
  assert.equal(selectCatalog('อันที่สอง', ambiguous.topic)?.courses[0].id, 'cbtu-10');
  assert.equal(selectCatalog('แล้วราคาล่ะ', 'catalog:cbtu-06')?.courses[0].id, 'cbtu-06');
  assert.deepEqual(selectCatalog('เปรียบเทียบอันแรกกับอันที่สอง', 'catalog:cbtu-06,cbtu-07')?.courses.map(c => c.id), ['cbtu-06', 'cbtu-07']);
  assert.equal(selectCatalog('แล้วสองอันนี้ต่างกันยังไง', 'catalog:cbtu-06,cbtu-07')?.kind, 'found');
  for (const q of ['แล้วคุณล่ะ', 'ทำอะไรอยู่', 'ฉันสนใจ AI', 'ฉันชื่อ Excel', 'ไม่อยากคุยเรื่องคอร์ส', 'ไม่พบคอร์ส', 'ติดต่อเจ้าหน้าที่เรื่องหลักสูตร']) {
    assert.equal(selectCatalog(q, 'catalog:cbtu-06'), undefined, q);
  }
  assert.equal(selectCatalog('พักก่อน', 'catalog:interest'), undefined);
  assert.equal(selectCatalog('แนะนำหลักสูตรที่เหมาะกับฉัน', undefined, 'Excel')?.courses[0].id, 'cbtu-06');
  assert.ok(retrieveCourses('งานวิจัย').ranked.some(c => c.course.id === 'cbtu-02'));
});

test('five acceptance cases use only selected catalog facts; memory and dialogue remain available', async () => {
  const requests: { candidates: string[]; prompt: string }[] = [];
  const core = new CustomerCore(modelFactory(requests), 1000);
  const client = core.client({ channel: 'terminal', scope: 'local', user: 'catalog-fixture' });
  const send = async (q: string) => { let text = ''; await client.send(q, { text: s => { text += s; }, status: () => {} }); return text; };
  try {
    assert.match(await send('ยังไม่รู้จะเรียนอะไร'), /ช่วยงานอะไร/);
    assert.equal(requests.length, 0);
    assert.match(await send('สนใจ Excel ไปใช้วิเคราะห์ข้อมูล'), /พื้นฐาน/);
    assert.match(await send('เคยใช้ Excel แต่ไม่เขียนโปรแกรม'), /เวลาเรียน/);
    const recommendation = await send('มีเวลาวันละ30นาที ชอบวิดีโอ');
    assert.match(recommendation, /Microsoft Excel/); assert.match(recommendation, /ตัวเลือก/);
    assert.equal(requests.length, 0, 'goal matching uses reviewed facts without model prose');
    const comparison = await send('เปรียบเทียบ Excel กับ Canva');
    assert.match(comparison, /Microsoft Excel/); assert.match(comparison, /สร้างสื่อสวยด้วย Canva/);
    assert.match(comparison, /เว็บยังไม่ระบุ/); assert.doesNotMatch(comparison, /999999|เปิดรับสมัครทันที/);
    assert.deepEqual(requests.at(-1)!.candidates, ['cbtu-06', 'cbtu-07']);
    const missing = await send('Basic Prompt Engineering (Update) ราคาเท่าไร');
    assert.match(missing, /ไม่พบราคา.*ไม่ถือว่าฟรี/); assert.match(missing, /https:\/\/cbtumu.net\/faq\//);
    const before = requests.length;
    assert.match(await send('มีคอร์ส Quantum Computing ไหม'), /ไม่พบ.*ในชุดข้อมูล.*ไม่ได้หมายความว่าไม่มี/);
    assert.equal(requests.length, before);
    assert.match(await send('แนะนำคอร์ส Data เป็นทางเลือกให้หน่อย'), /ช่วยงานอะไร/);
    assert.ok(requests.at(-1)!.candidates.length <= 3);
    assert.ok(!requests.at(-1)!.prompt.includes('Popular Course Bundle'));
    assert.match(await send('แล้วคุณล่ะ'), /อยู่คุย/);
    await send('ฉันชื่อ นักเรียนทดสอบ');
    assert.match(await client.memory!(), /นักเรียนทดสอบ/);
    assert.match(await send('จ่ายเงินแล้วเข้าเรียนทันทีไหม'), /ขัดกัน/);
    assert.match(await send('ตรวจ DEMO-1001'), /ข้อมูลสมมติ/);
  } finally { await core.dispose(); }
});

test('host rejects IDs outside retrieval, retains cohort warnings and answers grounded catalog during 429', async () => {
  const selection = selectCatalog('เปรียบเทียบ Excel กับ Canva')!;
  assert.throws(() => renderCatalogPlan({ intent: 'catalog', courseIds: ['cbtu-01'] }, selection));
  assert.throws(() => renderCatalogPlan({ intent: 'catalog', courseIds: ['cbtu-06'] }, selection));
  const reordered = renderCatalogPlan({ intent: 'catalog', courseIds: ['cbtu-07', 'cbtu-06'] }, selection);
  assert.equal(selectCatalog('อันแรก', catalogTopicForAnswer(reordered, selection))?.courses[0].id, 'cbtu-07');
  assert.match(renderCatalog(selectCatalog('Data Analytics ราคาเท่าไร')!), /วันเรียนเก่า|รุ่นจบแล้ว/);
  assert.doesNotMatch(renderCatalog(selectCatalog('Mini AI Agent Engineering')!), /ข้อความสถานะบนหน้าเดิม|เก็บ:|ราคาแสดง/);
  assert.equal(catalogContext(selection).length, 2);
  const requests: { candidates: string[]; prompt: string }[] = [], logs: object[] = [];
  const core = new CustomerCore(modelFactory(requests, true), 1000, r => logs.push(r));
  let text = '';
  try {
    const client = core.client({ channel: 'line', scope: 'test:direct', user: 'A' });
    for (const prompt of ['Excel รายละเอียด', 'Canva ราคาเท่าไร']) {
      text = ''; await client.send(prompt, { text: s => { text += s; }, status: () => {} });
      assert.match(text, prompt.includes('ราคา') ? /1,000 THB/ : /PivotTable/); assert.match(text, /ข้อมูลเว็บที่เก็บ/);
    }
    assert.equal(requests.length, 1, 'cooldown uses host facts without hammering provider');
    assert.match(JSON.stringify(logs), /catalog_model_fallback.*model_rate_limit/);
  } finally { await core.dispose(); }
});

test('signed LINE events use the same catalog retrieval and host comparison', async () => {
  const core = new CustomerCore(modelFactory([]), 1000);
  let reply = '';
  const secret = 'catalog-test-placeholder';
  const adapter = new LineAdapter({ core, account: 'test-oa', secret, dryRun: false, allowedUsers: new Set(['A']), reply: async (_t, text) => { reply = text; } });
  try {
    const body = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: 'catalog-event', replyToken: 'offline-placeholder',
      source: { type: 'user', userId: 'A' }, message: { type: 'text', text: 'เปรียบเทียบ Excel กับ Canva' } }] }));
    const signature = createHmac('sha256', secret).update(body).digest('base64');
    assert.equal(adapter.accept(body, signature), 200); await adapter.drain();
    assert.match(reply, /Microsoft Excel/); assert.match(reply, /สร้างสื่อสวยด้วย Canva/);
    assert.ok(reply.length < 4500);
  } finally { adapter.close(); await core.dispose(); }
});
