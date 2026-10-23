# ซีบอต — CBTU Customer Agent ทดลอง

ใช้ Pi SDK core เดียวสำหรับ Terminal และ LINE adapter ชื่ออังกฤษยังไม่ยืนยัน ใช้เฉพาะข้อมูลเว็บไซต์ CBTU สาธารณะ ไม่มี Notion ภายใน ไม่มีข้อมูลผู้เรียนจริง และยังไม่ deploy หรือส่ง LINE จริง

- [แผนและสถานะงาน](./CUSTOMER_AGENT_PLAN.md)
- [ผลทดสอบ Terminal จริง รวมความจำผ่านโมเดล](./TERMINAL_TEST_RESULTS.md)
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

`/exit`, `/quit`, Ctrl-C ออกจากแชต; EOF จบการรับข้อความ ประวัติอยู่ใน memory ของโปรเซส Terminal ถือเป็นผู้ทดสอบ local หนึ่งคน ส่วน LINE แยก session ตาม OA และ user ID ฝั่ง adapter

FAQ ตอบด้วยกติกาค้นข้อความจาก snapshot พร้อม URL/เวลาเก็บ เพื่อไม่ให้โมเดลเลือกข้อมูลขัดกันเอง ไม่ใช่ live crawler หรือ semantic search บทสนทนาเรื่องชื่อ/ความจำใช้ Pi กับ Groq Qwen ที่ผู้ใช้ตั้งใน .env คำถามที่ไม่รองรับตอบไม่ทราบ ไม่ตีความว่า tool สมมติเป็นข้อมูลผู้เรียนจริง

คีย์โมเดลตั้งใน `.env` บนเครื่อง ปัจจุบันใช้ `PI_PROVIDER=groq`, `PI_MODEL=qwen/qwen3.8-27b` และ `GROQ_API_KEY` หากเริ่มใหม่ให้ใช้ .env.example เป็นตัวอย่าง ห้ามคัดลอกทับ .env ที่มีค่าแล้ว ไม่ค้น/อ่าน Pi auth เก่า และไม่ต้องส่ง secrets ในแชต

## LINE local

เติม LINE_CHANNEL_SECRET และค่าทดสอบตาม [LINE_SETUP.md](./LINE_SETUP.md) แล้ว:

```sh
npm run server
```

ค่าเริ่มต้น bind `127.0.0.1:3000`, POST `/webhook/line`, GET `/health`; dry run เปิดอยู่ ไม่มี public endpoint ที่สร้างให้อัตโนมัติ ต้องมี HTTPS hosting และตั้ง Console เองก่อน LINE เข้าถึงได้ การส่งจริงต้องเติม token/allowlist และตั้ง dry run false เอง กลุ่ม/room ถูกข้าม รับเฉพาะ 1:1 กับผู้ทดสอบ

## โครงสร้างและผลตรวจ

- `src/core.ts`: แยก session/channel/customer, คิวรายลูกค้า, idle TTL และ turn/input/session budget
- `src/agent.ts`: สร้าง Pi session, provider config, tool allowlist ไม่มี shell/file tools; Qwen ใช้ system role แทน developer role
- `src/knowledge.ts`: แหล่งความรู้สาธารณะ กติกา conflict/unknown, read-only knowledge tool และ persona ซีบอต
- `src/chat.ts`, `src/main.ts`: Terminal adapters; `src/conversation.ts`: model streaming/progress/timeout/call limits
- `src/line.ts`, `src/server.ts`: raw-body signature verification, async queue, dedupe, allowlist, bounded reply client และ safe operational logs

Build และ tests ล่าสุด 10 รายการผ่าน รวม Pi tool allowlist/denial, conversation memory, session isolation, FIFO, FAQ grounding/unknown/conflict, idle expiry/limits, Ctrl-C, signature invalid/valid, raw-body integrity, webhook duplicate, dry run และ mocked reply API tests ไม่เรียก LINE จริง

รุ่น CBTU ทดสอบ `npm run chat` ผ่าน PTY จริงแล้ว: FAQ 5 หมวดผ่าน, ความจำ 2 turn ผ่านโมเดลจริงด้วย .env ปัจจุบันผ่าน (476/441 ms), /exit จบโปรเซสด้วย code 0 ดูรายละเอียดใน TERMINAL_TEST_RESULTS.md ก่อนปรับเป็น CBTU เคยทดสอบ live mock tool calling แล้วด้วย ยังไม่ได้ทดสอบ LINE OA/HTTPS จริง

สำหรับบริการจริงยังต้องเพิ่ม durable queue/dedupe, persistent store ตาม retention ที่ตกลง, customer verification ก่อนข้อมูลจริง, การประเมินคำตอบกว้างขึ้น และ cost monitoring แบบเงิน อ่านข้อจำกัดในคู่มือก่อนเปิดให้กลุ่มทดสอบ ไม่มีการส่งต่อเจ้าหน้าที่หรือ action เปลี่ยนข้อมูลในรุ่นนี้

## แหล่งข้อมูล

- [CBTU FAQ](https://cbtumu.net/faq/), [Home/หลักสูตร](https://cbtumu.net/), [About](https://cbtumu.net/about-cbtu/) — snapshot 23 ตุลาคม 2026 ไม่รับรองราคา/เปิดรับสมัครล่าสุด
- [Pi SDK](https://pi.dev/docs/latest/sdk) — dependencies ตรึง 1.4.0 ใน package-lock.json
- [LINE webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

Git local baseline เริ่มจาก `31365a3`; .env/secrets/runtime data ไม่ถูก track ไม่มี remote หรือ push
