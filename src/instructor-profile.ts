import { courseInstructors } from './course-instructors.js';
import { courseCatalog, type Course } from './course-catalog.js';

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

// Names/roles are the only person facts in the current snapshot. Course matches
// are evidence of teaching, never evidence of degrees, employment or biography.
export function readInstructorProfile(query: string, courses: Course[] = courseCatalog.courses) {
  const q = normalize(query);
  const found = new Map<string, { name: string; sources: Set<string> }>();
  if (q) for (const course of courses) for (const teacher of courseInstructors(course)) {
    if (!normalize(teacher.name).includes(q)) continue;
    const key = normalize(teacher.name);
    const record = found.get(key) ?? { name: teacher.name, sources: new Set<string>() };
    if (teacher.source_url) record.sources.add(teacher.source_url);
    found.set(key, record);
  }
  if (!found.size) return 'ยังไม่มีข้อมูลประวัติของบุคคลนี้ที่ยืนยันได้ในชุดข้อมูล CBTU ครับ';
  if (found.size > 1) return `พบชื่อผู้สอนที่ตรงมากกว่าหนึ่งชื่อครับ: ${[...found.values()].slice(0, 5).map(r => r.name).join(' / ')} กรุณาระบุชื่อเต็ม ไม่รวมประวัติของคนละชื่อเข้าด้วยกัน`;
  const { name, sources } = [...found.values()][0];
  return `${name} มีชื่อเป็นผู้สอนในข้อมูลหลักสูตร CBTU ที่เก็บไว้ครับ\nยังไม่มีประวัติการศึกษาและประสบการณ์ทำงานที่ยืนยันได้ในข้อมูลชุดนี้ จึงยังสรุปประวัติส่วนนี้ไม่ได้ครับ\n${sources.size ? `หลักฐานชื่อผู้สอนจากเว็บ: ${[...sources].slice(0, 2).join(' ')}\n` : ''}\nข้อมูลเว็บที่เก็บ ${courseCatalog.collectionDate} (ข้อมูลสำเนา)`;
}
