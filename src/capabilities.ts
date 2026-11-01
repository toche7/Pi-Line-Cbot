// Supplied by the host from the actual channel/services, never inferred from user text.
export type PrivateChatCapabilities = { commands: boolean; requests: boolean; humanSupport: boolean };
export type ConversationCapabilities = PrivateChatCapabilities & {
  channel: 'terminal' | 'line'; privateChat?: PrivateChatCapabilities;
};
export const capabilitiesTopic = { id: 'host:capabilities', title: 'บอตทำอะไรได้บ้าง ช่วยอะไรได้บ้าง และดูคำสั่งได้ที่ไหน' };

export function renderCapabilities(capabilities: ConversationCapabilities) {
  const privateChat = capabilities.channel === 'line' && !capabilities.commands ? capabilities.privateChat : undefined;
  return [
    'ช่วยได้ดังนี้ครับ',
    '• คุยและถามต่อเนื่องจากเรื่องก่อนหน้า',
    '• ตอบ FAQ เรื่องสมัคร เข้าเรียน เอกสาร และใบประกาศ',
    '• ค้น แนะนำ เปรียบเทียบ และดูรายละเอียดหลักสูตรจากข้อมูลที่มี',
    ...(capabilities.requests ? ['• รับคำขอจองหรือฝากเรื่องหลังคุณยืนยัน และดูคำขอของตัวเองได้'] : []),
    ...(capabilities.commands ? ['• ดูความจำ เริ่มบทสนทนาใหม่ หรือยืนยันให้ลืมข้อมูลของคุณ'] : []),
    ...(capabilities.channel === 'line' && capabilities.humanSupport ? ['• ขอคุยกับเจ้าหน้าที่เพื่อรอรับช่วงในแชตนี้ได้'] : []),
    ...(privateChat && (privateChat.requests || privateChat.commands || privateChat.humanSupport) ? [
      'ส่วนบริการต่อไปนี้ ให้ทัก LINE ส่วนตัวกับซีบอตครับ',
      ...(privateChat.requests ? ['• ฝากคำขอจองหรือเรื่องให้ทีมงาน ตรวจสรุปและยืนยันก่อนบันทึก'] : []),
      ...(privateChat.commands ? ['• ดูความจำ เริ่มบทสนทนาใหม่ หรือยืนยันให้ลืมข้อมูลในแชตส่วนตัว และดูคำสั่งด้วย /help'] : []),
      ...(privateChat.humanSupport ? ['• ขอคุยกับเจ้าหน้าที่เพื่อรอรับช่วงในแชตส่วนตัว'] : []),
    ] : []),
    ...(capabilities.requests || privateChat?.requests ? ['ยังสมัครสมาชิก ลงทะเบียน ชำระเงิน หรือยืนยันที่นั่งแทนไม่ได้ครับ'] : []),
    ...(capabilities.commands ? ['ดูคำสั่งที่ใช้ได้ด้วย /help ครับ'] : []),
  ].join('\n');
}
