import test from 'node:test';
import { courseInstructors } from './course-instructors.js';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { courseCatalog } from './course-catalog.js';
import { readCourseFields, validCourseFields, filterCourses } from './course-reader.js';
import { executeCatalogQuery, parseCatalogQuery, validCatalogState, routeCatalog } from './catalog-query.js';
import { LineAdapter } from './line.js';

test('public reader restricts fields and renders stored instructors and missing values faithfully', () => {
  for (const fields of [[], ['apiKey'], ['__proto__'], ['../../.env'], ['instructors', 'instructors'], Array(6).fill('name')]) {
    assert.equal(validCourseFields(fields), false);
    assert.throws(() => parseCatalogQuery({ operation: 'read', scope: 'all', fields }));
  }
  const course = courseCatalog.courses.find(c => c.id === 'cbtu-06')!;
  assert.ok(course.instructors?.length);
  assert.ok(readCourseFields([course], ['instructors']).includes(course.instructors[0].name));
  assert.ok(readCourseFields([course], ['topics']).includes(course.topics!.at(-1)!));
  const missing = { ...course, instructors: null, instructor_evidence: [] };
  assert.match(readCourseFields([missing], ['instructors']), /ยังไม่พบหลักฐานชื่อผู้สอน/);
  assert.ok(!readCourseFields([missing], ['instructors']).includes(course.instructors_text!));
  assert.match(readCourseFields([], ['instructors']), /หลักสูตรไหน/);
  assert.throws(() => readCourseFields(Array(4).fill(course), ['name']));
});

test('public reads follow displayed scope and paginate without losing the requested fields', () => {
  const listed = executeCatalogQuery({ operation: 'list', scope: 'all', limit: 3 });
  const read = executeCatalogQuery({ operation: 'read', scope: 'previous', fields: ['instructors', 'certificate'] }, listed.state);
  assert.deepEqual(read.state!.shownIds, listed.state!.shownIds);
  const next = executeCatalogQuery({ operation: 'more', scope: 'previous' }, read.state);
  assert.ok(validCatalogState(next.state));
  assert.deepEqual(next.state!.readFields, ['instructors', 'certificate']);
  assert.ok(next.state!.shownIds.every(id => !read.state!.shownIds.includes(id)));
  assert.match(next.answer!, /วิทยากร:/);
});

test('teacher search uses verified structured names, preserves the result set for prices/count/paging and excludes unknown authors', () => {
  assert.equal(courseCatalog.schemaVersion, '1.1.0');
  assert.equal(courseCatalog.validationWarnings.length, 21);
  assert.equal(courseCatalog.courses.filter(c => c.record_type === 'course' && c.instructors).length, 19);
  const missing = courseCatalog.courses.filter(c => c.record_type === 'course' && !c.instructors);
  assert.equal(missing.length, 0);
  for (const c of missing) {
    assert.ok(c.missing_fields.includes('instructors'));
    assert.match(readCourseFields([c], ['instructors']), /ยังไม่พบหลักฐาน/);
    if (c.instructors_text) assert.ok(!readCourseFields([c], ['instructors']).includes(c.instructors_text));
  }
  const expected = filterCourses(courseCatalog.courses, [{ field: 'instructors', value: 'ทวีศักดิ์' }]);
  assert.ok(expected.length > 3);
  assert.deepEqual(filterCourses(courseCatalog.courses, [{ field: 'instructors', value: 'ทวีศักดิ์  สมานชื่น' }]), expected);
  assert.deepEqual(filterCourses(missing, [{ field: 'instructors', value: 'taweesak samanchuen' }]), []);
  for (const c of expected) assert.ok(courseInstructors(c).some(t => t.name.includes('ทวีศักดิ์')));
  const first = routeCatalog('มีหลักสูตรไหนที่อาจารย์ทวีศักดิ์สอนบ้าง')!;
  assert.deepEqual(first.state!.matchedIds, expected.map(c => c.id));
  assert.match(routeCatalog('ขอราคาแต่ละตัวด้วย', first.state)!.answer!, /ราคาใน snapshot/);
  assert.deepEqual(routeCatalog('ดูต่อ', first.state)!.state!.matchedIds, first.state!.matchedIds);
  assert.match(executeCatalogQuery({ operation: 'count', scope: 'previous' }, first.state).answer!, new RegExp(`รวม ${expected.length} รายการ`));
  assert.deepEqual(filterCourses(courseCatalog.courses, [{ field: 'instructors', value: 'ไม่มีชื่อนี้' }]), []);
  assert.throws(() => parseCatalogQuery({ operation: 'list', scope: 'all', filters: [{ field: 'apiKey', value: 'x' }] }));
  const comparison = executeCatalogQuery({ operation: 'read', scope: 'search', query: 'Excel Canva', fields: ['instructors'] });
  assert.deepEqual(comparison.state!.shownIds, ['cbtu-06', 'cbtu-07']);
  for (const id of comparison.state!.shownIds) assert.ok(comparison.answer!.includes(courseCatalog.courses.find(c => c.id === id)!.instructors![0].name));
});

test('semantic field reads work with candidate retrieval and follow-up context; host ignores invented model facts', async () => {
  const plans: object[] = [
    { intent: 'catalog_query', operation: 'read', scope: 'search', query: 'Excel', fields: ['instructors'], reply: 'invented teacher' },
    { intent: 'catalog_query', operation: 'read', scope: 'search', query: 'Canva', fields: ['instructors'] },
    { intent: 'catalog_query', operation: 'read', scope: 'previous', fields: ['certificate'] },
  ];
  const prompts: string[] = [];
  const core = new CustomerCore(async manager => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      const user = context.messages.filter(m => m.role === 'user').at(-1);
      prompts.push(typeof user?.content === 'string' ? user.content : user?.content.filter(p => p.type === 'text').map(p => p.text).join('') ?? '');
      const message: AssistantMessage = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plans.shift()) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message }); return stream;
    };
    return session;
  }, 2000);
  const client = core.client({ channel: 'line', scope: 'fixture:direct', user: 'A' });
  const replies: string[] = [], secret = 'reader-test-only';
  const adapter = new LineAdapter({ core, secret, account: 'fixture', dryRun: false, allowedUsers: new Set(['A']),
    reply: async (_token, text) => { replies.push(text); } });
  let event = 0;
  const send = async (text: string) => {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: `reader-${event++}`, replyToken: 'mock-only',
      source: { type: 'user', userId: 'A' }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', secret).update(raw).digest('base64')), 200);
    await adapter.drain(); return replies.at(-1)!;
  };
  try {
    const answer = await send('Excel ใครเป็นคนถ่ายทอดความรู้ให้');
    assert.ok(answer.includes(courseCatalog.courses.find(c => c.id === 'cbtu-06')!.instructors![0].name));
    assert.doesNotMatch(answer, /invented teacher|catalog_query/);
    const followup = await send('แล้ว Canva ล่ะ');
    assert.ok(followup.includes(courseCatalog.courses.find(c => c.id === 'cbtu-07')!.instructors![0].name));
    assert.doesNotMatch(followup, /กานต์นภัส/);
    assert.match(await send('แล้วจบได้ประกาศนียบัตรหรือเปล่า'), /ใบประกาศ/);
    assert.equal(plans.length, 0);
    assert.ok(prompts[0].includes('instructors'));
    const memory = JSON.parse(await client.memory!());
    assert.deepEqual(memory.catalog.shownIds, ['cbtu-07']);
    assert.deepEqual(memory.catalog.readFields, ['certificate']);
    assert.equal(JSON.parse(await core.client({ channel: 'line', scope: 'fixture:direct', user: 'B' }).memory!()).catalog, undefined);
  } finally { adapter.close(); await core.dispose(); }
});
