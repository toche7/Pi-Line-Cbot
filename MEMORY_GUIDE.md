# Memory ของซีบอตใน Terminal

อัปเดต 23 ตุลาคม 2026 — milestone นี้เปลี่ยน Terminal/core/store เท่านั้น ไม่มีการเปลี่ยน LINE adapter/config หรือเปิด memory ถาวรให้ LINE server

## เริ่มใช้งาน

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm run build
npm run chat
```

ผู้ใช้ local เริ่มต้นคือ `tester` เปิดครั้งถัดไปจากโฟลเดอร์เดิมจะอ่าน memory เดิม หากแยกผู้ทดสอบใช้ `npm run chat -- --user alice` หรือ `--user bob` ห้ามถือ flag นี้เป็น authentication: ทุกคนที่ใช้บัญชี OS นี้เข้าถึงข้อมูล local ได้ ไม่มีการยืนยันสิทธิ์ข้อมูลผู้เรียนจริง

ลองบอก “ฉันชื่อ มะลิ”, “ฉันสนใจ AI”, “เป้าหมายการเรียนของฉันคือ สร้างบอต” แล้ว `/exit` เปิดใหม่ด้วย user เดิมและถามชื่อ/เป้าหมายได้ ระบบไม่เดาโปรไฟล์จากคำถามหรือจากคำตอบโมเดล รูปประโยคที่ไม่ตรงอาจอยู่ใน recent context แต่ไม่กลายเป็น profile โดยอัตโนมัติ

## เก็บอะไรและคำสั่งควบคุม

| ส่วน | พฤติกรรม |
|---|---|
| Recent context | เก็บข้อความและคำตอบที่แสดงจริงหลังคำขอสำเร็จ สูงสุด 12 คู่ เก็บแต่ละฝั่งไม่เกิน 1000 ตัวอักษร ไม่เก็บ raw JSON/reasoning/error ของ provider |
| Summary | คัดข้อความเก่าแบบ extractive ในเครื่อง: notes ล่าสุด 12 รายการ, topics ล่าสุด 8, pending ล่าสุด 8; รายการละไม่เกิน 180 ตัวอักษร ไม่เรียกโมเดลสรุปเพิ่ม |
| Profile | ชื่อที่ให้เรียก ความสนใจ เป้าหมายการเรียน จากประโยคที่บอกชัดเจน ค่าละไม่เกิน 160 ตัวอักษร บอกค่าใหม่เพื่อแก้ค่าเดิม |
| Long-term preferences | “ช่วยจำระยะยาวว่า ชอบตัวอย่างภาษาไทย” เก็บสูงสุด 8 รายการ ข้อละ 160 ตัวอักษร ไม่รับข้อความเรื่องค้าง/พรุ่งนี้/สิทธิ์หรือคำสั่งระบบ |
| `/memory` | แสดงข้อมูลของ local user นี้บน Terminal ควรใช้ในพื้นที่ส่วนตัว |
| `/reset` | ทำทันทีหลังคำอธิบาย: ล้าง recent messages, summary และ pending/หัวข้อ active ทั้งหมด คง profile และ long-term preferences ไม่โหลดเรื่องค้างจาก session เก่าอีก |
| `/forget` | อธิบายสิ่งที่จะลบและสร้างคำขอยืนยัน 60 วินาที ต้องพิมพ์ `/confirm-forget` จึงลบไฟล์ของ identity นี้ รวม recent/summary/profile/long-term และทิ้ง active Pi session |
| `/cancel` | ยกเลิกการลืม ข้อมูลยังอยู่ การส่งข้อความ/คำสั่งอื่นก็ยกเลิกคำขอยืนยันค้างเช่นกัน |
| `/exit` | ปิดโปรแกรมแต่คงข้อมูลที่บันทึกสำเร็จ |

“ลืมทั้งหมด” ลบจาก store ของโปรแกรมด้วย unlink ไม่มีสำเนาประวัติ/session JSONL เก็บซ่อนในแอป ไม่กระทบ user หรือ channel อื่น แต่ไม่สามารถรับรองการลบสำเนาที่มีอยู่ใน backup ของ OS, Terminal scrollback หรือระบบ provider ได้

## การย่อบริบทและ Pi

ไม่มีเพดานบังคับ reset ทุก 20 คำตอบหรือเพดาน cumulative token แบบเดิมแล้ว เมื่อ recent ครบ 12 คู่ หรือ serialized active Pi context ยาวเกิน 24000 ตัวอักษร ระบบคัดสาระเก่าและคง 6 คู่ล่าสุด สร้าง Pi session ใหม่โดยใช้ `SessionManager.inMemory()` พร้อม `appendCompaction()` และ custom context entries จาก memory ที่กรองแล้ว เก็บโปรไฟล์และเรื่องค้างแยกจาก recent ไว้ ไม่ใช่เพียงยก limit20 ให้สูงขึ้น

Store เป็น canonical persistence แบบมีขอบเขต ไม่มี Pi append-only raw transcript บนดิสก์ เพราะจะเก็บ reasoning/errors และโตไม่จำกัดได้ ตัวเลือก default LLM auto-compaction ของ SDK ยังปิดอยู่ ใช้ compaction entry/projection ของ Pi ร่วมกับ host-triggered extractive compaction แทน `session.compact()` ที่เรียก provider นี่เป็นการย่อแบบสูญรายละเอียดได้ ไม่ใช่ semantic summarization ที่เข้าใจทุกประโยค

หาก summarizer throw หรือคืน schema ไม่ถูกต้อง ใช้ extractive fallback ที่ validate แล้ว ไม่แก้ข้อมูลต้นฉบับก่อนสำเร็จ Provider 429 ยังแจ้ง cooldown และไม่ลบ memory เดิม ไม่บันทึกข้อความ error ลง memory หากบอกโปรไฟล์ชัดเจนจะบันทึกก่อนเรียกโมเดล จึงยังจำโปรไฟล์นั้นได้แม้ provider ตอบ 429

Notes/pending เป็นข้อมูลคำพูดผู้ใช้ ไม่ใช่สิ่งที่ระบบยืนยันหรือดำเนินการแล้ว Pending ไม่ได้มี task completion engine; อาจคงเรื่องเก่าจนหลุดจากขอบเขตล่าสุดหรือผู้ใช้ `/reset` Long-term มีเฉพาะ profile และข้อความที่ขอจำระยะยาวโดยตรง จึงไม่คง session pending หลัง reset

## ที่เก็บ ความปลอดภัย และ retention

- `.customer-memory/` อยู่ใต้โฟลเดอร์โปรเจกต์ ถูก ignore ใน Git ชื่อไฟล์ hash จาก channel/scope/user ไม่ใช้ user input เป็น path
- สิทธิ์ directory 0700, file/lock 0600 เขียน temporary file+fsync+rename แบบ atomic ไม่มี backup ในแอป; disk data ไม่เข้ารหัส ควรใช้ OS disk encryption ตามสภาพเครื่อง
- จำกัด 200 identities, 64 KiB/record ถ้าเข้าใกล้ 60 KiB จะย่อก่อนบันทึก มีเพดาน recent/summary/profile/long-term ตามตาราง เกิน capacity แจ้ง error โดยไม่เขียนทับไฟล์เดิม
- idle Pi sessions ถูกปล่อยเมื่อไม่มีการใช้ 30 นาทีและมี request ใหม่ แต่ record ถาวรยังอยู่ ลบ record ที่ไม่อัปเดตเกิน 90 วันเมื่อเปิด store หรือ load identity นั้น ไม่ใช่ background timer ขณะโปรแกรมปิด
- lock ให้ store นี้เปิดได้ทีละโปรเซสเพื่อไม่ให้ stale writer คืนข้อมูลที่ลบไป ปิดแชตเก่าก่อนเปิดอีกหน้าต่าง; lock ของ PID ที่ตายแล้วกู้ได้อัตโนมัติ ไฟล์เสีย/ขนาดเกินถูกแจ้งและคงไว้ ไม่แทนด้วย memory ว่างโดยเงียบ ๆ
- ไม่อ่าน `.env` เพื่อเอา key มาเก็บ ไม่อ่าน credentials เก่า ตัวกรองตัดข้อความที่มี label ของ secret/ข้อมูลอ่อนไหว และรูปแบบ token/email/หมายเลขที่รู้จักก่อนส่งโมเดลหรือบันทึก เป็น conservative heuristic อาจตัดคำถามทั่วไปมากไปและไม่ตรวจพบข้อมูลอ่อนไหวทุกรูปแบบ กรุณาไม่ป้อน secrets ให้บอต
- Profile/summary/recent ถูกระบุเป็น untrusted data ใน Pi context ไม่เปลี่ยน identity, tool allowlist, source facts หรือสิทธิ์ ไม่มี memory tool ที่ให้โมเดลเขียนชื่อคนอื่น/ลบข้อมูลเอง

## หลักฐานการทดสอบ

`npm run build` และ `npm test` ผ่าน 18 tests ครอบคลุม:

- คุยเกิน 20 (>32 รอบ) และ compaction หลายครั้ง มี Pi compaction entry จริงและรักษาชื่อ/เรื่องค้าง
- จำข้ามวันจำลองและเปิด store ใหม่ รวมแยก Node process เขียน/อ่านจริง
- แยก user/channel, FIFO, reset คง profile/long-term แต่ล้าง pending แล้ว restart ไม่คืน pending
- forget ต้อง confirm, มี cancel/หมดอายุ challenge, ลบ record จริง และเปิดใหม่ไม่กลับ; ไม่ลบ user B
- malformed summary/summary throw และ provider429 ไม่ล้าง facts เดิม, secret fixture ไม่อยู่ในไฟล์หรือ model context, permission/lock/retention/corrupt store

CLI จริงกับ Groq Qwen ใช้ผู้ทดสอบ `memory-check-1023`: บอกชื่อ “มะลิ73” (514 ms), `/exit`, เปิดโปรเซสใหม่แล้วถามชื่อได้ถูก (370 ms); ต่ออีก 24 FAQ/greeting โดยไม่บังคับ reset มี compaction, `/reset` แล้ว `/memory` คงชื่อและไม่มี recent/pending, `/forget`→`/cancel`→`/forget`→`/confirm-forget`; เปิดใหม่ `/memory` ว่างและตรวจไฟล์ identity ว่าไม่มีอยู่จริง ผู้ทดสอบนี้ถูกลบแล้ว ไม่แตะข้อมูล user เริ่มต้น

การข้ามวันเป็น fake-clock test ไม่ได้รอครบวันจริง Model live เรียกเพียงการบอกและถามชื่อ ไม่ทดสอบ LLM ทุกข้อความซ้ำเพื่อลดการใช้ quota; บทสนทนายังอาจติด provider429 หรือเลือก intent ผิดได้ ไม่มีการทดสอบหรือเปลี่ยน LINE ใน milestone นี้

เอกสาร Pi ที่ตรวจ: [SDK session storage](https://pi.dev/docs/latest/sdk), [Compaction reference](https://pi.dev/docs/latest/compaction) พร้อมตรวจ declarations ของเวอร์ชัน 1.4.0 ที่ติดตั้ง
