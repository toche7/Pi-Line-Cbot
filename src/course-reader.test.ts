import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { CustomerCore } from './core.js';
import { courseCatalog } from './course-catalog.js';
import { readCourseFields, validCourseFields } from './course-reader.js';
import { executeCatalogQuery, parseCatalogQuery, validCatalogState } from './catalog-query.js';

test('public reader restricts fields and renders stored instructors and missing values faithfully', () => {
  for (const fields of [[], ['apiKey'], ['__proto__'], ['../../.env'], ['instructors', 'instructors'], Array(6).fill('name')]) {
    assert.equal(validCourseFields(fields), false);
    assert.throws(() => parseCatalogQuery({ operation: 'read', scope: 'all', fields }));
  }
  const course = courseCatalog.courses.find(c => c.id === 'cbtu-06')!;
  assert.ok(course.instructors_text);
  assert.ok(readCourseFields([course], ['instructors']).includes(course.instructors_text));
  assert.ok(readCourseFields([course], ['topics']).includes(course.topics!.at(-1)!));
  const missing = { ...course, instructors_text: null };
  assert.match(readCourseFields([missing], ['instructors']), /ไม่พบข้อมูลส่วนนี้/);
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

test('semantic field reads work with candidate retrieval and follow-up context; host ignores invented model facts', async () => {
  const plans: object[] = [
    { intent: 'catalog_query', operation: 'read', scope: 'search', query: 'Excel', fields: ['instructors'], reply: 'invented teacher' },
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
  const send = async (q: string) => { let text = ''; await client.send(q, { text: s => { text += s; }, status: () => {} }); return text; };
  try {
    const answer = await send('Excel ใครเป็นคนถ่ายทอดความรู้ให้');
    assert.ok(answer.includes(courseCatalog.courses.find(c => c.id === 'cbtu-06')!.instructors_text!));
    assert.doesNotMatch(answer, /invented teacher|catalog_query/);
    assert.match(await send('แล้วจบได้ประกาศนียบัตรหรือเปล่า'), /ใบประกาศ/);
    assert.equal(plans.length, 0);
    assert.ok(prompts[0].includes('instructors'));
    const memory = JSON.parse(await client.memory!());
    assert.deepEqual(memory.catalog.shownIds, ['cbtu-06']);
    assert.deepEqual(memory.catalog.readFields, ['certificate']);
    assert.equal(JSON.parse(await core.client({ channel: 'line', scope: 'fixture:direct', user: 'B' }).memory!()).catalog, undefined);
  } finally { await core.dispose(); }
});
