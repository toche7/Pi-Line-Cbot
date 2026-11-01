// Public course data types; archived website evidence is kept separately from current instructor names.
export interface Course {
  id: string; record_type: string; name: string; canonical_url: string; detail_access: string;
  description_th: string | null; topics: string[] | null; learning_outcomes_th: string[] | null;
  audience_th: string | null; prerequisites_th: string | null; format_th: string | null; duration_text: string | null;
  session_dates_text: string | null; instructors_text: string | null;
  instructors: { name: string; source_url?: string; source_type?: 'course_detail' | 'explicit_bundle_teacher' }[] | null;
  instructor_evidence: { name: string; source_url: string; source_type: 'course_detail' | 'explicit_bundle_teacher'; excerpt: string; provenance: Course['provenance'] }[];
  evidence: Record<string, string | null>; dates: { raw: string | null; parsed: { start_date: string; end_date: string | null }[] | null }; included_course_ids: string[];
  price: { displayed_amount: number | null; currency: string | null; reference_amount: number | null; label: string | null; is_current_offer_verified: boolean };
  enrollment: { observed_text: string | null; is_live_availability_verified: boolean; catalog_observed_text?: string | null };
  certificate: { observed_text: string | null; course_specific_pass_criteria: string | null; general_faq_rule: string; faq_url: string };
  flags: string[]; missing_fields: string[];
  provenance: { requested_url: string; resolved_url: string; retrieved_at: string; html_sha256: string };
  field_sources: Record<string, string>; source_refs: { url: string; role: string }[];
}
export type CourseCatalogSnapshot = { schemaVersion: string; validationWarnings: { code: string; path: string; message: string }[]; collectionDate: string; sourceStatus: string; ingestion: string; sourceSha256: string; reportSha256: string; validationSha256: string; courses: Course[] };

export interface CourseRecord {
  id: string; type: string; name: string; url: string;
  overview: { description: Course['description_th']; topics: Course['topics'] };
  learning: { outcomes: Course['learning_outcomes_th']; audience: Course['audience_th'];
    prerequisites: Course['prerequisites_th']; format: Course['format_th']; duration: Course['duration_text'] };
  teaching: { webInstructors: Course['instructors']; webEvidence: Course['instructor_evidence'];
    legacyText: Course['instructors_text']; instructors: { name: string }[] };
  registration: { price: Course['price']; enrollment: Course['enrollment'];
    sessionText: Course['session_dates_text']; dates: Course['dates'] };
  certificate: Course['certificate']; includedCourseIds: string[];
  sources: { access: string; capture: Course['provenance']; fields: Course['field_sources'];
    links: Course['source_refs']; excerpts: Course['evidence'] };
  quality: { flags: string[]; missingFields: string[] };
}
export interface CourseCatalogData {
  layoutVersion: 1;
  snapshot: Omit<CourseCatalogSnapshot, 'courses'>;
  courses: CourseRecord[];
}
