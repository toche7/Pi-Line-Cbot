# คู่มือตรวจและเผยแพร่ catalog CBTU

## ขอบเขต

Schema ปัจจุบันคือ **`1.1.0`**, ใช้ JSON Schema Draft 2020-12 ที่ `schemas/courses-1.1.0.schema.json` และกฎเชิงความหมายเพิ่มเติมใน `catalog_validation.py` รองรับเฉพาะรุ่นนี้ รุ่นเดิม `1.0` สำรองไว้เพื่อกู้คืนและเปรียบเทียบ ไม่อ้างว่าผ่าน schema ใหม่

ระบบนี้เป็น **ตัว refresh metadata จาก manifest ที่ทบทวนแล้ว** จำนวน 19 หลักสูตร + 1 Bundle ไม่ใช่ crawler ทั่วไป ไม่ค้นพบหลักสูตรใหม่ ไม่ตีความ pagination ที่คืนซ้ำ และไม่ลบรายการเอง คำอธิบาย หัวข้อ ผลลัพธ์ พื้นฐาน รูปแบบ ระยะเวลา และ `session_dates_text` ยังเป็นข้อความที่เรียบเรียงใน snapshot เดิมและต้องทบทวน ข้อมูลที่ดึงใหม่อัตโนมัติได้แก่ชื่อหน้าหลักสูตร ชื่อวิทยากรที่มีหัวข้อผู้สอนชัดเจน ราคา และข้อความสถานะ ป้ายรับสมัครใน catalog ที่เก็บเดิมอาจเก่ากว่า detail จึงต้องอ่าน provenance และ flags ร่วมกัน

FAQ, Contact, Payment และข้อขัดแย้งเดิมยังอยู่ในไฟล์ประกอบชุดเดิม ไม่ได้เปลี่ยนวันเก็บหรือประกาศว่าได้รับการตรวจใหม่พร้อม catalog

ใช้ Python 3.11 ที่มี `jsonschema` อยู่แล้ว (ทดสอบกับ 4.26.0) ไม่ได้ติดตั้ง dependency หรือแก้ package ของแอป

Validator ตรวจโครงสร้างและความสอดคล้องของหลักฐานที่เก็บ ไม่ได้พิสูจน์ว่าเว็บยังแสดงข้อความนั้นอยู่หรือชื่อสองรูปแบบเป็นบุคคลเดียวกัน เมื่อ markup เปลี่ยน collector อาจหา heading ไม่พบและคืนชื่อเป็น null ต้องตรวจ source ที่อ้างกับเจ้าของต่อไป `excerpt` ของวิทยากรประกอบจาก heading ผู้สอนและบรรทัดชื่อใน source พร้อมชื่อคอร์สย่อยเมื่ออ้าง Bundle; เก็บ DOM events เฉพาะส่วน metadata ใน staging ไว้ตรวจตาม provenance ไม่เก็บหน้ารีวิวหรือบทเรียน

## ตรวจไฟล์อย่างเดียว

รันจากโฟลเดอร์ research นี้:

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo/research/cbtu-website
python3 catalog_validation.py courses.json --report staging/manual-validation.json
python3 -m unittest discover -s tests -v
```

Exit code `0` คือผ่าน, `1` คือมี error ห้ามใช้ exit code หรือจำนวน warning แทนการอ่าน `errors` และ `warnings` ในรายงาน

## เก็บ metadata รอบใหม่และทำไฟล์ร่าง

ใช้ชื่อรอบใหม่เสมอ ตัวอย่าง `refresh-02` ด้านล่างเป็นโฟลเดอร์ staging ภายใน research เท่านั้น:

```sh
python3 collect_details.py --output /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo/research/cbtu-website/staging/refresh-02/details.json
python3 build_artifacts.py --details staging/refresh-02/details.json --stage-dir staging/refresh-02
```

ตรวจ `staging/refresh-02/courses.json`, `validation_report.json` และ `instructor_review.json` ก่อน คำสั่ง builder เปรียบเทียบ candidate กับ `courses.json` ที่เผยแพร่อยู่ รายงานแสดง added / removed / price_changes การ fetch ล้มเหลวจะคง record เดิมไว้ใน candidate และเพิ่ม `fetch_errors`; ไม่สร้าง catalog ที่หายบางรายการ

เมื่อเจ้าของพร้อมใช้ไฟล์ที่ผ่านตรวจแล้ว:

```sh
python3 catalog_validation.py staging/refresh-02/courses.json --previous courses.json --report staging/refresh-02/prepublish-report.json
python3 catalog_validation.py staging/refresh-02/courses.json --publish
```

`--publish` อ่านไฟล์ปัจจุบันอีกครั้งภายใต้ lock และตรวจซ้ำก่อนแทนที่ จึงไม่ใช้ผลตรวจเก่าแทนการตรวจ ณ เวลาเผยแพร่ `--previous` ใช้กับการตรวจอย่างเดียว; เมื่อ publish จะเทียบกับไฟล์จริงเสมอ การเผยแพร่ในที่นี้หมายถึงไฟล์วิจัยในเครื่อง ไม่มีการ ingest เข้า runtime, deploy, restart หรือส่ง LINE

ตัวเลือก builder `--publish` รวม build + ตรวจ + atomic publish ได้ แต่รอบที่ยังมีความเปลี่ยนแปลงควรเปิดรายงานก่อน `--migration` ใช้บอกการย้าย snapshot เดิมเท่านั้น ไม่ใช่หลักฐานว่ากด pagination ใหม่แล้ว

ตัวเลือก `--allow-removals` มีไว้สำหรับผู้ดูแลที่ตรวจรายการลบแล้วเท่านั้น ค่าเริ่มต้นบล็อก removals เสมอ และตัวเลือกนี้ไม่ยกเว้น fetch error หรือ coverage ไม่ครบ Builder manifest ปัจจุบันยังไม่เพิ่ม/ลบ record อัตโนมัติ ต้องทบทวน manifest และ seed อย่างชัดเจนก่อน

## กฎที่บล็อกการเผยแพร่

- `schema_version` ต้องเป็น `1.1.0`; required keys ครบและไม่รับฟิลด์เกินทุกระดับของ object ตาม schema
- ID รูปแบบ `cbtu-XX` ไม่ซ้ำและคงคู่กับ canonical URL เดิมเมื่อเทียบ previous; URL ไม่ซ้ำหลังถอด percent encoding และละ trailing slash
- record_type ต้องเป็น course/bundle, มี name, canonical URL และ provenance พร้อม retrieval time แบบ ISO 8601 มี timezone และ SHA-256
- ชนิด string/list/number/boolean ตรง รวมถึงไม่รับ boolean เป็นราคา ตัวเลขต้อง finite และไม่ติดลบ
- เงินที่มีค่ามากกว่าศูนย์ต้องมี currency และตัวเลขตรงข้อความราคาจาก source; `0` ใช้ได้เฉพาะมี `Free` ทั้ง label และหลักฐาน ข้อมูลไม่พบใช้ `null`
- `missing_fields` ต้องตรงกับ nullable knowledge fields ที่กำหนด ไม่ใช้รายการชื่อฟิลด์ตามใจ รวม `instructors` เมื่อเป็น `null`
- URL ต้องเป็น HTTPS บน allowlist แหล่งสาธารณะ CBTU/เว็บย่อยที่ตรวจไว้/ตาราง Google Drive ไม่มี username/password, custom port หรือ query คล้าย credentials; fetch ตรวจ redirect ด้วย
- provenance หลักตรง URL ของหลักสูตร และ provenance หลักฐานชื่อวิทยากรตรงแหล่งที่อ้าง
- `instructors` เป็น array ของ `{name, source_url, source_type}` หรือ `null`; ชื่อคงคำนำหน้าตามแหล่ง ห้ามเพิ่มปริญญาหรือขยายชื่อเอง
- source_type รับเฉพาะ `course_detail` และ `explicit_bundle_teacher`; ไม่รับ `catalog_by` ต้องมีชื่อที่ตรงกันในข้อความที่มีป้ายผู้สอน และ Bundle ต้องระบุชื่อคอร์สย่อยที่เกี่ยวข้อง
- วิทยากรภายในคอร์สไม่ซ้ำตามชื่อที่ตัดช่องว่างเพื่อเปรียบเทียบเท่านั้น ไม่รวมคนจากชื่อคล้ายกัน ไม่ทำ global person ID/alias
- ไม่ใช้ Add to Cart หรือ Enroll Now รับรองที่นั่งสด: research นี้ต้องคง `is_live_availability_verified=false` และ `is_current_offer_verified=false`
- `dates.raw` คือค่า `session_dates_text` ที่เก็บไว้เดิมในรูปข้อความ ยังไม่ใช่วันที่มาตรฐานหรือคำยืนยันว่าตารางเรียนได้รับการอัปเดต `dates.parsed` แยกต่างหากและเป็น `null` ในชุดนี้ จึงไม่เดาวันใหม่จากข้อความเก่าหรือ Last Updated
- ไม่ลบ review flags เดิมโดยเงียบ ๆ ไม่เลือกราคา วัน หรือข้อมูลติดต่อจากแหล่งขัดกันให้เอง
- fetch_errors, coverage ไม่ครบ, IDs ไม่ตรง manifest และ removals ที่ไม่อนุญาต บล็อก publish

`missing_fields` ไม่ได้ไล่ nullable metadata ทุกช่อง เช่น currency ของ Free หรือ parsed date ที่ยังไม่ได้แปลง รายการที่ตรวจคือ description, topics, learning outcomes, audience, prerequisites, format, duration, session dates, raw instructors text, structured instructors, displayed price และข้อความ/เกณฑ์ certificate ที่ระบุไว้ในโค้ดและ enum ของ schema

## Warning ที่ไม่ใช่ schema error

แหล่งข้อมูลเกิน 30 วัน, วันที่อบรมที่ผ่านไปแล้ว/flags เก่า, ชื่อวิทยากรที่ยังไม่ยืนยัน, ชื่อที่ใช้คำนำหน้าต่างกันระหว่างหน้า, และราคาที่เปลี่ยนแสดงเป็น warning เพื่อให้เจ้าของตรวจ Warning คงอยู่ในรายงานเมื่อ publish ผ่าน ไม่แปลว่าปัญหาถูกแก้แล้ว ชุดนี้ยังไม่แปลง dates.parsed; วันอบรมเก่าเตือนผ่าน flags ที่เก็บจากการสำรวจเดิม

## Staging, versions และ last good

`courses.json` คือไฟล์ **last good ที่ผ่านตรวจล่าสุด** และเป็นจุด commit เดียว ก่อนแทนที่ ระบบสร้าง candidate, validation report และ changes report ใน staging แล้วสำรองไฟล์เดิมแบบ byte-for-byte ไว้ที่ `versions/<sha256>/courses.json` พร้อม snapshot ของรุ่นใหม่ที่ผ่านตรวจ

จากนั้นใช้ temporary file ใน filesystem เดียวกัน, flush/fsync และ `os.replace` เพื่อแทน `courses.json` แบบ atomic ภายใต้ `.publish.lock` ถ้า validation/fetch/snapshot write ล้มเหลวก่อน commit ไฟล์ที่ใช้อยู่จะไม่เปลี่ยน หากโปรเซสหยุดระหว่างทางจะเหลือไฟล์เดิมหรือไฟล์ใหม่ที่ตรวจแล้ว ไม่ใช่ JSON ครึ่งไฟล์ Snapshot และ staged candidate อาจยังเหลือไว้สำหรับวิเคราะห์ การเผยแพร่หลายไฟล์ประกอบพร้อมกันไม่ได้อยู่ใน transaction นี้

รุ่นเดิมก่อน migration อยู่ที่:

```text
versions/b9b683a2710a86e99622149182c25c926359c01d79ad2236262915934c7f2dca/courses.json
```

สำรอง builder รุ่นเดิมที่ hardcode ไว้ที่ `versions/legacy-tools/build_artifacts-1.0.py` เพื่อประวัติเท่านั้น ไม่ควรรัน เพราะเป็น workflow เก่าที่ไม่ใช้ validator รุ่นใหม่

ตรวจหรือกู้คืนรุ่น `1.1.0` ด้วย validator และ publisher เดียวกันได้ แต่ flags ที่หายและ record ที่ถูกลบยังต้องผ่านกฎเทียบ previous การย้อนกลับ schema `1.0` ไม่ใช่ publish ที่ validator นี้รองรับ ต้องตัดสินใจโดยเจ้าของและ migrate ก่อน ไม่มี auto rollback ที่แอบใช้ schema เก่า

## ผลตรวจครั้งนี้

- 19 หลักสูตร + 1 Bundle; ไม่มี added, removed หรือ price changes เทียบ snapshot ก่อน migration
- ยืนยันวิทยากรแบบ structured ได้ **14 หลักสูตร และ Bundle 1 ชุด**
- ยังเป็น null 5 หลักสูตร: AI Agent Workshop with n8n, AI for All, Data Analyst Level 4 รุ่นที่ 4, Basic Prompt Engineering (Update), Basic Prompt Engineering
- Excel อ้างป้ายอาจารย์ผู้สอนของคอร์สย่อยใน Bundle โดยตรง ส่วน n8n มีหัวข้อผู้สอนใน detail อยู่แล้ว
- Canva detail ใช้ `คุณอภิญญา ชูชาติ` แต่ Bundle ใช้ `นางสาว อภิญญา ชูชาติ` เก็บเป็นข้อควรตรวจใน `instructor_review.json` ไม่ประกาศว่าเป็น alias เดียวกัน
- `instructors_text` เดิมคงไว้ครบ รวมข้อความที่เคยนำมาจาก By แต่มี flag กำกับ และไม่ใช่แหล่งรายชื่อวิทยากรที่ยืนยันแล้ว
- tests ตรวจ invalid types, unknown keys, missing keys, Free/ราคาและหลักฐาน, duplicate IDs/URLs, author-vs-instructor, provenance, conflict flags, old-data warnings, removals/price diff และ failure ที่ต้องรักษา last good

ดูผลเต็มที่ `validation_report.json`, `changes.json` และ `test_report.json` โดย snapshot หลักสูตรที่ระบุใน report ต้องตรงกับ SHA-256 ของไฟล์ที่นำไปใช้ต่อ
