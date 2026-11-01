# Google Login และสิทธิ์เจ้าหน้าที่ซีบอต

วันที่ 1 พฤศจิกายน 2026 · เชื่อมหน้าเว็บและ API บน local server แล้ว ล็อกอินบัญชีผู้ดูแล Google จริงถึงหน้า overview ผ่านแล้วหลังแก้ cross-site redirect

## ผลตรวจล่าสุด: แก้การกลับจาก Google ถูกปฏิเสธ

ตรวจรอบก่อนส่ง GitHub หลังแก้ครบ: Build ผ่าน, full runtime232/232, ngrok6/6 และ catalog-import9/9 ผ่าน หลักฐานใน `test-evidence/2026-11-01-staff/` ผล231/231และtargeted12/12ที่บันทึกถัดไปเป็นรอบก่อนหน้าตามลำดับการแก้

เจ้าของบัญชีอนุญาต Google แล้ว callback ผูก subject และสร้าง session จริงได้ แต่ browser คง Sec-Fetch-Site=cross-site ตลอดสาย redirect ทำให้กลับหน้าแรกเจอ403 แก้เฉพาะ GET / ที่ไม่มี query และมี Sec-Fetch-Mode=navigate, Sec-Fetch-Dest=document ยังคงปฏิเสธ Origin อื่น, iframe, subresource, ทุก API และ POST ข้ามเว็บไซต์ ไม่ผ่อน session/CSRF/role

Build และ targeted12/12ผ่าน รวม regression raw HTTP metadata กรณีหน้าแรกที่อนุญาตกับ API/frame/subresource/POST/Originอื่นที่ต้องปฏิเสธ รีสตาร์ต server แล้ว ตรวจ Google flow จริงถึงหน้า overview ด้วยบทบาทผู้ดูแลระบบและเปิดหน้าแรกใหม่ด้วย session เดิมผ่านแล้ว ไม่ส่ง LINE หรือเปลี่ยนโมเดล หลักฐานหน้าจอจริงเก็บเฉพาะส่วนหัวใน /tmp ไม่เข้า Git บัญชีจริงของบทบาทอื่นยังไม่ได้ทดสอบ ใช้ fixture สำหรับตารางสิทธิ์

อ้างอิงพฤติกรรม redirect: [W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/#redirects)

ข้อความรอ consent ในบันทึกรอบก่อนด้านล่างเป็นประวัติก่อนผลตรวจล่าสุดนี้

## ความคืบหน้ารอบนี้

เพิ่ม `src/google-login.ts` ใช้ google-auth-library ของ Google แลก code และตรวจ ID token พร้อม state/nonce/PKCE, flow ใช้ครั้งเดียว 5 นาที, session อายุ 8 ชั่วโมงที่เก็บใน RAM และตรวจสถานะบัญชีใหม่ทุกครั้ง เพิ่ม `src/staff-policy.ts` กำหนดสามบทบาทและสิทธิ์เสริมแบบปฏิเสธโดยปริยาย Build และ targeted tests 6/6 ผ่านด้วย fixture โดยไม่เรียก Google หรือส่ง LINE

เพิ่ม `staff-store.ts`, `staff-auth.ts`, `staff-context.ts` และ `staff-admin.ts` เชื่อม HTTP start/callback/session/logout/me บัญชีเจ้าหน้าที่ถาวร และ permission gate ครอบทุกเส้นทางของ adminHandler ที่ใช้ใน server จริงแล้ว Session อยู่ใน RAM อายุ 8 ชั่วโมง cookie HttpOnly/SameSite=Lax/host-only สำหรับ HTTP loopback ปัจจุบัน รีสตาร์ตต้องล็อกอินใหม่ บัญชีและสิทธิ์ไม่หาย

หน้า “จัดการบอต” เปลี่ยนเป็น “ตั้งค่า” เมื่อเปิดใช้ auth มีเมนูย่อยความรู้บอต ตั้งค่า AI สถานะระบบ ผู้ใช้และสิทธิ์ ตามบทบาท ไม่นำ markup/ตัวโหลดข้อมูลของส่วนที่ไม่มีสิทธิ์ใส่หน้า บันทึก actor ที่ยืนยันแล้วใน workflow เดิมและ audit การเรียก API ไม่รับบทบาทหรือ actor ที่ client อ้างเอง

บัญชีรอผูก Google อยู่ใน `runtime/staff/accounts.json` ซึ่ง Git ignore จำกัดไฟล์ 0600 ใช้ lock/atomic rename ตรวจ revision และรักษาผู้ดูแลระบบที่ผูก Googleแล้วอย่างน้อยหนึ่งคน ผู้ดูแลเพิ่มอีเมล/เปลี่ยนบทบาท/ปิดบัญชี/มอบสิทธิ์เสริมในหน้าเว็บได้ ไม่มีการส่งเมลอัตโนมัติ การปิดบัญชีและเปลี่ยนบทบาทตรวจใหม่ทุก request รวมหลังอ่าน upload จบ ไม่รอหมด session บัญชี Google ที่ไม่ได้อยู่ในรายชื่อไม่เข้าหลังบ้าน

หากไม่มี GOOGLE_* ทั้งชุดและยังไม่มี registry จะคง local legacy mode สำหรับ entrypoint/fixture เดิม หากเคยมี registry แล้ว config หาย server จะไม่เริ่มในโหมดไม่มี auth ถ้า config ขาดบางค่าหรือ callback ไม่ตรง admin port ก็ไม่เริ่ม ห้ามแก้ config เพื่อ bypass login

## Google Cloud ที่ตั้งแล้ว

เจ้าของเลือกโปรเจกต์ **CBot** (`cbot-d5561`) ตั้ง Google Auth Platform ชื่อ **CBot Care Center** แบบ External/testing โดยเจ้าของยอมรับนโยบาย Google เอง จากนั้นอนุมัติสร้าง Web application client **CBot Care Center Local Admin** และตรวจพบในรายการ Clients แล้ววันที่ 1 พฤศจิกายน 2026

Redirect URI: `http://127.0.0.1:3001/auth/google/callback` ไม่มี JavaScript origin เพิ่ม และไม่เปิดโหมด AI-powered agent สำหรับ client นี้ ข้อมูล Client ID/Secret และ redirect บันทึกใน `.env` ที่ Git ignore และจำกัดสิทธิ์ 0600 พร้อมอีเมล bootstrap เฉพาะเครื่อง ตรวจ googleLoginConfig ผ่านแล้ว ไม่บันทึกค่ารับรองลงเอกสารหรือ Git

ตรวจไปถึงหน้าขออนุญาต Google จริงแล้ว เห็น scope ชื่อ/รูปโปรไฟล์และอีเมล ยังไม่ได้กด Continue แทนเจ้าของบัญชี จึงยังไม่อ้างว่าผ่าน callback/สร้าง session ของบัญชีจริง หาก state หมดอายุให้เริ่มที่หน้าแรกอีกครั้ง เมื่อ deploy cloud ให้สร้าง OAuth Client แยกและใช้ callback HTTPS ของ admin hosting จริง คงตัว local สำหรับพัฒนาต่อ และต้องออกแบบ Secure cookies/proxy/host policy สำหรับ hosting เพิ่ม ไม่ใช้ config local นี้เปิดบริการสาธารณะ

## ผลตรวจและการเปิดใช้

- Build ผ่าน และ full runtime suite 231/231 ผ่าน หลังแก้ย่อยเรื่องคงผู้ดูแลที่ผูก Google และ recheck หลัง upload: build + targeted auth/role/actor 12/12 ผ่าน ไม่รัน full ซ้ำจากการแก้ย่อยเหล่านั้น
- ngrok 6/6 และ catalog-import 9/9 ผ่านก่อนการแก้ย่อย auth ซึ่งไม่แตะส่วนเหล่านั้น
- Browser fixture: login จำลอง, ผู้ดูแลระบบเห็นครบ 4 ส่วน, ผู้ดูแลเนื้อหาเห็นเฉพาะความรู้, เจ้าหน้าที่ไม่มีเมนูตั้งค่า/ส่งข่าวที่ไม่ได้รับสิทธิ์, เพิ่มบัญชีผู้ดูแลเนื้อหาและโหลดกลับได้, mobile viewport 390 ไม่มี horizontal overflow (document width 375 <= viewport 390)
- รีสตาร์ตเฉพาะ server เดิมแล้ว: webhook health 200, หน้า admin 200 เป็นหน้า Google login ไม่มี CUSTOMER_CSRF_TOKEN และ API หลัก 9 เส้นทางตอบ 401 เมื่อไม่ส่ง session คง ngrok/model settings/LINE allowlist เดิม ไม่ส่งข้อความหรือเรียกโมเดลเพื่อทดสอบ
- ยังไม่ยืนยัน Google callback ของบัญชีจริงจนกว่าเจ้าของจะอนุญาตที่หน้าขอ consent ไม่ถือว่าผ่านเพียงเห็นหน้า Google
- npm audit พบรายงานเดิม 3 รายการในสาย pi-coding-agent/minimatch/undici ไม่พบ advisory ชี้ Google auth ที่เพิ่มในรอบนี้ ไม่รัน audit fix หรืออัปเกรดส่วนอื่นอัตโนมัติ

วิธีใช้งาน: เปิด `http://127.0.0.1:3001/` → เข้าสู่ระบบด้วย Google → ใช้บัญชีผู้ดูแลที่ระบุใน config → ยืนยันหน้าของ Google → ตั้งค่า → ผู้ใช้และสิทธิ์ เพื่อเพิ่มเจ้าหน้าที่ การเปลี่ยน model/เผยแพร่ความรู้/ส่งข่าวยังมีขั้นยืนยันเดิมตามสิทธิ์ การเปิดหน้าล็อกอินไม่เปลี่ยนค่าบอต

## ข้อตกลง

ใช้ Google ยืนยันตัวตนเท่านั้น ซีบอตกำหนดสิทธิ์สามบทบาทเอง: เจ้าหน้าที่ ผู้ดูแลเนื้อหา ผู้ดูแลระบบ ลูกค้า LINE ไม่ใช่บัญชีเจ้าหน้าที่ ห้ามให้ผู้ที่ล็อกอินด้วย Google สำเร็จเข้าถึงข้อมูลโดยอัตโนมัติ

## สิ่งที่ต้องตั้งใน Google Cloud

1. ใช้โปรเจกต์ Google Cloud ที่เจ้าของดูแล แล้วตั้ง Google Auth Platform: Branding, Audience และ OAuth client
2. ประเภท OAuth client เป็น Web application สำหรับ local admin server
3. เส้นทาง callback ที่เสนอสำหรับพัฒนา: `http://127.0.0.1:3001/auth/google/callback` ต้องตรงกับ redirect URI ในแอปทุกตัวอักษร เส้นทางนี้ยังไม่ได้ implement
4. ขอเฉพาะ scope `openid email profile` ไม่ขอ Gmail, Drive หรือสิทธิ์ส่ง LINE
5. หากใช้ audience แบบ External ในโหมดทดสอบ ให้เพิ่มบัญชีทดสอบที่จำเป็นใน Google Cloud หากเลือก Internal ต้องเป็นองค์กร Google Workspace ที่รองรับและตรงกับทีมจริง ไม่สมมติ domain ขององค์กร
6. เก็บ Client ID และ Client Secret ใน config เครื่องที่ Git ignore เช่น `.env` ห้ามส่ง Client Secret ในแชตหรือใส่ frontend
7. กำหนดอีเมลผู้ดูแลคนแรกผ่านการตั้งค่าเครื่องอย่างชัดเจน และผูก Google subject หลังตรวจ token สำเร็จ ไม่ใช้กติกา “คนแรกที่ล็อกอินได้เป็นแอดมิน”

การใช้งานผ่านเครื่องอื่นในอนาคตต้องออกแบบ admin hosting/HTTPS และ redirect URI แยก ไม่เปิดพอร์ต 3001 ผ่าน ngrok ของ webhook เพื่อให้ Google login ใช้ได้

## เกณฑ์ฝั่งโค้ดและข้อจำกัดที่ต้องรักษา

- Authorization-code flow ฝั่ง server มี state ที่ผูกกับ browser, nonce, PKCE, อายุจำกัดและใช้ครั้งเดียว
- ตรวจ ID token ด้วยไลบรารีที่รองรับ รวมลายเซ็น issuer audience expiry nonce และ verified email ไม่เชื่อข้อมูลจาก browser โดยตรง ไม่ใช้ tokeninfo debugging endpoint เป็น production verifier
- บัญชี Google ไม่อยู่ในรายชื่อเจ้าหน้าที่หรือถูกปิดต้องถูกปฏิเสธ แม้ยืนยันตัวตนกับ Google ผ่าน
- ใช้ session cookie HttpOnly, SameSite และ Secure เมื่อใช้ HTTPS จำกัดอายุ ออกจากระบบและเพิกถอน session ได้
- ตรวจบทบาทและสิทธิ์ทุก API ที่ server รักษา localhost/Host/Origin/CSRF เดิม หน้าเว็บต้องไม่โหลดข้อมูลที่ผู้ใช้ไม่มีสิทธิ์
- ยืนยันด้วย fixture ก่อนทดสอบ Google จริง และไม่เปลี่ยนการทำงาน LINE/โมเดล/ข้อมูล runtime จริงในระหว่างพัฒนา

เอกสารอ้างอิงหลัก: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
