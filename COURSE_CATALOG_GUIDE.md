# ค้นหลักสูตร CBTU จาก snapshot

สถานะ 23 ตุลาคม 2026: เชื่อม 19 หลักสูตร + 1 bundle เข้ากับ CustomerCore เดียวกันสำหรับ Terminal/LINE ตามการอนุญาตของเจ้าของ ไม่มี vector DB หรือ dependency ใหม่ ไม่ใช้ข้อมูล Notion/ผู้เรียนจริง ไม่เปลี่ยนคีย์ โมเดล OA หรือ tunnel

## แหล่งข้อมูลและการนำเข้า

อ่าน `research/cbtu-website/courses.json`, `SOURCE_REPORT.md` และ `validation.json` แบบ read-only ตรวจ JSON/counts, IDs/URLs ไม่ซ้ำ, canonical HTTPS ของ cbtumu.net, provenance/capture time/hash, source refs, flags/missing fields และ offer/availability verified=false ตรงกับรายงาน 19 courses + 1 bundle มีหน้ารายละเอียดล็อก 1 รายการ

Research มีสถานะ `research_for_owner_review_not_runtime_ingestion` อยู่ตามเดิม เจ้าของอนุญาตให้เชื่อมเฉพาะ public metadata snapshot นี้แล้ว จึงสร้าง projection แยกที่ `src/course-catalog.ts` พร้อมสถานะการนำเข้าและ SHA256 ของ source/report/validation ไม่แก้ collector หรือไฟล์ research และไม่ถือว่าข้อขัดแย้งได้รับการแก้ ไม่ได้นำ review_required/payment accounts หรือข้อมูล cohort เว็บย่อยที่ยังไม่ยืนยันเข้าบอต

Source SHA256 ของชุดที่นำเข้า: `b9b683a2710a86e99622149182c25c926359c01d79ad2236262915934c7f2dca`

Snapshot เก็บชื่อ/URL/description/topics/outcomes/audience/prerequisites/format/duration/dates/instructors/price/enrollment/certificate พร้อม field_sources, source_refs, retrieved_at, HTML hash, flags และ missing_fields ไม่แปลง null เป็นฟรี/ไม่มีเงื่อนไข ไม่อ่านหรือ bypass หน้าที่ล็อก ราคาที่แสดงไม่ใช่ราคา checkout ปัจจุบัน และ Add to Cart/Enroll Now ไม่ยืนยันเปิดรับสมัคร

หากเจ้าของอนุญาต refresh ชุดวิจัยใหม่แล้ว ให้ทบทวน report/validation/conflicts ก่อนรัน:

```sh
node scripts/import-course-catalog.mjs
npm run build
npm test
```

คำสั่ง import ไม่ fetch เว็บ ไม่แก้ research และไม่รันอัตโนมัติเมื่อมีคนเปลี่ยน source การ build ปกติใช้ projection ที่ commit แล้ว ไม่ต้องมี research อยู่ใน deployment การทดสอบ structural ไม่แทนการทบทวนความถูกต้องเนื้อหาโดยเจ้าของ

## วิธีค้นหาและตอบ

1. ตรวจว่าข้อความเป็นคำถามหลักสูตร/การเลือกเรียน ชื่อหรือ alias ที่ชัดเจน หรือ follow-up ของรายการก่อนหน้า ข้อความคุยเล่น/บอกชื่อและสนใจทั่วไปยังเข้า dialogue/profile ตามเดิม ไม่ตัด dialogue เพียงเพราะมีคำ AI/Data
2. Normalize ไทย/อังกฤษโดยคงสระและวรรณยุกต์ จับชื่อเต็มก่อน alias ที่อยู่ซ้อนกัน จากนั้น rank ชื่อ (6), topics (3), description/audience/outcomes (1) ต่อคำที่ตรง ใช้ Thai word segmentation และคำเชื่อมความหมายจำกัด เช่น วิเคราะห์ข้อมูล→data
3. Aliases เป็นคำค้นที่ช่วยอ้างชื่อ เช่น Excel/เอ็กเซล, Canva/แคนวา, n8n, DSE, MDS10 ไม่อ้างว่าเป็นรหัสทางการ n8n และ Basic Prompt Engineering ที่มีหลายรายการจะถามเลือกก่อน ไม่รวมคนละรุ่น
4. เลือกไม่เกิน 3 รายการที่เกี่ยวข้อง เมื่อมีผลชัดเจนส่งเฉพาะ metadata ของ candidates นั้นให้โมเดลเลือก ID/เรียงรายการ การเปรียบเทียบต้องเลือกสองรายการ ถ้าไม่ชัดเจนถามเพิ่ม ไม่ส่ง catalog ทั้ง 20 รายการในทุก prompt ประวัติ turn เก่ายังคงอยู่ภายใต้ bounded memory/compaction เดิม
5. โมเดลคืนเฉพาะ IDs ที่อยู่ใน candidates โค้ดตรวจ subset/จำนวน/ID ซ้ำ แล้ว render ข้อเท็จจริงและ citations จาก snapshot เท่านั้น ไม่ใช้ราคาหรือรายละเอียดที่โมเดลแต่ง `lastTopic` เก็บ IDs ตามลำดับที่แสดงจริง เพื่อให้ “อันแรก/อันที่สอง/แล้วราคาล่ะ” ตรงกับคำตอบก่อนหน้าและคงข้าม restart ได้
6. ถ้าไม่รู้จะเรียนอะไร ถามความสนใจและเป้าหมายก่อน ถ้าถามตามความสนใจที่เคยบอก ใช้เฉพาะ profile ของ identity นั้นเป็นคำค้น ไม่พบตอบว่าไม่พบในชุดนี้ ไม่อ้างว่าไม่มีจริง กรณีข้อมูลราคา/พื้นฐาน/ระยะเวลาขาด แจ้งว่าไม่พบพร้อมแหล่งและช่องทางเจ้าหน้าที่

คำตอบมี URL/capture time ต่อรายการ พร้อมข้อความว่าเป็น snapshot ไม่ใช่ราคา/การเปิดรับสมัครสด รายการวันเก่า/cohort จบแล้ว/ข้อขัดแย้ง/หน้า protected แสดงข้อจำกัดโดยไม่สรุปแทนเจ้าของ ไม่ infer รุ่นใหม่หรือประกันสิทธิ์เข้าเรียน/ใบประกาศ

คำถามไม่พบ/ต้องเลือกชื่อ/ถามความสนใจ ตอบด้วย host โดยไม่เรียกโมเดล เมื่อโมเดลเลือก IDs ไม่สำเร็จ/429/timeout จะใช้ ranked host facts ที่มี provenance แทน พร้อม log `catalog_model_fallback` แบบไม่เก็บ raw error; 429 ตั้ง cooldown เดิมและไม่ยิงโมเดลซ้ำระหว่างรอ ไม่ได้แก้ข้อจำกัดโควตาของ provider

FAQ เรื่องชำระ/ใบเสร็จ/เข้าสู่ระบบ/ติดต่อเจ้าหน้าที่และ mock DEMO order ยังใช้กติกาเดิม Memory stores ของ Terminal/LINE แยกกันตาม MEMORY_GUIDE.md ไม่มีการย้ายหรือลบข้อมูลเพื่อทดสอบ

## ผลตรวจ

- Build/tests 27 รายการผ่าน รวม 5 กรณีที่ตกลง: ยังไม่รู้จะเรียนอะไร→ถามความสนใจ→ค้นจริง, เปรียบเทียบสองหลักสูตร, ราคา null ไม่แต่ง/แนะนำติดต่อ, หลักสูตรไม่พบไม่สร้างขึ้น และเสนอทางเลือกจากรายการจริงอย่างสุภาพ
- ครอบคลุม alias/ชื่อกำกวม/รุ่นที่ไม่มีใน snapshot, topic search, follow-up/ลำดับที่โมเดลเรียง, ป้องกัน ID นอก retrieval/ข้อเท็จจริงแต่ง, flags/null/protected/provenance, 429 fallback/cooldown รวม FAQ/dialogue/Terminal และ LINE persistent memory regression
- Signed LINE mock ใช้ core retrieval เดียวกัน เปรียบเทียบ Excel/Canva พร้อมแหล่งอ้างอิงและข้อความไม่เกิน LINE limit; HTTP loopback health200/invalid401/signed200/dedupeหนึ่ง mockreply ผ่าน ไม่มีส่ง LINE จริงจาก tests
- Live core/model หนึ่งคำถาม Excel/Canva ผ่าน มีสอง sources/caveat และไม่มี model fallback ใช้ fixture identity/RAM ไม่แตะ memory จริง
- หลัง restart DemoB1 ใช้ tunnel/webhook เดิม public signature checks และ LINE Verify ผ่าน active=true ผู้ใช้ยืนยันรับคำตอบเปรียบเทียบสองหลักสูตรพร้อมลิงก์ใน LINE แล้ว log `ok`552ms → `replied` ไม่ใช้ push หรือ reply token เก่า

ข้อจำกัด: lexical retrieval/alias ไม่เข้าใจทุกคำพ้องหรือภาษาพูด การเปรียบเทียบครั้งละสองรายการและ candidates สูงสุดสามรายการอาจต้องถามเพิ่ม ชุดนี้ครอบคลุมรายการ Home ที่สำรวจ ณ วันเก็บ ไม่ใช่ทุกหลักสูตรในอดีต/ระบบภายใน ไม่มี live enrollment/checkout หรือการรับรองราคาใหม่และวันเปิดรุ่นใหม่
