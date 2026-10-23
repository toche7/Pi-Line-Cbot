# ซีบอต — CBTU Customer Agent ทดลอง

ใช้ Pi SDK core เดียวสำหรับ Terminal และ LINE adapter ชื่ออังกฤษยังไม่ยืนยัน ใช้เฉพาะข้อมูลเว็บไซต์ CBTU สาธารณะ ไม่มี Notion ภายใน ไม่มีข้อมูลผู้เรียนจริง และยังไม่ deploy หรือส่ง LINE จริง

- [แผนและสถานะงาน](./CUSTOMER_AGENT_PLAN.md)
- [ผลทดสอบ Terminal จริง รวมความจำผ่านโมเดล](./TERMINAL_TEST_RESULTS.md)
- [คู่มือ memory / reset / ลืมทั้งหมด](./MEMORY_GUIDE.md)
- [คู่มือตั้งค่า LINE ภาษาไทย](./LINE_SETUP.md)
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

`/memory` ดูสิ่งที่จำ; `/reset` ล้างบทสนทนา/สรุป/เรื่องค้าง แต่คงโปรไฟล์และ long-term preferences; `/forget` ตามด้วย `/confirm-forget` เพื่อลบทั้งหมด หรือ `/cancel` เพื่อยกเลิก; `/exit`, `/quit`, Ctrl-C ออกโดยคง memory ที่บันทึกแล้ว ผู้ทดสอบ local เริ่มต้นคือ tester; แยกอีกคนด้วย `npm run chat -- --user alice` (ไม่ใช่การยืนยันตัวตนจริง) LINE adapter/config ไม่เปลี่ยนใน milestone memory และ server ยังไม่เปิด persistent store

FAQ ที่ระบุหัวข้อตอบจาก snapshot พร้อม URL/เวลาเก็บ ส่วนข้อความอื่นเข้า Pi dialogue layer ให้ตีความบทสนทนา/ความจำ/follow-up เป็น structured intent ไม่ใช้ whitelist คำ small talk ที่เหลือถูกปัดเป็น FAQ ไม่พบอีกแล้ว Core จำหัวข้อ FAQ ล่าสุดสำหรับคำอ้างทันที และ render ข้อมูล CBTU/ตัวตน/ลิงก์จากข้อมูลที่กำหนด ตรวจ domain/ชื่อสถาบันที่โมเดลพยายามแต่งเอง คำถามข้อเท็จจริงที่ไม่รองรับตอบไม่ทราบ ไม่ตีความ mock order เป็นข้อมูลผู้เรียนจริง

หาก Groq จำกัดการใช้งาน (HTTP 429) จะแจ้งเวลาพักและไม่ยิงซ้ำระหว่าง cooldown FAQ ที่ตอบจาก snapshot ยังใช้ได้ ข้อมูลเดิมไม่ถูกล้าง ไม่รับรองว่าจะคุยกับโมเดลต่อเนื่องได้โดยไม่ติด quota ระบบใช้ bounded context/auto compaction แทนเพดานสะสม 20 turn/100000 tokens เดิม

คีย์โมเดลตั้งใน `.env` บนเครื่อง ปัจจุบันใช้ `PI_PROVIDER=groq`, `PI_MODEL=qwen/qwen3.8-27b` และ `GROQ_API_KEY` หากเริ่มใหม่ให้ใช้ .env.example เป็นตัวอย่าง ห้ามคัดลอกทับ .env ที่มีค่าแล้ว ไม่ค้น/อ่าน Pi auth เก่า และไม่ต้องส่ง secrets ในแชต

## LINE local

ตรวจ config โดยไม่แสดงค่า secrets: `npm run line:check` (หลัง build) ผลล่าสุดยืนยัน OA **DemoB1** และ token/channel/allowlistแล้ว แต่ HTTPS base URLยังขาดและOAมีwebhook n8nเดิม activeอยู่ Local dry-runผ่านแล้ว ยังไม่routeเข้าLINEหรือส่งreplyจริง อ่าน [สถานะ readiness และขั้นต่อไป](./LINE_SETUP.md)

เติม LINE_CHANNEL_SECRET และค่าทดสอบตาม [LINE_SETUP.md](./LINE_SETUP.md) แล้ว:

```sh
npm run server
```

ค่าเริ่มต้น bind `127.0.0.1:3000`, POST `/webhook/line`, GET `/health`; dry run เปิดอยู่ ไม่มี public endpoint ที่สร้างให้อัตโนมัติ ต้องมี HTTPS hosting และตั้ง Console เองก่อน LINE เข้าถึงได้ การส่งจริงต้องเติม token/allowlist และตั้ง dry run false เอง กลุ่ม/room ถูกข้าม รับเฉพาะ 1:1 กับผู้ทดสอบ

## โครงสร้างและผลตรวจ

- `src/core.ts`: แยก session/channel/customer, คิวรายลูกค้า, idle TTL, auto compaction และ memory controls
- `src/memory.ts`: local bounded persistence, profile/long-term preference extraction, summary, Pi context restoration และ confirmed deletion
- `src/agent.ts`: สร้าง Pi session, provider config, tool allowlist ไม่มี shell/file tools; Qwen ใช้ system role แทน developer role
- `src/knowledge.ts`: แหล่งความรู้สาธารณะ กติกา conflict/unknown, read-only knowledge tool และ persona ซีบอต
- `src/chat.ts`, `src/main.ts`: Terminal adapters; `src/conversation.ts`: model streaming/progress/timeout/call limits
- `src/line.ts`, `src/server.ts`: raw-body signature verification, async queue, dedupe, allowlist, bounded reply client และ safe operational logs

Build และ tests ล่าสุด 18 รายการผ่าน รวม persistence/restart, >20 turn/compaction, reset/forget confirm/cancel/physical deletion, isolation, safe memory และ failed summary/429 recovery เพิ่มจาก tests dialogue/FAQ/LINE จำลองเดิม หาก dialogue ผิดรูปแบบ/ถูกตัด/ว่าง จะขอซ่อมได้หนึ่งครั้งภายใน deadline เดิม Tests ไม่เรียก LINE จริง

ทดสอบ `npm run chat` ผ่าน PTY จริงหลายรอบและหลาย turn แบบผสมแล้ว พบและแก้ routing ที่วน FAQ fallback และการแต่งตัวตน/เว็บ ไม่พบ process crash ในรอบที่ reproduce แต่พบ provider 429 จริงด้วย จึงแยกผล functional กับข้อจำกัด provider ไว้ใน TERMINAL_TEST_RESULTS.md การทดสอบ 2 turn เดิมไม่เพียงพอยืนยัน small talk หรือความเสถียรแชตยาว ยังไม่ได้ทดสอบ LINE OA/HTTPS จริง

สำหรับบริการจริงยังต้องเพิ่ม durable queue/dedupe และ persistence สำหรับ LINE หลังตกลง retention/access, customer verification ก่อนข้อมูลจริง, การประเมินคำตอบกว้างขึ้น และ cost monitoring แบบเงิน Local Terminal store มี idle retention 90 วันและสิทธิ์ไฟล์จำกัด แต่ยังไม่ใช่ระบบหลายเครื่องหรือฐานข้อมูลเข้ารหัส ไม่มีการส่งต่อเจ้าหน้าที่หรือ action เปลี่ยนข้อมูลในรุ่นนี้

## แหล่งข้อมูล

- [CBTU FAQ](https://cbtumu.net/faq/), [Home/หลักสูตร](https://cbtumu.net/), [About](https://cbtumu.net/about-cbtu/) — snapshot 23 ตุลาคม 2026 ไม่รับรองราคา/เปิดรับสมัครล่าสุด
- [Pi SDK](https://pi.dev/docs/latest/sdk) — dependencies ตรึง 1.4.0 ใน package-lock.json
- [LINE webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

Git local baseline เริ่มจาก `31365a3`; .env/secrets/runtime data ไม่ถูก track ไม่มี remote หรือ push
