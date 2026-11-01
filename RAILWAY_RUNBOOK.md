# Railway cloud trial

## อัปเวอร์ชันโปรแกรมและข้อความเจ้าหน้าที่ — 1 พฤศจิกายน 2026

- ผู้ใช้สั่งอัปโค้ดล่าสุด Railway เดิม; รอบนี้เพิ่ม build metadata, แสดงรุ่นในหน้าเว็บ/คำสั่ง LINE direct `/version`, prefix เจ้าหน้าที่ `Staff: ` และซ่อน audit event พักบอตที่ไม่มีข้อความจากหน้าแชต
- แก้ write-build-info ให้ hash เฉพาะ production TypeScript และ course-catalog-data.json ตาม allowlist staging เพราะ local มี test sources ที่ไม่ได้ส่งขึ้น Docker; ตรวจ hash จาก staging ตรง local build แล้ว
- Build และ application tests 300/300 ผ่าน; snapshot `a71ac83e-fb40-4beb-b9f1-72627c1122a6`, `Before program version update 2026-11-01` ตรวจพบใน native backup list
- ก่อนอัป deployment `ece8dd32-1cb8-465b-be56-652551e2a7da`; ใหม่ `b038a187-56dd-4990-87ea-861818e31a33` SUCCESS รุ่นโค้ด `1476874266de` ตรง local/cloud
- เทียบ SHA-256 production files ที่เปลี่ยน 8 ไฟล์ตรง local build; ตรวจฟังก์ชัน version reply ใน container มีรุ่นที่ถูกต้อง ไม่ได้ส่ง `/version` จริงผ่าน LINE
- ตรวจ health/auth/Origin/signature/Google start และ LINE Platform Verify ผ่าน webhook เดิม active=true; ไม่เปลี่ยน Variables/volume/webhook ไม่ส่งข้อความจากเครื่องมือ ไม่ commit/push GitHub
- ไม่ได้รัน Playwright UI script รอบนี้เพราะ project ไม่มี Playwright; application tests ครอบคลุม admin version visibility, LINE version command gates และบทสนทนา ผู้ใช้ควร refresh/login ใหม่แล้วลอง UI จริง

## แก้ข้อความลูกค้าไม่แสดงระหว่างเจ้าหน้าที่รับช่วง — 1 พฤศจิกายน 2026

- ผู้ใช้อนุญาตแก้และอัป Railway เดิมหลังรายงานข้อความธรรมดาหายจากหน้าบทสนทนา พบ browser cache รวมรายการด้วย webhook ID อย่างเดียว ทำให้รายการขาออก `bot_paused` ทับข้อความขาเข้า ID เดียวกัน
- แก้ cache identity ให้รวม account/user/ID/direction และ cursor ฝั่ง browse ให้แยก source/ID/direction ป้องกันข้ามข้อความเมื่อ timestamp และ webhook ID ตรงกันตรงขอบหน้า ไม่มีการแก้รูปแบบข้อมูลบน volume
- Build ผ่านและ targeted tests 18/18 ผ่าน รวม regression ทดสอบ merge ที่ใช้จริงใน browser script, polling ไม่เพิ่มรายการซ้ำ, และ API paging size=1 ที่คืน inbound/paused ครบทั้งคู่
- ตรวจ metadata cloud โดยไม่แสดงข้อความหรือ ID ลูกค้า พบ active human conversations=0 ณ ตอนตรวจ จึงยังยืนยันข้อความที่ผู้ใช้แจ้งเป็นรายรายการไม่ได้ ไม่อ้างว่าตรวจข้อมูลจริงครบ
- Snapshot ก่อนอัป `fafa6786-bb2e-4eb0-b797-06c91dd6f1de` ชื่อ `Before handover inbox display fix 2026-11-01` ตรวจพบใน backup list แล้ว
- ก่อนอัป `43bff015-059b-4dea-a6a2-8c7918315e54`; deployment ตัวแก้ `ece8dd32-1cb8-465b-be56-652551e2a7da` SUCCESS ใช้ source staging แบบ allowlist 94 ไฟล์ ตรง working tree ขณะอัป ไม่เปลี่ยน Variables/webhook/volume data
- หลังอัป SHA-256 `conversations-admin.js` และ `browse.js` ตรง build ที่ทดสอบแล้ว; health/auth/Origin/signature/Google start และ LINE Platform Verify ผ่าน endpoint เดิม active=true ไม่ส่งข้อความ LINE จากเครื่องมือ
- ผู้ใช้ต้อง refresh/login ใหม่เพื่อรับ browser script ใหม่ แล้วลองให้เจ้าหน้าที่รับช่วงและลูกค้าตอบกลับ ยังไม่ได้ตรวจด้วย session UI จริงของผู้ใช้หรือส่งข้อความแทนลูกค้า

## อัป grounded runtime และข้อมูลหลักสูตร — 1 พฤศจิกายน 2026 เวลาไทย

- ผู้ใช้สั่งอัปโค้ดล่าสุดไปปลายทางเดิม `MaiLinePvd / cbot-trial`, production; ก่อนอัป deployment `698c66e7-fe43-4fec-9f01-fe3278307bd3` SUCCESS
- Build ผ่าน, application tests 295/295 และ catalog import tests 11/11 ผ่าน เทสต์ HTTP ต้องรันนอก sandbox; importer ใช้ jsonschema ใน temp Python environment ไม่เปลี่ยน Python ระบบ
- Native snapshot ก่อนอัป `a1a324c3-923e-4e17-9a7c-b506c11a5bae`, `Before grounded runtime update 2026-11-01` ตรวจพบใน backup list แล้ว ไม่ได้ทดสอบ restore รอบนี้
- Staging allowlist 94 ไฟล์ตรง working tree รวม `src/course-catalog-data.json`; credential pattern scan ไม่พบ ไม่มี local runtime/.env; digest `6ebbc5c504ac6541fd7e474ab25c0901ed644c7e00e5144f6adf91e40c773d3b`
- Deployment ใหม่ `43bff015-059b-4dea-a6a2-8c7918315e54` SUCCESS, start `node dist/server.js`, healthcheck `/healthz`, หนึ่ง replica และ volume `/data` เดิม ไม่เปลี่ยน Variables หรือ webhook
- หลัง deploy cloud health/auth/Origin/signature/Google start และ LINE Platform Verify ผ่าน, endpoint ตรง cloud และ active=true; UI modes/server badge อยู่ครบ live=true
- เทียบ SHA-256 ไฟล์ build บน cloud กับ local 16 ไฟล์ตรงทั้งหมด รวม grounded runtime, core, customer-runtime และข้อมูลหลักสูตร JSON ไม่ได้ส่งข้อความ LINE หรือทดสอบคำตอบโมเดลจริงรอบนี้
- Source ปัจจุบันเลือก grounded ทั้ง LINE direct และกลุ่มตามโค้ดที่ผู้ใช้ปรับ; ข้อมูลและโหมดห้องใช้ volume เดิม ไม่ได้คัดลอกข้อมูล local หรือ commit/push GitHub

## อัปตัวแก้ชื่อ LINE รอบล่าสุด — 1 พฤศจิกายน 2026

ผู้ใช้ขออัป source ล่าสุดอีกครั้ง เปรียบเทียบกับ staging รอบก่อนพบ production change ที่ `admin.ts` และ `browse.ts`: ส่ง LineProfiles เข้าหน้ารายการแบบแบ่งหน้า คืน capability ของปุ่ม refresh และ refreshDue เฉพาะรายการที่เห็นกับลูกค้าที่เลือกโดยใช้ cache/backoff เดิม หน้าตั้งโหมดห้องยังอยู่ครบ

- Build local ผ่าน และ targeted tests 11/11 ผ่าน ครอบคลุม LINE profiles, browse/pagination, room-mode API และ cloud auth
- Snapshot ก่อนอัป `8c01acbb-f2d8-44c2-9eb8-5337ee3a3dcc` ชื่อ `Before LINE profile refresh update 2026-11-01` ตรวจพบใน native backup list แล้ว
- เวอร์ชันก่อนอัป `01f3cff1-0e3f-4cd3-b46c-6deed73c8ee9`; deployment ใหม่ `698c66e7-fe43-4fec-9f01-fe3278307bd3` SUCCESS, หนึ่ง replica, healthcheck `/healthz` ผ่าน และ start command ปกติ
- Staging 85 ไฟล์ตรง working tree ไม่มี `.env`/runtime local; source digest `bbeade9473f5e66b3e796c7c4b66873e44167f94ae94411b82d4c8ab6cfa6c9d` ตรวจ credential patterns ไม่พบ
- ตรวจ compiled code บน cloud 7 ไฟล์ตรง local build ทุกไฟล์ รวม admin/browse ที่เปลี่ยนและ UI โหมดห้อง ป้าย server ยังเป็นชื่อ cloud เดิม โหมด live เดิม
- ตรวจ cloud health/auth/Origin/signature/Google start และ LINE Platform Verify ผ่าน ไม่เปลี่ยน webhook; อ่าน metadata ห้องกลับพบโหมด `cbot` และประวัติยังอยู่ ไม่มีการแก้ข้อมูลห้องหรือคัดลอก runtime local ในรอบนี้

ให้ผู้ใช้รีเฟรช/login Google ใหม่แล้วลองหน้ารายชื่อลูกค้าเพื่อใช้ตัวแก้ดึงชื่อ LINE รอบนี้ ไม่ได้ไล่ refresh ชื่อลูกค้าจริงทุกรายจากเครื่องมือ ผลตรวจ deployed UI เป็น fixture rendering กับ code hash และ security checks เช่นเดิม ยังไม่ได้ commit งานค้าง

## อัป source หน้าตั้งโหมดห้อง 1 พฤศจิกายน 2026

ผู้ใช้อนุญาตให้อัป source ที่แก้และทดสอบบน local แล้วขึ้น cloud เดิม ตรวจ Main Dev ว่างานเสร็จและมีผลทดสอบ 246 รายการผ่าน; build ล่าสุดก่อน upload และ Docker build บน Railway ผ่าน ใช้ staging แบบ allowlist 85 ไฟล์ ไม่ส่ง `.env` หรือ runtime local

- ก่อนอัป: deployment `c129166c-b130-4c5e-a9e5-4b79c678f43a`; snapshot `ee474f51-dcb0-4347-892f-33f4be95a5fa` ชื่อ `Before room mode UI update 2026-11-01` ตรวจว่าปรากฏใน native backup list แล้ว
- หลังอัป: deployment `01f3cff1-0e3f-4cd3-b46c-6deed73c8ee9` SUCCESS, image `sha256:554c0367cf5833eb4c16b56abcc2342e49576d5f4624c1bed655f8c857dc9267`, หนึ่ง replica ใช้ volume เดิม
- Source staging digest `371b790674152e4b815449c663d8e534fa89e04cdfcf377a0f4479700974f935`; ตรวจ deployed compiled code 7 ไฟล์เทียบ local build ด้วย SHA-256 ตรงทุกไฟล์ รวม admin, room API/UI, group replies, server, browse และ navigation
- ตั้งเฉพาะค่าที่ไม่ลับ `SERVER_NAME=MaiLinePvd / cbot-trial`; อ่านกลับจาก container เป็นชื่อนี้และ environment `cloud · production` โหมด live ยังคงเดิม
- ตรวจ rendered admin fixture ใน container พบตัวเลือกโหมดรายห้อง ป้าย server และห้องใต้ลูกค้าและกลุ่มครบ ไม่สร้าง session ผู้ดูแลจริงหรือแก้โหมดห้องเพื่อทดสอบบนข้อมูลจริง
- ตรวจ cloud health/auth/Origin/signature/Google start และ LINE Platform Verify ผ่านหลัง deploy, webhook ยังตรง cloud/active=true, Channel cloud ต่างจาก local และไม่ได้แก้ webhook ในรอบนี้

ให้ผู้ใช้รีเฟรชและ login Google ใหม่ แล้วเข้า **ลูกค้าและกลุ่ม → ห้องกลุ่ม → ห้อง LINE** เลือกห้อง เลือกโหมด และกดบันทึก การเลือกเฉย ๆ ยังไม่เปลี่ยนค่าจริง การตั้งโหมดจำกัดผู้ดูแลระบบและเก็บแยกตาม server ตาม source ใหม่

ใช้ `scripts/verify-railway-room-ui.mjs PROJECT SERVICE ENV` ตรวจ deployed build และองค์ประกอบ UI แบบไม่เปลี่ยนข้อมูลจริง การตรวจ fixture rendering ไม่แทนการตรวจ session/UI ของผู้ใช้จริงหลังรีเฟรช งาน source และ pagination ที่ค้างยังไม่ได้ commit ไม่เปลี่ยน local runtime หรือคัดลอกสิทธิ์ห้องข้าม server

## สถานะล่าสุดก่อนผู้ใช้ลองทัก OA ใหม่

อัปเดตหลังผู้ใช้ทดสอบ: ผู้ใช้ยืนยันแชตเดี่ยวเรียบร้อยแล้ว พบว่าห้องกลุ่ม cloud ที่มีข้อความเข้าจริงยังเป็น `replyMode` ว่าง (อ่านอย่างเดียว) จึงสำรองและเปิด `cbot` เฉพาะห้อง key `c8969a431d95` ขณะ maintenance ตรวจว่าประวัติเดิมครบ คืนแอปด้วย deployment `c129166c-b130-4c5e-a9e5-4b79c678f43a` SUCCESS แล้ว ไม่เปลี่ยนห้องอื่น/local รอผู้ใช้ส่งข้อความกลุ่มใหม่เพื่อยืนยัน reply

1 พฤศจิกายน 2026: ผู้ใช้ยืนยัน Google login สำเร็จ ค่า Variables ครบแล้ว AI completion สั้นตอบ 200 และ LINE token ตอบ 200 ยืนยัน Channel cloud ต่างจาก local ตรวจ auth/Origin/signature บน cloud จริงและ LINE Platform Verify ผ่านก่อนเปลี่ยน webhook เฉพาะ Channel ใหม่ อ่านกลับ URL ตรงและ active=true

สำรอง cloud volume ขณะ maintenance ไม่เริ่ม app/worker แล้ว กู้คืนลงพื้นที่แยกผ่าน checksum 4 ไฟล์ และตรวจ store classes ผ่าน มี admin 1 บัญชี, customers/requests/monitor/news/queued/inflight = 0 ไม่ใช่หลักฐานรับโหลดหรือกู้ข้อมูลใช้งานจำนวนมาก ไม่ได้ทำ native Railway restore ทับ volume จริง

Native backup baseline ID `6fdce21f-ef7b-4038-a0da-41874ab32b14`, label `Cloud trial baseline 2026-11-01`; ตั้ง DAILY แล้วอ่านกลับ retention 518400 วินาที (6 วัน), cron `7 6 * * *` UTC หรือ 13:07 เวลาไทย Backup คิดพื้นที่ incremental ตาม [Backups](https://docs.railway.com/volumes/backups); ราคา volume ณ วันที่ตรวจ $0.15/GB/เดือนตาม [Pricing](https://docs.railway.com/pricing) ไม่ได้หมายความว่า backup ฟรี

Native schedule ไม่ประสาน transaction ข้าม JSON หลาย store จึงไม่แทน controlled offline backup ก่อนเปลี่ยนข้อมูลสำคัญ ก่อน restore ให้หยุด writer และตรวจคิว/ambiguous deliveries เสมอ สำเนาทดสอบอยู่ใน temp ส่วนตัว ไม่ใช่ backup ระยะยาวและห้าม commit ลง repo

คืนแอปปกติแล้ว เปิด `LINE_DRY_RUN=false`; deployment ล่าสุด `74e9f010-398e-414e-a6ba-2471b854f885` SUCCESS, หนึ่ง replica, `/healthz`, start `node dist/server.js` และ startup ยืนยัน allowlist พร้อม ตรวจ security/LINE Verify ซ้ำหลัง deploy ผ่าน ยังไม่ได้ส่งข้อความ LINE จากเครื่องมือ รอผู้ใช้ทัก OA ใหม่เพื่อยืนยัน reply จริง

เครื่องมือ: `check-railway-trial.mjs PROJECT SERVICE ENV --live` ตรวจค่าล่าสุดโดยไม่แสดงค่าลับ, `probe-railway-trial.mjs` ตรวจ LINE แบบ GET และ AI หนึ่งคำขอสั้น, `connect-railway-line.mjs check` ตรวจ auth/signature/LINE Verify โดยไม่แก้ webhook ส่วน `connect` บังคับ Channel แยกจาก local และ dry run ก่อนเปลี่ยน URL

`railway-trial-maintenance.mjs enter|exit PROJECT SERVICE ENV PREPARED_SOURCE_ROOT` ใช้เฉพาะ staging แบบ allowlist ต้องตรวจ health body เป็น Maintenance ก่อน copy ข้อมูล และตรวจ JSON health ok=true กับ startup ปกติหลังออก API startCommand=null ไม่ได้ล้างค่าเดิม จึงระบุ `node dist/server.js` ชัดเจนและอ่านกลับก่อน deploy

รายละเอียดด้านล่างบันทึกขั้นตอนและหลักฐานระหว่างเตรียมระบบ; สถานะล่าสุดด้านบนแทนข้อความเก่าเรื่องยังขาด key หรือยังไม่ได้เปิด webhook

ข้อตกลง 1 พฤศจิกายน 2026: JSON บน volume เดียว, หนึ่ง instance/replica, LINE Channel ใหม่แยกจาก local ผู้ใช้ยืนยันสร้าง `MaiLinePvd` ใหม่ใน `toche7's Projects` แล้ว สร้าง project/service/volume/domain และตั้งเฉพาะค่าที่ไม่ลับสำเร็จ deploy image บน Railway แบบ dry run สำเร็จแล้ว ยังไม่ได้เปิด/เปลี่ยน webhook

## ปลายทางที่ตรวจยืนยันแล้ว

| ทรัพยากร | ชื่อ / ID |
|---|---|
| Workspace | `toche7's Projects` / `6e5df89f-6e2e-4a5b-8e53-09eb1ccd58c1` |
| Project | `MaiLinePvd` / `347e9ef6-6dd1-4486-a542-87b0abdbe38f` |
| Environment | `production` / `c51a6a9d-df30-479e-9ad7-9208ff40a1c9` (ค่าเริ่มต้นของ project ใหม่) |
| Service | `cbot-trial` / `35ad7863-6f53-4d41-bd09-2e54c19bb931` |
| Volume | `cbot-trial-volume` / `5d5548e4-603f-48ab-85e9-640b306a314a`, mount `/data`, state `READY` |
| Domain | `https://cbot-trial-production.up.railway.app`, target port `8080` |

Deployment `97926946-dbfb-418e-9cdc-bd28a4a30a8f` สถานะ `SUCCESS`, image digest `sha256:09330b005d9669ed87bdaccef3e23ef66cb7e475a675514501057d4bf8d8380d`; source มาจาก staging ที่เลือกไฟล์ ไม่ได้เชื่อม GitHub auto deploy และไม่ได้นำข้อมูลปฏิบัติงาน local เข้า volume

ตรวจ HTTPS จริงแล้ว: `/healthz` 200 `{ok:true}`, `/` 200 หน้า Google login, `/api/customers` 401, `/auth/google/start` 303 ไป accounts.google.com พร้อม Secure/HttpOnly cookie ทดสอบ `service restart` แล้ว startup log ยืนยัน dry run ยังเปิดอยู่ กลับมา health 200 และ API 401 โดย volume เดิมยังมี marker/โฟลเดอร์ข้อมูล ยังไม่ได้ทดสอบ Google callback จนครบ session/role ของบัญชีจริง

ตั้ง service ผ่าน API แล้วอ่านกลับยืนยัน: healthcheck `/healthz`, timeout 120, 1 replica, grace 35s, overlap 0, retry max 3, sleep=false (ภูมิภาค Singapore 1 replica) ต้องตรวจการใช้ healthcheck ใน deployment ถัดไปอีกครั้ง เพราะ deployment แรกเริ่มจากค่าบริการเดิม

ตั้งแล้วโดย `--skip-deploys`: `DEPLOYMENT_MODE`, `DATA_ROOT`, `PORT`, `LINE_DRY_RUN`, `PUBLIC_BASE_URL`, `GOOGLE_REDIRECT_URI` ผู้ใช้เพิ่มค่า LINE และ Google/bootstrap admin แล้ว ตรวจว่ามีค่าครบแต่ยังไม่ยืนยันกับ API/login จริง เหลือ `GROQ_API_KEY`; ต้อง register Google callback และทดลอง login จริง

ตรวจค่าที่ขาดโดยไม่พิมพ์ค่า Variables:

```sh
node scripts/check-railway-trial.mjs 347e9ef6-6dd1-4486-a542-87b0abdbe38f 35ad7863-6f53-4d41-bd09-2e54c19bb931 c51a6a9d-df30-479e-9ad7-9208ff40a1c9
```

สคริปต์ตรวจเพียงการมีค่า/ค่าตั้งต้นที่ตรง ไม่ได้ยืนยันว่า credentials ใช้ได้จริงหรือแยกจาก local; sealed variable แสดงเฉพาะการมีชื่อ ต้องทดสอบกับ application หลัง deploy อีกครั้ง

## ค่าที่ต้องตั้งใน Railway Variables

อย่านำ `.env` local ขึ้นไปทั้งไฟล์ ห้ามส่งค่าลับผ่านแชตหรือใส่ Git ค่าในตารางเป็นชื่อ/ตัวอย่างเท่านั้น

| ตัวแปร | ค่า/จุดประสงค์ |
|---|---|
| `DEPLOYMENT_MODE` | `cloud` |
| `DATA_ROOT` | `/data` ตรงกับ mount path ของ volume ใหม่ |
| `PUBLIC_BASE_URL` | HTTPS origin ของ cloud เช่น `https://<domain>` ไม่มี path |
| `PORT` | ใช้ค่าที่ Railway กำหนด ไม่ใช้พอร์ต local |
| `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | ชุดใหม่ของ Channel cloud เท่านั้น |
| `LINE_ALLOWED_USER_IDS` | ID ผู้ทดลองที่ตรวจจาก Channel ใหม่ คั่นด้วย comma |
| `LINE_DRY_RUN` | เริ่ม `true`; เปลี่ยน `false` หลังผ่านเกณฑ์และมี token/allowlist |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client สำหรับ cloud เก็บ secret ใน Variables |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_BASE_URL}/auth/google/callback` โดยแทนค่าเป็น URL จริง |
| `ADMIN_BOOTSTRAP_EMAIL` | อีเมล Google ผู้ดูแลเริ่มต้นของ cloud |
| `PI_PROVIDER`, `PI_MODEL`, `PI_TIMEOUT_MS` | เลือกคู่ที่มีใน SDK; provider credential ตั้งแยก เช่น `GROQ_API_KEY` |

ไม่ต้องตั้ง `HOST` หรือ `MONITOR_PORT` สำหรับ cloud; มีเพียง listener เดียว Cloud บังคับ Google config และ bootstrap email ก่อนเริ่ม ไม่มีหลังบ้านแบบ local fallback

## โค้ดและขอบเขตข้อมูล

- `Dockerfile` build TypeScript ด้วย Node 22 แล้วเริ่ม `node dist/server.js` โดยตรง ให้ Node รับ SIGTERM; ไม่อ่าน `.env` ใน image
- `.dockerignore` อนุญาตเฉพาะ source และ build manifests; final image คัดลอกเฉพาะ dependencies กับ `dist` ไม่มี local runtime, research หรือ secrets
- `railway.json` บันทึกค่าที่ต้องการ แต่เอกสารล่าสุดระบุ Config as Code ใช้ต่อได้เฉพาะ legacy service และ service ใหม่ไม่สามารถ opt in จึงตั้งค่าบริการจริงผ่าน API และอ่านกลับยืนยันแทน ก่อน deploy ถัดไปตรวจ service settings/regional replicas ทุกครั้ง; หากจะใช้ IaC ให้ย้ายไป `.railway/railway.ts` พร้อม plan ที่รักษา Variables/volume เดิม ดู [Config as Code](https://docs.railway.com/config-as-code) และ [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)
- ข้อมูลถาวร: `/data/runtime/**`, `/data/.line-memory/**`, `/data/.line-monitor/**`; SDK `.pi-runtime` เป็น cache ชั่วคราว ไม่ใช่ที่เก็บบัญชีหรือบทสนทนา (credentials รับจาก environment; sessions อยู่ใน memory)
- `/data/cloud-channel.json` ผูก volume กับ Channel ใหม่ หากไม่พบ marker แต่พบ runtime/ความจำเดิมจะปฏิเสธ startup; เปลี่ยน Channel บน volume เดิมก็ปฏิเสธ ห้ามสร้าง marker เพื่อข้ามข้อจำกัด
- เริ่ม staff, customers, LINE admissions, groups, requests, chats, consent และ news queue ใหม่ทั้งหมด ไม่ย้ายงานส่งค้าง local
- หลักสูตร/ความรู้สาธารณะที่ compile ใน source มาพร้อม image; ต้องทบทวนความเป็นปัจจุบันก่อนทดลองจริง หากต้องการความรู้เพิ่มเติมให้นำเข้าเฉพาะข้อความ/หลักฐานที่ตรวจแล้วผ่านหลังบ้าน ไม่คัดลอก knowledge/settings JSON ทั้งชุดพร้อมประวัติและ actor

## เส้นทางและการตรวจสิทธิ์

Public มีเฉพาะ `/webhook/line` (ยังตรวจ LINE signature), `/news-media/*` (เฉพาะภาพข่าวที่ยืนยันแล้ว), `/healthz` และ `/health` (สถานะ `{ok}` ไม่มีข้อมูลภายใน) ที่เหลือเข้า StaffAuth

StaffAuth ตรวจ exact Host จาก HTTPS callback ที่ตั้งไว้ ไม่เชื่อ `X-Forwarded-Host`/Origin; ตรวจ Origin/Fetch Metadata, session, POST CSRF, permission และ recheck บัญชีหลังอ่าน body เหมือนเดิม Cookies มี HttpOnly, SameSite=Lax และ Secure บน HTTPS callback ส่วน callback ยังผูก state/nonce/PKCE กับ browser

หลังผ่าน StaffAuth เท่านั้นจะแปลง metadata คำขอภายในให้ handler หลังบ้านเดิมที่จำกัด local รับต่อได้ โดยไม่เปิดพอร์ตภายในเพิ่มและยังตรวจ token เฉพาะ panel ตัว adapter ไม่ใช้ forwarded headers หรือ client เป็นหลักฐาน login

## ลำดับเปิดใช้จริง

1. ตรวจ project `MaiLinePvd` ให้ได้ ID/workspace/environment หรือสร้างใหม่หลังผู้ใช้ยืนยัน; ถ้าชื่อซ้ำหรือมีหลาย environment ให้ยืนยันปลายทางที่กำกวมก่อนเขียนข้อมูล
2. ตรวจ service เดิม/source root/ค่าใช้จ่าย/สิทธิ์ volume และ backup ของบัญชี สร้าง cloud trial service + volume ใหม่ที่ `/data` ในปลายทางที่ตรวจแล้ว โดยไม่ attach ข้อมูล local
3. ตรวจ image build จริงบน Docker/Railway ใช้ `node scripts/prepare-railway-source.mjs` สร้าง staging ที่มีเฉพาะ source/build manifests เพราะ working tree มี pagination ที่ยัง uncommitted; ห้ามอัปโหลด repo ทั้งโฟลเดอร์พร้อมไฟล์ ignored Deploy staging ด้วย explicit project/service/environment และ `--path-as-root`; อย่าใช้ `railway up --new` หรือ defaults เพื่อข้ามการตรวจปลายทาง
4. สร้าง HTTPS domain แล้วตั้ง Variables และ Google authorized redirect URI ให้ตรง domain; หากใช้ OAuth consent testing ให้เพิ่มอีเมลผู้ทดลองตาม Google configuration จริง อย่าเปลี่ยน callback local
5. Deploy dry run ก่อน ตรวจ `/healthz`, login Google จริง, bootstrap admin และบทบาท staff/content/admin รวมถึงการปฏิเสธบัญชีที่ไม่อนุมัติ คำขอข้าม Origin และ token ผิด
6. ตรวจว่า cloud volume มีแต่ข้อมูลของ Channel ใหม่; เพิ่มสิทธิ์ LINE ID ใหม่แบบตรวจตัวตน ทดสอบส่ง event พร้อม signature, FAQ/หลักสูตร/คำขอ/ความจำ/รูปข่าว/คิวจำลอง ไม่สร้างข่าวจริงโดยอัตโนมัติ
7. บันทึกค่าจำนวน records/ไฟล์ + ตัวอย่าง record ของ cloud, restart แล้ว redeploy ตรวจข้อมูล/สิทธิ์/สื่อยังครบ Sessions จะต้อง login ใหม่หลัง restart ซึ่งเป็นพฤติกรรมตั้งใจ
8. ทดสอบ backup/restore และ rollback ตามด้านล่างก่อนเปิดกลุ่ม เมื่อครบจึงตั้ง webhook **Channel ใหม่เท่านั้น** เป็น `${PUBLIC_BASE_URL}/webhook/line`, ตรวจ Verify/เหตุการณ์จริง และค่อยปิด dry run ด้วย allowlist ใหม่
9. ทดลองตอบจริงและส่งข่าวเฉพาะผู้ทดลองที่ยินยอม โดยต้อง review/confirm ข่าวแต่ละรายการ ตรวจการยกเลิกและการไม่ส่งซ้ำ Local ยังคง Channel และ webhook เดิม

Railway mount volume เฉพาะตอนรัน ไม่ใช่ build/pre-deploy; deployment ที่มี volume อาจมี downtime จึงไม่ควรสัญญา zero downtime ดู [Volumes](https://docs.railway.com/volumes) และ [Healthchecks](https://docs.railway.com/deployments/healthchecks) ซึ่งระบุด้วยว่า healthcheck ไม่ใช่ continuous monitoring

## Backup / restore / rollback

เครื่องมือ `scripts/trial-backup.mjs` ใช้กับสำเนา cloud data root ที่ **หยุดทุก writer แล้ว** เท่านั้น `--offline` เป็นคำรับรองของผู้ปฏิบัติงาน ไม่ได้สั่งหยุด service ให้เอง ตัวอย่าง path ด้านล่างเป็นพื้นที่ maintenance/ทดสอบที่ต้องเลือกจริง ไม่ใช่ข้อมูล local

```sh
node scripts/trial-backup.mjs backup /path/to/offline-cloud-data /path/to/new-backup --offline
node scripts/trial-backup.mjs restore /path/to/new-backup /path/to/new-restore-root --offline
node --test scripts/trial-backup.test.mjs
```

Backup เก็บ manifest จำนวนไฟล์ ขนาด และ SHA-256, restore ตรวจทุกไฟล์ก่อนสร้างปลายทาง ปฏิเสธ target เดิม, path traversal, symlinks และ lock/temp files หาก backup ล้มเหลวให้ถือว่าสำเนายังไม่สมบูรณ์ ไม่ใช้กู้ข้อมูล; checksums ตรวจความเสียหาย ไม่ใช่ลายเซ็นป้องกันผู้แก้ทั้ง manifest กับข้อมูล สำเนามีข้อมูลส่วนบุคคล ให้เก็บในพื้นที่จำกัดสิทธิ์นอก Git และนอก volume ต้นฉบับ

บน Railway เลือกวิธี export/maintenance หลังตรวจสิทธิ์จริง หยุดรับ event ของ Channel cloud, หยุด service และ worker แล้วจึง snapshot/download; ไม่ใช้ `railway run` บนเครื่องแล้วเข้าใจว่า mount volume อยู่ด้วย ไม่ทำ snapshot ของหลาย JSON ขณะมีการเขียนข้าม store แล้วอ้างว่าสอดคล้องกัน

ทดสอบ restore ในพื้นที่แยก เปรียบเทียบ inventory/hash/จำนวน records เปิดอ่านและ login/ค้นข้อมูลโดยไม่เปิด webhook และไม่ส่งข่าวจริง ห้ามเปิดสำเนาที่มีคิวเก่าเป็น live worker ของ Channel เดิมพร้อมตัวจริง สำหรับ application drill ใช้ข้อมูลทดสอบที่ไม่มี queued/inflight; สำเนาข่าวจริงต้องตรวจ delivery/retry keys และสถานะ ambiguous ก่อนเริ่ม worker เพราะ restore จุดเก่าอาจนำ pending delivery กลับมา

Railway native backup เป็นอีกทางเลือก ตรวจราคา/ข้อจำกัดจริงก่อนเปิด schedule; restore สร้าง volume ใหม่ที่ mount เดิมพร้อม staged deployment และเก็บ volume เก่าไว้แบบ unmounted จึงต้องตรวจ staged changes ก่อน Deploy ([Backups](https://docs.railway.com/volumes/backups)) ยังไม่ได้ตั้ง schedule หรือทำ Railway restore จริงในงานนี้

หยุด/ย้อน cloud: ปิด webhook ของ Channel ใหม่และหยุด service ก่อน ห้ามชี้ Channel local มารับแทน เก็บ volume เดิมไว้; ถ้า rollback เฉพาะโค้ด ให้ตรวจ schema compatibility แล้ว deploy image เดิมบน volume เดิม ถ้าข้อมูลเสีย ให้กู้ลงพื้นที่ใหม่และตรวจตามข้างต้นก่อนสลับกลับ ห้าม wipe volume

Process-lifetime memory/news-worker locks ของ cloud อยู่ใน ephemeral `/tmp` เพื่อไม่ให้ PID ซ้ำหลังเปลี่ยน container ทำให้ restart ติดล็อก จึงต้องรักษาหนึ่ง container/volume ตามข้อจำกัด Railway การทดสอบใน repo ตรวจ graceful restart; ยังไม่ยืนยัน crash/redeploy ของ container จริง หากพบ transaction `.write-lock`/`*.lock`/`.tmp` ค้างบน volume หลัง crash ให้หยุด service เก็บสำเนาทั้งชุดและตรวจไฟล์ก่อนกู้ ห้ามลบ lock ขณะมี writer หรือ retry คิวข่าวโดยไม่ตรวจสถานะ

## หลักฐานและงานที่ยังเหลือ

มี tests สำหรับ HTTPS config/volume channel binding, cloud auth + API จริงพร้อม permission/CSRF/Host-Origin, signed webhook + graceful process restart, backup exact inventory/checksum และการปฏิเสธไฟล์อันตราย รัน `npm run build`, `npm test`, `node --test scripts/trial-backup.test.mjs`

ผลตรวจ 1 พฤศจิกายน 2026: build ผ่าน, application tests 243/243, backup tests 2/2; source staging 85 ไฟล์ตรงกับ working tree ตาม SHA-256 และไม่มี `.env`/runtime local รวมแก้บั๊กเวลาอนุมัติข่าวที่อ่าน clock สองครั้งแล้วทำให้ expiry interval ไม่ตรง validator พร้อม regression test แบบ clock เดินทุกครั้ง

Image build/deploy จริงและ graceful Railway restart ผ่านแล้ว ยังต้องทดสอบ volume data แบบมี records, redeploy/crash recovery, Google login/roles จนครบ, LINE/AI credentials ของจริง, backup/restore บนบัญชีปลายทาง และ quota/ค่าใช้จ่าย ก่อนเปิดกลุ่มทดลอง ห้ามใช้ผล unit/fixture tests แทนหลักฐาน deploy หรือการส่ง LINE จริง
