import { writeFile } from 'node:fs/promises';
import { courseBriefs } from '../dist/course-briefs.js';
const text = [
  '# สาระหลักสูตรสำหรับช่วยเลือกตามงานและเป้าหมาย',
  '',
  'สรุปจาก public snapshot ที่มีอยู่ ไม่แก้ research ต้นฉบับ ตัวอย่างงานเป็นการประยุกต์จากหัวข้อที่สอน ไม่ใช่คำรับประกันผลลัพธ์หรือคุณสมบัติผู้สมัคร ข้อมูลไม่ระบุให้คงว่าขาด; ราคา/รอบเป็นข้อมูลเก่า ต้องยืนยันก่อนซื้อ',
  '',
  ...courseBriefs.flatMap(b => [
    `## ${b.name}`, '',
    `- งานที่อาจนำไปใช้: ${b.workExamples.join('; ') || 'ข้อมูลไม่พอ (หน้าล็อก)'}`,
    `- สิ่งที่ฝึก: ${b.outcomes.join('; ') || 'ไม่พบรายละเอียดที่อ่านได้'}`,
    `- กลุ่มผู้เรียนที่เว็บระบุ: ${b.audience ?? 'เว็บยังไม่ระบุ'}`,
    `- พื้นฐาน: ${b.prerequisites ?? 'เว็บยังไม่ระบุ'}`,
    `- หัวข้อสำคัญ: ${b.topics.join('; ') || 'ไม่พบรายละเอียดที่อ่านได้'}`,
    `- การเรียน: ${b.format ?? 'ไม่พบข้อมูล'}; ระยะเวลา: ${b.duration ?? 'เว็บยังไม่ระบุ'}`,
    `- ราคาที่เคยแสดง: ${b.price.displayed_amount === null ? 'ไม่พบราคา ไม่ถือว่าฟรี' : b.price.label === 'Free' ? 'Free' : b.price.displayed_amount + ' ' + (b.price.currency ?? '(ไม่ระบุสกุลเงิน)')}`,
    `- รอบที่หน้าเดิมระบุ: ${b.sessions ?? 'เว็บยังไม่ระบุ'}`,
    `- แหล่ง: ${b.evidence.source} (เก็บ ${b.evidence.capturedAt})`, '',
  ]),
].join('\n');
await writeFile('COURSE_BRIEFS.md', text);
console.log(`Exported ${courseBriefs.length} concise course briefs for owner review; research unchanged.`);
