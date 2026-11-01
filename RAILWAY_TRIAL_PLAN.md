# Railway: ระบบทดลองโดยคงไฟล์เดิม

ข้อตกลง 1 พฤศจิกายน 2026: ใช้ไฟล์ JSON บน persistent volume ก่อน แยกการย้าย PostgreSQL เป็นงานภายหลัง เริ่มหนึ่ง instance/หนึ่ง replica ไม่เปิดหลายตัวเขียนไฟล์ชุดเดียวกัน

## แยก LINE Channel สำหรับคลาวด์

ผู้ใช้เลือกสร้าง/ใช้ LINE Channel อีกตัวสำหรับ cloud trial โดย local คง Channel เดิม ไม่สลับ webhook ของ Channel เดิมไปคลาวด์

- Cloud ใช้ Channel ID, Secret, Access Token, webhook URL และรายชื่ออนุญาตของตัวเอง เก็บค่าลับใน Railway Variables
- Cloud ใช้ volume และทะเบียนเจ้าหน้าที่/ลูกค้าแยก ห้ามคัดลอก runtime ทั้งชุดจาก local ไปใช้โดยตรง เพราะหลาย store ผูกกับ Channel เดิม
- เริ่มข้อมูลผู้ใช้/สิทธิ์/คำขอ/แชต/คิวส่งข่าวของ Channel ใหม่เป็นชุดใหม่ ไม่ย้ายงานส่งค้างจาก local
- ความรู้บอต หลักสูตร และการตั้งค่าที่ไม่เป็นความลับสามารถพิจารณานำเข้าแบบเลือกเฉพาะรายการ หลังตรวจการอ้างอิง Channel/ตัวตนแล้ว
- การแยก Channel ไม่ใช่การยืนยันว่า LINE user ID จาก Channel เดิมใช้ซ้ำได้ ต้องตรวจตัวตนและเพิ่มสิทธิ์ผู้ทดลองของ Channel ใหม่
- Local กับ cloud ทำงานพร้อมกันได้เมื่อแต่ละตัวใช้ Channel, webhook, ข้อมูล และ worker ของตัวเอง

## ต้องเตรียมก่อนเปิดใช้

- โหมด `DEPLOYMENT_MODE=cloud` รวม runtime, ความจำ LINE, monitor และสื่อส่งข่าวไว้ใต้ `DATA_ROOT=/data`; local ที่ไม่ตั้งค่านี้ใช้เส้นทางเดิม
- โหมด cloud รวม webhook/admin บน `0.0.0.0:$PORT` พร้อม `/healthz`; local ยังแยกพอร์ตและจำกัด loopback
- รักษา Google login, role checks, CSRF และ Host/Origin validation ไม่เปิด admin สาธารณะโดยข้ามมาตรการเดิม
- ตั้ง Google callback สำหรับโดเมนคลาวด์แยกจาก local; เก็บ secrets ใน Railway Variables ไม่ใส่ Git
- ตั้ง backup และทดลอง restore ลงพื้นที่แยก; ตรวจสิทธิ์แพ็กเกจ/ค่าใช้จ่ายจริงก่อนเลือกวิธี
- เริ่ม volume cloud ว่าง ไม่คัดลอกข้อมูลปฏิบัติงาน local; การสำรอง/กู้ข้อมูล cloud ต้องหยุดเขียน ตรวจจำนวน/ความครบถ้วน และทดสอบ restart/redeploy ก่อนเปิด webhook ของ Channel ใหม่
- ไม่ย้ายคิวส่งข่าวเดิม และไม่ให้สอง instance รับ Channel เดียวกัน; local คงทำงานกับ Channel เดิมได้ เก็บแนวทางหยุด/ย้อน deployment ของ cloud แยกต่างหาก

## เกณฑ์ผ่าน

FAQ/หลักสูตร/คำขอ/ความจำทำงานผ่าน LINE; หลังบ้านล็อกอินได้ตามสิทธิ์; restart/redeploy ข้อมูลไม่หาย; ทดสอบกู้คืนได้; webhook ใช้ HTTPS คงที่; ไม่มี secret ใน Git/log; ไม่มีสอง instance ใช้ข้อมูลเดียวกัน

## สถานะ

รอบล่าสุด: ผู้ใช้ขออัป code แก้ดึงชื่อ LINE เพิ่มจากรอบหน้าโหมดห้องแล้ว Build และ targeted tests 11/11 ผ่าน มี snapshot ก่อนอัป deployment `698c66e7-fe43-4fec-9f01-fe3278307bd3` SUCCESS ตรวจ code hash ของไฟล์สำคัญบน cloud ตรง local build, health/auth/signature/LINE Verify ผ่าน และโหมดห้องเดิมยังอยู่ ใช้ volume/config เดิม ไม่เปลี่ยน webhook/local runtime รายละเอียดหัวข้ออัปตัวแก้ชื่อ LINE ใน RAILWAY_RUNBOOK.md

อัปเดตล่าสุด 1 พฤศจิกายน 2026: อัป source ใหม่จาก Main Dev ที่ผู้ใช้ทดสอบ local แล้วสำเร็จ deployment `01f3cff1-0e3f-4cd3-b46c-6deed73c8ee9` SUCCESS มี UI เลือกโหมดห้องและป้ายชื่อ server บน cloud แล้ว ตรวจ compiled code 7 ไฟล์ตรง local build, health/auth/signature/LINE Verify ผ่าน และใช้ข้อมูล volume เดิม ตั้ง `SERVER_NAME` เป็นชื่อ project/service จริง มี snapshot ก่อนอัปแล้ว รายละเอียดในหัวข้ออัป source ของ RAILWAY_RUNBOOK.md ผู้ใช้ต้องรีเฟรช/login ใหม่เพื่อใช้หน้าเว็บเวอร์ชันล่าสุด

ผู้ใช้ยืนยันให้สร้าง `MaiLinePvd` ใหม่ใน `toche7's Projects` แล้ว สร้าง project `347e9ef6-6dd1-4486-a542-87b0abdbe38f`, service `cbot-trial` และ volume ใหม่ที่ `/data` สำเร็จใน environment `production` ที่ Railway สร้างให้ ตรวจยืนยัน volume `/data`, domain port 8080 และ deployment `97926946-dbfb-418e-9cdc-bd28a4a30a8f` สถานะ `SUCCESS` แล้ว

เตรียมโค้ด cloud routing, data paths, HTTPS Google callback, Secure cookies, channel binding, Docker build context แบบเลือกไฟล์, Railway config และเครื่องมือ backup/restore แล้ว รายละเอียดเปิดใช้และสิ่งที่ยังต้องทดสอบอยู่ใน [RAILWAY_RUNBOOK.md](RAILWAY_RUNBOOK.md)

Variables ล่าสุดครบแล้ว รวม AI key ตรวจโดยไม่แสดงค่าลับ ผู้ใช้ยืนยัน Google login สำเร็จ LINE token ตอบ 200 และ AI completion ทดสอบสั้นตอบสำเร็จ เปรียบเทียบใน memory ยืนยัน Channel cloud ต่างจาก local

Build/deploy/restart/redeploy จริงผ่านแล้ว ตรวจ HTTPS health, API 401, cross-Origin 403, unsigned webhook 401, signed empty webhook 200 และ Google Secure/HttpOnly cookie ผ่าน ให้ LINE Platform Verify ผ่านก่อนตั้ง webhook ของ Channel ใหม่เป็น `https://cbot-trial-production.up.railway.app/webhook/line`; อ่านกลับ URL ตรงและ active=true โดยไม่เปลี่ยน Channel local

ทดสอบ backup ขณะ maintenance หยุด app/worker แล้ว: ดาวน์โหลด cloud volume ลงพื้นที่ส่วนตัว สำรอง/กู้คืน 4 ไฟล์ checksum ตรง และเปิดอ่าน store กลับได้ ผู้ดูแล 1 บัญชี ไม่มีลูกค้า/คำขอ/แชต/ข่าวหรือคิวค้าง ยังไม่ได้ทดสอบ native Railway restore หรือข้อมูลใช้งานปริมาณมาก

ตั้ง native DAILY backup (retention 6 วัน) และ baseline snapshot แล้ว คืนแอปปกติ เปิด `LINE_DRY_RUN=false` เฉพาะ cloud และ deploy ล่าสุด `74e9f010-398e-414e-a6ba-2471b854f885` SUCCESS: หนึ่ง replica, health `/healthz`, start `node dist/server.js`; startup ยืนยัน allowlist พร้อม

ผู้ใช้ยืนยันแชตเดี่ยวใช้งานเรียบร้อยแล้ว และ startup log มี direct reply สำเร็จ ตรวจปัญหากลุ่มพบห้อง cloud เดียวมีข้อความเข้าแต่ยังเป็นอ่านอย่างเดียว จึงเปิด `cbot` เฉพาะห้องนั้นขณะ maintenance พร้อม backup และตรวจว่าประวัติครบ ยังรอผู้ใช้ลองข้อความกลุ่มใหม่เพื่อยืนยัน reply จริง ไม่มีการส่งข้อความ LINE จากเครื่องมือ

ตั้ง service healthcheck `/healthz`, timeout 120, 1 replica, grace 35s, overlap 0, retries 3 และไม่ sleep ผ่าน API แล้วอ่านกลับยืนยัน ค่าใน `railway.json` ไม่ควรใช้เป็นหลักฐานว่า service รับ config จริง เพราะ Config as Code ถูกเลิกใช้กับ service ใหม่ตามเอกสารล่าสุด ต้องตรวจ service settings/API และผล deploy ทุกครั้ง

ผลตรวจใน repo: `npm run build` ผ่าน, `npm test` ผ่าน 243/243, backup/restore tests ผ่าน 2/2 รวม graceful cloud process restart และ security fixtures; source staging ตรวจ hash ตรงกับ working tree 85 ไฟล์ โดยไม่มี `.env`/runtime local งาน pagination เดิมยังอยู่และยังไม่ได้ commit
