import type { ConversationCapabilities } from './capabilities.js';

export const privateChatHelpTopic = { id: 'host:line-private-chat', title: 'วิธีเพิ่มเพื่อนซีบอตและเปิดแชต LINE ส่วนตัวกับบอต' };
// Verified against LINE Help / LINE URL scheme docs; no account ID or link is
// inferred from a channel ID, bot display name or untrusted user input.
export function renderPrivateChatHelp(capabilities: ConversationCapabilities) {
  const alreadyDirect = capabilities.channel === 'line' && capabilities.commands;
  return [
    'ถ้าหมายถึงแชตส่วนตัวกับซีบอตครับ',
    ...(alreadyDirect ? ['ถ้าคุยกับซีบอตแบบตัวต่อตัวใน LINE อยู่แล้ว แชตนี้คือแชตส่วนตัวครับ'] : []),
    'ถ้าอยู่ในกลุ่ม LINE ให้แตะรูปโปรไฟล์บัญชีซีบอตเพื่อเปิดหน้าโปรไฟล์ แล้วเลือกเพิ่มเพื่อน จากนั้นกดแชตเพื่อคุยแบบตัวต่อตัว ถ้าเพิ่มเพื่อนไว้แล้วกดแชตได้เลยครับ',
    'หากยังหาโปรไฟล์บอตไม่เจอ ให้ขอ QR code หรือลิงก์เพิ่มเพื่อนของบัญชีนี้จากผู้ดูแล ตอนนี้ระบบยังไม่มี LINE ID หรือลิงก์เพิ่มเพื่อนที่ยืนยันแล้วให้แสดงครับ',
  ].join('\n');
}
