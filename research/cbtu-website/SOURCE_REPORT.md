# รายงานแหล่งข้อมูลสาธารณะ CBTU สำหรับฐานความรู้ซีบอต

**อัปเดตขั้นตอนตรวจข้อมูล 23 ตุลาคม 2569:** `courses.json` ใช้ schema **1.1.0** แล้ว เพิ่มวิทยากรรายคนพร้อมหลักฐาน โดยยืนยันได้ 14 หลักสูตร + Bundle 1 ชุด และยังขาดหลักฐาน 5 หลักสูตร ชื่อจากช่อง By ไม่ถูกยกระดับเป็นผู้สอนอัตโนมัติ ข้อความ `instructors_text` เดิมคงไว้เพื่อประวัติ ดูคู่มือใหม่ที่ [VALIDATION_GUIDE_TH.md](VALIDATION_GUIDE_TH.md), กฎที่ [schema](schemas/courses-1.1.0.schema.json), ผลตรวจที่ [validation_report.json](validation_report.json) และชื่อที่ต่างกันระหว่างแหล่งที่ [instructor_review.json](instructor_review.json)

รายละเอียดวิทยากร/ราคา/สถานะของหน้าหลักสูตรตรวจใหม่ประมาณ **22:25 น.** วันเดียวกัน ตาม provenance รายหน้า ส่วนการสำรวจ Home, FAQ, ข้อความสรุปและตารางที่เรียบเรียงไว้ยังเป็น snapshot รอบเดิม ไม่ตีความว่าเป็นการ crawl เนื้อหาใหม่ทั้งหมด รุ่นเก่าก่อน migration เก็บไว้ใน `versions/` และ `courses.json` เปลี่ยนเฉพาะเมื่อ candidate ผ่านทั้ง schema และกฎเชิงความหมาย ตัว builder ปัจจุบันใช้ manifest ที่ทบทวนแล้ว ไม่ใช่ general auto crawler

เก็บข้อมูลวันที่ **23 ตุลาคม 2569 (2026-10-23), เขตเวลา Asia/Bangkok** จากเว็บสาธารณะ เริ่มอ่านรายละเอียดหลักสูตรประมาณ 19:35 น. เวลาที่อ่านจริงของแต่ละหน้าเป็น ISO 8601 UTC ใน `provenance.retrieved_at` พร้อม URL ที่ร้องขอ/ปลายทางและ SHA-256 ของ HTML เพื่อแยก snapshot ข้อมูลนี้เป็นงานวิจัยสำหรับเจ้าของตรวจ ยังไม่ได้นำเข้าบอต

## ผลการสำรวจและความครอบคลุม

- พบ **19 หลักสูตร + 1 ชุด Bundle** จากการกด pagination ของ [Home](https://cbtumu.net/) ครบ 4 หน้า: 6 + 6 + 6 + 2 รายการ รวม URL ไม่ซ้ำ 20 รายการ
- อ่านหน้ารายละเอียดสาธารณะได้ 19 รายการ ซึ่งประกอบด้วย 18 หลักสูตรและ Bundle อีก 1 รายการ ส่วน **Basic Prompt Engineering (Update)** แสดงหน้าล็อกด้วยรหัสผ่าน จึงเก็บเฉพาะชื่อ URL และปุ่มที่ปรากฏในรายการ ไม่พยายามเข้าถึงส่วนที่ล็อก
- ตรวจ [Courses](https://cbtumu.net/coursescurrent/) และลิงก์ครบ 3 หน้าที่เว็บแสดง แต่ direct GET ของ `?current_page=2/3` คืนรายการหน้าแรกซ้ำ ส่วนการกดปุ่ม 2/3 ใน UI กลับแสดง `Page 1 of 3` พร้อมรายการซ้ำ จึงใช้ Home UI ที่แบ่งหน้าได้จริงเป็นหลักฐาน coverage
- Home แบบ direct GET `?current_page=2/3/4` ก็คืนรายการหน้าแรกซ้ำ การกดปุ่มบน Home จากหน้าแรกทำงานผ่าน AJAX และให้รายการต่างกันจริง การกดหน้าถัดไปต่อจากผล AJAX บางครั้งสร้าง URL ที่มี `current_page` ซ้ำ จึงกลับ Home ก่อนเลือกหน้าที่ต้องการ
- ผล web index บางหน้าล้ากว่า live HTML: เช่น index Home ไม่มี Popular Course Bundle ขณะที่ live มี จึงใช้เวลาของการเก็บโดยตรงเป็นหลัก ไม่ใช้ยอดผู้เรียนหรือเรตติ้งเป็นหลักฐานความสด
- อ่าน [FAQ](https://cbtumu.net/faq/), [About](https://cbtumu.net/about-cbtu/), [Contact](https://cbtumu.net/contactus/), [Payment](https://cbtumu.net/payment/) และข่าวที่ช่วยแยกรุ่นจบแล้วออกจากข้อเสนอรับสมัคร
- อ่านเว็บย่อยหลักสูตรที่ Home/รายละเอียดเชื่อมไว้เพื่อค้นข้อขัดแย้ง แต่เก็บ cohort ใหม่แยกจากรายการ CBTU ไม่รวมราคาและวันของคนละรุ่นเข้าด้วยกัน

ขอบเขตนี้ครอบคลุมรายการที่แสดงใน Home ทั้ง 4 หน้าวันเก็บข้อมูล ไม่ใช่การรับรองว่าครบทุกหลักสูตรในประวัติหรือทุกรายการในระบบ ส่วน Payment มีชื่ออื่นในตัวเลือกฟอร์ม เช่น SOP/WI และ “AI Agent ในการทำงาน” ซึ่งไม่อยู่ใน catalog ที่สำรวจ จึงไม่ยกระดับเป็นหลักสูตรที่เปิดรับสมัคร

## รายการใน catalog

ราคาด้านล่างเป็นเพียงตัวเลขที่หน้าเว็บแสดงขณะอ่าน ไม่ยืนยันส่วนลด ราคา checkout หรือการรับสมัครสด ปุ่ม Add to Cart ไม่ใช่หลักฐานว่ามีรอบเรียนใหม่ วัน พ.ศ. คงตามต้นฉบับ

| ID | หลักสูตร / ชุด | ราคาที่แสดง (บาท) | ข้อความ/ข้อจำกัดที่พบ |
|---|---|---:|---|
| cbtu-01 | [Data Analysis with AI](https://cbtumu.net/coursenew/dataanalysiswithai/) | 2,000 | Enrollment is now closed; 13 ก.ย.–4 ต.ค. 2569, 12 ชม. |
| cbtu-02 | [CBTU AI Day : AI for Research](https://cbtumu.net/coursenew/cbtu-ai-day-ai-for-research/) | Free | Enroll Now; 1 ชม. 30 นาที; Prism AI |
| cbtu-03 | [CBTU AI Day : AI for Work](https://cbtumu.net/coursenew/cbtu-ai-day-ai-for-work/) | Free | Enroll Now; 2 ชม.; Claude และ Canva AI |
| cbtu-04 | [Mini AI Agent Engineering](https://cbtumu.net/coursenew/miniaiagentengineer/) | 24,000 | Enrollment is now closed; Hybrid 14 สัปดาห์ |
| cbtu-05 | [Mini Data Science รุ่นที่ 10](https://cbtumu.net/coursenew/minidatascience10/) | 28,000 | Enrollment is now closed; 17 วัน 102 ชม.; มีข่าวจบการอบรม |
| cbtu-06 | [การวิเคราะห์ข้อมูลด้วย Microsoft Excel](https://cbtumu.net/coursenew/analyticsmicrosoftexcel/) | 1,000 | Add to Cart; วิดีโอออนไลน์ |
| cbtu-07 | [สร้างสื่อสวยด้วย Canva](https://cbtumu.net/coursenew/creativemediadesignwithcanva/) | 1,000 | Add to Cart; วิดีโอเรียนด้วยตนเอง |
| cbtu-08 | [Generative AI in Health Product Marketing](https://cbtumu.net/coursenew/generativeaiinhealthproductmarketing/) | 1,000 | Add to Cart; วิดีโอ 5 ชม. |
| cbtu-09 | [AI Agent with n8n](https://cbtumu.net/coursenew/aiagentwithn8n/) | 1,000 | Add to Cart; วิดีโอ |
| cbtu-10 | [AI Agent Workshop with n8n](https://cbtumu.net/coursenew/n8n-workshop/) | 3,000 | Add to Cart แต่วันอบรมรุ่น 2 คือ 21/28 ก.พ. 2569 ผ่านไปแล้ว |
| cbtu-11 | [Basic Prompt Engineering (2026)](https://cbtumu.net/coursenew/basicpromptengineering2026/) | 1,000 | Add to Cart; วิดีโอ 2 ชม. |
| cbtu-12 | [AI Agent for ALL](https://cbtumu.net/coursenew/aiagentforall/) | ไม่พบ | Fully Booked / This course is full right now.; 2 ชม. 30 นาที |
| cbtu-13 | [AI Agents in Action](https://cbtumu.net/coursenew/ai-agents-in-action/) | ไม่พบ | Fully Booked / This course is full right now. |
| cbtu-14 | [AI for All](https://cbtumu.net/coursenew/ai-for-all/) | ไม่พบ | Fully Booked / This course is full right now.; 2 ชม. |
| cbtu-15 | [Data Analytics](https://cbtumu.net/coursenew/dataanalytic/) | 3,150; แสดงราคาอ้างอิง 4,500 | Add to Cart แต่วันอบรม ก.พ.–มี.ค. 2569 ผ่านไปแล้ว; 18 ชม. |
| cbtu-16 | [Data Science Essentials](https://cbtumu.net/coursenew/datascienceessentials/) | 6,300; แสดงราคาอ้างอิง 9,000 | Add to Cart แต่วันอบรม มี.ค.–เม.ย. 2569 ผ่านไปแล้ว; Hybrid 36 ชม. |
| cbtu-17 | [Data Analyst Level 4 รุ่นที่ 4](https://cbtumu.net/coursenew/data-analyst-level-4-รุ่นที่-4/) | 3,000 | Enrollment is now closed; 2/9/16/23 พ.ย. 2568, 12 ชม. |
| cbtu-18 | [Basic Prompt Engineering (Update)](https://cbtumu.net/coursenew/exambasicpromptengineeringupdate/) | ไม่พบ | Listing มี Enroll Course แต่ detail เป็น Protected |
| cbtu-19 | [Basic Prompt Engineering](https://cbtumu.net/coursenew/basic-prompt-engineering/) | ไม่พบ | Enrollment is now closed; 2 ชม.; แยกจากรุ่น 2026 และ Update |
| cbtu-20 | [Popular Course Bundle](https://cbtumu.net/course-bundle/mostcoursebundle/) | 1,500; แสดงราคาอ้างอิง 4,000 | Add to Cart; 4 หลักสูตร: Canva, Excel, n8n, Prompt 2026 |

## ข้อมูลที่ต้องให้เจ้าของตรวจ

1. **บัญชีรับชำระเงินต่างกัน:** FAQ และ Payment ระบุเลขบัญชีและชื่อบัญชีต่างกัน เก็บค่าต้นฉบับพร้อมแหล่งใน `review_required.json` เท่านั้น ไม่คัดเป็นคำตอบลูกค้า ไม่เลือกว่าบัญชีใดถูก
2. **เวลาเริ่มเรียน:** FAQ ขั้นตอนสมัครบอกเริ่มทันทีหลังชำระ แต่คำถามถัดมาและ Payment บอกตรวจ 1–2 วัน ต้องยืนยันสิทธิ์เข้าเรียนจริงกับเจ้าหน้าที่
3. **อีเมล:** เนื้อหา Contact/FAQ ใช้ `cbtu.mu@gmail.com` ส่วน footer ใช้ `cbtumu.net@gmail.com` ยังไม่เลือกอีเมลหลักให้
4. **รอบอบรมเก่าและปุ่มซื้อ:** n8n Workshop, Data Analytics และ Data Science Essentials ยังมี Add to Cart แม้วันที่อบรมผ่านไปแล้ว ไม่ตีความว่าเปิดสดรอบใหม่ หรือว่าเป็น replay เสมอ
5. **ใบประกาศกับ TPQI:** Home อ้างมีใบประกาศทุกหลักสูตร ขณะที่ FAQ กำหนดเรียนจบและผ่านเกณฑ์ ส่วน About ระบุเพียง 6 หลักสูตรที่รับรอง ไม่รับรองว่าทุกหลักสูตรได้คุณวุฒิวิชาชีพอัตโนมัติ หรือกำหนดคะแนนผ่านเอง; AI for Research ไม่พบคำรับรองเฉพาะรายวิชาใน sidebar
6. **ผู้โพสต์กับผู้สอน:** AI for Work แสดง By เป็น taweesak samanchuen ใน catalog แต่คำอธิบายระบุผู้สอน ดำรงพล ชนะวรรณ และ อภิญญา ชูชาติ เก็บเป็นคนละบทบาท
7. **ข้อกำหนด n8n:** Requirements บางบรรทัดใช้ชื่อ NSN ทั้งที่ About เป็น n8n; เก็บ flag ไม่แก้ต้นฉบับโดยเดา
8. **Bundle:** แสดง duration `02:00:00` แต่มี 4 คอร์ส ยังไม่ยืนยันว่าเป็นเวลารวมทั้งหมด

### เว็บย่อยหลักสูตร: แยกรุ่นและยังไม่รับรองกำหนดการ

- [Mini AI Agent /apply](https://miniaiagentweb-production.up.railway.app/apply) แสดงรุ่น 2 เป็น waitlist แต่ส่วนหนึ่งระบุยังไม่ประกาศราคา/จำนวนรับ/วันเปิด อีกส่วนแสดง 24,000, 30 ที่นั่ง, ปิด 1 เมษายน 2570 และเริ่ม 1 สิงหาคม 2570 พร้อม outcome `test` วันที่เริ่มดังกล่าวตรงวันอาทิตย์ ขณะที่ตารางเขียนวันเสาร์ จึงไม่เผยแพร่เป็นกำหนดการยืนยัน
- [Mini Data Science /apply](https://minidswebsite-production.up.railway.app/apply) เป็นรุ่น 11 ราคา 29,500 บาท และข้อความ Early Bird 10% แสดงวันปิดทั้ง 15 ธันวาคม 2569 และ 15 สิงหาคม อีกทั้งเริ่ม 1 กันยายน 2569 ซึ่งตรงวันอังคาร แต่ตารางเขียนวันเสาร์ ห้ามแทนที่ข้อมูลรุ่น 10 ด้วยข้อมูลนี้ และต้องยืนยันรุ่น/ราคา/วันกับเจ้าของ
- [เว็บ Mini Data Science เดิม](https://www.minidatasci.com/) กล่าวถึง 28,000 บาท 4 เดือน/17 สัปดาห์ วุฒิปริญญาตรีหรือเทียบเท่า และประสบการณ์ 1 ปี แต่ไม่ยืนยันว่าบังคับกับรุ่นใด จึงไม่เติม prerequisites ของรุ่น 10 หรือ 11 จากการเดา
- เว็บย่อย Home และ apply มีคำบรรยายสถานะไม่สอดคล้องกันบางส่วน โครงหลักสูตร Mini Data Science บนเว็บใหม่เป็น 7 modules ขณะที่ CBTU รุ่น 10 เป็น 6 modules ซึ่งอาจเป็นการเปลี่ยนรุ่น จึงเก็บแยก ไม่สรุปว่าแหล่งใดผิด

## ข่าวและข้อมูลนอก catalog

- [ข่าว Mini Data Science รุ่น 10 จบอบรม](https://cbtumu.net/mini-data-science-10-completion/) ยืนยันเสร็จสิ้นการอบรมที่ KX รวม 17 วัน 102 ชั่วโมง ใช้ประกอบสถานะรุ่นเก่า
- [ข่าว HERMES AGENT](https://cbtumu.net/hermes-agent-training-cbtu-mu/) รายงานการอบรมเสร็จสิ้น ณ คณะวิศวกรรมศาสตร์ มหิดล อาคาร 1 ห้อง R301 ไม่มีหลักฐาน catalog ของรอบใหม่ จึงไม่เพิ่มเป็นหลักสูตรเปิดรับ
- ชื่อหลักสูตรใน About, ข่าวอบรมองค์กร และตัวเลือกฟอร์ม Payment เป็นการกล่าวถึงบริการหรือประวัติ ไม่ถือเป็นข้อเสนอเปิดรับสมัครปัจจุบัน

## ช่องที่ยังขาดและข้อจำกัดการเข้าถึง

- Basic Prompt Engineering (Update): เนื้อหารายละเอียดถูกล็อกรหัสผ่าน ไม่อ่านหรือ bypass
- Mini Data Science รุ่น 10: หน้า detail ลิงก์ตารางเรียน Google Drive แต่ไม่ได้เปิด/ดาวน์โหลด PDF ตารางนั้น จึงยังไม่มีวันเริ่ม–สิ้นสุดที่ยืนยันจากไฟล์
- หลายคอร์สไม่ระบุระยะเวลาวิดีโอครบ วันอบรมใหม่ อายุสิทธิ์เข้าเรียนเฉพาะรายวิชา หรือเกณฑ์คะแนนผ่าน ดู `missing_fields` ของแต่ละรายการ ไม่ใช้ `null` แทนฟรี/ไม่มีเงื่อนไข
- ไม่ทดลอง checkout, สมัครสมาชิก, จ่ายเงิน, กรอกฟอร์ม หรือตรวจสิทธิ์หลัง login ดังนั้นปุ่ม Enroll Now/Add to Cart ไม่ยืนยันว่าทำรายการได้จริง
- เครื่องมือค้นเว็บอ่านข่าวบางหน้าและหน้า cohorts ของเว็บย่อยไม่ได้ ข่าวสองหน้าหลักอ่านได้ด้วย HTTP สาธารณะแล้ว ส่วน cohorts ไม่ได้อ้างว่าอ่านสำเร็จ
- ไม่อ่านบทเรียนเต็ม ดาวน์โหลดวิดีโอ หรือเก็บชื่อ/รีวิว/ข้อมูลส่วนตัวผู้เรียน เก็บเฉพาะ metadata หลักสูตร สรุปที่เรียบเรียงใหม่ และหลักฐานสั้น

## ไฟล์และแนวทางนำเข้าในภายหลัง

- `courses.json`: catalog 20 รายการ ชื่อ canonical URL สรุปหัวข้อ/ผลลัพธ์ กลุ่มเป้าหมาย พื้นฐาน รูปแบบ ระยะเวลา รอบเรียน ผู้สอน ราคา สถานะ ใบประกาศ ลิงก์ entry แหล่ง/เวลา หลักฐานสั้น flags และ missing fields
- `supporting_knowledge.json`: FAQ 10 ข้อ Contact/About และข่าวที่แยกจากข้อเสนอหลักสูตร
- `review_required.json`: บัญชีชำระเงินและความขัดแย้งสำหรับเจ้าของตรวจ **ไม่ใช้ทั้งไฟล์เป็นข้อเท็จจริงตอบลูกค้า** รวมข้อมูล cohort เว็บย่อยที่ยังไม่ยืนยัน
- `catalog_observations.json` / `listing_observations.json`: หลักฐาน coverage จาก UI และผล HTTP ที่คืนซ้ำ ใช้ตรวจวิธีสำรวจ ไม่ใช้เป็นรายการหลักสูตรซ้ำ
- สคริปต์ `collect_public.py`, `collect_details.py`, `collect_support.py`, `build_artifacts.py`: รอบปัจจุบันต้องเขียนลง staging ตามคู่มือใหม่ก่อนตรวจ สรุปและตารางที่เรียบเรียงไว้ยังต้องทบทวนเมื่อเว็บเปลี่ยน `collect_support.py` เก็บแหล่งร่างสำหรับการทบทวน ไม่เผยแพร่ FAQ อัตโนมัติ การรันเก็บใหม่ไม่รับรองว่าข้อขัดแย้งได้รับการแก้แล้ว

ก่อน ingest ให้เจ้าของตัดสินข้อขัดแย้ง โดยเฉพาะการชำระเงิน วันเรียนใหม่ และราคาแต่ละ cohort แสดงแหล่งและเวลาเมื่อตอบคำถามที่เปลี่ยนตามเวลา หากผู้ใช้ถามเปิดรับสมัครหรือจ่ายเท่าไรให้ตรวจหน้าปัจจุบัน/เจ้าหน้าที่ก่อน ไม่ใช้ค่าวัน Last Updated เป็นวันเริ่มเรียน ไม่เหมารวม FAQ “ส่วนมากตลอดชีพ” ไปทุกคอร์ส

ทุกไฟล์สร้างเฉพาะใน `research/cbtu-website/` ไม่มีการแก้ runtime code, sharedknowledge.ts, .env, package, Git staging/commit ไม่มี deploy/restart/ส่ง LINE และไม่ใช้ข้อมูล Notion ภายใน
