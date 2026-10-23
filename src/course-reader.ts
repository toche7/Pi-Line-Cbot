import type { Course } from './course-catalog.js';
import { courseBrief, briefSourceNote } from './course-briefs.js';

// Public schema, not paths into arbitrary files/objects. Model chooses fields;
// the host retrieves and renders values from the bound course records only.
export const courseFields = {
  name: 'ชื่อและรุ่นหลักสูตร',
  work_examples: 'งานที่อาจนำไปประยุกต์ (inference จากหัวข้อ)',
  outcomes: 'สิ่งที่เนื้อหาสอนให้ฝึก',
  topics: 'หัวข้อเรียนทั้งหมดที่เก็บไว้',
  audience: 'กลุ่มผู้เรียนที่เว็บระบุ',
  prerequisites: 'พื้นฐานและสิ่งที่ต้องเตรียม',
  format: 'รูปแบบการเรียน',
  duration: 'ระยะเวลาเรียน',
  sessions: 'วันหรือรอบเรียนจากหน้าเดิม ไม่ยืนยันรอบปัจจุบัน',
  price: 'ราคาใน snapshot ไม่ใช่ข้อเสนอสด',
  instructors: 'ชื่อวิทยากร/ผู้สอนที่ระบุในข้อมูล',
  certificate: 'ใบประกาศและเกณฑ์เฉพาะวิชาเท่าที่พบ',
  availability: 'ข้อความสถานะบนหน้าเดิม ไม่ยืนยันเปิดรับสด',
} as const;
export type CourseField = keyof typeof courseFields;
export function validCourseFields(value: unknown): value is CourseField[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 5 && new Set(value).size === value.length
    && value.every(k => typeof k === 'string' && Object.hasOwn(courseFields, k));
}
function fieldValue(c: Course, field: CourseField): string | null {
  const b = courseBrief(c);
  switch (field) {
    case 'name': return c.name;
    case 'work_examples': return b.workExamples.join('; ') || null;
    case 'outcomes': return b.outcomes.join('; ') || null;
    case 'topics': return c.topics?.join(', ') || null;
    case 'audience': return c.audience_th;
    case 'prerequisites': return c.prerequisites_th;
    case 'format': return c.format_th;
    case 'duration': return c.duration_text;
    case 'sessions': return c.session_dates_text;
    case 'instructors': return c.instructors_text;
    case 'availability': return c.enrollment.observed_text;
    case 'certificate': return [c.certificate.observed_text, c.certificate.course_specific_pass_criteria].filter(Boolean).join('; ') || null;
    case 'price': return c.price.displayed_amount === null ? null : c.price.label === 'Free' ? 'หน้าเดิมแสดง Free'
      : `${c.price.displayed_amount.toLocaleString('en-US')} ${c.price.currency ?? '(ไม่ระบุสกุลเงิน)'}`;
  }
}
export function readCourseFields(courses: Course[], fields: CourseField[]) {
  if (!validCourseFields(fields) || courses.length > 3) throw new Error('Invalid public course read');
  if (!courses.length) return 'ต้องการถามข้อมูลของหลักสูตรไหนครับ? ระบุชื่อ หรือเลือกจากรายการที่กำลังดูได้';
  return courses.map(c => [c.name, ...fields.map(field => {
    const value = fieldValue(c, field);
    const label = field === 'instructors' ? 'วิทยากร' : courseFields[field];
    return `${label}: ${value ?? (field === 'price' ? 'ไม่พบราคา ไม่ถือว่าฟรี' : 'ไม่พบข้อมูลส่วนนี้ในแหล่งที่เก็บไว้')}`;
  }), ...(c.detail_access !== 'public' ? ['หน้ารายละเอียดล็อก ใช้เฉพาะ metadata สาธารณะที่เก็บได้'] : []),
  c.canonical_url].join('\n')).join('\n\n') + '\n\n' + briefSourceNote(courses, fields.some(f => ['price', 'sessions', 'availability'].includes(f)));
}
