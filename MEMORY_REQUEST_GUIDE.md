# คำขอจำตามความหมาย

ใช้โค้ดชุดเดียวกันสำหรับ Terminal และ LINE ผ่าน CustomerCore โดย identity มาจาก adapter เท่านั้น คง store/key/locks/retention/limits และ schema memory version1 เดิม ไม่ย้ายหรือรวมความจำผู้ใช้/OA/Terminal/LINE และไม่เปลี่ยน provider หรือ credentials

## เข้าใจ → ตรวจ → บันทึก → ยืนยัน

คำขอหลายสำนวน เช่น “จำไว้ด้วยว่าฉันสะดวกเรียนวันเสาร์” และ “คราวหน้าช่วยจำว่าชอบออนไลน์” เข้า semantic planner โมเดลเสนอ JSON intent memory/action/entries ไม่มีสิทธิ์เรียกไฟล์หรือเลือก identity แยกชนิด profile(name/interests/goals), long_term(preferences) และ pending(เรื่องชั่วคราว)

Host ตรวจ shape/whitelist/source/owner/ขนาด/ข้อความอ่อนไหวและคำสั่งเปลี่ยนกฎ ค่าต้องเป็นข้อความสั้นที่อยู่จริงใน quote ของผู้ใช้ปัจจุบัน หรือผู้ใช้ก่อนหน้าทันที ไม่อนุมานจากคำตอบบอต ไม่ค้น memory คนอื่น และไม่ยกระดับข้อเท็จจริงหลักสูตรเป็นความชอบผู้ใช้ ข้อความมีเวลาชั่วคราว เช่น “พรุ่งนี้ค่อยเลือกคอร์ส” ไป pending และบอกว่า /reset ล้างได้

การบอกชื่อ/ความสนใจ/เป้าหมายที่รูปประโยคชัดเจนและคำขอระยะยาวรูปเดิมยังมี fast path โดยผ่าน host guards และขั้นตอน commit เดียวกัน จึงยังใช้ได้เมื่อ provider มีปัญหา ไม่มีการบังคับใช้รูปประโยคนี้กับคำขออื่น

แก้ canonical memory ผ่านสำเนา staging และเรียก MemoryStore.save (atomic/fsync/rename เดิม) ก่อนเปลี่ยน in-memory canonical state หรือส่งคำตอบ “บันทึกแล้ว” Host ทวน normalized fact และประเภทที่เก็บ พร้อมบอกให้ตรวจ /memory โมเดลไม่มีสิทธิ์ยืนยันการ persist เองผ่าน chat reply หากไม่มี persistent store จะบอกว่าใช้เฉพาะแชตนี้และยังไม่ได้เปิดที่เก็บข้าม restart

ถ้า schema/extraction/provider ผิดหรือเขียนไฟล์ไม่สำเร็จจะไม่อ้าง success และไม่ทับ canonical facts เดิม รูปแบบผิดซ่อมได้หนึ่งครั้งภายใน deadline เดิม ไม่ retry 429 หรือ store failure Store failure มี category memory_write และข้อความไทยที่ไม่แสดง raw error เมื่อlong_term/pendingครบ8รายการจะไม่ไล่ลบข้อเก่าเพื่อเพิ่มข้อใหม่

## อ้างเรื่องก่อนหน้าและการถามให้ชัด

“จำเรื่องนี้ไว้” อ้างได้เฉพาะ USER statement ก่อนหน้าทันทีที่ชัดเจนเพียงเรื่องเดียว ไม่รับคำถาม/ทางเลือกหลายข้อ/ข้อความผู้ช่วย/คำขอจำก่อนหน้าเป็น evidence ถ้ากำกวม Host ถามให้ระบุข้อมูลชัดและยังไม่เพิ่ม fact

เมื่อมีคำขอจำชัดแต่ต้องถามเพิ่ม ให้ตอบข้อเท็จจริงส่วนตัวที่ต้องการจำหนึ่งเรื่องภายใน5นาที สิทธิ์ตอบคำถามนี้อยู่ในRAMของidentityเดิมเท่านั้น ไม่เป็นสิทธิ์ระบบ หมดอายุเมื่อเปลี่ยนเรื่อง/reset/restart ไม่เอาประวัติเก่าหรือคำถามเรื่องหลักสูตรมาเติม fact ถ้าผู้ใช้กลับมาหลังเริ่มใหม่ให้ขอจำพร้อมข้อมูลอีกครั้ง

การบอกความชอบเฉย ๆ ไม่ถูกเลื่อนเป็น long_term โดยอัตโนมัติ คง recent/session context ตามเดิม (ยกเว้น profile declarations ที่รองรับเดิม) คำที่ตรงFAQเช่น “วิดีโอ” ภายใน personal preference ไม่ทำให้ถูกตอบเป็นปัญหาการเล่นวิดีโอ

## ขอบเขตข้อมูล

ไม่รับ API keys/tokens/passwords/payment details, PII ที่ไม่จำเป็น, ข้อมูลส่วนตัวบุคคลอื่น หรือคำสั่ง override policy ชื่อที่ให้เรียกและข้อมูลเรียนของเจ้าของidentityเก็บได้ ข้อมูล memory เป็น untrusted user data ไม่ใช่ authority ขยายการกรอง PII สำหรับข้อความเข้าใหม่โดยไม่เปลี่ยน version1 read validator จนไฟล์ประวัติเดิมเปิดไม่ได้ ไม่ได้ scan/แก้ย้อนหลัง record ของคนอื่น

การตรวจคำอ้างและคำสั่งเป็นแบบ conservative อาจถามเพิ่มกับประโยคยาว หลายเรื่อง คำสัมพันธ์บุคคล หรือการถอดความที่ไม่ตรง source ไม่รับรองทุกสำนวนภาษา คำขอทั่วไปใช้ quota โมเดลเดิม ส่วน /help และ memory commands ยังเป็น host commands ไม่เรียกโมเดล

## ผลตรวจรุ่นนี้

- Build/runtime tests49รายการผ่าน รวม 7 tests ใหม่ด้าน paraphrases, single/ambiguous reference, clarification/expiry/new core/reset, ownership/injection/identity override, normalized fact/temporary pending, provider/parse/store failure, no data loss, limits และ signed LINE/Terminal mock
- ตรวจ store failure ทั้ง semantic request และ fast profile update: ไม่ส่งคำยืนยันและทั้งไฟล์กับ in-memory canonical facts เดิมไม่เปลี่ยน
- /memory เห็นข้อมูลจริง, /reset คงprofile/long_termแต่ล้างpending, /forget confirm/cancel และ restart/channel/user/OA isolation regressions ผ่าน
- API จริงหลังแก้ contract: 2สำนวนข้างต้นเลือกmemory/save/long_termโดยค่าตรงquote บันทึกสองข้อพร้อมทวนได้ เปิดstoreใหม่อ่านสองข้อกลับได้ ใช้directory/identityชั่วคราวที่ลบหลังทดสอบ ไม่ส่งข้อความLINE
- การรับคำตอบจริงในแอป LINE รุ่นนี้ต้องรอ incoming จากผู้ใช้ จึงยังไม่ถือว่า end-to-end ผ่าน
- Restart server โหมดตอบจริงบนDemoB1แล้ว ใช้tunnel/webhookเดิมและเปิดpersistentstoreสำเร็จ ตรวจhealth200/unsigned401/signed-empty200/LINE Verifyผ่าน ไม่เปลี่ยน.envหรือส่งpush/broadcast

ลองใน DemoB1: “จำไว้ด้วยว่าฉันสะดวกเรียนวันเสาร์” แล้ว `/memory` ควรเห็น fact ที่บอตทวนในรายการ “ขอจำระยะยาว”
