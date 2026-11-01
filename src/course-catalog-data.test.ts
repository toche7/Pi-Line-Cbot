import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { courseCatalog, structuredCourseCatalog } from './course-catalog.js';
import { courseInstructors } from './course-instructors.js';

test('grouped catalog preserves website fields and fingerprint except the explicitly edited instructors and free prices', () => {
  const raw = readFileSync(new URL('../research/cbtu-website/courses.json', import.meta.url), 'utf8');
  const original = JSON.parse(raw);
  assert.equal(createHash('sha256').update(raw).digest('hex'), courseCatalog.sourceSha256);
  assert.equal(structuredCourseCatalog.layoutVersion, 1);
  assert.equal(courseCatalog.courses.length, original.courses.length);
  for (const course of courseCatalog.courses) {
    const before = structuredClone(original.courses.find((c: { id: string }) => c.id === course.id));
    const teachers: Record<string, string> = {
      'cbtu-10': 'ผศ.ดร. ทวีศักดิ์ สมานชื่น', 'cbtu-14': 'ผศ.ดร. ทวีศักดิ์ สมานชื่น',
      'cbtu-17': 'ผศ. ดร.วรัญญู วงษ์เสรี', 'cbtu-18': 'ผศ.ดร. ทวีศักดิ์ สมานชื่น', 'cbtu-19': 'ผศ.ดร. ทวีศักดิ์ สมานชื่น',
    };
    if (teachers[course.id]) {
      before.instructors = [{ name: teachers[course.id] }];
      before.missing_fields = before.missing_fields.filter((f: string) => f !== 'instructors');
      before.flags = before.flags.filter((f: string) => !['explicit_teacher_not_found_catalog_author_not_promoted', 'legacy_instructors_text_contains_catalog_author_unverified_as_teacher'].includes(f));
    }
    if (['cbtu-12', 'cbtu-13', 'cbtu-14'].includes(course.id)) {
      Object.assign(before.price, { displayed_amount: 0, currency: 'THB', label: 'Free' });
      before.missing_fields = before.missing_fields.filter((f: string) => f !== 'price.displayed_amount');
    }
    for (const [field, value] of Object.entries(course)) assert.deepEqual(value, before[field] ?? null, `${course.id}.${field}`);
  }
});

test('ordinary instructor names are stored separately from archived webpage evidence', () => {
  const record = structuredCourseCatalog.courses.find(c => c.id === 'cbtu-10')!;
  assert.deepEqual(record.teaching.instructors, [{ name: 'ผศ.ดร. ทวีศักดิ์ สมานชื่น' }]);
  assert.equal(record.teaching.webInstructors, null);
  assert.deepEqual(record.teaching.webEvidence, []);
  assert.ok(!('projectConfirmations' in record.teaching));
  const course = courseCatalog.courses.find(c => c.id === record.id)!;
  assert.equal(courseInstructors(course)[0].name, record.teaching.instructors[0].name);
});

test('completed instructor and free-price data are used by readers with no stale teacher warnings', async () => {
  const { readCourseFields, courseFieldValue } = await import('./course-reader.js');
  assert.ok(courseCatalog.courses.every(c => c.instructors?.length));
  assert.ok(courseCatalog.validationWarnings.every(w => w.code !== 'instructor_unknown'));
  for (const id of ['cbtu-12', 'cbtu-13', 'cbtu-14']) {
    const c = courseCatalog.courses.find(c => c.id === id)!;
    assert.equal(c.price.displayed_amount, 0);
    assert.match(courseFieldValue(c, 'price')!, /เรียนฟรี ไม่มีค่าใช้จ่าย/);
    assert.ok(!c.missing_fields.includes('price.displayed_amount'));
  }
  const workshop = courseCatalog.courses.find(c => c.id === 'cbtu-10')!;
  assert.ok(workshop.flags.every(f => !f.includes('teacher_not_found') && !f.includes('unverified_as_teacher')));
  const answer = readCourseFields([courseCatalog.courses.find(c => c.id === 'cbtu-17')!], ['instructors']);
  assert.match(answer, /วรัญญู วงษ์เสรี/);
  assert.doesNotMatch(answer, /คำยืนยัน|แชตโครงการ/);
});
