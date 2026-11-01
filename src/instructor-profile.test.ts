import test from 'node:test';
import assert from 'node:assert/strict';
import { courseCatalog } from './course-catalog.js';
import { readInstructorProfile } from './instructor-profile.js';
import { executeCatalogQuery, parseCatalogQuery } from './catalog-query.js';

test('who-is instructor returns verified role and missing-biography explanation, never a course listing', () => {
  const previous = executeCatalogQuery({ operation: 'list', scope: 'search', query: 'AI', limit: 3 }).state;
  const answer = executeCatalogQuery({ operation: 'instructor', scope: 'search', query: 'ทวีศักดิ์ สมานชื่น' }, previous);
  assert.match(answer.answer!, /ทวีศักดิ์ สมานชื่น.*มีชื่อเป็นผู้สอน/);
  assert.match(answer.answer!, /ยังไม่มีประวัติการศึกษาและประสบการณ์ทำงานที่ยืนยันได้/);
  assert.match(answer.answer!, /https:\/\/cbtumu.net\//);
  assert.doesNotMatch(answer.answer!, /พบ 11 รายการ|แสดง 1|1\. Data Analysis|จบจาก|ปัจจุบันทำงานที่/);
  assert.deepEqual(answer.state, previous);
  assert.match(readInstructorProfile('ชื่อที่ไม่มีอยู่ในหลักฐาน'), /ยังไม่มีข้อมูลประวัติ/);
  assert.throws(() => parseCatalogQuery({ operation: 'instructor', scope: 'all', query: 'ทวีศักดิ์' }));
});

test('instructor profile ignores catalog authors, collapses punctuation only, and distinguishes genuinely different names', () => {
  const course = structuredClone(courseCatalog.courses[0]);
  course.instructors = null; course.instructors_text = 'Legacy-Only';
  assert.match(readInstructorProfile('Legacy-Only', [course]), /ยังไม่มีข้อมูลประวัติ/);
  course.instructors = [
    { name: 'ดร. มาลี ใจดี', source_url: course.canonical_url, source_type: 'course_detail' },
    { name: 'ดร.มาลี ใจดี', source_url: course.canonical_url, source_type: 'course_detail' },
  ];
  assert.doesNotMatch(readInstructorProfile('มาลี ใจดี', [course]), /มากกว่าหนึ่ง/);
  course.instructors.push({ name: 'ดร. มาลี อีกคน', source_url: course.canonical_url, source_type: 'course_detail' });
  assert.match(readInstructorProfile('มาลี', [course]), /มากกว่าหนึ่งชื่อ/);
});
