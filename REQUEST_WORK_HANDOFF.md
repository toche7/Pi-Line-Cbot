# ส่งต่องานรอดูแล — 28 ตุลาคม 2026

ส่วนงานรอดูแลพัฒนาและ integrate แล้วใน working tree: `src/request-work.ts`, `src/requests-admin.ts`, testsสองไฟล์ และ `scripts/request-work-ui.test.mjs` คู่มือใน COURSE_REQUESTS_GUIDE.md

ตรวจแชตบทสนทนา01a18279-527f-77e2-a667-6a688403d5a1 idle ก่อนแก้ src/admin.ts โดยอ่านฉบับล่าสุดและเพิ่มเพียง:

1. ส่ง token เดิมให้ requestsAdminHandler(requests, token) เพื่อให้ POST งานใช้เว็บเดิม3001
2. ใส่ listener admin-open-customer ภายใน customerScript closure ผ่าน replace anchor `refresh();setInterval(` เพื่อเลือก selected=customerId, view=profile แล้ว fetchState/render โดยไม่แตะไฟล์ customers-admin.ts ที่ห้ามแก้
3. listenerเดียวกันใน tab controller เพื่อเปลี่ยนไปแท็บcustomers ปุ่มบทสนทนาใช้ admin-open-conversation ของเดิม ไม่เปิดhandover

ต้องคงสามจุดนี้เมื่อรวมส่งข่าว ไม่เขียนทับ src/admin.ts ทั้งไฟล์จากสำเนาก่อนงานนี้ ไม่ต้องเพิ่ม argument ให้ server.ts เพราะ handlerสร้าง work storeเป็น siblingของ course-requests ที่ runtime/request-work อยู่แล้ว

ไม่มีการแก้ server.ts, conversations-*, conversation-control, core, line, customers*, line-profile, CUSTOMER_AGENT_PLAN, README หรือ config จากงานนี้ ไม่มี commit/push/restart

Buildผ่าน npm test101/101 และ browser request-work/customer/conversation ผ่าน ณ รอบตรวจล่าสุด ทุก writeทดสอบใน temp; ไม่มีส่งLINEจริง ภาพตรวจอยู่ design/request-work

ยังไม่เปิดใช้ serverจริง: พบแชต “ซีบอต — ส่งข่าว”01a18282-2e24-7c71-a36d-1b2b89a600e8 activeและรอรวมตอนตรวจ จึงหยุดก่อน restartตามเงื่อนไขไม่รบกวน sharedserver ให้ผู้รวมขั้นสุดท้ายตรวจ working tree/build/tests/UI ล่าสุดก่อน restartร่วมครั้งเดียวและตรวจจริงแบบอ่าน ไม่สร้างคำขอ/โน้ตตัวอย่างในstoreจริง

ข้อจำกัดสำคัญ: ไม่มีlogin actorเป็น localActorเดิม assigneeเป็นป้ายภายใน; สถานะใบคำขอimmutableคงpending_team/not_selected; งานกำพร้าถูกซ่อนและล้างครั้งต่อไปที่ตรวจstoreหลังforget/expiry ไม่ใช่transactionเดียวกับforget ไม่มีบันทึกข้อมูลกลับเข้าคำขอเดิม

รายการอัปเดตแผน/READMEที่ผู้รวมควรทำ: งานรอดูแลค้น/กรอง/รับงาน/มอบหมาย/สถานะ/บันทึก/timeline/นำทางพัฒนาแล้ว ผลทดสอบตามข้างต้น แยกสถานะintegratedจากเปิดใช้จริงหลังrestart และคงข้อจำกัดactor/forget/immutable/no-dispatch อย่าอ้างLINE E2Eจากผลtemp/browser
