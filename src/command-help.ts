import type { ChatClient } from './core.js';

export function commandHelp(channel: 'terminal' | 'line', client?: ChatClient) {
  const forget = !!(client?.requestForget && client.forget);
  return [
    `คำสั่งซีบอตใน ${channel === 'line' ? 'LINE OA นี้ (เฉพาะความจำของคุณ)' : 'Terminal'}`,
    '/help — ดูคำสั่งที่ใช้ได้',
    ...(channel === 'line' ? ['/version — ดูรุ่นโปรแกรมและเซิร์ฟเวอร์ของแชตส่วนตัวนี้'] : []),
    ...(client?.requestsEnabled ? [
      '/book ชื่อคอร์ส — เตรียมคำขอจอง ให้ตรวจและยืนยันก่อนบันทึก',
      '/contact เรื่องที่ต้องการฝาก — เตรียมเรื่องให้ทีมงาน',
      '/request-note ข้อความใหม่ — แก้ข้อความในฉบับร่าง',
      '/confirm-request รหัส — ยืนยันบันทึกคำขอในระบบกลาง',
      '/cancel-request — ยกเลิกฉบับร่างที่ยังไม่บันทึก',
      '/requests — ดูคำขอของคุณที่บันทึกแล้ว',
    ] : []),
    ...(client?.memory ? ['/memory — ดูความจำของคุณ'] : []),
    ...(client?.reset ? ['/reset — ล้างบทสนทนา สรุป หัวข้อและเรื่องค้าง แต่คงโปรไฟล์/ข้อมูลระยะยาว'] : []),
    ...(forget ? [
      `/forget — ขอให้ลืมความจำ${client?.requestsEnabled ? 'และคำขอในระบบกลาง' : ''}ของคุณ ต้องยืนยันก่อนลบ`,
      '/confirm-forget — ยืนยันลบหลัง /forget ภายใน 60 วินาที',
      '/cancel — ยกเลิกคำขอลืม ข้อมูลยังอยู่',
      'ข้อความอื่น รวมถึง /help จะยกเลิกคำขอลืมที่รอยืนยัน',
    ] : []),
    ...(channel === 'terminal' ? ['/exit หรือ /quit — ออกจากแชต'] : []),
  ].join('\n');
}
