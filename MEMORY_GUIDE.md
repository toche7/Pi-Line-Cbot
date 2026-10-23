# Memory ของซีบอตใน Terminal และ LINE

อัปเดต 23 ตุลาคม 2026 — Terminal และ LINE ใช้ bounded memory semantics เดียวกัน แยกโฟลเดอร์/lock/identity ไม่อ่านหรือรวมความจำข้ามช่องทาง

## LINE persistent memory

Catalog context มี advice goal/background/time/stage แบบoptionalและbounded200ตัวอักษรต่อคำตอบ เก็บเฉพาะสิ่งที่ผู้ใช้ตอบ ไม่เดาอาชีพ/คุณสมบัติ ใช้เฉพาะidentityเดิม ผ่านcompaction/restart `/reset` และ `/forget` ล้างadviceด้วย การคุยเล่นและการถามราคา/รายชื่อไม่ถูกเก็บเป็นคำตอบขั้นadviceโดยอัตโนมัติ

Catalog context ปัจจุบันเก็บ full matched IDs / shown IDs / offset / page size / filter queryที่กรองแล้ว แยกจากหัวข้อ FAQ เพื่อไม่เสียบริบทเมื่อขอราคา/รายการต่อหรือคุยเล่น รองรับไม่เกิน20IDsและหน้าละ10รายการ สร้างเมื่อใช้catalogคงผ่านcompaction/restart และล้างด้วย/resetหรือ/forget ไม่เชื่อมข้ามผู้ใช้/OA/ช่องทาง รายละเอียด [LINE_HISTORY_REVIEW.md](./LINE_HISTORY_REVIEW.md)

LINE server เปิด MemoryStore ใน `.line-memory/` ส่วน Terminal ใช้ `.customer-memory/` ทั้งสองถูกignoreในGit โฟลเดอร์และlockแยกกันจึงเปิดคนละโปรเซสพร้อมกันได้ LINE keyประกอบด้วยchannel=line + channelIDของOA/direct + LINE userIDที่ผ่านsignature/allowlist ไม่ดึงidentityจากเนื้อหาข้อความ ไม่แชร์ไฟล์หรือprofileกับTerminal แม้เป็นเจ้าของคนเดียวกัน

ค่าการเก็บเหมือนตารางด้านล่าง: profile, explicit long-term, recent, local extractive summary(notes/topics/pending), lastTopic และcompactions; recentครบ12คู่หรือcontextเกิน24000ตัวอักษรจะcompactเหลือ6คู่ล่าสุด retention90วันเมื่อตรวจ ขีดจำกัด200identities/64KiBต่อrecordและpermission0700/0600ใช้ต่อstore คงหลักการบันทึกrendered successfulturnและเรียนprofileชัดเจนก่อนเรียกโมเดลตามTerminalเดิม ไม่เก็บprovidererrors/reasoning/rawJSON

คำสั่ง LINE 1:1 เฉพาะallowlist:

- `/memory`: ดูprofile/long-termและภาพรวมsummary/recentแบบย่อให้พอดีLINE ข้อมูลเต็มยังอยู่ในboundedstore ไม่ส่งuserID/ชื่อไฟล์/confirmationtokenให้ผู้ใช้
- `/reset`: ล้างrecent/summary/pending/lastTopicแล้วคงprofile/long-term เฉพาะผู้ใช้นี้และOAนี้
- `/forget`: แจ้งว่าจะลบทั้งหมด รอ `/confirm-forget` ภายใน60วินาที หรือ `/cancel` ยกเลิก
- `/confirm-forget`: ใช้ได้เฉพาะchallengeที่ขอจากผู้ใช้/OA/adapter instanceเดิม ทิ้งchallengeหลังใช้ ไม่รับtokenในข้อความ ผู้ใช้อื่น/OAอื่นยืนยันแทนไม่ได้
- `/cancel`, ข้อความปกติ หรือคำสั่งอื่นยกเลิกchallengeที่ค้าง การrestart/idleเกิน30นาทีก็ทิ้งchallengeด้วย การพิมพ์ขอให้ลืมในข้อความทั่วไปไม่เรียกdeleteเอง

คำสั่งเหล่านี้ไม่เรียกโมเดล ไม่ถูกบันทึกเป็นrecentturn และยังต้องผ่านrawsignature/dedupe/allowlistเหมือนข้อความทั่วไป Dry-runยังประมวลผลและบันทึกmemoryได้แต่ไม่ส่งreply ไม่ใช้dry-runกับข้อมูลที่ไม่ต้องการเก็บ/เปลี่ยน การrestartเปิดrecordเดิมกลับมา ส่วนประวัติLINEที่เคยอยู่RAMก่อนmilestoneนี้ไม่ได้ย้ายอัตโนมัติ

LINE storeยังเป็นlocalJSONที่ไม่เข้ารหัส ไม่มีหลายเครื่องร่วมเขียนและไม่มีdurablequeue/dedupe การเปิดเครื่อง/server/tunnelค้างไว้ยังจำเป็น การเก็บmemoryไม่ได้แก้provider429/timeoutหรือรับประกันdelivery ไม่แชร์สิทธิ์ข้อมูลผู้เรียนหรือเรียกNotion

## ผลตรวจ LINE memory

Build/tests22รายการผ่าน รวมsignedLINEevents/profile/summary/>32turn/compaction/restart/fake-next-day, OA/user/channel isolation, TerminalอีกโปรเซสเปิดstoreแยกขณะLINEถือlock, resetคงprofile/long-termแต่ล้างpending, forgetcancel/expiry/confirmationข้ามuser/OA/adapterrestartไม่ได้, physicaldelete/no-revival และretentionจากmemoryread คงsignature/mockreply/dedupe/privacyเดิม Testsใช้tempstores/mockIDsและmockprovider ไม่ลบหรืออ่านเนื้อหาTerminalmemoryจริง

LINEจริง: ผู้ใช้ส่งชื่อเข้าDemoB1แล้ว logok490ms/replied ตรวจmetadataว่าrecordบนดิสก์มีprofile nameและrecent1คู่ permission0600 โดยไม่พิมพ์ค่า identity/name จากนั้นrestartserver ผู้ใช้ส่ง/memoryผ่านLINEและยืนยันว่าprofile nameกับrecent1คู่ยังอยู่หลังrestart จึงยืนยันอ่านข้ามโปรเซสผ่านLINEจริงแล้ว ไม่มีการลบข้อมูลจริงเพื่อทดสอบ

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
| Long-term preferences | รับคำขอหลายสำนวน เช่น “จำไว้ด้วยว่าฉันสะดวกเรียนวันเสาร์”, “คราวหน้าช่วยจำว่าชอบออนไลน์” ผ่าน semantic extraction และ host validation สูงสุด8รายการ ข้อละ160ตัวอักษร เรื่องชั่วคราวไปpendingแทน ไม่ใช้เป็นสิทธิ์/คำสั่งระบบ และไม่ไล่ลบรายการเดิมเมื่อเต็ม |
| `/memory` | แสดงข้อมูลของ local user นี้บน Terminal ควรใช้ในพื้นที่ส่วนตัว |
| `/help` | ดูคำสั่งที่ใช้ได้ในช่องทางนั้น ไม่เรียกโมเดลหรือบันทึกเป็นบทสนทนา และยกเลิกคำขอลืมที่รอยืนยันพร้อมแจ้งว่าข้อมูลยังอยู่ LINE ไม่แสดง `/exit` หรือ `/quit` |
| `/reset` | ทำทันทีหลังคำอธิบาย: ล้าง recent messages, summary และ pending/หัวข้อ active ทั้งหมด คง profile และ long-term preferences ไม่โหลดเรื่องค้างจาก session เก่าอีก |
| `/forget` | อธิบายสิ่งที่จะลบและสร้างคำขอยืนยัน 60 วินาที ต้องพิมพ์ `/confirm-forget` จึงลบไฟล์ของ identity นี้ รวม recent/summary/profile/long-term และทิ้ง active Pi session |
| `/cancel` | ยกเลิกการลืม ข้อมูลยังอยู่ การส่งข้อความ/คำสั่งอื่นก็ยกเลิกคำขอยืนยันค้างเช่นกัน |
| `/exit` | ปิดโปรแกรมแต่คงข้อมูลที่บันทึกสำเร็จ |

“ลืมทั้งหมด” ลบจาก store ของโปรแกรมด้วย unlink ไม่มีสำเนาประวัติ/session JSONL เก็บซ่อนในแอป ไม่กระทบ user หรือ channel อื่น แต่ไม่สามารถรับรองการลบสำเนาที่มีอยู่ใน backup ของ OS, Terminal scrollback หรือระบบ provider ได้

คำขอจำตามความหมายใช้โมเดลสร้างแผน ไม่บังคับวลี “ช่วยจำระยะยาวว่า…” โค้ดตรวจหลักฐานที่เป็นข้อความของผู้ใช้และบันทึกก่อนตอบ “บันทึกแล้ว” พร้อมทวนค่าจริง `/memory` จึงเห็นข้อมูลที่ยืนยัน คำอ้าง “จำเรื่องนี้ไว้” ใช้ได้เฉพาะข้อความผู้ใช้ก่อนหน้าที่เป็นข้อเท็จจริงส่วนตัวชัดเจนหนึ่งเรื่อง ถ้ากำกวมจะถามก่อนและยังไม่บันทึก ช่วงตอบคำถามเพื่อให้ชัดมีอายุ5นาทีในRAM ไม่ข้ามrestart/reset/การเปลี่ยนเรื่อง รายละเอียดและผลทดสอบที่ [MEMORY_REQUEST_GUIDE.md](./MEMORY_REQUEST_GUIDE.md)

## การย่อบริบทและ Pi

ไม่มีเพดานบังคับ reset ทุก 20 คำตอบหรือเพดาน cumulative token แบบเดิมแล้ว เมื่อ recent ครบ 12 คู่ หรือ serialized active Pi context ยาวเกิน 24000 ตัวอักษร ระบบคัดสาระเก่าและคง 6 คู่ล่าสุด สร้าง Pi session ใหม่โดยใช้ `SessionManager.inMemory()` พร้อม `appendCompaction()` และ custom context entries จาก memory ที่กรองแล้ว เก็บโปรไฟล์และเรื่องค้างแยกจาก recent ไว้ ไม่ใช่เพียงยก limit20 ให้สูงขึ้น

Store เป็น canonical persistence แบบมีขอบเขต ไม่มี Pi append-only raw transcript บนดิสก์ เพราะจะเก็บ reasoning/errors และโตไม่จำกัดได้ ตัวเลือก default LLM auto-compaction ของ SDK ยังปิดอยู่ ใช้ compaction entry/projection ของ Pi ร่วมกับ host-triggered extractive compaction แทน `session.compact()` ที่เรียก provider นี่เป็นการย่อแบบสูญรายละเอียดได้ ไม่ใช่ semantic summarization ที่เข้าใจทุกประโยค

หาก summarizer throw หรือคืน schema ไม่ถูกต้อง ใช้ extractive fallback ที่ validate แล้ว ไม่แก้ข้อมูลต้นฉบับก่อนสำเร็จ Provider 429 ยังแจ้ง cooldown และไม่ลบ memory เดิม ไม่บันทึกข้อความ error ลง memory หากบอกโปรไฟล์ชัดเจนจะบันทึกก่อนเรียกโมเดล จึงยังจำโปรไฟล์นั้นได้แม้ provider ตอบ 429

Notes/pending เป็นข้อมูลคำพูดผู้ใช้ ไม่ใช่สิ่งที่ระบบยืนยันหรือดำเนินการแล้ว Pending ไม่ได้มี task completion engine; อาจคงเรื่องเก่าจนหลุดจากขอบเขตล่าสุดหรือผู้ใช้ `/reset` Long-term มีเฉพาะ profile และข้อความที่ขอจำระยะยาวโดยตรง จึงไม่คง session pending หลัง reset

## ที่เก็บ ความปลอดภัย และ retention

- `.customer-memory/` (Terminal) และ `.line-memory/` (LINE) อยู่ใต้โฟลเดอร์โปรเจกต์ ถูก ignore ใน Git ชื่อไฟล์ hash จาก channel/scope/user ไม่ใช้ user input เป็น path
- สิทธิ์ directory 0700, file/lock 0600 เขียน temporary file+fsync+rename แบบ atomic ไม่มี backup ในแอป; disk data ไม่เข้ารหัส ควรใช้ OS disk encryption ตามสภาพเครื่อง
- จำกัด 200 identities, 64 KiB/record ถ้าเข้าใกล้ 60 KiB จะย่อก่อนบันทึก มีเพดาน recent/summary/profile/long-term ตามตาราง เกิน capacity แจ้ง error โดยไม่เขียนทับไฟล์เดิม
- idle Pi sessions ถูกปล่อยเมื่อไม่มีการใช้ 30 นาทีและมี request ใหม่ แต่ record ถาวรยังอยู่ ลบ record ที่ไม่อัปเดตเกิน 90 วันเมื่อเปิด store หรือ load identity นั้น ไม่ใช่ background timer ขณะโปรแกรมปิด
- lock ให้ store นี้เปิดได้ทีละโปรเซสเพื่อไม่ให้ stale writer คืนข้อมูลที่ลบไป ปิดแชตเก่าก่อนเปิดอีกหน้าต่าง; lock ของ PID ที่ตายแล้วกู้ได้อัตโนมัติ ไฟล์เสีย/ขนาดเกินถูกแจ้งและคงไว้ ไม่แทนด้วย memory ว่างโดยเงียบ ๆ
- ไม่อ่าน `.env` เพื่อเอา key มาเก็บ ไม่อ่าน credentials เก่า ตัวกรองตัดข้อความที่มี label ของ secret/ข้อมูลอ่อนไหว และรูปแบบ token/email/หมายเลขที่รู้จักก่อนส่งโมเดลหรือบันทึก เป็น conservative heuristic อาจตัดคำถามทั่วไปมากไปและไม่ตรวจพบข้อมูลอ่อนไหวทุกรูปแบบ กรุณาไม่ป้อน secrets ให้บอต
- Profile/summary/recent ถูกระบุเป็น untrusted data ใน Pi context ไม่เปลี่ยน identity, tool allowlist, source facts หรือสิทธิ์ ไม่มี memory tool ที่ให้โมเดลเขียนชื่อคนอื่น/ลบข้อมูลเอง

## หลักฐานการทดสอบ

ผลmilestone Terminalเดิม: `npm run build` และ `npm test` ผ่าน 18 tests ครอบคลุม:

- คุยเกิน 20 (>32 รอบ) และ compaction หลายครั้ง มี Pi compaction entry จริงและรักษาชื่อ/เรื่องค้าง
- จำข้ามวันจำลองและเปิด store ใหม่ รวมแยก Node process เขียน/อ่านจริง
- แยก user/channel, FIFO, reset คง profile/long-term แต่ล้าง pending แล้ว restart ไม่คืน pending
- forget ต้อง confirm, มี cancel/หมดอายุ challenge, ลบ record จริง และเปิดใหม่ไม่กลับ; ไม่ลบ user B
- malformed summary/summary throw และ provider429 ไม่ล้าง facts เดิม, secret fixture ไม่อยู่ในไฟล์หรือ model context, permission/lock/retention/corrupt store

CLI จริงกับ Groq Qwen ใช้ผู้ทดสอบ `memory-check-1023`: บอกชื่อ “มะลิ73” (514 ms), `/exit`, เปิดโปรเซสใหม่แล้วถามชื่อได้ถูก (370 ms); ต่ออีก 24 FAQ/greeting โดยไม่บังคับ reset มี compaction, `/reset` แล้ว `/memory` คงชื่อและไม่มี recent/pending, `/forget`→`/cancel`→`/forget`→`/confirm-forget`; เปิดใหม่ `/memory` ว่างและตรวจไฟล์ identity ว่าไม่มีอยู่จริง ผู้ทดสอบนี้ถูกลบแล้ว ไม่แตะข้อมูล user เริ่มต้น

การข้ามวันเป็น fake-clock test ไม่ได้รอครบวันจริง Model live เรียกเพียงการบอกและถามชื่อ ไม่ทดสอบ LLM ทุกข้อความซ้ำเพื่อลดการใช้ quota; บทสนทนายังอาจติด provider429 หรือเลือก intent ผิดได้ ไม่มีการทดสอบหรือเปลี่ยน LINE ใน milestone Terminalเดิมนี้; ผลLINEใหม่อยู่ด้านบน

เอกสาร Pi ที่ตรวจ: [SDK session storage](https://pi.dev/docs/latest/sdk), [Compaction reference](https://pi.dev/docs/latest/compaction) พร้อมตรวจ declarations ของเวอร์ชัน 1.4.0 ที่ติดตั้ง
