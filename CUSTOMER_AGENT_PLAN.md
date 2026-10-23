# แผนและสถานะ ซีบอต — CBTU Customer Agent

อัปเดต 23 ตุลาคม 2026 ใช้ชื่อเสียงอ่าน “ซีบอต” เท่านั้น รอยืนยัน spelling อังกฤษ

## Catalog retrieval milestone ล่าสุด

ปรับจากhistoryLINEจริงหลังmilestoneแรก: พบrecentตอบไม่ตรงเรื่องราคาแต่ละตัว/จำนวนทั้งหมดและsummaryมีคำขอดูเพิ่ม จึงเพิ่มtypedqueryoperations+semanticplanning พร้อมcatalogcontextแยกmatchset/page/offsetในstoreของแต่ละidentity คงchat/compaction/restartและล้างreset/forget แสดงได้หน้าละ1–10ไม่ใช่cap3 Tests32รายการรวมreplayคำถามจริง/signedLINE/dedupe/persistence/isolationผ่าน Livecoresemanticoperationหนึ่งคำถามผ่าน Restartserverแล้วpublic/LINE Verifyผ่าน ผู้ใช้ลองรายการAI→ราคาแต่ละตัวยืนยันokแล้ว Logปกติ26/11msและmetadataURLsราคาอ้างรายการเดิมตรงกันทั้งหมด matched12/shown3 หลักฐานอ่านhistoryมีขอบเขตและไม่ครอบคลุมfailedturnทั้งหมด ดู LINE_HISTORY_REVIEW.md

เจ้าของอนุญาตใช้ public metadata 19 หลักสูตร+1 bundle จากชุด research แล้ว ตรวจ SOURCE_REPORT/validation/counts/provenance/URLs/flags/nulls และ unverified offers ก่อนสร้าง runtime projection แยก ไม่แก้ shared research ไม่ import บัญชีชำระเงิน/review_required หรือข้อมูล cohort เว็บย่อยที่ยังไม่ยืนยัน เก็บ hash source/report/validation และ field_sources ใน src/course-catalog.ts

ค้นชื่อ/alias/หัวข้อไทยอังกฤษด้วย lexical ranking เลือกสูงสุด3 candidates ให้โมเดลเลือก IDs แล้ว host แสดง facts/citations เปรียบเทียบสองรายการ ถ้ากำกวมถามเพิ่ม ถ้า unknown/null ไม่เดาหรือเหมาว่าไม่มีจริง/ฟรี ถามความสนใจก่อนแนะนำ และใช้ profile ของ identity นั้นเมื่อขอแนะนำตามความสนใจ lastTopic เก็บลำดับที่แสดงเพื่อรองรับ follow-up ไม่ส่ง catalog ทั้งหมดทุก turn มี host fallback/cooldown เมื่อโมเดลล้ม คง memory/credentials/model/OA/tunnel เดิม

Build/tests27รายการผ่าน รวม5 acceptance cases, aliases/รุ่น/follow-up/ID grounding/429/LINE signed mock และ memory regression ทั้งหมด Live core/model หนึ่ง comparison ผ่านไม่มี fallback ผู้ใช้ยืนยันรับ Excel/Canva พร้อมลิงก์ใน LINE แล้ว log ok552ms/replied Public/LINE Verifyผ่าน active=true ข้อมูล snapshot ไม่รับรองราคา/วันเรียน/เปิดรับสด รายละเอียด COURSE_CATALOG_GUIDE.md

## เป้าหมายและขอบเขตที่ปรับแล้ว

ผู้ช่วยผู้สนใจอบรม/ผู้เรียน CBTU ใช้ Pi SDK core เดียวกันผ่าน Terminal สำหรับทดสอบเร็ว และ LINE สำหรับผู้ทดสอบแบบ 1:1 ใช้ knowledge/policy/tools ชุดเดียวกัน ทดสอบ Terminal ก่อนเปิด LINE จริง

ข้อมูลมาจากเว็บไซต์สาธารณะ https://cbtumu.net/ เท่านั้น ไม่ใช้ข้อมูล Notion ภายใน ไม่ถือ mock order เป็นข้อมูลผู้เรียน รุ่นทดลองนี้ตอบ FAQ การสมัคร/เข้าเรียน/เอกสาร/certificate แนะนำหน้าหลักสูตรและช่องทางเจ้าหน้าที่ พร้อม source URL และเวลาเก็บ snapshot

เมื่อข้อมูลไม่พบหรือขัดกันให้บอกตรง ๆ ไม่ยืนยันเวลาอนุมัติ ราคา สถานะเปิดรับสมัคร หรือเลขบัญชีจากข้อมูลที่ยังไม่ตรวจสด การส่งต่อหมายถึงชี้ช่องทางหน้า FAQ เท่านั้น ไม่ส่งข้อความ เปิดเคส หรือแจ้งเจ้าหน้าที่จริง

## สถานะ DONE / PARTIAL / TODO

| สถานะ | งาน | หลักฐาน/ข้อจำกัด |
|---|---|---|
| DONE | M1: Git baseline | local main เริ่มจาก 31365a3; กัน .env/secrets/build/logs/customer runtime ออก; ไม่มี remote/push |
| DONE | Pi SDK/Terminal | one-shot `npm start`, แชต `npm run chat`, check/build/tests; Terminal มี bounded persistent memory และ progress/error/timeout |
| DONE | แยก channel/core | CustomerCore ไม่พิมพ์ stdout เอง รับ trusted identity + callbacks; Terminal/LINE ใช้ core เดียวกัน |
| DONE | ข้อมูลสาธารณะ CBTU ชุดเริ่มต้น | FAQ/Home/About มี source/capturedAt; deterministic routing สำหรับ FAQ, unknown/conflict; ไม่เรียก Notion ไม่ crawler สด |
| DONE | กติกาซีบอตและ tools | ชื่อไทย, read-only public knowledge tool และ mock order เดิม; ไม่มี shell/file tools |
| DONE | Memory session isolation/queue | key แยก channel/OA/direct/user, FIFO รายลูกค้า; ทดสอบ A/B และ Terminal แยกกัน |
| DONE | LINE adapter + mock tests | raw body HMAC, valid/invalid signature, immediate ACK, in-memory queue/dedupe, allowlist, mock reply; ไม่ส่ง LINE จริง |
| DONE | Config/คู่มือ LINE | .env.example และ append keys ที่ขาดใน .env โดยไม่เขียนทับค่าเดิม; LINE_SETUP.md; local endpoint ยังต้องเติม config |
| DONE | Limits เบื้องต้น | input 2000 chars, 100 active sessions, idle TTL 30 นาที, output 800 tokens, model/tool calls สูงสุด 4/turn; เปลี่ยนเพดาน 20 turn/100000 tokens เป็น bounded context+auto compaction; dry run ของ LINE ไม่เปลี่ยน |
| PARTIAL | Logging/cost control | safe metadata และ token/call limits มีแล้ว; ยังไม่มี dashboard, monetary/daily budget หรือ billing reconciliation |
| PARTIAL | การประเมินคุณภาพ | tests 10 รายการผ่าน รวมชุด FAQ 11 คำถาม แต่ยังไม่ใช่การประเมินทุกคำถาม/ทุกภาษา/ทุก prompt injection |
| TODO | LINE end-to-end จริง | ผู้ใช้ต้องเติม test OA credentials/allowlist และมี HTTPS hosting; ยังไม่ deploy, ตั้ง tunnel หรือส่ง reply จริง |
| DONE สำหรับ Terminal และ LINE local | Persistent memory | stores/locksแยกdirectory, keyแยกchannel/OA/direct/user, 0700/0600, retention90วัน, profile/recent/summary/long-term, resetคงprofile และforgetมีconfirmation; ยังไม่ใช่multi-hoststore |
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
| M3 | DONE สำหรับ local Terminal; production ยัง PARTIAL | ทดสอบ persistence/restart/day/isolation/reset/forget ผ่าน; ใช้ Pi compaction entry กับ bounded store; LINE persistence ยังไม่เชื่อม และ real-data access ต้อง verify ownership |
| M4 | PARTIAL — FAQ/contact | ชุดคำถามเริ่มต้นผ่าน found/unknown/conflict/source; เพิ่ม dataset ที่เจ้าของรับรองและชุดคำถามทดสอบจริง; handoff ลดขอบเขตเป็นชี้ช่องทางตามคำสั่งผู้ใช้ ไม่ถือว่าทำส่งต่อจริงเสร็จ |
| M5 | PARTIAL — reliability/cost | timeout/cancellation/empty response/tool denial และ limits เริ่มต้นผ่าน; ยังต้อง fault/load tests, monetary budget และตรวจคุณภาพคำตอบกว้างขึ้น |
| M6 | พร้อมตั้งค่า/ยังไม่ E2E — LINE | เมื่อมี test OA/HTTPS: Verify events=[] ได้ 200, invalid signature ได้ 401, allowlist ทำงาน, A/B ไม่รั่ว, redelivery ไม่ซ้ำในโปรเซสเดียว, reply จริงสำเร็จ โดยผู้ใช้เปิดส่งเอง |
| M7 | TODO — กลุ่มทดสอบ | ตกลง expected answers/latency/error/cost thresholds, retention และ rollback ก่อนทดลอง; เก็บผลจริงเพื่อเลือกงานถัดไป |

ข้ามขั้น production reliability ไม่ได้เพียงเพราะ mock tests ผ่าน การเตรียม LINE adapter รอบนี้ยังไม่ถือว่าเปิดให้บริการ LINE แล้ว

## ข้อมูล/การตัดสินใจที่ยังขาด

- Test LINE OA: channel ID/secret/access token, tester IDs และ HTTPS hosting เจ้าของระบบจะเติมเองบนเครื่อง
- แหล่ง public knowledge เลือกแล้ว: FAQ/Home/About; ยังต้องให้เจ้าของข้อมูลทบทวนข้อขัดแย้ง อัปเดต snapshot และอนุมัติ coverage ที่ต้องตอบ
- วิธี map/verify learner และ ownership ก่อนใช้ข้อมูลจริง ไม่มีการรวมตัวตนข้ามช่องทางอัตโนมัติ
- Retention และ storage: Terminal demo เก็บไฟล์แบบมีขอบเขตจน inactive เกิน 90 วัน (purge ตอนเปิด/load), Pi active idle 30 นาที; ทบทวน production retention และ LINE persistence ก่อนใช้งานจริง
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

## Milestone memory — ตรวจรับแล้ว

เอาการบังคับ reset ทุก20คำตอบออก เก็บ local canonical store ที่ไม่รวม raw Pi transcript/reasoning/errors และคืน context ด้วย Pi SessionManager+compaction entry ใช้ extractive summary ในเครื่องเพื่อลด quota ไม่ใช่ยกเพดานเป็นตัวเลขใหญ่

เก็บ recent 12 คู่ (ย่อเหลือ6), summary/หัวข้อ/เรื่องค้างแบบ bounded, profile จากที่ผู้ใช้บอกชัด และ long-term ที่ขอจำโดยตรง `/reset` ล้าง session context/pending แต่คง profile/long-term; `/forget` ต้อง confirm และ cancel ได้ ลบไฟล์ identity จริงไม่กระทบคนอื่น

Build/tests ล่าสุด18รายการผ่าน รวม >32turn, fake next day และ separate-process restart, identity/channel isolation, reset/no pending revival, forget/no file revival, failed/malformed summary และ429ไม่ล้าง facts, privacy fixtures/permissions/locking/retention ทดสอบ CLI live เพียงสอง model calls: บอกชื่อ514ms และ restartแล้วถามชื่อ370ms จากนั้น24ข้อความ FAQ/greeting พร้อม auto compaction, reset, forget cancel/confirm และ restartอ่าน memory ว่างผ่าน ไม่มีการเปลี่ยน LINE/config/credentials

ข้อจำกัดและ retention implementation: [MEMORY_GUIDE.md](./MEMORY_GUIDE.md) Summary คัดข้อความแบบมีขอบเขตสูญรายละเอียดได้ ไม่ใช่ semantic task manager, filtering เป็น heuristic, disk ไม่เข้ารหัส และ CLI --user ไม่ใช่ customer authentication

## LINE readiness หลังได้รับอนุญาตให้เชื่อมต่อ

ตรวจ .env แบบ presence-only: Channel ID/secret/access token, tester allowlist และ HTTPS base URL ยังขาด, dry run=true, tester0คน ตรวจไม่พบ listener ที่ port3000 และ serverหยุดเมื่อไม่มี secret ตามคาด Build/tests18รายการผ่าน ตรวจ HTTP loopback ด้วย fixtures ผ่าน health200/invalid401/valid200/duplicateหนึ่งmockreply ไม่มีการส่ง LINE จริงหรือเลือก hosting/tunnel

เพิ่ม `npm run line:check` สำหรับตรวจ readiness ที่ไม่แสดงค่า secrets และปรับ LINE_SETUP ให้ตรงกับ core ล่าสุด ยังไม่ต่อ persistent store ให้ LINE ต้องกำหนด OA/HTTPS ก่อนและวาง store แยกพร้อม lifecycle/isolation/reset/forget controls ให้ครบ ไม่อ้างว่า Terminal memory milestone ทำให้ LINE จำข้าม restartแล้ว ขั้นที่ต้องใช้เจ้าของคือเติม config บนเครื่องและเลือก HTTPS hosting; ไม่ส่ง keys ผ่านแชต

### อัปเดตหลังเติม config

ยืนยันผ่าน read-only LINE APIว่า OAชื่อ DemoB1, tokenใช้ได้และchannelตรงกับ.env, allowlist1คนformatถูกต้อง PUBLIC_BASE_URLยังขาด และมีwebhookเดิมactiveบนn8n ไม่ได้ชี้มาที่localserverโดยหลักฐานที่มี จึงยังไม่เปลี่ยนปลายทางหรือเปิดreply

local dry-run serverเริ่มได้แล้ว: health200, unsigned401, signed events=[]200 ไม่ส่งuser event/LINE message ต้องเจ้าของเลือกเส้นทางผ่านn8nเดิมหรือHTTPS hostingก่อนตรวจLINE E2Eและreplyจริง ไม่มีการเปลี่ยนcredentialsหรือTerminal memory

## ผลทดสอบ Terminal ก่อน LINE เพิ่มเติม

ทดสอบ `npm run chat` รุ่น CBTU ผ่าน PTY จริงครบสมัครสมาชิก, ข้อขัดแย้งการเข้าเรียนหลังจ่าย, certificate, ติดต่อเจ้าหน้าที่ และไม่พบข้อมูล ทั้งหมดผ่านพร้อม source/time ตามกติกา ทดสอบความจำผ่านโมเดลจริงสอง turn ในโปรเซสเดียวแล้วตอบชื่อทดสอบตรงกัน (476/441 ms) และ `/exit` ออกด้วย code 0 ไม่มีการเปลี่ยน config หรือเรียก LINE ในรอบนี้ รายละเอียด: [TERMINAL_TEST_RESULTS.md](./TERMINAL_TEST_RESULTS.md)


## เชื่อม DemoB1 ผ่าน HTTPS tunnel

23 ตุลาคม 2026: หลังเจ้าของอนุญาตให้เปิด tunnel/เปลี่ยน webhook ใช้ ngrok ที่ติดตั้งและมี configอยู่ อัปเดตโปรแกรมเป็น3.39.12 เปิดเฉพาะซีบอตพอร์ต3000และปิดrequest inspector ตรวจ public health200/unsigned401/signed-empty200 และ LINE Verify success=true สำรอง webhookเดิมในruntimeที่ignoredและmode0600 แล้วเปลี่ยนปลายทาง อ่านกลับ active=true/URLตรงกัน จากนั้นเปิดreplyจริงเฉพาะallowlist1คนและrestart ตรวจpublic/LINE Verifyซ้ำผ่าน ต่อมารับinboundจริงและlogยืนยันoutcome=replied7ครั้งหลังLINE reply APIสำเร็จ ยังไม่ได้ตรวจหน้าจอผู้รับ ไม่ส่งpush/broadcast ไม่แตะn8nworkflowหรือTerminal memory และLINE memoryยังephemeral

เพิ่ม script สำหรับตรวจ/เปลี่ยน/rollback โดยไม่แสดงsecretsและไม่ทับbackupเดิม วิธีหยุดและคืนปลายทางใน LINE_SETUP.md เครื่อง/server/tunnelต้องเปิดอยู่และURLอาจเปลี่ยน ยังไม่ใช่hostingถาวร


## LINE fallback / provider429

หลังผู้ใช้พบfallback ตรวจcoreจริงพบ Groq HTTP429 ทำซ้ำได้ (modelturnแรกผ่าน แต่followupติดquota; FAQผ่านทันที) ไม่ใช่หลักฐานkey/networkผิด แก้adapterให้บอกquota/FAQและtimeoutอย่างปลอดภัย เพิ่มcategorylogและแยกreplied_fallbackจากreplied ไม่ส่งrawerror ไม่มีproviderretryเพิ่ม ไม่แตะcredentials/model/Terminal store Build/tests20รายการรวมregressionผ่าน Local HTTPและpublicsignature/LINE Verifyผ่าน หลังrestartรับinboundจริงlogmodel_rate_limit/fallbackตามคาด แล้วFAQok2ms/replied ผู้ใช้ยืนยันว่าได้รับFAQแล้ว บทสนทนาผ่านโมเดลยังอาจติดquotaจนproviderปลดข้อจำกัด LINE memoryยังephemeral รายละเอียดstartupoverrideและrollbackใน LINE_SETUP.md


## LINE persistent memory แยกจาก Terminal

ตามการอนุญาตล่าสุด LINEserverใช้MemoryStoreค่าเดียวกับTerminalใน.line-memory แยกdirectory/lockและtrustedidentity ไม่แตะTerminalstoreหรือconfigcredentials เพิ่มLineConversationsเก็บclient/challengeเฉพาะuser/OA/adapter มีidle30นาที/cap100 และmemorycommandsที่ไม่เรียกโมเดล /memoryเป็นsnapshotย่อ /resetคงprofile/long-termล้างpending /forgetต้องconfirm60วินาทีและcancel/ข้อความอื่นยกเลิก ไม่ให้confirmข้ามคน/OA/restart

Build/tests22รายการผ่าน รวมsignedadapter→persistentstore/restart/profile/summary/compaction32turn, OA/user/channelisolation, Terminalอีกprocess/storeเปิดพร้อมLINE, resetpreservesfacts, forgetcancel/expiry/physicaldelete/no-revival/retention และregressionเดิม LocalHTTPmockผ่าน ไม่ใช้ข้อมูลจริงเพื่อdelete tests ServerเปิดstoreจริงและLINE Verifyผ่านหลังrestart ผู้ใช้ส่งชื่อสำเร็จและมีrecord0600จริง จากนั้นrestartและผู้ใช้ส่ง/memoryยืนยันprofileกับrecentยังอยู่จริง ประวัติRAMก่อนเปิดstoreไม่ได้ย้ายอัตโนมัติ คิว/dedupeยังไม่durable
