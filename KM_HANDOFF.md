# KM integration handoff — 28 ตุลาคม 2026

**อัปเดตล่าสุด: ตั้งค่าการตอบพัฒนาครบและเปิด runtime แล้ว ดู RESPONSE_SETTINGS_GUIDE.md (tests132/132/import9/9)** ค่า active ยังเป็น initial เดิม รอเจ้าของลอง/ตรวจ/ยืนยันค่าใหม่เอง

**ประวัติช่วงเปลี่ยนเมนู ก่อนพัฒนาตั้งค่าจริง: เปิด runtime และตรวจหน้า “จัดการบอต” แล้ว** ตั้งค่าการตอบอยู่บน/ความรู้บอตอยู่ล่างเป็น section ไม่ใช่แท็บย่อย; หน้าตั้งค่าอ่านอย่างเดียว ดูรายละเอียดรอบล่าสุดใน KM_GUIDE.md ข้อมูลด้านล่างเป็นประวัติจุดส่งต่อครั้งแรก ไม่ใช่สถานะรอรีสตาร์ตปัจจุบัน

**KM source integration + QA เสร็จ หยุดแก้ src/admin.ts/src/server.ts และพร้อมให้ผู้รวมงานรีสตาร์ตแล้ว** งานนี้ไม่ได้รีสตาร์ตเองเพราะพบแชตส่งข่าว active เตรียมเปิดบริการเฉพาะข่าวที่เจ้าของอนุญาต ไม่ส่งข้อความข้ามแชต

ไฟล์ร่วมล่าสุดมี KM ครบแล้ว: admin เพิ่ม knowledgeStyle/Body/Script + optional KnowledgeStore argument หลัง news + /api/knowledge; มี nav KM แยกจากห้าแท็บเดิม; server configureKnowledge(new KnowledgeStore(runtime/knowledge)) ก่อนสร้าง core และส่ง store เข้า adminHandler อย่าเขียนทับสิ่งนี้ตอน wire news transport/worker

ไฟล์ KM ใหม่: knowledge-store.ts, knowledge-seed.ts, knowledge-api.ts, knowledge-admin.ts, knowledge.test.ts, knowledge-api.test.ts; knowledge.ts ใช้ active store แทน array; dialogue.ts เพิ่ม published topic IDs ทุก turn; main.ts bind store เดียวกันสำหรับ Terminal ไม่แก้ core.ts/line.ts/โมดูลลูกค้า/ส่งข่าว/งานรอดูแล

ผลล่าสุด npm build ผ่าน / npm test 116/116 ผ่าน / import 9/9 ผ่าน; browser temp ผ่านทั้ง FAQ create/edit/diff/review/explicit publish/rollback/reload/stale tabs/HTML-as-text/course evidence/mobile ดู KM_GUIDE.md

สถานะ runtime ตอนตรวจ: node PID8116 ผ่าน npm PID8103 cwd pi-sdk-demo, loopback3000/3001, dryRun=false, allowlist1; ไม่เปิดเผยหรือเปลี่ยน credentials ค่าปัจจุบันต้องตรวจซ้ำก่อน restart พบข่าวจริงกำลังทำงานร่วมกับผู้ใช้จากแชตส่งข่าว จึงอย่ากล่าวอ้าง hash ข้อมูลทุกตัวคงเดิมหากผู้ใช้แก้ระหว่างนี้

หลังผู้รวมงานต่อข่าวและ restart: ตรวจ /health200, GET /api/knowledge200 มี healthy=true/active=seed/revision=0, FAQ9/courses20, KM nav กับ5แท็บเดิม; ตรวจUIแบบอ่านเท่านั้น ห้ามสร้างหรือเผยแพร่ FAQ ทดสอบใน runtime จริง ไม่ต้องส่ง LINE เพื่อทดสอบ KM ไม่แตะ generated catalog/research/validator

KM_GUIDE.md ระบุชัดว่ายังไม่เปิด runtime ในรอบนี้ ผู้รวมงานควรอัปเดตหลักฐานหลังเปิดจริง และรวมสถานะเข้า CUSTOMER_AGENT_PLAN.md/README/MONITOR_GUIDE.md ภายหลัง หลีกเลี่ยงเขียนไฟล์คู่มือร่วมพร้อมกัน

รายการอัปเดตแผน: KM แยกเมนู, FAQ draft/review/publish/rollback จริงทุกเส้นทาง, revision+digest, local actor, source safety/last-good, courseอ่านอย่างเดียวพร้อมหลักฐาน; แยก code/tests/temp UI ผ่านจาก runtime/LINE E2E
