# ซีบอต — CBTU Customer Agent ทดลอง

ใช้ Pi SDK core เดียวสำหรับ Terminal และ LINE adapter ชื่ออังกฤษยังไม่ยืนยัน ใช้เฉพาะข้อมูลเว็บไซต์ CBTU สาธารณะ ไม่มี Notion ภายใน ไม่มีข้อมูลผู้เรียนจริง และใช้ LINE ผ่าน tunnel ชั่วคราวสำหรับผู้ทดสอบ (LINE reply API ยอมรับข้อความจริงแล้ว)

- [แผนและสถานะงาน](./CUSTOMER_AGENT_PLAN.md)
- [Google Login และสิทธิ์เจ้าหน้าที่](./GOOGLE_LOGIN_SETUP.md)
- [โครงตั้งค่าและตารางสิทธิ์](./SETTINGS_ACCESS_PLAN.md)
- [คู่มือภาพรวมการดูแลและนิยามตัวเลข](./OVERVIEW_GUIDE.md)
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

รุ่นที่ทดสอบผ่านเป็นค่าเริ่มต้นใน source/build บน local แล้ว: `npm run chat`, `npm start`, `npm run chat:line` และ `npm run chat:group` ใช้ grounded เหมือนคำสั่ง next เดิม ให้โมเดลอ่านบริบท ค้นข้อมูลที่อนุญาต แล้วตอบจากหลักฐาน ไม่มีก็บอกตรง ๆ โดยไม่พ่วง FAQ อัตโนมัติ ทุกช่องทางใช้ข้อมูลหลักสูตรชุดเดียวกัน คงความจำ/คำขอ/สิทธิ์และการยืนยันเดิม แยกข้อมูลส่วนตัวกับกลุ่มตามเดิม กลุ่มยังแนะนำบริการที่ต้องทักส่วนตัว โดยไม่เปิดบริการส่วนตัวในกลุ่ม

สถานะรอบนี้: เปลี่ยนค่าเริ่มต้นและตรวจบน local เท่านั้น ยังไม่ deploy หรือ restart LINE จริง การยืนยันการรับส่งใน LINE จริงเป็นขั้นถัดไป คำสั่ง next ยังเป็นชื่อเรียกที่เข้าทางเดียวกันชั่วคราวจนตรวจ LINE จริงครบ ส่วนตัวเลือก model-first เก็บไว้สำหรับย้อนกลับและทดสอบเทียบ ไม่ใช่ค่าเริ่มต้นของช่องทางใช้งาน

เมื่อโมเดลจำกัดโควตาหรือไม่พร้อม จะแจ้งปัญหาโดยไม่ชี้ FAQ อัตโนมัติ คำสั่ง host เช่น `/help`, `/memory` และขั้นยืนยันยังทำตามกฎเดิม ไม่มีการล้างข้อมูลเดิมเพื่อเปลี่ยนวิธีตอบ ระบบใช้ bounded context/auto compaction ตามเดิม

คีย์โมเดลตั้งใน `.env` บนเครื่อง ปัจจุบันใช้ `PI_PROVIDER=groq`, `PI_MODEL=qwen/qwen3.8-27b` และ `GROQ_API_KEY` หากเริ่มใหม่ให้ใช้ .env.example เป็นตัวอย่าง ห้ามคัดลอกทับ .env ที่มีค่าแล้ว ไม่ค้น/อ่าน Pi auth เก่า และไม่ต้องส่ง secrets ในแชต

## พื้นที่ทดลองสนทนาแยกข้อมูล

คำสั่งเดิม `npm run chat` ใช้ grounded และเก็บความจำถาวรแล้ว ส่วน `npm run chat:natural` ยังเก็บไว้สำหรับทดลองกับtemp memory/requestsที่ลบทิ้งเมื่อออก ไม่มีLINE transport ใช้ `npm run check:natural` เพื่อตรวจconfigโดยไม่เรียกโมเดล หรือเปรียบเทียบกฎเดิมในtempด้วย `npm run chat:natural -- --rules-first` groundedใช้โมเดลจริงแม้เป็นคำทักทาย/FAQ ต้องมีkeyใช้งานได้และใช้โควตา ดู [ขอบเขต ผลทดสอบ และสถานะรวม](./NATURAL_CHAT_EXPERIMENT.md)

## LINE local

เปิด ngrok และอัปเดต LINE webhook อัตโนมัติด้วย `npm run ngrok` หลังเปิด Server แล้ว ดู [คู่มือเปิดระบบและกรณี URL เปลี่ยน](./NGROK_GUIDE.md)

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
- `src/course-catalog-data.json`: ข้อมูลหลักสูตรแยกหมวด พร้อมชื่อผู้สอนปกติและหลักฐานเว็บเดิมที่เก็บแยกไว้; `src/course-types.ts` กำหนดรูปแบบ และ `src/course-catalog.ts` โหลดให้ตัวอ่านเดิมใช้ต่อ
- `src/catalog.ts`: lexical ranking/aliases, bounded model candidates และ host-rendered facts
- `src/agent.ts`: สร้าง Pi session, provider config, tool allowlist ไม่มี shell/file tools; Qwen ใช้ system role แทน developer role
- `src/knowledge.ts`: แหล่งความรู้สาธารณะ กติกา conflict/unknown, read-only knowledge tool และ persona ซีบอต
- `src/chat.ts`, `src/main.ts`: Terminal adapters; `src/conversation.ts`: model streaming/progress/timeout/call limits
- `src/line.ts`, `src/line-memory.ts`, `src/server.ts`: raw-body signature verification, async queue, dedupe, allowlist, bounded reply client และ safe operational logs

Build และ runtime tests ในรอบพัฒนาช่วงนี้ 49 รายการผ่าน (ประวัติรอบก่อน; ล่าสุดแชตบทสนทนา29ต.ค.145/145 ดู CONVERSATIONS_GUIDE.md) รวม semantic memory requests/commit-before-ack/no-data-loss และ host /help ทั้งTerminal/LINEและcancel pending forget, structured instructor reader/teacher search/semantic follow-up, reviewed briefs/job-first advice และ history replay/query operations/catalog acceptance/grounding/aliases/follow-up, persistence/restart, >20 turn/compaction, reset/forget confirm/cancel/physical deletion, isolation, safe memory และ failed summary/429 recovery เพิ่ม import tests9รายการตรวจ fail-closed/last-good แยกด้วย `npm run test:catalog-import` ดู dependency/ข้อจำกัดใน [COURSE_INSTRUCTORS_GUIDE.md](./COURSE_INSTRUCTORS_GUIDE.md) หาก dialogue ผิดรูปแบบ/ถูกตัด/ว่าง จะขอซ่อมได้หนึ่งครั้งภายใน deadline เดิม Tests ไม่เรียก LINE จริง

ทดสอบ `npm run chat` ผ่าน PTY จริงหลายรอบและหลาย turn แบบผสมแล้ว พบและแก้ routing ที่วน FAQ fallback และการแต่งตัวตน/เว็บ ไม่พบ process crash ในรอบที่ reproduce แต่พบ provider 429 จริงด้วย จึงแยกผล functional กับข้อจำกัด provider ไว้ใน TERMINAL_TEST_RESULTS.md การทดสอบ 2 turn เดิมไม่เพียงพอยืนยัน small talk หรือความเสถียรแชตยาว LINE OA/HTTPS ตรวจ Verify และ signature จริงผ่านแล้ว และ LINE reply API ยอมรับ reply จริง 7 ครั้งแล้ว (ยังไม่ได้ตรวจหน้าจอผู้รับ)

สำหรับบริการจริงยังต้องเพิ่ม durable queue/dedupe และ customer verification ก่อนข้อมูลจริง, การประเมินคำตอบกว้างขึ้น และ cost monitoring แบบเงิน Local Terminal/LINE stores มี idle retention 90 วันและสิทธิ์ไฟล์จำกัด แต่ยังไม่ใช่ระบบหลายเครื่องหรือฐานข้อมูลเข้ารหัส รองรับคำขอรอเจ้าหน้าที่และStaffรับช่วงคุยในLINEแล้วตามCONVERSATIONS_GUIDE.md แต่ยังไม่ยืนยันผู้เรียน/ที่นั่ง/การชำระเงินหรือแจ้งเจ้าหน้าที่ภายนอกอัตโนมัติ

## แหล่งข้อมูล

- [CBTU FAQ](https://cbtumu.net/faq/), [Home/หลักสูตร](https://cbtumu.net/), [About](https://cbtumu.net/about-cbtu/) — snapshot 23 ตุลาคม 2026 ไม่รับรองราคา/เปิดรับสมัครล่าสุด
- [Pi SDK](https://pi.dev/docs/latest/sdk) — dependencies ตรึง 1.4.0 ใน package-lock.json
- [LINE webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

Git local baseline เริ่มจาก `31365a3`; .env/secrets/runtime data ไม่ถูก track ไม่มี remote หรือ push


ผลแก้ LINE fallback ล่าสุด: ทำซ้ำพบ Groq HTTP429 ขณะที่ FAQ ยังตอบได้ จึงแยกข้อความแจ้งโควตา/timeoutและlog `model_rate_limit`, `replied_fallback` ออกจากคำตอบปกติ ไม่แสดงraw error ผู้ใช้ยืนยันรับFAQหลังrestartแล้ว Build/tests20รายการและHTTP/public/LINE Verifyผ่าน โควตาโมเดลยังเป็นข้อจำกัดของprovider รายละเอียดและโหมดรันปัจจุบันใน LINE_SETUP.md

## ติดตามบทสนทนา

เปิด http://127.0.0.1:3001/#monitor เพื่อดูบทสนทนาและรายการรอเจ้าหน้าที่ รับช่วงตอบด้วย【Staff】และคืนให้บอตพร้อมบริบทได้ ลูกค้าพิมพ์ “ขอคุยกับเจ้าหน้าที่” เพื่อขึ้นรายการรอ หน้าเว็บอัปเดตทุก5วินาที ยังไม่มีเสียงหรือแจ้งเตือนนอกเว็บ ดู [คู่มือบทสนทนาและผลเจ้าของยืนยัน](./CONVERSATIONS_GUIDE.md) และ [ภาพรวมหลังบ้าน](./MONITOR_GUIDE.md) เว็บเดิมมีลูกค้าและกลุ่ม งานรอดูแล ส่งข่าว และจัดการบอตแล้ว ภาพรวมพัฒนาใน source แล้วที่ #overview รวมตัวเลขตามข้อมูลจริงและลิงก์ไปดูแลต่อ เปิดใช้บนโปรเซสจริงแล้ว รวมแถบสถานะ Server/LINE/Webhook/AI/ข้อมูล ตรวจLINE/Webhookอัตโนมัติเมื่อยังไม่มีผลหรือผลเก่า รับtokenใหม่หลังrestartโดยไม่reloadหน้า ผ่านfixtureและruntime220/220ตามขอบเขตในคู่มือ ดู [ขอบเขตและผลทดสอบ](./OVERVIEW_GUIDE.md) ข้อจำกัดเรื่องไม่มีloginคงเดิม


### จัดการบอต

เปิด [จัดการบอต](http://127.0.0.1:3001/#bot) บนเว็บเดิม ส่วนตั้งค่าการตอบอยู่บนและความรู้บอตอยู่ล่าง แก้FAQผ่านdraft/review/publish/rollback และตั้งmodel/บุคลิก/limitsผ่านdraft/ลอง/ตรวจ/ยืนยันใช้จริงได้ โดยต้องให้เจ้าของยืนยันเอง การลองโมเดลใช้providerจริงและquotaแต่ไม่ส่งLINE รายละเอียด [KM_GUIDE.md](./KM_GUIDE.md) และ [RESPONSE_SETTINGS_GUIDE.md](./RESPONSE_SETTINGS_GUIDE.md) ค่าใช้งานจริงยังเป็นinitialเดิมหลังเปิดฟังก์ชัน ไม่ได้applyค่าทดสอบให้เอง

- [การแบ่งหน้าและขอบเขตการรองรับรายการจำนวนมาก](PAGINATION_GUIDE.md)

ทดสอบบริบท LINE ผ่าน Terminal แบบข้อมูลชั่วคราว:

```sh
npm run chat:line
npm run chat:group
```

คำสั่งแรกจำลองแชตส่วนตัว คำสั่งที่สองจำลองกลุ่มโดยเติมคำเรียก CBOT ให้อัตโนมัติ ใช้ adapter/กติกาของช่องทางจริง แต่แสดงคำตอบใน Terminal ไม่ส่ง LINE และไม่อ่านความจำลูกค้าจริง พิมพ์ `/exit` เพื่อออก ข้อมูลทดลองลบทิ้งเมื่อปิด ต่างจาก `npm run chat` ที่เก็บความจำเดิม ข้อความทั่วไปเรียกโมเดลจริงและใช้โควตา ส่วน `npm run chat:line -- --check` หรือ `npm run chat:group -- --check` ตรวจการตั้งค่าโดยไม่เรียกโมเดล สถานะเจ้าหน้าที่เป็นการจำลอง ไม่มีการรับช่วงจากเจ้าหน้าที่จริง

Terminal แยกสีผู้ใช้เป็นสีฟ้า ผู้ช่วยเป็นสีเขียว และสถานะระหว่างตอบเป็นสีจาง ใช้กับทั้ง chat ปกติและโหมดจำลอง LINE เปิดสีเฉพาะหน้าจอ Terminal ที่รองรับ เมื่อ redirect/pipe หรือกำหนด NO_COLOR จะเป็นข้อความธรรมดา

### รุ่นทดลองสนทนาแบบค้นหลักฐานก่อนตอบ

```sh
npm run chat:line:next
npm run chat:group:next
```

ใช้จำลองส่วนตัว/กลุ่มใน Terminal ตามลำดับ พิมพ์ `/exit` เพื่อออก ข้อมูลอยู่ใน temp และลบทิ้งเมื่อปิด ไม่มีการส่ง LINE จริง โหมดเดิม `chat:line` / `chat:group` ยังใช้เทียบได้ รุ่นใหม่ค้นเอกสารที่เผยแพร่ไว้แล้วและเรียบเรียงคำตอบจากหลักฐาน ไม่พ่วง FAQ เมื่อไม่รู้ ไม่ได้เปิดค้นเว็บทั่วไป การจอง บันทึก ลบข้อมูลยังผ่าน host workflow เดิม

เมื่อเปลี่ยนโมเดล ให้ใช้ชุดเดิมตรวจซ้ำ:

```sh
npm run build
npm test
npm run eval:chat:next -- --live
```

คำสั่งสุดท้ายใช้โมเดลจริงกับ 8 ข้อความสมมติ สูงสุด14ครั้งเรียกโมเดล เปรียบเทียบทางตอบเดิมกับรุ่นทดลองบนโมเดลที่เลือกอยู่ในแต่ละรอบ ผลรายงานระบุ provider/model ไว้ ใช้เทียบรายงานข้ามโมเดลได้ หากไม่ใส่ `--live` จะไม่เรียกโมเดล ภาษาเป็นข้อสังเกตตามที่เจ้าของตกลง ไม่ใช่เงื่อนไขตัดสินผ่าน การตรวจอัตโนมัติดูการพ่วงเว็บและการแนบแหล่งข้อมูล ไม่รับรองความหมาย/ความเป็นธรรมชาติทุกประโยค ข้อความยืนยันคำสั่งและข้อผิดพลาดของ host ยังใช้ข้อความเดิม ผลและข้อจำกัดล่าสุดดู NATURAL_CHAT_EXPERIMENT.md ส่วน “รุ่นทดลองค้นหลักฐานก่อนเรียบเรียงคำตอบ”
