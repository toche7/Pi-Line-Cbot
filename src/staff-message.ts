import { CustomerError } from './customers.js';
export const staffPrefix = 'Staff: ';
export const staffTextLimit = 4500 - staffPrefix.length;
export function staffMessage(text: unknown): string {
  if (typeof text !== 'string' || !text.trim()) throw new CustomerError(400, 'กรุณากรอกข้อความก่อนส่ง');
  const message = text.startsWith(staffPrefix.trim()) ? text : staffPrefix + text;
  if (message.length > 4500) throw new CustomerError(400, `ข้อความยาวเกินกำหนด กรุณาย่อเหลือไม่เกิน ${staffTextLimit} ตัวอักษร`);
  return message;
}
