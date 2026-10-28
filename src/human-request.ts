// Conservative host routing: only explicit requests create a waiting item.
// Ambiguous complaints, quoted instructions and model guesses do not transfer ownership.
export type HumanIntent = { kind: 'request'; stopBot: boolean } | { kind: 'cancel' | 'info' };
export function humanIntent(raw: string): HumanIntent | undefined {
  const text = raw.trim().toLowerCase();
  if (!text || text.length > 2000 || /[\n\r"“”`]|^(?:ตัวอย่าง|สมมติ|ถ้า|หาก|แปล|คำว่า|เขาบอก|ลูกค้าบอก|example|translate|if\b)/.test(text)) return;
  if (/เป็นตัวอย่าง|แค่ตัวอย่าง|ไม่ใช่คำขอ|ไม่ได้ขอ|ยังไม่ต้อง|\bexample\b|do not transfer|don't transfer/.test(text)) return;
  if (/^(?:ขอ)(?:เจ้าหน้าที่|แอดมิน|คนจริง|staff)(?:หน่อย|ครับ|ค่ะ|คะ|นะ|$)/.test(text)) return { kind: 'request', stopBot: false };
  if (/^(?:ยกเลิก(?:คำขอ)?(?:คุย|ติดต่อ|รอ|เรียก)(?:กับ)?(?:เจ้าหน้าที่|แอดมิน|คนจริง|staff)|(?:ขอ|ให้)?(?:คุยกับ|ให้)?(?:บอต|บอท|ซีบอต|ai)(?:ตอบ|คุย)?ต่อ|ไม่(?:ต้อง|เอา)(?:รอ|เรียก|ติดต่อ|คุยกับ)?(?:เจ้าหน้าที่|แอดมิน)|cancel (?:the )?(?:human|staff|agent)(?: request)?|(?:resume|continue)(?: with)? (?:the )?bot)/.test(text)) return { kind: 'cancel' };
  if (/^(?:ไม่(?:อยาก|ต้องการ)?(?:คุย|คุยกับ)(?:บอต|บอท|ซีบอต|ai)|(?:เลิก|หยุด)(?:ให้)?(?:บอต|บอท|ซีบอต|ai)(?:ตอบ|คุย)|(?:บอต|บอท|ซีบอต|ai)(?:หยุดตอบ|ไม่ต้องตอบ)|(?:stop|pause)(?: the)? bot|(?:i )?(?:do not|don't|dont) want to (?:talk|chat)(?: to| with)? (?:a |the )?bot)/.test(text)) return { kind: 'request', stopBot: true };
  if (/^(?:มีเจ้าหน้าที่(?:อยู่)?ไหม|เจ้าหน้าที่อยู่ไหม|(?:คุย|ติดต่อ)(?:กับ)?เจ้าหน้าที่ได้ไหม|(?:can i|is it possible to) (?:talk|speak|chat) (?:to|with) (?:a )?(?:human|agent|staff))/.test(text)) return { kind: 'info' };
  if (/^(?:(?:ผม|ฉัน|เรา|หนู|ดิฉัน)(?:อยาก|ต้องการ)|(?:ขอ|อยาก|ต้องการ|ช่วย|รบกวน))(?:ช่วย)?(?:คุย|คุยต่อ|พูดคุย|ติดต่อ|เรียก|ต่อสาย|โอน|ส่งต่อ|ให้)(?:กับ|หา|ไปหา|ไป|ทาง)?(?:เจ้าหน้าที่|แอดมิน|คนจริง|มนุษย์|staff|admin|human)|^(?:ติดต่อ|คุยกับ|เรียก)(?:เจ้าหน้าที่|แอดมิน|คนจริง)|^(?:please )?(?:(?:i (?:want|need|would like) to )?(?:talk|speak|chat) (?:to|with)|connect me (?:to|with)|transfer me to)(?: a| an| the)? (?:human|staff|agent|person|representative)/.test(text)) {
    if (/ไม่(?:อยาก|ต้องการ)?คุย(?:กับ)?(?:บอต|บอท|ai)|stop(?: the)? bot/.test(text)) return { kind: 'request', stopBot: true };
    return { kind: 'request', stopBot: false };
  }

}
export const humanRequestReply = (stop: boolean) => 'รับคำขอคุยกับเจ้าหน้าที่ไว้แล้วครับ ยังไม่มีผู้รับช่วงและยังยืนยันเวลาตอบไม่ได้'
  + (stop ? '\nซีบอตจะพักตอบระหว่างรอ หากต้องการให้ตอบต่อ พิมพ์ คุยกับบอตต่อ' : '\nระหว่างรอถามซีบอตต่อได้ครับ');
export type HumanSupportStatus = { waiting: boolean };
export const humanSupportText = (status: HumanSupportStatus) => status.waiting
  ? 'คำขอคุยกับเจ้าหน้าที่ของคุณยังรอผู้รับช่วงครับ ยังยืนยันเวลาตอบไม่ได้'
  : 'เจ้าหน้าที่รับช่วงคุยต่อในแชต LINE นี้ได้ครับ หากต้องการ พิมพ์ ขอคุยกับเจ้าหน้าที่ ยังยืนยันเวลาตอบไม่ได้ครับ';
