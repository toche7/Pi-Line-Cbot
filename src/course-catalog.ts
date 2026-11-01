// Runtime entry point: grouped data lives in course-catalog-data.json.
// Keep this compatibility projection so existing readers share the same snapshot.
import data from './course-catalog-data.json' with { type: 'json' };
import type { CourseCatalogData, CourseCatalogSnapshot } from './course-types.js';
export type { Course, CourseRecord, CourseCatalogData } from './course-types.js';

export const structuredCourseCatalog = data as CourseCatalogData;
export const courseCatalog = flattenCatalog(structuredCourseCatalog);

function flattenCatalog(data: CourseCatalogData): CourseCatalogSnapshot {
  if (data.layoutVersion !== 1) throw new Error('Unsupported course catalog layout');
  return { ...data.snapshot, courses: data.courses.map(c => ({
    id: c.id, record_type: c.type, name: c.name, canonical_url: c.url, detail_access: c.sources.access,
    description_th: c.overview.description, topics: c.overview.topics,
    learning_outcomes_th: c.learning.outcomes, audience_th: c.learning.audience,
    prerequisites_th: c.learning.prerequisites, format_th: c.learning.format, duration_text: c.learning.duration,
    session_dates_text: c.registration.sessionText, instructors_text: c.teaching.legacyText,
    instructors: c.teaching.instructors.length ? c.teaching.instructors.map(t => c.teaching.webInstructors?.find(web => web.name === t.name) ?? t) : null, instructor_evidence: c.teaching.webEvidence,
    price: c.registration.price, enrollment: c.registration.enrollment, certificate: c.certificate,
    flags: c.quality.flags, missing_fields: c.quality.missingFields.filter(field => field !== 'instructors' || !c.teaching.instructors.length), provenance: c.sources.capture,
    field_sources: c.sources.fields, source_refs: c.sources.links, evidence: c.sources.excerpts,
    dates: c.registration.dates, included_course_ids: c.includedCourseIds,
  })) };
}
