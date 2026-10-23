# แผนและสถานะ ซีบอต — CBTU Customer Agent

อัปเดต 23 ตุลาคม 2026 ใช้ชื่อเสียงอ่าน “ซีบอต” เท่านั้น รอยืนยัน spelling อังกฤษ

## เป้าหมายและขอบเขตที่ปรับแล้ว

ผู้ช่วยผู้สนใจอบรม/ผู้เรียน CBTU ใช้ Pi SDK core เดียวกันผ่าน Terminal สำหรับทดสอบเร็ว และ LINE สำหรับผู้ทดสอบแบบ 1:1 ใช้ knowledge/policy/tools ชุดเดียวกัน ทดสอบ Terminal ก่อนเปิด LINE จริง

ข้อมูลมาจากเว็บไซต์สาธารณะ https://cbtumu.net/ เท่านั้น ไม่ใช้ข้อมูล Notion ภายใน ไม่ถือ mock order เป็นข้อมูลผู้เรียน รุ่นทดลองนี้ตอบ FAQ การสมัคร/เข้าเรียน/เอกสาร/certificate แนะนำหน้าหลักสูตรและช่องทางเจ้าหน้าที่ พร้อม source URL และเวลาเก็บ snapshot

เมื่อข้อมูลไม่พบหรือขัดกันให้บอกตรง ๆ ไม่ยืนยันเวลาอนุมัติ ราคา สถานะเปิดรับสมัคร หรือเลขบัญชีจากข้อมูลที่ยังไม่ตรวจสด การส่งต่อหมายถึงชี้ช่องทางหน้า FAQ เท่านั้น ไม่ส่งข้อความ เปิดเคส หรือแจ้งเจ้าหน้าที่จริง

## สถานะ DONE / PARTIAL / TODO

| สถานะ | งาน | หลักฐาน/ข้อจำกัด |
|---|---|---|
| DONE | M1: Git baseline | local main เริ่มจาก 31365a3; กัน .env/secrets/build/logs/customer runtime ออก; ไม่มี remote/push |
| DONE | Pi SDK/Terminal | one-shot `npm start`, แชต `npm run chat`, check/build/tests; มี memory ในโปรเซสและ progress/error/timeout |
| DONE | แยก channel/core | CustomerCore ไม่พิมพ์ stdout เอง รับ trusted identity + callbacks; Terminal/LINE ใช้ core เดียวกัน |
| DONE | ข้อมูลสาธารณะ CBTU ชุดเริ่มต้น | FAQ/Home/About มี source/capturedAt; deterministic routing สำหรับ FAQ, unknown/conflict; ไม่เรียก Notion ไม่ crawler สด |
| DONE | กติกาซีบอตและ tools | ชื่อไทย, read-only public knowledge tool และ mock order เดิม; ไม่มี shell/file tools |
| DONE | Memory session isolation/queue | key แยก channel/OA/direct/user, FIFO รายลูกค้า; ทดสอบ A/B และ Terminal แยกกัน |
| DONE | LINE adapter + mock tests | raw body HMAC, valid/invalid signature, immediate ACK, in-memory queue/dedupe, allowlist, mock reply; ไม่ส่ง LINE จริง |
| DONE | Config/คู่มือ LINE | .env.example และ append keys ที่ขาดใน .env โดยไม่เขียนทับค่าเดิม; LINE_SETUP.md; local endpoint ยังต้องเติม config |
| DONE | Limits เบื้องต้น | input 2000 chars, 20 คำตอบสำเร็จ/session, 100 sessions, idle TTL 30 นาที, output 800 tokens, model/tool calls สูงสุด 4/turn, session token threshold 100000; Terminal /reset เพื่อเริ่มใหม่; dry run default |
| PARTIAL | Logging/cost control | safe metadata และ token/call limits มีแล้ว; ยังไม่มี dashboard, monetary/daily budget หรือ billing reconciliation |
| PARTIAL | การประเมินคุณภาพ | tests 10 รายการผ่าน รวมชุด FAQ 11 คำถาม แต่ยังไม่ใช่การประเมินทุกคำถาม/ทุกภาษา/ทุก prompt injection |
| TODO | LINE end-to-end จริง | ผู้ใช้ต้องเติม test OA credentials/allowlist และมี HTTPS hosting; ยังไม่ deploy, ตั้ง tunnel หรือส่ง reply จริง |
| TODO | Persistent sessions/retention | ปัจจุบัน memory only; ต้องกำหนด retention, access control และ deletion ก่อนเลือก store |
| TODO | Durable queue/dedupe | ปัจจุบัน restart อาจสูญงานที่ ACK หรือประมวลผล redelivery ใหม่; ยังไม่ production delivery guarantee |
| TODO | Customer verification/ข้อมูลจริง | LINE identity ไม่เท่ากับสิทธิ์ข้อมูลผู้เรียน; ต้อง map/verify/check ownership ก่อนเพิ่ม real-data tools |
| TODO | Handoff จริง | ยังไม่มี case store/destination/recipient/authorization; แนะนำช่องทางเท่านั้น |

## องค์ประกอบปัจจุบัน

1. **Agent core (`src/core.ts`)** จัดการ session/queue/limits ด้วย trusted channel identity ที่ adapter ให้ ข้อความลูกค้าเปลี่ยน identity หรือเพิ่มสิทธิ์ไม่ได้
2. **Pi engine (`src/agent.ts`)** สร้าง session แบบ in-memory และ explicit resources/tools; ใช้เฉพาะ environment ของโปรเซส ไม่โหลด Pi auth เก่า
3. **Public knowledge (`src/knowledge.ts`)** ข้อมูลคัดสรุปจาก FAQ/Home/About พร้อม capture timestamp ไม่ตีความเวลาเก็บเป็นเวลาที่เว็บแก้ไขล่าสุด คำตอบ FAQ ใช้กติกาค้นข้อความที่ตรวจได้เพื่อลดการแต่งข้อเท็จจริง ส่วน small talk/memory ใช้โมเดล
4. **Terminal (`src/main.ts`, `src/chat.ts`)** ใช้ local tester หนึ่ง session, progress ทุก 5 วินาที, timeout, /exit, /quit, Ctrl-C, EOF
5. **LINE (`src/line.ts`, `src/server.ts`)** รับเฉพาะ text แบบ 1:1 ของ allowlist แยก scope OA/user, ตรวจ raw bytes ก่อน parse, ACK แล้วเข้าคิว; dry run ไม่ส่งข้อความ
6. **Operational controls** บันทึก request ID/channel/outcome/latency ไม่บันทึก raw body, headers, token, user ID หรือเนื้อหาประวัติลง log; model output/call limits และ deadline มีในโค้ด

## กติกาที่ต้องคงไว้

- สิทธิ์อยู่ที่ backend ไม่ใช่การตัดสินของโมเดล ห้ามใช้ชื่อ/เลขออเดอร์ที่พิมพ์เป็นการยืนยันตัวตน
- ไม่โหลดความรู้ภายใน CBTU ให้ customer bot และไม่ให้คำสั่งในเว็บ/ข้อความเพิ่ม tool หรือสิทธิ์
- FAQ ขัดกันเรื่องเริ่มเรียนทันที vs ตรวจเงิน 1–2 วัน และ email บางตอนต่างกัน: ชี้แหล่ง/เจ้าหน้าที่ ไม่เลือกยืนยันเอง
- ราคาหรือเปิดรับสมัครต้องตรวจจากหน้าหลักสูตรล่าสุด ไม่ใช้ snapshot รับรองความพร้อม
- mock order ใช้ DEMO-1001 สำหรับสาธิตเท่านั้น ไม่มี real learner/order API
- ห้ามส่งต่อเจ้าหน้าที่จริงจนกำหนด destination, recipient, ข้อมูลที่ส่ง และได้รับอนุญาต การส่ง reply ตอบผู้ทดสอบก็ยังปิดจนผู้ใช้ตั้งค่าเปิดเอง
- action เปลี่ยนข้อมูลธุรกิจในอนาคตต้องมี preview/confirmation ที่ผูกพารามิเตอร์และผู้ใช้ พร้อมตรวจสิทธิ์ซ้ำก่อน execute
- ไม่เก็บ secrets ใน Git/logs และไม่ขอให้ส่ง credentials ผ่านแชต

## Milestones และ acceptance criteria ต่อจากนี้

| ลำดับ | สถานะ/งาน | เกณฑ์ผ่าน |
|---|---|---|
| M1 | DONE — Git | baseline local, staged secret scan, clean working tree, ไม่มี remote/push |
| M2 | DONE สำหรับ prototype — shared core/CBTU policy | ทั้งสอง adapter ใช้ core/policy/tools เดียวกัน, Terminal ยังรันได้, knowledge มาจาก public URL เท่านั้น |
| M3 | PARTIAL — sessions/identity | ผ่าน isolation/FIFO/idle TTL; ส่วนถาวรต้องทดสอบ restart/expiry/delete หลังตกลง retention; real-data access ต้อง verify ownership |
| M4 | PARTIAL — FAQ/contact | ชุดคำถามเริ่มต้นผ่าน found/unknown/conflict/source; เพิ่ม dataset ที่เจ้าของรับรองและชุดคำถามทดสอบจริง; handoff ลดขอบเขตเป็นชี้ช่องทางตามคำสั่งผู้ใช้ ไม่ถือว่าทำส่งต่อจริงเสร็จ |
| M5 | PARTIAL — reliability/cost | timeout/cancellation/empty response/tool denial และ limits เริ่มต้นผ่าน; ยังต้อง fault/load tests, monetary budget และตรวจคุณภาพคำตอบกว้างขึ้น |
| M6 | พร้อมตั้งค่า/ยังไม่ E2E — LINE | เมื่อมี test OA/HTTPS: Verify events=[] ได้ 200, invalid signature ได้ 401, allowlist ทำงาน, A/B ไม่รั่ว, redelivery ไม่ซ้ำในโปรเซสเดียว, reply จริงสำเร็จ โดยผู้ใช้เปิดส่งเอง |
| M7 | TODO — กลุ่มทดสอบ | ตกลง expected answers/latency/error/cost thresholds, retention และ rollback ก่อนทดลอง; เก็บผลจริงเพื่อเลือกงานถัดไป |

ข้ามขั้น production reliability ไม่ได้เพียงเพราะ mock tests ผ่าน การเตรียม LINE adapter รอบนี้ยังไม่ถือว่าเปิดให้บริการ LINE แล้ว

## ข้อมูล/การตัดสินใจที่ยังขาด

- Test LINE OA: channel ID/secret/access token, tester IDs และ HTTPS hosting เจ้าของระบบจะเติมเองบนเครื่อง
- แหล่ง public knowledge เลือกแล้ว: FAQ/Home/About; ยังต้องให้เจ้าของข้อมูลทบทวนข้อขัดแย้ง อัปเดต snapshot และอนุมัติ coverage ที่ต้องตอบ
- วิธี map/verify learner และ ownership ก่อนใช้ข้อมูลจริง ไม่มีการรวมตัวตนข้ามช่องทางอัตโนมัติ
- Retention และ storage: ตอนนี้ทดลอง memory idle 30 นาที ไม่ได้อนุมัติ retention ถาวร
- Handoff destination/recipient และการอนุญาตส่งจริง ยังไม่กำหนด ไม่มีการส่งออก
- งบรายวัน/ลูกค้า, คุณภาพและ SLA, persistent queue/dedupe และ monitoring ก่อน production
- Remote Git ยังไม่กำหนด จึงไม่ตั้งหรือ push

## ผลตรวจรอบ CBTU

`npm run build`, `npm test` (10 tests) และ `npm run check` ผ่าน; Terminal conflict FAQ แสดงข้อขัดแย้งพร้อม URL/เวลาเก็บถูกต้อง การรัน server เมื่อ LINE_CHANNEL_SECRET ว่างหยุดพร้อมคำแนะนำตามคาด Tests LINE ใช้ signature/reply/fetch จำลอง ไม่มี production LINE API call ตรวจ HTTP จริงเฉพาะ loopback ด้วย fixtures: health 200, invalid signature 401, valid 200, ส่ง event ซ้ำได้ mock reply ครั้งเดียว รอบนี้ไม่เรียกโมเดลจริงเพิ่ม; ผล live Groq Qwen จากเดโมก่อนหน้ายังแยกจากผล mock รุ่น CBTU

คู่มือการเติม config และตั้ง webhook: [LINE_SETUP.md](./LINE_SETUP.md)

## ผลแก้แชตหลาย turn เพิ่มเติม

ผู้ใช้พบว่าคุยทั่วไปไม่กี่ turn แล้วบอตตอบไม่ได้ ตรวจ PTY จริงพบ routing เดิมส่ง small talk และ follow-up ไป FAQ not_found ทั้งที่โปรเซสไม่ crash และพบ provider HTTP 429 เมื่อส่งเร็วหลายรอบ การทดสอบ 2 turn เดิมไม่ครอบคลุมปัญหานี้

เปลี่ยนเป็น structured Pi dialogue layer สำหรับข้อความที่ไม่ใช่ FAQ ที่ทราบ โดย host render ตัวตน/ข้อมูลธุรกิจ/ลิงก์ ตรวจสถาบันและ domain ผิด จำหัวข้อ FAQ ล่าสุดใน session และเพิ่ม clarification intent ไม่ให้โมเดลเดาข้อเท็จจริงเอง ลด system context/ข้อความซ้ำ ปิด tool loop ระหว่าง dialogue เลือก intent เพิ่ม cooldown เมื่อ 429 และ /reset เพื่อออกจากเพดาน session คำขอที่ล้มเหลวไม่เพิ่มจำนวน turn

Tests ล่าสุด 14 รายการผ่าน รวม malformed/truncated dialogue พร้อมซ่อมหนึ่งครั้งภายใน deadline เดิม, domain/institution guard, contextual topic, isolation/reset และ 429→FAQ ยังใช้ได้→กลับแชตหลัง cooldown ยังไม่ถือว่าพิสูจน์ correctness ทุกประโยคหรือแก้ข้อจำกัดโควตา Groq ได้ รายละเอียดผลจริงใน TERMINAL_TEST_RESULTS.md ไม่มีการเปลี่ยน credentials หรือเรียก LINE ในรอบนี้

## ผลทดสอบ Terminal ก่อน LINE เพิ่มเติม

ทดสอบ `npm run chat` รุ่น CBTU ผ่าน PTY จริงครบสมัครสมาชิก, ข้อขัดแย้งการเข้าเรียนหลังจ่าย, certificate, ติดต่อเจ้าหน้าที่ และไม่พบข้อมูล ทั้งหมดผ่านพร้อม source/time ตามกติกา ทดสอบความจำผ่านโมเดลจริงสอง turn ในโปรเซสเดียวแล้วตอบชื่อทดสอบตรงกัน (476/441 ms) และ `/exit` ออกด้วย code 0 ไม่มีการเปลี่ยน config หรือเรียก LINE ในรอบนี้ รายละเอียด: [TERMINAL_TEST_RESULTS.md](./TERMINAL_TEST_RESULTS.md)
