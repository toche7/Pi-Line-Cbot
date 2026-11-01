import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { groupCatalog, flattenCatalog } from './course-catalog-layout.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'catalog-import-fixture.json'), 'utf8'));
// The importer intentionally excludes research-only links and catalog authors.
function runtimeCourses(courses) {
  return courses.map(({ application_links, additional_public_links, catalog_author_text, ...runtime }) => runtime);
}
function candidate() {
  const source = structuredClone(fixture), template = source.courses[0];
  source.courses = Array.from({ length: 20 }, (_, i) => {
    const c = structuredClone(template), id = `cbtu-${String(i + 1).padStart(2, '0')}`;
    c.id = id; c.name = `Fixture ${id}`; c.record_type = i === 19 ? 'bundle' : 'course';
    c.canonical_url = `https://cbtumu.net/${i === 19 ? 'course-bundle' : 'coursenew'}/${id}/`;
    c.provenance.requested_url = c.provenance.resolved_url = c.canonical_url;
    c.detail_access = i === 17 ? 'password_protected' : 'public';
    c.instructors = [{ name: 'อาจารย์ ทดสอบ หลักฐาน', source_url: c.canonical_url, source_type: 'course_detail' }];
    c.instructor_evidence = [{ ...c.instructors[0], excerpt: 'ผู้สอน อาจารย์ ทดสอบ หลักฐาน', provenance: structuredClone(c.provenance) }];
    c.included_course_ids = i === 19 ? ['cbtu-01'] : [];
    return c;
  });
  source.collection.expected_ids = source.courses.map(c => c.id);
  return source;
}
function stage(root, source, reportEdit = r => r) {
  const raw = JSON.stringify(source), digest = createHash('sha256').update(raw).digest('hex');
  writeFileSync(join(root, 'courses.json'), raw);
  writeFileSync(join(root, 'SOURCE_REPORT.md'), 'Isolated public fixture.');
  writeFileSync(join(root, 'validation_report.json'), JSON.stringify(reportEdit({ schema_version: '1.1.0', valid: true, errors: [], warnings: [], published_catalog_sha256: digest })));
  const archive = join(root, 'versions', digest); mkdirSync(archive, { recursive: true });
  writeFileSync(join(archive, 'courses.json'), raw);
}
function run(root, output) {
  return spawnSync(process.execPath, [join(here, 'import-course-catalog.mjs'), root, output], { encoding: 'utf8', maxBuffer: 2e6 });
}

test('valid schema/evidence publishes an atomic independent projection with provenance', () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-import-')), output = join(root, 'runtime.json');
  try {
    stage(root, candidate());
    const result = run(root, output); assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(output, 'utf8');
    assert.match(text, /"schemaVersion": "1.1.0"/);
    const grouped = JSON.parse(text);
    assert.equal(grouped.layoutVersion, 1);
    assert.deepEqual(flattenCatalog(grouped).courses, runtimeCourses(candidate().courses));
    assert.match(text, /"webEvidence"/); assert.match(text, /"html_sha256"/);
    const research = readFileSync(join(root, 'courses.json'), 'utf8');
    assert.equal(research, JSON.stringify(candidate()));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('grouping and flattening preserve every field, including explicit nulls', () => {
  const flat = { collectionDate: '2026-11-01', courses: runtimeCourses(candidate().courses) };
  assert.deepEqual(flattenCatalog(groupCatalog(flat)), flat);
});

test('refresh retains instructors and free prices, and removes resolved teacher warnings', () => {
  const root = mkdtempSync(join(tmpdir(), 'cbot-import-confirmation-')), output = join(root, 'runtime.json');
  try {
    const input = candidate();
    for (const c of input.courses.slice(0, 2)) { c.instructors = null; c.instructor_evidence = []; c.missing_fields.push('instructors'); }
    input.courses[0].price.displayed_amount = null;
    input.courses[0].missing_fields.push('price.displayed_amount');
    stage(root, input, report => ({ ...report, warnings: [{ code: 'instructor_unknown', path: '/courses/0', message: 'No explicit named-teacher evidence' }] }));
    const first = run(root, output); assert.equal(first.status, 0, first.stderr);
    const previous = JSON.parse(readFileSync(output, 'utf8'));
    const names = [{ name: 'อาจารย์ ทดสอบ' }];
    previous.courses[0].teaching.instructors = names;
    previous.courses[1].teaching.instructors = names;
    previous.courses[0].registration.price = { displayed_amount: 0, currency: 'THB', reference_amount: null, label: 'Free', is_current_offer_verified: false };
    writeFileSync(output, JSON.stringify(previous));
    const next = run(root, output); assert.equal(next.status, 0, next.stderr);
    const result = JSON.parse(readFileSync(output, 'utf8'));
    assert.deepEqual(result.courses[0].teaching.instructors, names);
    assert.deepEqual(result.courses[1].teaching.instructors, names);
    assert.equal(result.courses[0].registration.price.displayed_amount, 0);
    assert.equal(result.courses[0].registration.price.label, 'Free');
    assert.ok(!result.courses[0].quality.missingFields.includes('instructors'));
    assert.ok(!result.courses[0].quality.missingFields.includes('price.displayed_amount'));
    assert.ok(result.snapshot.validationWarnings.every(w => w.code !== 'instructor_unknown'));
    // A URL mismatch must never transfer instructor names to a different course.
    previous.courses[1].url = 'https://cbtumu.net/coursenew/different/';
    const regrouped = groupCatalog(flattenCatalog(result), previous);
    assert.deepEqual(regrouped.courses[1].teaching.instructors, []);
    writeFileSync(output, JSON.stringify(previous));
    const before = readFileSync(output);
    assert.notEqual(run(root, output).status, 0); // Existing stable-ID validation also rejects it.
    assert.deepEqual(readFileSync(output), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const [name, mutate, reportEdit] of [
  ['unsupported schema', s => { s.schema_version = '2.0'; }],
  ['unknown field', s => { s.courses[0].secret = 'forbidden'; }],
  ['wrong field type', s => { s.courses[0].price.displayed_amount = true; }],
  ['catalog author masquerading as instructor', s => { s.courses[0].instructors[0].source_type = 'catalog_author'; }],
  ['missing teacher evidence', s => { s.courses[0].instructor_evidence = []; }],
  ['unlabelled teacher excerpt', s => { s.courses[0].instructor_evidence[0].excerpt = 'By อาจารย์ ทดสอบ หลักฐาน'; }],
  ['invalid report fingerprint', () => {}, r => ({ ...r, published_catalog_sha256: '0'.repeat(64) })],
  ['invalid validation report', () => {}, r => ({ ...r, valid: false })],
]) {
  test(`rejects ${name}, preserving last-good runtime bytes`, () => {
    const root = mkdtempSync(join(tmpdir(), 'cbot-import-invalid-')), output = join(root, 'runtime.json');
    try {
      stage(root, candidate()); const good = run(root, output); assert.equal(good.status, 0, good.stderr);
      const before = readFileSync(output);
      const invalid = candidate(); mutate(invalid); stage(root, invalid, reportEdit);
      assert.notEqual(run(root, output).status, 0);
      assert.deepEqual(readFileSync(output), before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
