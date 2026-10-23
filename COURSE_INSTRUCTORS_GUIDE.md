# วิทยากรจากหลักฐานสาธารณะ schema 1.1.0

นำเข้า 23 ตุลาคม 2026 จาก source SHA256 `9c2f2098b34a147808eac29835c3eddad8238e56995a43e76f8ff9d8ec7c4cac` ตรงกับ `validation_report.json` และไฟล์ `versions/<SHA>/courses.json` ไม่แก้ไฟล์ research ตัว collector ยังเป็น curated manifest 19 หลักสูตร + 1 Bundle ไม่ใช่ general crawler

Research validator รายงาน 35 tests ผ่าน, 0 errors, 26 warnings Runtime ใช้ projection แยกใน `src/course-catalog.ts` พร้อม schemaVersion/hash/warnings และเก็บ instructors, instructor_evidence, provenance, field_sources, source_refs, flags, missing_fields, raw/parsed dates และ legacy instructors_text ไม่เปลี่ยน null เป็นคำรับรอง

## หลักฐานที่ใช้ตอบ

ใช้เฉพาะ structured instructors ที่มีหลักฐานชื่อภายใต้หัวข้อผู้สอน/วิทยากรบนหน้าหลักสูตร หรือชื่อผู้สอนหลักสูตรย่อยที่ Bundle ระบุชัด พร้อม URL/excerpt/เวลาที่เก็บ/HTML hash ไม่ใช้ author, listing By หรือ legacy instructors_text เพื่อสร้างรายชื่อผู้สอน

ยืนยันได้ 14 หลักสูตร + Bundle 1 ชุด อีก 5 หลักสูตรคืน null และแจ้งว่ายังไม่พบหลักฐานชื่อผู้สอนที่ยืนยันได้:

- AI Agent Workshop with n8n (`cbtu-10`)
- AI for All (`cbtu-14`)
- Data Analyst Level 4 รุ่นที่ 4 (`cbtu-17`)
- Basic Prompt Engineering (Update) (`cbtu-18`, หน้ารายละเอียดล็อก)
- Basic Prompt Engineering (`cbtu-19`)

Excel อ้างหลักฐานผู้สอนที่ระบุใน Bundle โดยตรง Canva ใช้ชื่อจากหน้าเดี่ยว และแสดงข้อควรตรวจว่ารูปแบบชื่อใน Bundle ต่างกัน ไม่รวมชื่อเป็นบุคคลเดียวกันอัตโนมัติ ไม่สร้าง alias บุคคลหรือแปลชื่ออังกฤษจาก author เอง

## เส้นทางคำถาม

โมเดลเลือก read fields และ scope ตามความหมาย แล้ว host ตรวจ schema และอ่านข้อมูล คำถามต่อที่เปลี่ยนหลักสูตร เช่น “แล้ว Canva ล่ะ” ใช้ lastReadFields เดิมและค้นหลักสูตรใหม่ ไม่แสดงชื่อผู้สอนจากหลักสูตรก่อน

เพิ่ม generic public-field filters เช่น `filters:[{field:"instructors",value:"ทวีศักดิ์"}]` สำหรับ list/count/read/price โดยจำกัด whitelist เดียวกับ reader ไม่รับ arbitrary key/path ข้อความ filter ใช้ชื่อที่ต้องการค้น ไม่ใช่คำเรียกสนทนาหรือคำสั่ง สำหรับชื่อที่ตรวจพบใน structured index เส้นทางค้นเดิมใช้ชุด match จากหลักฐานได้ด้วย ไม่เพิ่ม regex รายชื่อบุคคลเฉพาะราย ชุดผลค้นยังใช้ราคา/จำนวน/ดูต่อได้โดยคง matched/shown context

ค้น “ทวีศักดิ์” ในข้อมูลปัจจุบันพบ 10 หลักสูตร + 1 Bundle แสดงครั้งละ3และดูต่อได้ ไม่รวมหลักสูตรที่มีเพียงชื่อ By การ match อาศัยข้อความและ Thai segmentation ไม่ใช่ person identity resolver จึงไม่รับรองคำสะกดทุกแบบหรือรวมชื่อสองรูปแบบว่าเป็นบุคคลเดียวกัน

## ข้อควรตรวจจาก warnings

คงคำเตือนวันเรียนเก่า/รุ่นจบ/คนละรุ่น, program hub และรอบที่ยังไม่ยืนยัน, price/availability unverified, เนื้อหาที่เรียบเรียงเดิมต้องทบทวน, Requirements NSN/n8n, รูปแบบชื่อ Canva, ระยะเวลา Bundle และหน้าที่ล็อก คำตอบแสดงข้อควรตรวจที่เกี่ยวกับข้อมูลที่ถามอย่างกระชับ ไม่ส่งทั้ง26warningsซ้ำทุกครั้ง ไม่อนุมานราคาใหม่ วันเปิดรุ่นใหม่ หรือผู้สอนจากข้อความที่กำกวม

## ผลตรวจสำหรับรุ่นนี้

- Build และ runtime regression tests39รายการผ่าน รวม signed LINE mock, เปลี่ยน Excel→Canva, compare, generic filter, missing teachers, teacher search และ list/count/price/paging/memory/reset/forget/isolation เดิม
- Import tests9รายการผ่าน: valid independent projection และ invalid schema/unknown field/type/author-as-teacher/missing evidence/unlabelled excerpt/report/hash ไม่แทนที่ bytes ของ last-good catalog
- API จริง: “Excel ใครสอน” และ “แล้ว Canva ล่ะ” เลือก read/instructors และตอบชื่อตรงกับหลักฐานทั้งสองข้อ; teacher search ได้11รายการที่มี structured evidence ใช้ความจำชั่วคราว ไม่ส่ง LINE
- การทดสอบในแอป LINE หลัง restart ต้องรอ incoming จริงจากผู้ใช้ จึงยังไม่ถือว่า end-to-end ผ่าน
- Restart server ด้วยโหมดตอบจริงบน OA DemoB1 ผ่าน tunnel/webhook เดิมแล้ว; public health200, unsigned webhook401, signed empty webhook200 และ LINE Verify ผ่าน ไม่เปลี่ยน .env/provider/credentials หรือส่ง push/broadcast

คำสั่ง refresh/test และ dependency เฉพาะตอน import ดู [COURSE_CATALOG_GUIDE.md](./COURSE_CATALOG_GUIDE.md)
