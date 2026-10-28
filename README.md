# ซีบอต — CBTU Customer Agent ทดลอง

ใช้ Pi SDK core เดียวสำหรับ Terminal และ LINE adapter ชื่ออังกฤษยังไม่ยืนยัน ใช้เฉพาะข้อมูลเว็บไซต์ CBTU สาธารณะ ไม่มี Notion ภายใน ไม่มีข้อมูลผู้เรียนจริง และใช้ LINE ผ่าน tunnel ชั่วคราวสำหรับผู้ทดสอบ (LINE reply API ยอมรับข้อความจริงแล้ว)

- [แผนและสถานะงาน](./CUSTOMER_AGENT_PLAN.md)
- [ผลทดสอบ Terminal จริง รวมความจำผ่านโมเดล](./TERMINAL_TEST_RESULTS.md)
- [คู่มือ memory / reset / ลืมทั้งหมด](./MEMORY_GUIDE.md)
- [คู่มือตั้งค่า LINE ภาษาไทย](./LINE_SETUP.md)
- [ค้นหลักสูตรจาก snapshot / retrieval](./COURSE_CATALOG_GUIDE.md)
- [สาระสำคัญทั้ง 20 รายการ](./COURSE_BRIEFS.md) · [แนะนำตามงานและเป้าหมาย](./COURSE_ADVICE_GUIDE.md)
- [ผลตรวจคำถามที่ตอบผิดจาก LINE history](./LINE_HISTORY_REVIEW.md)
- [ตัวอย่าง config ไม่มี secrets](./.env.example)

## เริ่ม Terminal

ใช้ Node >=22.19.0 และ npm:

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm ci --ignore-scripts
npm run build
npm test
npm run check
npm run chat
```

ถามครั้งเดียว:

```sh
npm start -- "สมัครเรียนอย่างไร"
npm start -- "จ่ายเงินแล้วเริ่มเรียนทันทีไหม"
npm start -- "ดาวน์โหลด certificate"
npm start -- "ตรวจ DEMO-1001"
```

Terminal จำข้าม restart แล้ว: เก็บ recent context + สรุป + โปรไฟล์จากที่บอกชัดเจนไว้ใน `.customer-memory/` (ignore ใน Git) ไม่มีการบังคับ reset ทุก 20 ข้อความ เมื่อบริบทยาวจะย่ออัตโนมัติ ดูรายละเอียดและข้อจำกัดใน [MEMORY_GUIDE.md](./MEMORY_GUIDE.md)

คำขอจำรองรับหลายสำนวนแล้ว เช่น “จำไว้ด้วยว่าฉันสะดวกเรียนวันเสาร์” บอตจะยืนยันพร้อมทวน fact หลังบันทึกสำเร็จ และถามให้ชัดเมื่ออ้างได้หลายเรื่อง ดู [MEMORY_REQUEST_GUIDE.md](./MEMORY_REQUEST_GUIDE.md)

`/help` ดูคำสั่งที่รองรับในช่องทางนั้นโดยไม่เรียกโมเดล; `/memory` ดูสิ่งที่จำ; `/reset` ล้างบทสนทนา/สรุป/เรื่องค้าง แต่คงโปรไฟล์และ long-term preferences; `/forget` ตามด้วย `/confirm-forget` ภายใน60วินาทีเพื่อลบทั้งหมด หรือ `/cancel` เพื่อยกเลิก ข้อความอื่นรวม `/help` ยกเลิกคำขอยืนยันค้างและ help แจ้งชัดว่าข้อมูลยังอยู่; `/exit`, `/quit`, Ctrl-C ใช้เฉพาะTerminalเพื่อออกโดยคง memory ที่บันทึกแล้ว ผู้ทดสอบ local เริ่มต้นคือ tester; แยกอีกคนด้วย `npm run chat -- --user alice` (ไม่ใช่การยืนยันตัวตนจริง) LINE มีคำสั่ง help/memory/reset/forgetชุดเดียวกันแล้ว ใช้ `.line-memory/` แยกไฟล์/lockจากTerminal

FAQ ที่ระบุหัวข้อตอบจาก snapshot พร้อม URL/เวลาเก็บ ส่วนข้อความอื่นเข้า Pi dialogue layer ให้ตีความบทสนทนา/ความจำ/follow-up เป็น structured intent ไม่ใช้ whitelist คำ small talk ที่เหลือถูกปัดเป็น FAQ ไม่พบอีกแล้ว Core จำหัวข้อ FAQ ล่าสุดสำหรับคำอ้างทันที และ render ข้อมูล CBTU/ตัวตน/ลิงก์จากข้อมูลที่กำหนด ตรวจ domain/ชื่อสถาบันที่โมเดลพยายามแต่งเอง คำถามข้อเท็จจริงที่ไม่รองรับตอบไม่ทราบ ไม่ตีความ mock order เป็นข้อมูลผู้เรียนจริง

หาก Groq จำกัดการใช้งาน (HTTP 429) จะแจ้งเวลาพักและไม่ยิงซ้ำระหว่าง cooldown FAQ ที่ตอบจาก snapshot ยังใช้ได้ ข้อมูลเดิมไม่ถูกล้าง ไม่รับรองว่าจะคุยกับโมเดลต่อเนื่องได้โดยไม่ติด quota ระบบใช้ bounded context/auto compaction แทนเพดานสะสม 20 turn/100000 tokens เดิม

คีย์โมเดลตั้งใน `.env` บนเครื่อง ปัจจุบันใช้ `PI_PROVIDER=groq`, `PI_MODEL=qwen/qwen3.8-27b` และ `GROQ_API_KEY` หากเริ่มใหม่ให้ใช้ .env.example เป็นตัวอย่าง ห้ามคัดลอกทับ .env ที่มีค่าแล้ว ไม่ค้น/อ่าน Pi auth เก่า และไม่ต้องส่ง secrets ในแชต

## LINE local

ตรวจ config โดยไม่แสดงค่า secrets: `npm run line:check` (หลัง build) ผลล่าสุดยืนยัน OA **DemoB1**, token/channel และ allowlist 1คน เปิด ngrok เฉพาะพอร์ต3000แล้ว Public signature checks และ LINE Verify ผ่าน เปลี่ยน webhook/readback active=true และเริ่มโหมด reply จริงเฉพาะ allowlist แล้ว รับ inbound จริงและ LINE reply API ยอมรับ reply 7 ครั้งแล้ว อ่าน [สถานะและวิธีหยุด/rollback](./LINE_SETUP.md)

เติม LINE_CHANNEL_SECRET และค่าทดสอบตาม [LINE_SETUP.md](./LINE_SETUP.md) แล้ว:

```sh
npm run server
```

ค่าเริ่มต้น bind `127.0.0.1:3000`, POST `/webhook/line`, GET `/health`; dry run เป็นค่าเริ่มต้น รอบทดสอบปัจจุบันได้รับอนุญาตให้เปิด tunnel และตั้ง dry run false แล้ว ต้องเปิด server/tunnel ค้างไว้ กลุ่ม/room ถูกข้าม รับเฉพาะ 1:1 กับผู้ทดสอบ

LINE persistent memory เปิดแล้ว: `.line-memory/` แยกจากTerminal, key=line/OA/direct/user, retention90วันและcompactionค่าเดียวกัน ใช้ `/memory`, `/reset`, `/forget`→`/confirm-forget` หรือ `/cancel` ในแชต1:1 จากallowlist รายละเอียด [MEMORY_GUIDE.md](./MEMORY_GUIDE.md) ประวัติRAMก่อนเปิดstoreไม่ได้ย้ายอัตโนมัติ

## ค้นหลักสูตร

การแนะนำเน้นงาน/เป้าหมายแล้ว: ถามงานที่อยากทำ → พื้นฐาน → เวลา ทีละขั้น เลือกเฉพาะวิชาที่ตรงจริง แสดงงาน/สิ่งที่ฝึก/พื้นฐาน/วิธีเรียนแบบสั้น ราคาและรายละเอียดอื่นค่อยขยายเมื่อถาม ไม่เทmetadataทั้งหมด คงข้อมูลและแหล่งอ้างอิงหลังบ้าน ดู COURSE_BRIEFS.md และ COURSE_ADVICE_GUIDE.md

รุ่นแก้historyรองรับ list/count/price/sort/more/summary โดยเก็บกลุ่มผลค้นและหน้าที่แสดงแยกจากchat ดูได้หน้าละ1–10 ไม่ใช่cap3 โมเดลช่วยตีความภาษาพูดเป็นoperationที่hostvalidateและexecute Factsยังจากsnapshotเท่านั้น ลองรายการAI→“ขอราคาแต่ละตัวด้วย”, “ขอดูมากกว่า5ได้ไหม”, “อะไรแพงที่สุด”, “มีทั้งหมดกี่หลักสูตร” Testsล่าสุด32รายการรวมhistoryreplay/LINE/persistence/isolationผ่าน ดูหลักฐานและcoverageใน LINE_HISTORY_REVIEW.md

เชื่อม public snapshot 19 หลักสูตร + 1 bundle แล้ว ค้นชื่อ/alias/หัวข้อไทยอังกฤษและ rank candidates ไม่เกิน 3 รายการให้โมเดลเลือก IDs โค้ดแสดง facts/citations จาก snapshot เท่านั้น ชื่อกำกวมถามเพิ่ม ราคา null ไม่ถือว่าฟรี ไม่พบหลักสูตรไม่อ้างว่าไม่มีจริง ลอง “ยังไม่รู้จะเรียนอะไร”, “เปรียบเทียบ Excel กับ Canva”, “AI Agent for ALL ราคาเท่าไร”, “มีคอร์ส Quantum Computing ไหม” ข้อมูลไม่ใช่ราคา/รอบเปิดรับสด รายละเอียด [COURSE_CATALOG_GUIDE.md](./COURSE_CATALOG_GUIDE.md)

## โครงสร้างและผลตรวจ

- `src/core.ts`: แยก session/channel/customer, คิวรายลูกค้า, idle TTL, auto compaction และ memory controls
- `src/memory.ts`: local bounded persistence, profile/long-term preference extraction, summary, Pi context restoration และ confirmed deletion
- `src/catalog.ts`, `src/course-catalog.ts`: public course snapshot, lexical ranking/aliases, bounded model candidates และ host-rendered facts
- `src/agent.ts`: สร้าง Pi session, provider config, tool allowlist ไม่มี shell/file tools; Qwen ใช้ system role แทน developer role
- `src/knowledge.ts`: แหล่งความรู้สาธารณะ กติกา conflict/unknown, read-only knowledge tool และ persona ซีบอต
- `src/chat.ts`, `src/main.ts`: Terminal adapters; `src/conversation.ts`: model streaming/progress/timeout/call limits
- `src/line.ts`, `src/line-memory.ts`, `src/server.ts`: raw-body signature verification, async queue, dedupe, allowlist, bounded reply client และ safe operational logs

Build และ runtime tests ล่าสุด 49 รายการผ่าน รวม semantic memory requests/commit-before-ack/no-data-loss และ host /help ทั้งTerminal/LINEและcancel pending forget, structured instructor reader/teacher search/semantic follow-up, reviewed briefs/job-first advice และ history replay/query operations/catalog acceptance/grounding/aliases/follow-up, persistence/restart, >20 turn/compaction, reset/forget confirm/cancel/physical deletion, isolation, safe memory และ failed summary/429 recovery เพิ่ม import tests9รายการตรวจ fail-closed/last-good แยกด้วย `npm run test:catalog-import` ดู dependency/ข้อจำกัดใน [COURSE_INSTRUCTORS_GUIDE.md](./COURSE_INSTRUCTORS_GUIDE.md) หาก dialogue ผิดรูปแบบ/ถูกตัด/ว่าง จะขอซ่อมได้หนึ่งครั้งภายใน deadline เดิม Tests ไม่เรียก LINE จริง

ทดสอบ `npm run chat` ผ่าน PTY จริงหลายรอบและหลาย turn แบบผสมแล้ว พบและแก้ routing ที่วน FAQ fallback และการแต่งตัวตน/เว็บ ไม่พบ process crash ในรอบที่ reproduce แต่พบ provider 429 จริงด้วย จึงแยกผล functional กับข้อจำกัด provider ไว้ใน TERMINAL_TEST_RESULTS.md การทดสอบ 2 turn เดิมไม่เพียงพอยืนยัน small talk หรือความเสถียรแชตยาว LINE OA/HTTPS ตรวจ Verify และ signature จริงผ่านแล้ว และ LINE reply API ยอมรับ reply จริง 7 ครั้งแล้ว (ยังไม่ได้ตรวจหน้าจอผู้รับ)

สำหรับบริการจริงยังต้องเพิ่ม durable queue/dedupe และ customer verification ก่อนข้อมูลจริง, การประเมินคำตอบกว้างขึ้น และ cost monitoring แบบเงิน Local Terminal/LINE stores มี idle retention 90 วันและสิทธิ์ไฟล์จำกัด แต่ยังไม่ใช่ระบบหลายเครื่องหรือฐานข้อมูลเข้ารหัส ไม่มีการส่งต่อเจ้าหน้าที่หรือ action เปลี่ยนข้อมูลในรุ่นนี้

## แหล่งข้อมูล

- [CBTU FAQ](https://cbtumu.net/faq/), [Home/หลักสูตร](https://cbtumu.net/), [About](https://cbtumu.net/about-cbtu/) — snapshot 23 ตุลาคม 2026 ไม่รับรองราคา/เปิดรับสมัครล่าสุด
- [Pi SDK](https://pi.dev/docs/latest/sdk) — dependencies ตรึง 1.4.0 ใน package-lock.json
- [LINE webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

Git local baseline เริ่มจาก `31365a3`; .env/secrets/runtime data ไม่ถูก track ไม่มี remote หรือ push


ผลแก้ LINE fallback ล่าสุด: ทำซ้ำพบ Groq HTTP429 ขณะที่ FAQ ยังตอบได้ จึงแยกข้อความแจ้งโควตา/timeoutและlog `model_rate_limit`, `replied_fallback` ออกจากคำตอบปกติ ไม่แสดงraw error ผู้ใช้ยืนยันรับFAQหลังrestartแล้ว Build/tests20รายการและHTTP/public/LINE Verifyผ่าน โควตาโมเดลยังเป็นข้อจำกัดของprovider รายละเอียดและโหมดรันปัจจุบันใน LINE_SETUP.md

## ติดตามบทสนทนา

หลังเริ่ม server รุ่นใหม่ เปิด http://127.0.0.1:3001 เพื่อดูผู้ติดต่อและข้อความรับ–ตอบบนเครื่องนี้ ดูข้อจำกัด การเก็บข้อมูล และแนวทาง push message ที่ [MONITOR_GUIDE.md](./MONITOR_GUIDE.md)
