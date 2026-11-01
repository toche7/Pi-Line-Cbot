// Explicit owner-authorized snapshot import. Never changes shared research files.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupCatalog, flattenCatalog } from './course-catalog-layout.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
// Optional paths support isolated import regression fixtures; neither path is a network source.
const inputDir = resolve(process.argv[2] ?? 'research/cbtu-website');
const output = resolve(process.argv[3] ?? 'src/course-catalog-data.json');
const raw = await readFile(join(inputDir, 'courses.json'), 'utf8');
const report = await readFile(join(inputDir, 'SOURCE_REPORT.md'), 'utf8');
const validationRaw = await readFile(join(inputDir, 'validation_report.json'), 'utf8');
const source = JSON.parse(raw), validation = JSON.parse(validationRaw);
if (source.schema_version !== '1.1.0' || source.status !== 'research_for_owner_review_not_runtime_ingestion' || source.courses?.length !== 20
  || validation.schema_version !== '1.1.0' || validation.valid !== true || validation.errors?.length !== 0
  || validation.published_catalog_sha256 !== sha(raw)) throw new Error('Unsupported schema, invalid report or catalog fingerprint');
const archived = await readFile(join(inputDir, 'versions', sha(raw), 'courses.json'), 'utf8');
if (archived !== raw) throw new Error('Published catalog differs from archived last-good version');
let previous, previousGrouped;
try {
  const existing = await readFile(output, 'utf8');
  if (existing.trimStart().startsWith('{')) {
    previousGrouped = JSON.parse(existing);
    previous = flattenCatalog(previousGrouped);
  } else {
    // One-time compatibility with the former generated TypeScript snapshot.
    const serialized = existing.match(/ = (\{[\s\S]*\});\s*$/)?.[1];
    if (!serialized) throw new Error('Cannot parse existing last-good catalog');
    previous = JSON.parse(serialized);
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const scripts = dirname(fileURLToPath(import.meta.url));
// Revalidate exact candidate bytes rather than trusting a past "valid" flag.
const fresh = JSON.parse(execFileSync(process.env.CATALOG_PYTHON ?? 'python3', ['-B', join(scripts, 'validate-course-import.py')], {
  input: `{"candidate":${raw},"previous":${JSON.stringify(previous ?? null)}}`, encoding: 'utf8', maxBuffer: 1024 * 1024,
}));
if (!fresh.valid || fresh.errors.length) throw new Error('Fresh schema/evidence validation failed');
const ids = new Set(), urls = new Set();
const fields = ['id', 'record_type', 'name', 'canonical_url', 'detail_access', 'description_th', 'topics', 'learning_outcomes_th',
  'audience_th', 'prerequisites_th', 'format_th', 'duration_text', 'session_dates_text', 'instructors_text', 'price', 'enrollment',
  'certificate', 'flags', 'missing_fields', 'provenance', 'field_sources', 'source_refs',
  'instructors', 'instructor_evidence', 'evidence', 'dates', 'included_course_ids'];
const courses = source.courses.map(c => {
  const url = new URL(c.canonical_url);
  const canonical = decodeURI(url.href);
  if (url.protocol !== 'https:' || url.hostname !== 'cbtumu.net' || ids.has(c.id) || urls.has(canonical)
    || !c.name || !Number.isFinite(Date.parse(c.provenance?.retrieved_at)) || !/^[a-f0-9]{64}$/.test(c.provenance?.html_sha256)
    || !Array.isArray(c.flags) || !Array.isArray(c.missing_fields) || !Array.isArray(c.source_refs)
    || !c.field_sources || c.price?.is_current_offer_verified !== false || c.enrollment?.is_live_availability_verified !== false
    || (c.price.displayed_amount !== null && (!Number.isFinite(c.price.displayed_amount) || c.price.displayed_amount < 0))) throw new Error('Invalid catalog record');
  ids.add(c.id); urls.add(canonical);
  return Object.fromEntries(fields.map(field => [field, c[field] ?? null]));
});
if (courses.filter(c => c.record_type === 'course').length !== 19 || courses.filter(c => c.record_type === 'bundle').length !== 1 || courses.filter(c => c.detail_access !== 'public').length !== 1) throw new Error('Unexpected record/access types');
const snapshot = { schemaVersion: source.schema_version, collectionDate: source.collection_date, sourceStatus: source.status,
  ingestion: 'Owner-authorized public metadata only; unresolved conflicts/protected fields remain unverified',
  sourceSha256: sha(raw), reportSha256: sha(report), validationSha256: sha(validationRaw),
  validationWarnings: validation.warnings, courses };
// Preserve existing instructor names when the matching ID/URL has no new website teacher data.
const grouped = groupCatalog(snapshot, previousGrouped);
const temporary = output + '.' + randomUUID() + '.tmp';
try {
  await writeFile(temporary, JSON.stringify(grouped, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, output);
} finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
console.log(`Validated schema 1.1.0 and projected ${courses.length} public records; warnings=${validation.warnings.length}; source SHA256 ${sha(raw)}. Research files unchanged.`);
