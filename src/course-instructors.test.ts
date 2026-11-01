import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCatalogQuery, parseCatalogQuery } from './catalog-query.js';
import { courseCatalog, structuredCourseCatalog } from './course-catalog.js';
import { courseInstructors } from './course-instructors.js';
import { readCourseFields, filterCourses } from './course-reader.js';
import { retrieveCourses } from './catalog.js';
import { publicEvidence } from './grounded-evidence.js';
import { renderGroundedAnswer, executeGroundedCatalog } from './grounded-dialogue.js';
const workshop = () => courseCatalog.courses.find(c => c.id === 'cbtu-10')!;

test('workshop stores its instructor as a normal name without confirmation metadata', () => {
  const record = structuredCourseCatalog.courses.find(c => c.id === 'cbtu-10')!;
  assert.deepEqual(record.teaching.instructors, [{ name: 'ผศ.ดร. ทวีศักดิ์ สมานชื่น' }]);
  assert.ok(!('projectConfirmations' in record.teaching));
  assert.deepEqual(workshop().instructors, record.teaching.instructors);
  assert.ok(!workshop().missing_fields.includes('instructors'));
  assert.doesNotMatch(JSON.stringify(record.teaching), /confirmedAt|user_confirmation|project_confirmation/);
});

test('reader and search use the ordinary workshop instructor and never infer a teacher from By text', () => {
  const answer = readCourseFields([workshop()], ['instructors']);
  assert.match(answer, /วิทยากร: ผศ.ดร. ทวีศักดิ์ สมานชื่น/);
  assert.doesNotMatch(answer, /คำยืนยัน|แชตโครงการ|2026-11-01|หลักฐานผู้สอนจากเว็บ/);
  assert.ok(filterCourses(courseCatalog.courses, [{ field: 'instructors', value: 'ทวีศักดิ์' }]).some(c => c.id === 'cbtu-10'));
  assert.ok(retrieveCourses('ทวีศักดิ์ สมานชื่น').instructorMatches.some(c => c.id === 'cbtu-10'));
  assert.deepEqual(courseInstructors({ ...workshop(), instructors: null, instructors_text: 'By taweesak samanchuen' }), []);
});

test('normal names do not fabricate archived website teacher evidence', () => {
  const record = structuredCourseCatalog.courses.find(c => c.id === 'cbtu-10')!;
  assert.equal(record.teaching.webInstructors, null);
  assert.deepEqual(record.teaching.webEvidence, []);
  assert.deepEqual(workshop().instructor_evidence, []);
});

test('grounded replies include the instructor name without a project-confirmation note', () => {
  const doc = publicEvidence().find(d => d.id === 'course:cbtu-10')!;
  assert.match(doc.text, /instructors: ผศ.ดร. ทวีศักดิ์ สมานชื่น/);
  const answer = renderGroundedAnswer({ intent: 'answer', reply: 'วิทยากรคือ ผศ.ดร. ทวีศักดิ์ สมานชื่นครับ',
    evidence: [{ id: doc.id, quote: 'instructors: ผศ.ดร. ทวีศักดิ์ สมานชื่น' }] }, new Map([[doc.id, doc]]));
  assert.doesNotMatch(answer, /คำยืนยัน|แชตโครงการ|2026-11-01/);
});

test('legacy ambiguous instructor operation with a course title reads its teacher; person_profile remains a person lookup', () => {
  const resolve = (plan: any) => executeCatalogQuery(parseCatalogQuery(plan, 'model')).answer!;
  const answer = executeGroundedCatalog({ operation: 'instructor', scope: 'search', query: 'AI Agent Workshop with n8n' }, resolve);
  assert.match(answer, /วิทยากร: ผศ.ดร. ทวีศักดิ์ สมานชื่น/);
  assert.doesNotMatch(answer, /คำยืนยัน|confirmedAt|user_confirmation/);
  const profile = executeGroundedCatalog({ operation: 'person_profile', scope: 'search', query: 'ทวีศักดิ์ สมานชื่น' }, resolve);
  assert.match(profile, /มีชื่อเป็นผู้สอน/);
  assert.throws(() => executeGroundedCatalog({ operation: 'person_profile', scope: 'search', query: 'AI Agent Workshop with n8n' }, resolve), /expects a person name/);
});
