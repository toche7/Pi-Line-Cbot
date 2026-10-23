// Explicit owner-authorized snapshot import. Never changes shared research files.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = text => createHash('sha256').update(text).digest('hex');
const raw = await readFile('research/cbtu-website/courses.json', 'utf8');
const report = await readFile('research/cbtu-website/SOURCE_REPORT.md', 'utf8');
const validationRaw = await readFile('research/cbtu-website/validation.json', 'utf8');
const source = JSON.parse(raw), validation = JSON.parse(validationRaw);
if (source.status !== 'research_for_owner_review_not_runtime_ingestion' || source.courses.length !== 20
  || validation.catalog_records !== 20 || validation.courses !== 19 || validation.bundles !== 1) throw new Error('Unexpected research/validation counts or status');
const ids = new Set(), urls = new Set();
const fields = ['id', 'record_type', 'name', 'canonical_url', 'detail_access', 'description_th', 'topics', 'learning_outcomes_th',
  'audience_th', 'prerequisites_th', 'format_th', 'duration_text', 'session_dates_text', 'instructors_text', 'price', 'enrollment',
  'certificate', 'flags', 'missing_fields', 'provenance', 'field_sources', 'source_refs'];
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
if (courses.filter(c => c.record_type === 'bundle').length !== 1 || courses.filter(c => c.detail_access !== 'public').length !== 1) throw new Error('Unexpected record/access types');
const snapshot = { collectionDate: source.collection_date, sourceStatus: source.status,
  ingestion: 'Owner-authorized public metadata only; unresolved conflicts/protected fields remain unverified',
  sourceSha256: sha(raw), reportSha256: sha(report), validationSha256: sha(validationRaw), courses };
const header = `// Generated read-only projection; run scripts/import-course-catalog.mjs only for an authorized refresh.\nexport interface Course {\n  id: string; record_type: string; name: string; canonical_url: string; detail_access: string;\n  description_th: string | null; topics: string[] | null; learning_outcomes_th: string[] | null;\n  audience_th: string | null; prerequisites_th: string | null; format_th: string | null; duration_text: string | null;\n  session_dates_text: string | null; instructors_text: string | null;\n  price: { displayed_amount: number | null; currency: string | null; reference_amount: number | null; label: string | null; is_current_offer_verified: boolean };\n  enrollment: { observed_text: string | null; is_live_availability_verified: boolean; catalog_observed_text?: string };\n  certificate: { observed_text: string | null; course_specific_pass_criteria: string | null; general_faq_rule: string; faq_url: string };\n  flags: string[]; missing_fields: string[];\n  provenance: { requested_url: string; resolved_url: string; retrieved_at: string; html_sha256: string };\n  field_sources: Record<string, string>; source_refs: { url: string; role: string }[];\n}\nexport const courseCatalog: { collectionDate: string; sourceStatus: string; ingestion: string; sourceSha256: string; reportSha256: string; validationSha256: string; courses: Course[] } = `;
await writeFile('src/course-catalog.ts', header + JSON.stringify(snapshot, null, 2) + ';\n');
console.log(`Validated and projected ${courses.length} public metadata records; source SHA256 ${sha(raw)}. Research files unchanged.`);
