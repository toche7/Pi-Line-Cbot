# ตรวจปัญหา catalog จากบทสนทนา LINE จริง

วันที่ตรวจ 23 ตุลาคม 2026 เฉพาะ identity ของผู้ทดสอบคนแรกใน LINE allowlist ของ OA ที่ตั้งอยู่ ไม่อ่าน records คนอื่น ไม่บันทึกชื่อส่วนตัว/user ID/token หรือสำเนา store ลง Git

## ขอบเขตหลักฐาน

อ่าน record ปัจจุบันแบบ read-only พบ recent 7 คู่, summary.notes 12 รายการ และ compactions 3 ครั้ง ข้อความ recent ที่เกี่ยวกับปัญหาอยู่ช่วงประมาณ 20:44–20:46 น. Asia/Bangkok อัปเดตล่าสุด 20:46:13 น. ส่วน summary เป็นข้อความย่อจาก turn เก่าซึ่งไม่มีคำตอบเต็มทุกข้อ ไม่ใช่ประวัติ LINE ทั้งหมด ไม่มี API ดึงแชตย้อนหลังทั้งหมดในงานนี้

Store บันทึก successful core turns จึงอาจมีคำตอบที่ส่งสำเร็จแต่ตอบไม่ตรงคำถาม ส่วน turn ที่ core ล้มก่อนบันทึกไม่มี question/answer เต็มอยู่ใน store Log ที่อ่านเพิ่มพบ model_format 2 ครั้งและ core_failure 1 ครั้งพร้อม replied_fallback แต่ไม่มีเนื้อหาคำถามใน log จึงจับคู่ error แต่ละครั้งกับคำถามเฉพาะไม่ได้ ไม่สรุปว่าเป็นโควตา/network/key โดยไม่มีหลักฐาน

## สิ่งที่พบจริง

- หลัง “มีหลักสูตร ai อะไรบ้าง” บอตแสดง 3 รายการแล้วถามให้เลือก ทั้งที่เป็นคำขอรายการ ไม่ได้ต้องเลือกวิชาเดียว
- “ขอราคาแต่ละตัวด้วย” กลับได้ “ยังไม่พบหลักสูตรที่ตรง…” ทั้งที่เพิ่งแสดงรายการไปและ snapshot มี price/null ของแต่ละรายการ
- “อ้าวตอบราคาไม่ได้เหรอ” และ “ทำไมตรวจสอบราคาไม่ได้ละ” กลับไปข้อความ FAQ ทั่วไปว่าไม่ได้ตรวจราคาแบบสด แทนการแสดงราคา snapshot ที่มีพร้อมข้อจำกัด
- “มีทัั้งหดมกี่หลักสูตร” ได้ not_found ทั้งที่ metadata นับได้ 19 หลักสูตร + 1 bundle
- Summary ยังกล่าวถึง “เขียนสรุปกระชับหน่อย”, “list หลักสูตร ai”, “prompt”, “ขอดูมากกว่า 5 ได้ไหม”, “ทำได้แค่ 3 เองเหรอ”, “3 ก็ได้”, “data”, “อะไรแพงที่สุด”, “ดูราคาได้ไหม” คำตอบเก่าบางข้อไม่อยู่แล้ว จึงใช้เป็น regression questions โดยไม่อ้างว่ารู้คำตอบเดิมครบ

## สาเหตุและการแก้

ระบบเดิมเก็บ lastTopic เพียง IDs ของ 3 candidates/รายการที่แสดงและล้างหัวข้อเมื่อคุยเรื่องอื่น ไม่แยก full match set กับ page ที่แสดง การค้นหลายรายการถูกตีความเป็นชื่อกำกวม และไม่มี operation สำหรับ count/list/paging/sort-price/summary บาง follow-up จึงหลุดไป FAQ หรือ dialogue และบางข้อความเข้า JSON model failure

เพิ่ม query engine ที่มีชนิดคำสั่งจำกัด `list/count/price/sort_price/more/summary` และ scope `all/previous/search` ให้ host ประมวลผลข้อมูลจริง ข้อความภาษาพูดที่กฎทั่วไปยังตีความไม่ได้ให้โมเดลคืน operation plan แล้ว validate ก่อน execute ไม่ให้โมเดลแต่งข้อเท็จจริงหรืออ้างว่าจำกัด catalog 3 วิชา

เก็บ catalog context แบบ bounded ใน memory ของ identity เดิม: matched IDs สูงสุด20, shown IDs, offset/page size, filter query ที่กรองข้อมูลลับ และรูปแบบการแสดง แยกจาก lastTopic ของ FAQ/คุยเล่น จึงยังถามราคา/รายการต่อหลังคุยเล่นหรือ compaction/restart ได้ `/reset` และ `/forget` ล้าง catalog context ด้วยเหมือน session pending ไม่เก็บข้ามผู้ใช้/OA/ช่องทาง

รายการ browse แบ่งหน้าได้ครั้งละ1–10 ไม่ใช่ hard cap3 ส่วน metadata ที่ส่งให้โมเดลสำหรับเลือกวิชายังคงเฉพาะ candidates ที่เกี่ยวข้อง รายการราคาอ้างถึง shown set ก่อนหน้า; การนับ/ดูต่อใช้ full match set; การเปลี่ยน filter ต้องมีชื่อ/หัวข้อใหม่ชัดเจน ไม่ให้คำกริยาในคำถามบังเอิญเปลี่ยนไปวิชาอื่น เรียงราคาเฉพาะค่าที่มีและแจ้งจำนวนรายการที่ราคา null แยกต่างหาก

Records เก่าที่ไม่มี catalog context กู้เฉพาะ IDs/URL ที่ถูกต้องจาก rendered recent ของ identity เดียวกันเมื่อมี turn ใหม่ ไม่ไปอ่าน user อื่นหรือแก้ไฟล์ก่อนผู้ใช้โต้ตอบ ไม่แก้ research snapshot/.env/โมเดล/LINE OA/tunnel หรือความจำ Terminal

## ผลตรวจรุ่นแก้

- Build/tests32รายการผ่าน รวม replay คำถามจริงต่อเนื่อง, ทดสอบตัวอย่าง paraphrase ผ่าน semantic operation, แยก all/previous/search, count19+bundle1, more-than5/pagingครบ20, ราคา null, ราคาแพงสุด, summary, mixed chat/compaction/persist/restart/reset/forget และ isolation เดิม
- Signed LINE mock replay คำถามรายการ AI → ราคาแต่ละตัว → จำนวนทั้งหมด ตอบได้และไม่ส่งซ้ำเมื่อ event เดิมมาอีก Local HTTP mock health200/invalid401/signed200/dedupeหนึ่ง reply ผ่าน
- Minimal live core/model ใช้ fixture RAM หนึ่งคำถามภาษาพูดหลังเตรียม context ด้วย host queries สำเร็จ โมเดลขอรายการต่อจาก AI match set12รายการ และ host แสดงอีก9รายการที่เหลือภายใน LINE limit ไม่ส่ง LINE จริงจาก script และไม่ใช้ข้อมูลส่วนตัว
- Server รุ่นใหม่ restart แล้วใช้ store/webhook/tunnel เดิม public health/signature/LINE Verify ผ่าน active=true ผล incoming จริงหลังแก้อยู่ใน LINE_SETUP.md
- ผู้ใช้ทดสอบรายการ AI → ราคาแต่ละตัวใน LINE แล้วและยืนยัน ok Logปกติทั้งสองturn (26/11ms) ตรวจmetadataล่าสุดเฉพาะidentityเดิมพบว่าคำถามตรงกับชุดทดสอบ คำตอบราคาเป็นsnapshotและURLsหลักสูตรตรงกับรายการก่อนหน้าทุกตัว contextเก็บmatched12/shown3 โดยไม่พิมพ์ค่าidentity/ชื่อส่วนตัว

ยังไม่มีราคา/รายละเอียดที่ขาดจากต้นฉบับเพิ่มขึ้น: null ยังคงไม่พบ ไม่ถือว่าฟรี หน้าล็อก/วันเก่า/ต่าง cohort/ความขัดแย้งยังต้องยืนยัน ราคาที่แสดงเป็น snapshot ไม่ใช่ข้อเสนอปัจจุบัน การแก้ operation/context ไม่รับประกันว่าโมเดลไม่มี 429/timeout/JSON failure อีก และไม่แทนการทดสอบภาษาพูดทุกแบบ
