import type { ChatClient } from './core.js';

export function commandHelp(channel: 'terminal' | 'line', client?: ChatClient) {
  const forget = !!(client?.requestForget && client.forget);
  return [
    `คำสั่งซีบอตใน ${channel === 'line' ? 'LINE OA นี้ (เฉพาะความจำของคุณ)' : 'Terminal'}`,
    '/help — ดูคำสั่งที่ใช้ได้',
    ...(client?.memory ? ['/memory — ดูความจำของคุณ'] : []),
    ...(client?.reset ? ['/reset — ล้างบทสนทนา สรุป หัวข้อและเรื่องค้าง แต่คงโปรไฟล์/ข้อมูลระยะยาว'] : []),
    ...(forget ? [
      '/forget — ขอให้ลืมข้อมูลทั้งหมดของคุณ ต้องยืนยันก่อนลบ',
      '/confirm-forget — ยืนยันลบหลัง /forget ภายใน 60 วินาที',
      '/cancel — ยกเลิกคำขอลืม ข้อมูลยังอยู่',
      'ข้อความอื่น รวมถึง /help จะยกเลิกคำขอลืมที่รอยืนยัน',
    ] : []),
    ...(channel === 'terminal' ? ['/exit หรือ /quit — ออกจากแชต'] : []),
  ].join('\n');
}
