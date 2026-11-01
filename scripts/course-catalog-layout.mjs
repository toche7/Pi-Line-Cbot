// Pure, lossless grouping of validated public snapshot records. No network or IO.
export function groupCatalog(snapshot, previous) {
  const { courses, ...metadata } = snapshot;
  const grouped = { layoutVersion: 1, snapshot: metadata, courses: courses.map(c => {
    const prior = previous?.courses.find(p => p.id === c.id && p.url === c.canonical_url);
    const instructors = c.instructors?.map(t => ({ name: t.name })) ?? prior?.teaching.instructors ?? [];
    const price = c.price.displayed_amount === null && prior?.registration.price.displayed_amount != null
      ? prior.registration.price : c.price;
    return {
      id: c.id, type: c.record_type, name: c.name, url: c.canonical_url,
      overview: { description: c.description_th, topics: c.topics },
      learning: { outcomes: c.learning_outcomes_th, audience: c.audience_th, prerequisites: c.prerequisites_th,
        format: c.format_th, duration: c.duration_text },
      teaching: { webInstructors: c.instructors, webEvidence: c.instructor_evidence,
        legacyText: c.instructors_text, instructors },
      registration: { price, enrollment: c.enrollment, sessionText: c.session_dates_text, dates: c.dates },
      certificate: c.certificate, includedCourseIds: c.included_course_ids,
      sources: { access: c.detail_access, capture: c.provenance, fields: c.field_sources, links: c.source_refs, excerpts: c.evidence },
      quality: { flags: c.flags.filter(f => !instructors.length || !obsoleteTeacherFlags.includes(f)),
        missingFields: c.missing_fields.filter(f => (f !== 'instructors' || !instructors.length)
          && (f !== 'price.displayed_amount' || price.displayed_amount === null)) },
    };
  }) };
  if (metadata.validationWarnings) grouped.snapshot.validationWarnings = metadata.validationWarnings.flatMap(w => {
    const index = /^\/courses\/(\d+)$/.exec(w.path)?.[1];
    if (index === undefined || !grouped.courses[Number(index)]?.teaching.instructors.length) return [w];
    if (w.code === 'instructor_unknown') return [];
    return [{ ...w, message: w.message.split(', ').filter(f => !obsoleteTeacherFlags.includes(f)).join(', ') }];
  });
  return grouped;
}

const obsoleteTeacherFlags = ['explicit_teacher_not_found_catalog_author_not_promoted',
  'legacy_instructors_text_contains_catalog_author_unverified_as_teacher'];

export function flattenCatalog(data) {
  if (data.layoutVersion !== 1) throw new Error('Unsupported course catalog layout');
  return { ...data.snapshot, courses: data.courses.map(c => ({
    id: c.id, record_type: c.type, name: c.name, canonical_url: c.url, detail_access: c.sources.access,
    description_th: c.overview.description, topics: c.overview.topics,
    learning_outcomes_th: c.learning.outcomes, audience_th: c.learning.audience,
    prerequisites_th: c.learning.prerequisites, format_th: c.learning.format, duration_text: c.learning.duration,
    session_dates_text: c.registration.sessionText, instructors_text: c.teaching.legacyText,
    instructors: c.teaching.webInstructors, instructor_evidence: c.teaching.webEvidence,
    price: c.registration.price, enrollment: c.registration.enrollment, certificate: c.certificate,
    flags: c.quality.flags, missing_fields: c.quality.missingFields, provenance: c.sources.capture,
    field_sources: c.sources.fields, source_refs: c.sources.links, evidence: c.sources.excerpts,
    dates: c.registration.dates, included_course_ids: c.includedCourseIds,
  })) };
}
