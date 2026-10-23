# ตั้งค่าซีบอต CBTU สำหรับ LINE กลุ่มทดสอบ

สถานะ 23 ตุลาคม 2026: OA **DemoB1** เชื่อมกับซีบอตบนเครื่องผ่าน ngrok HTTPS tunnel แล้ว LINE Verify ผ่านและ webhook active=true โหมด reply จริงเปิดเฉพาะ allowlist 1 คน ได้รับ inbound จาก LINE และ API ยอมรับ reply จริงแล้ว 7 ครั้ง ชื่อใช้ภาษาไทย “ซีบอต” จนกว่าจะยืนยัน spelling อังกฤษ

## ผล readiness ล่าสุด

### LINE persistent memory (สถานะปัจจุบัน)

ได้รับอนุญาตให้ใช้ค่าmemoryเดียวกับTerminalแล้ว LINEserverเปิดstoreที่ `.line-memory/` แยกdirectory/lockจาก `.customer-memory/` และkeyแยกchannel+OA/direct+user ไม่เชื่อมประวัติข้ามช่องทาง ใช้profile/explicitlong-term/recent/summary/lastTopic และcompaction/retention90วัน/limitsเดิม คำสั่ง `/memory`, `/reset`, `/forget`, `/confirm-forget`, `/cancel` ใช้ใน1:1allowlistเท่านั้น ดูรายละเอียดและข้อจำกัดใน MEMORY_GUIDE.md

/memoryแสดงsnapshotแบบย่อเพื่อพอดีLINE /resetล้างrecent/summary/pending/lastTopicแต่คงprofile/long-term /forgetต้องchallenge60วินาทีที่ผูกuser/OA/adapterเดิม ข้อความหรือคำสั่งอื่นยกเลิกchallenge ไม่ให้โมเดลลบmemoryเอง ไม่เปิดกลุ่ม ไม่ส่งpush/broadcast ไม่มีrawerrors/tokens/IDsในlogs ประวัติRAMของLINEก่อนเปิดstoreไม่ได้ย้ายอัตโนมัติ

Build/tests22รายการผ่าน รวมLINEsignedmemorypersist/restart/compaction, OA/user/channelisolation, Terminalคนละโปรเซส/storeเปิดพร้อมLINEได้, reset/forgetcancel/expiry/physicaldelete/no-revival และretention Local HTTPhealth200/signature401/200/dedupeหนึ่งmockreplyผ่าน Serverrestartแล้วเปิดpersistentstoreจริงและpublichealth/signature/LINE Verifyผ่านactive=trueใช้URLเดิม ผู้ใช้บอกชื่อผ่านLINEสำเร็จ(ok490ms/replied) ตรวจmetadatarecordมีชื่อและrecent1คู่/0600แล้วrestartอีกครั้งเพื่อยืนยันอ่านกลับ (รอผลผู้ใช้)

คำสั่งเริ่มใช้ค่า.envตามปกติ; โปรเซสทดสอบreplyปัจจุบันใช้ `LINE_DRY_RUN=false npm run server` โดยไม่แก้credentials/.env ระหว่างงานนี้ ต้องเปิดserver/tunnelค้างไว้ การpersistไม่ได้ทำให้คิว/dedupeเป็นdurableและไม่ได้แก้providerquota

### แก้ provider JSON generation failure หลังเปลี่ยนคีย์

ผู้ใช้เปลี่ยนคีย์บนเครื่องแล้วทดสอบหนึ่ง model turnสำเร็จ และรับreplyปกติในLINE404ms ต่อมามีภาพfallbackซ้ำ ตรวจlogพบcore_failure (จึงไม่สรุปว่าเป็น429) ทำซ้ำบทสนทนาในcoreชั่วคราวพบ provider error “Failed to generate JSON” โดยไม่เก็บหรือแสดงraw error/failed generation การย่อบริบทหลังFAQ6turnทดสอบแยกแล้วผ่าน จึงยังไม่มีหลักฐานว่าcompactionเป็นต้นเหตุ

แก้describeFailureให้จำแนกJSON generation errorอย่างปลอดภัย และrunDialogueซ่อมได้หนึ่งครั้งภายในdeadlineเดิมเช่นเดียวกับคำตอบผิดรูปแบบ ไม่retry429/auth/network เพิ่ม model_format categoryและข้อความLINEเฉพาะกรณีซ่อมแล้วยังไม่ผ่าน TestsครอบคลุมproviderJSONล้มครั้งแรกแล้วสำเร็จ และล้มซ้ำต้องหยุดที่สองcalls ไม่เผยrawerror Build/tests20รายการผ่าน บทสนทนาผ่านcoreจริงหลังแก้8turnต่อเนื่องผ่าน

Restart serverด้วยโหมดreplyเฉพาะallowlistเดิมและtunnelเดิม หลังแก้ผู้ใช้ส่ง “เหนื่อยอีกแล้ว” ในLINEและยืนยันได้รับคำตอบปกติ Logล่าสุดมีok496ms/repliedและok332ms/replied ไม่มีfallbackสองturnนั้น ไม่ได้ยืนยันว่าโมเดลจะไม่มีerrorทุกกรณี ไม่มีการเปลี่ยนcredentialsหรือTerminal memory

### แก้ fallback จาก model rate limit (ประวัติก่อนเปลี่ยนคีย์)

ผู้ใช้พบข้อความ “ขณะนี้ซีบอตยังตอบไม่ได้…” ทั้งที่ webhook/reply ทำงาน ตรวจ core เดียวกับ LINE ด้วย config เดิม (Groq qwen/qwen3.8-27b, timeout25s, identity allowlistเดิมแต่ sessionทดสอบชั่วคราว ไม่แตะ Terminal store) พบ model turn สำเร็จหนึ่งครั้ง แล้ว follow-up ได้ HTTP429; FAQ สำเร็จทันที ทดสอบซ้ำพบ429อีกครั้ง ไม่เปลี่ยนcredentialsหรือmodel และไม่retryreplytokenเดิม

สาเหตุที่ทำซ้ำได้คือ provider rate limit; adapterเดิมจับทุกข้อผิดพลาดแล้วส่งข้อความรวมและlogเพียงreplied ทำให้แยกคำตอบปกติกับfallbackไม่ได้ จึงเพิ่มcategoryแบบค่าคงที่ในcore/adapter โดยไม่logข้อความerrorดิบ เปลี่ยน429เป็นข้อความไทยแจ้งโควตาชั่วคราวและบอกว่าFAQยังใช้ได้ พร้อมoutcome `core_failed` / `replied_fallback` ต่างจาก `replied` ปกติ timeoutมีข้อความเฉพาะ ส่วนerrorไม่ทราบชนิดยังซ่อนรายละเอียด

หลังbuildและrestartจริง logรับinboundยืนยัน `model_rate_limit` → `core_failed` → `replied_fallback`; ถัดมาFAQ `ok` 2ms → `replied` ผู้ใช้ยืนยันว่าได้รับคำตอบFAQแล้ว นี่เป็นหลักฐานการตอบจริงหลังแก้ ส่วนบทสนทนาที่เรียกโมเดลยังอาจติด429จนproviderปลดข้อจำกัด ไม่มีการรับรองว่าquotaถูกแก้แล้ว

Build/tests20รายการผ่าน รวม429fallback/FAQถัดไป/timeout/ซ่อนunknownerror และTerminal persistenceเดิม Local HTTP smokeผ่านhealth200/invalid401/signed200/dedupeหนึ่งmockreply; public checksและLINE Verifyหลังrestartผ่าน endpointตรงและactive=true

ตอนตรวจรอบนี้ `.env` มี LINE_DRY_RUN=true แต่โปรเซสเดิมทำงานfalseอยู่ จึงคงไฟล์เดิมและเริ่มโปรเซสใหม่ด้วย `LINE_DRY_RUN=false npm run server` เพื่อคงการทดสอบreplyเฉพาะallowlistตามที่อนุญาต หากเริ่มด้วย `npm run server` ธรรมดาจะใช้ค่าใน.env และไม่ส่งreply; ต้องเลือกโหมดให้ตรงเจตนา LINE sessionถูกล้างตามปกติเมื่อrestartเพราะยังephemeral Terminal memoryไม่เปลี่ยน

### HTTPS tunnel และการเปลี่ยน webhook (ประวัติการเชื่อมต่อ)

เจ้าของอนุญาต tunnel ชั่วคราวและเปลี่ยน webhook โดยตรงแล้ว ใช้ ngrok ที่มี config อยู่ อัปเดตจาก 3.6.0 เป็น 3.39.12 เพราะบริการปฏิเสธเวอร์ชันเก่า เปิดเฉพาะ upstream `http://127.0.0.1:3000` และปิด request inspector (`--inspect=false`) ไม่ได้เปิดบริการอื่น

Public webhook ทดสอบปัจจุบัน: `https://2d34-2405-9800-b651-6936-fc30-29a7-345-362e.ngrok-free.app/webhook/line` URL อาจเปลี่ยนเมื่อเริ่ม tunnel ใหม่; ค่าปัจจุบันอยู่ใน `.env` เป็น PUBLIC_BASE_URL

ตรวจ OA DemoB1 และ token/channel ตรงกันก่อนเปลี่ยน ผ่าน public health200 / unsigned401 / signed events=[]200 และ LINE webhook test success=true ทั้งก่อนและหลังเปลี่ยน อ่านกลับแล้ว endpoint ตรงกับ tunnel และ active=true จากนั้นตั้ง LINE_DRY_RUN=false และ restart server ตรวจซ้ำผ่าน ไม่มีการส่ง push/broadcast และต่อมารับ inbound จริงและ log outcome=replied จำนวน 7 ครั้ง ซึ่งเกิดหลัง LINE reply API ตอบ success ไม่มี raw body/user ID/reply token ใน log; เป็นหลักฐานฝั่ง API ไม่ใช่การตรวจหน้าจอผู้รับ

สำรอง webhook เดิมไว้ใน `runtime/line-webhook-rollback.json` (ignored, mode0600, directory0700) ไม่แสดง URL เดิมซึ่งอาจมีข้อมูลส่วนตัว ไม่แก้ workflow หรือบริการ n8n อื่น **อย่า commit หรือส่งไฟล์นี้ในแชต** เก็บไว้จนเลิกทดสอบ

### เปิดต่อ หยุด และ rollback

เปิด terminal แยกสองหน้าที่โฟลเดอร์โปรเจกต์:

```sh
npm run server
ngrok http http://127.0.0.1:3000 --inspect=false --log stdout --log-format json --log-level warn
```

หากโปรเซสเดิมยังทำงานอยู่ไม่ต้องเปิดซ้ำ ปิดด้วย Ctrl-C ใน terminal ของแต่ละโปรเซส การปิดเครื่อง/server/tunnel จะทำให้ LINE เรียกซีบอตไม่ได้ ควร rollback ก่อนหยุดทดสอบ ไม่ใช่บริการที่ทำงานถาวร

อ่านสถานะและทดสอบ events ว่างโดยไม่มีข้อความออก:

```sh
node --env-file=.env scripts/line-webhook-admin.mjs verify
```

คืน webhook เดิมจากไฟล์ส่วนตัว (ตรวจ channel/ปลายทางปัจจุบันก่อนเปลี่ยน):

```sh
node --env-file=.env scripts/line-webhook-admin.mjs rollback
```

คำสั่งคืน URL เดิม อ่านกลับเพื่อยืนยัน และตั้ง LINE_DRY_RUN=true ใน .env จากนั้น restart server ให้รับค่าใหม่ หรือหยุด server/tunnel ด้วย Ctrl-C หากมีผู้อื่นเปลี่ยน webhook ไปแล้ว คำสั่งจะหยุดแทนการทับปลายทางที่ไม่ตรง

`scripts/line-webhook-admin.mjs prepare` ใช้ตรวจ tunnel และบันทึก rollback ครั้งแรกเท่านั้น จะไม่เขียนทับ backup ที่มีอยู่; `switch` ต้องมี backup และผ่าน identity/public signature/LINE Verify ก่อนเปลี่ยน ส่วนการเปิด Use webhook หากปิดอยู่ต้องตั้งใน Console งานนี้อ่านกลับแล้วเปิดอยู่ ไม่มี secrets ใน script

ในรอบเปิดtunnelเดิม LINEยังephemeral; milestoneปัจจุบันเปิดstoreแยกและmemorycontrolsแล้วตามด้านบน

### หลังผู้ใช้เติม OA config (ประวัติก่อนเปิด tunnel)

อ่าน LINE metadata ด้วย token จาก .env เท่านั้น: bot info HTTP200 ยืนยันชื่อ OA **DemoB1**, token metadata HTTP200 และ channel ID ตรงกับ config, tester allowlist 1คนมีรูปแบบถูกต้อง ไม่แสดง token หรือ user ID เต็ม ไม่เปลี่ยนค่า config

PUBLIC_BASE_URL ยังว่าง และ LINE รายงานว่ามี webhook เดิม active อยู่บน `maieg.app.n8n.cloud` ซึ่งไม่ใช่หลักฐานว่า route มาซีบอตบนเครื่องนี้แล้ว ไม่แก้/ทับ webhook เดิม ไม่ตั้ง tunnel หรือเลือก hosting แทนเจ้าของ

เริ่ม local server ที่127.0.0.1:3000ด้วย configปัจจุบันและ dry run=trueแล้ว ตรวจจริง: GET /health→200, POST unsigned→401, signed events=[]→200 ไม่มี user event หรือ replyส่งออก การทดสอบนี้ยืนยันเฉพาะ local HTTP/signature ไม่ใช่ LINE HTTPS E2E

สิ่งที่ยังต้องตัดสินใจคือใช้ n8n เดิมเป็นตัวรับแล้วส่ง raw body/signatureต่อไปยังซีบอตที่เข้าถึงได้ หรือกำหนด HTTPS hostingอื่นให้ซีบอต เจ้าของต้องเลือก/ระบุปลายทางก่อน ไม่ส่งข้อความทดสอบไป workflowเดิมโดยเดาทาง เมื่อเส้นทางพร้อมจึงทดสอบ Verify/dry runผ่าน HTTPS แล้วเปิด replyเฉพาะallowlistเพื่อให้ผู้ใช้ส่งข้อความเข้าDemoB1 ไม่มี push/broadcast/handoff

Server localเป็นโปรเซสชั่วคราว ต้องเปิดserver/tunnelไว้ ความจำLINEปัจจุบันเปิดใหม่แล้วอ่านstoreของLINEกลับมาได้ตามmilestoneด้านบน

### สถานะเริ่มต้นก่อนเติม config (เก็บเป็นประวัติ)

หลัง Terminal memory milestone `c7eb825`: ตรวจเฉพาะ presence ใน .env พบ LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_ALLOWED_USER_IDS และ PUBLIC_BASE_URL ยังไม่ตั้ง; dry run=true, tester count=0 ตรวจ port3000 ไม่พบ listener และ `npm run server` หยุดเพราะไม่มี secret ตามคาด ยังระบุ OA/ผู้รับจริงไม่ได้ จึงไม่มี external reply

สิ่งที่ต้องเติมบนเครื่องขั้นต่ำ: ID/secret/token ของ **OA ทดสอบเดียวกัน**, user ID ของผู้ทดสอบ 1:1 และเลือก HTTPS hosting/base URL ที่ต้องการใช้ ไม่มีการสร้าง tunnel/deploy ให้เองและไม่มีการเขียนทับ .env

ตรวจซ้ำโดยไม่แสดงค่า secrets:

```sh
npm run build
npm run line:check
```

Exit code1 หมายถึงข้อมูลขาดหรือ URL syntax ไม่ครบ ไม่ใช่ server crash คำสั่งนี้ไม่เรียก LINE API และไม่พิสูจน์ token validity/endpoint reachability แม้แสดง configured ครบ ก่อนเปิด reply จริงต้องตรวจ OA เป้าหมายและรายชื่อผู้ทดสอบกับเจ้าของอีกครั้ง

ประวัติreadinessก่อนmilestoneLINEmemory: LINE server **ยังไม่ต่อ persistent store**: memory ถาวรใน `.customer-memory/` ถูกเปิดโดย Terminal เท่านั้น งานถัดไปหลังยืนยัน OA/hosting คือใช้ store แยกสำหรับ LINE, key แยก OA/direct/user, lifecycle เปิด/ปิด store และคำสั่ง reset/forget ที่ยืนยันได้ต่อผู้ใช้ คง Terminal เดิมและทดสอบ restart/isolation/no data revival ก่อนอ้างว่า LINE จำข้ามวันได้

## ทดลอง Terminal ก่อน

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm run build
npm test
npm run chat
```

ลอง “สมัครสมาชิกอย่างไร”, “จ่ายแล้วเข้าเรียนทันทีไหม”, “ดาวน์โหลด certificate”, “ติดต่อเจ้าหน้าที่”, “ตรวจ DEMO-1001” และคำถามที่ไม่มีในแหล่งข้อมูล

FAQ ตอบจาก snapshot ที่คัดจากเว็บสาธารณะ พร้อม URL และเวลาเก็บ ไม่ใช้ Notion ภายใน ไม่เรียกโมเดลเพื่อแต่งข้อเท็จจริงเพิ่ม บทสนทนาเกี่ยวกับชื่อ/ความจำใช้ Pi และ provider ที่ตั้งใน .env Tool ออเดอร์เป็นของจำลองเดิม ไม่ใช่สถานะผู้เรียนจริง

## เติมค่าบนเครื่อง

เปิด `.env` แล้วเติมค่าด้วยตนเอง ไม่ต้องส่ง secrets ในแชต `.env.example` เป็นตัวอย่างเท่านั้น อย่าคัดลอกทับ `.env` ที่มีคีย์แล้ว รอบนี้เพิ่มเฉพาะชื่อ keys ที่ขาด โดยคงค่าที่มีอยู่ทั้งหมด

| Key | ใช้ทำอะไร / หาได้จากที่ใด |
|---|---|
| GROQ_API_KEY / PI_PROVIDER / PI_MODEL | ค่าโมเดลของผู้ใช้ที่ตั้งไว้เดิม ไม่มีการเปลี่ยนคีย์ |
| LINE_CHANNEL_ID | Channel ID ของ Messaging API channel ใน LINE Developers Console > Basic settings ใช้แยก scope ของ OA |
| LINE_CHANNEL_SECRET | Channel secret ใน Basic settings ใช้ตรวจ signature ห้ามเผยแพร่หรือใช้ค่าทดสอบกับ OA จริง |
| LINE_CHANNEL_ACCESS_TOKEN | Channel access token จาก Messaging API tab ของ channel ชนิดที่เลือกใช้งานและมีสิทธิ์ reply เก็บเฉพาะฝั่ง server |
| LINE_ALLOWED_USER_IDS | LINE user IDs ของผู้ทดสอบ คั่นด้วย comma เริ่มทดสอบกับ own user ID ใน Console ได้; ว่างหมายถึงไม่ตอบใคร ไม่ใช้ชื่อ display name และไม่ใช่สิทธิ์เข้าข้อมูลผู้เรียน |
| LINE_DRY_RUN | `true` เป็นค่าเริ่มต้น: ตรวจ webhook/ประมวลผลแต่ไม่ส่ง LINE; ตั้ง `false` เองเมื่อพร้อมทดสอบ reply จริงแล้ว |
| HOST | `127.0.0.1` ค่าเริ่มต้นสำหรับ local; หาก deploy ใน container ค่อยกำหนด interface ให้เหมาะสม เช่น 0.0.0.0 และจำกัด network access |
| PORT | `3000` ค่าเริ่มต้น |
| PUBLIC_BASE_URL | เว้นว่างจนมี HTTPS hosting ของตนเอง เช่น `https://bot.example.org` เป็นช่องจด config เท่านั้น โค้ดไม่สร้าง hosting หรือปรับ Console ให้ |
| PI_TIMEOUT_MS | Terminal เริ่มต้น 45000 ms; LINE core จำกัดไม่เกิน 25000 ms เพื่อเหลือเวลาตอบ; network ไป LINE จำกัด 8 วินาที |

หากยังไม่มี OA ให้สร้าง test LINE Official Account แล้วเปิด Messaging API ตาม [คู่มือเริ่มต้น LINE](https://developers.line.biz/en/docs/messaging-api/getting-started/) และเข้า channel ที่เชื่อมกับ OA นั้นใน [LINE Developers Console](https://developers.line.biz/console/) หลีกเลี่ยงใช้ OA ที่ให้บริการลูกค้าจริงสำหรับทดลอง

## เริ่ม local server

เมื่อเติม LINE_CHANNEL_SECRET แล้ว:

```sh
npm run build
npm run server
```

URL บนเครื่องคือ `http://127.0.0.1:3000/webhook/line` และ health check `http://127.0.0.1:3000/health` หาก secret ว่าง โปรแกรมจะหยุดพร้อมข้อความตั้งค่า ไม่อ่าน credentials เก่าของ Pi หรือค้น LINE secrets ในเครื่อง

`LINE_DRY_RUN=true` จะไม่มีการส่ง reply ออก และไม่ log เนื้อหาคำถาม/คำตอบ เมื่อ allowlist ว่างจะรับ webhook verification ที่ events=[] ได้ แต่ไม่ประมวลผลแชตผู้ใช้ ไม่มีการกรอกข้อมูลลง Console อัตโนมัติ

## ตั้ง webhook หลังมี HTTPS hosting

1. จัดเตรียม HTTPS endpoint ที่เจ้าของระบบดูแลและ route POST `/webhook/line` ถึง server โดยคง raw request body ไม่ parse/reformat ก่อนตรวจ signature; สำหรับทางเลือก hosting ถาวรนอกเหนือจาก tunnel ทดสอบด้านบน
2. เติม PUBLIC_BASE_URL ใน .env เพื่อบันทึกปลายทาง แล้วเข้า Messaging API tab ใน Console ตั้ง Webhook URL เป็น `https://<โดเมนของคุณ>/webhook/line` ด้วยตนเอง localhost ใช้รับ webhook จาก LINE โดยตรงไม่ได้
3. กด Verify: request ที่มี signature ถูกต้องและ events=[] ต้องตอบ 200; signature ไม่ถูกต้องต้องได้ 401
4. เปิด Use webhook และตรวจ response settings ของ OA เพื่อไม่ให้ auto-reply/greeting ที่ตั้งไว้ชนกับบอต ปรับเฉพาะ OA ทดสอบตามต้องการ
5. เติมผู้ทดสอบใน allowlist แล้วทดสอบ dry run ก่อน เมื่ออนุญาตให้ส่ง reply จริงจึงตั้ง LINE_DRY_RUN=false และ restart server ด้วยตนเอง ไม่มี push/broadcast/handoff sender ในโค้ดนี้
6. ทดสอบ FAQ, conflict, unknown, คุยสอง turn, ผู้ใช้ A/B และ event redelivery ตรวจว่าไม่รั่วประวัติหรือส่งซ้ำ; กลับ LINE_DRY_RUN=true และ restart เพื่อหยุดส่ง reply

## พฤติกรรมและข้อจำกัด

- HMAC-SHA256 + timing-safe comparison ตรวจ raw bytes ก่อน JSON.parse; ไม่อาศัยการตรวจ IP แทน signature
- ACK 200 ก่อนเรียก core แล้วประมวลผลในคิวหน่วยความจำ; body ไม่เกิน 256 KiB, events ไม่เกิน 20, pending queue ไม่เกิน 32
- รับเฉพาะ text ในแชต 1:1 จาก allowlist แชต group/room และ media ถูกข้าม เพื่อไม่เผยบริบทส่วนตัวในห้องรวม “กลุ่มทดสอบ” หมายถึงรายชื่อผู้ทดสอบที่คุย 1:1
- แยก Pi session ด้วย channel + OA/direct scope + user ID ไม่รวม Terminal กับ LINE อัตโนมัติ ข้อความที่อ้างว่าเป็นอีกคนไม่เปลี่ยน identity
- LINE active Pi sessionอยู่ในRAM idle expiry30นาทีและสูงสุด100sessions input2000ตัวอักษร คิวต่อsession3ข้อความ; persistentrecordอยู่ใน.line-memoryและอ่านคืนหลังrestart มีauto compaction/retention90วันเหมือนTerminal
- Pi จำกัด output 800 tokens/request, model/tool calls ไม่เกิน 4 ต่อ turn; ไม่ใช่ระบบ hard billing cap แบบเงิน งบรายวัน/การกระจายหลายเครื่องยังไม่ได้ทำ Terminal และ LINE มี /memory, /reset, /forget พร้อมconfirmation และ persistent storeแยกกัน ตาม MEMORY_GUIDE.md
- Dedupe webhookEventId ใน memory 24 ชั่วโมง สูงสุด 10000 IDs; คิวเกิน capacity ตอบ 503, งานรอเกิน 20 วินาทีถูกข้าม, reply ที่ล่าช้าเกิน 50 วินาทีไม่ส่ง ไม่ retry reply ที่ล้มเหลวเองเพราะผลอาจกำกวม
- คิวและ dedupe **ยังไม่ durable**: server restart อาจทำให้งานที่ ACK แล้วหายหรือ redelivery ถูกประมวลผลใหม่ ต้องเพิ่ม durable queue/store ก่อนใช้งานจริงที่ต้องรับประกัน delivery
- Log server มี request ID, channel, outcome และ latency ไม่มี raw body, user ID, reply token, authorization headers หรือ secrets ไม่มีการเก็บประวัติลงดิสก์ แต่ประวัติใน memory ยังคงเป็นข้อมูลที่ต้องดูแล
- FAQ ขัดกันเรื่องเวลาอนุมัติและบาง email: ชี้หน้าเว็บ/เจ้าหน้าที่ ไม่เลือกยืนยันเลขบัญชีหรือข้อมูลโอน ไม่เก็บสลิปหรือข้อมูลส่วนบุคคล การส่งต่อเป็นคำแนะนำช่องทางเท่านั้น ไม่เปิด case จริง
- ตัวเลขเวลาเก็บ snapshot ไม่ใช่เวลาที่เจ้าของเว็บแก้ไขล่าสุด ต้อง refresh/ทบทวนข้อมูลก่อนรับรองราคา รอบเรียน หรือเปิดรับสมัคร ข้อมูลเพิ่มเติมแก้ `src/knowledge.ts` และ tests โดยอ้าง source เสมอ

## เอกสารทางการที่ตรวจ

- [Verify webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [Receive messages / asynchronous processing / redelivery](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [Send reply messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/)
- [CBTU FAQ](https://cbtumu.net/faq/), [หลักสูตรหน้า Home](https://cbtumu.net/), [About CBTU](https://cbtumu.net/about-cbtu/)
