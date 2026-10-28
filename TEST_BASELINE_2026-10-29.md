# ผล baseline ซีบอต 29 ตุลาคม 2026

เริ่มตรวจช่วงประมาณ 04:12 น. Asia/Bangkok · commit `12a600632217a895078ded4e5515e9de81bb54aa`

เริ่มด้วย working tree สะอาด `main` = `origin/main` ที่มีในเครื่อง ไม่ได้ fetch remote ใหม่ หลังตรวจมีเฉพาะเอกสาร/หลักฐานทดสอบเพิ่ม ไม่มีแก้ source ฟีเจอร์หรือแก้บั๊ก ไม่มี commit/push

สภาพแวดล้อม: macOS (`darwin`), arm64, Node v25.2.1, npm 11.6.2, TypeScript จาก dependency ที่มีอยู่, Python `/Users/taweesaksamanchuen/.pyenv/versions/3.11.8/bin/python3` สำหรับ import; ไม่มีติดตั้ง dependency เพิ่ม

## ผลใหม่รอบนี้

| ID | สภาพแวดล้อม / ขอบเขต | Expected | Actual / สถานะ |
|---|---|---|---|
| B01 | Git ก่อนเริ่ม | ระบุ base/changes | main และ cached origin/main ตรง commit ข้างต้น, สะอาด — ผ่าน |
| B02 | `npm run build` | compile exit 0 | exit 0 — ผ่าน |
| A01 | `npm test` หลัง build; temp/mock ไม่โหลด .env จาก npm test | 132 tests ผ่าน | 132/132, fail/skip/cancel 0, 9.50s — ผ่าน |
| A02 | catalog import tests; Python ที่ระบุ, temp output | 9 tests ผ่าน, invalid input ไม่ทับ last-good | 9/9, fail/skip/cancel 0, 4.62s — ผ่าน |
| U01 | CUA / IAB, `scripts/knowledge-ui-fixture.mjs`, loopback ephemeral 49991, temp stores, fake settings runner | save ไม่สลับ active; trial/review/confirm แล้ว reload คงค่า | save revision1 active initial; mock trial revision3; review4; explicit apply แล้ว reload revision5, active versionใหม่และบุคลิก “ตอบกระชับและเป็นกันเอง” — ผ่าน |
| U02 | CUA / fixture เดียวกัน; FAQ “สมัครสมาชิก” | ร่างและ active found, มีแหล่งข้อมูลและวันที่ snapshot | ทั้งสอง found/คำตอบตรงกัน มี FAQ URL และ capturedAt; KM revision0 seed; ไม่ใช้โมเดล/ไม่ publish — ผ่าน |
| U03 | CUA / fixture / viewport390×844, reload แล้ว preview FAQ | scrollWidth ไม่เกิน innerWidth | ก่อน preview375/390; หลัง preview631/390; ทำซ้ำหลัง reload ได้ — พบปัญหา BUG-001 |
| U09 | Console ของแท็บ fixture ณ จุดตรวจ | ไม่มี error/warn | อ่านรายการ error/warn ได้ `[]` — ผ่านเฉพาะแท็บและช่วงที่ตรวจ |
| L01 | listener เดิม PID7784; ports3000/3001 | webhook health ตอบ200 | GET3000/health `{"ok":true}` HTTP200; admin3001/health404 เป็นคนละ handler ไม่ใช่ webhookล้ม — ผ่าน |
| L02 | CUA เว็บจริง3001/#bot อ่านอย่างเดียว | settings/KM โหลดได้ แสดง active/revision | settings groq/qwen/qwen3.8-27b initial revision0; KM seed revision0; ตั้งค่าด้านบน KMด้านล่าง — ผ่าน |
| L03 | CUA เว็บจริง3001/#news อ่านอย่างเดียว + source gate | ข่าวไม่เปิดส่งจากการมี worker/transport อย่างเดียว | UI “การส่ง LINE จริงปิดอยู่”; พบ draftหนึ่งและสิ้นสุดหนึ่ง ไม่มีสร้าง/แก้/ยืนยันข่าว — ผ่านเฉพาะ gate UI ณ จุดตรวจ |
| N01 | CUA เว็บจริง / เมนู | ระบุส่วนที่ไม่มี | ภาพรวม disabled “ยังไม่พัฒนา” — ไม่มีฟังก์ชัน |

ผล runtime ครั้งแรกใน sandbox เป็น129ผ่าน/3ไม่ผ่าน ทั้งสามเกิด `listen EPERM 127.0.0.1` ได้แก่ HTTP tests บทสนทนา/ลูกค้า/LINE profile จึงขอ escalation แล้วรันชุดเต็มใหม่ได้132/132 ไม่จัด EPERM เป็นบั๊กของแอป เว็บ fixture ก็ต้องเปิดนอก sandbox ด้วยเหตุเดียวกัน

หลักฐาน automation: [runtime](./test-evidence/2026-10-29/runtime.txt), [import](./test-evidence/2026-10-29/catalog-import.txt) และภาพ temp [settings](./design/knowledge/baseline-2026-10-29-settings-temp.png), [FAQ mobile](./design/knowledge/baseline-2026-10-29-faq-overflow-temp.png)

จบรอบแล้วหยุดเฉพาะ fixture PID9319 ด้วย SIGTERM, process exit0 และตรวจ temp directory ถูกลบแล้ว คืน viewport และปิดแท็บทดสอบ บริการจริง PID7784 ยังฟังพอร์ต3001ตามเดิม

## BUG-001 — FAQ preview บนมือถือทำให้หน้าล้นแนวนอน

- **สถานะ:** พบปัญหา / ยังไม่แก้ · **Severity:** P2 · **ผลกระทบ:** หน้าจัดการบอตหลังลอง FAQ ต้องเลื่อนแนวนอน เนื้อหาและฟอร์มบางส่วนอยู่นอกจอ; ยังอ่านคำตอบได้ ไม่พบการส่งข้อความหรือข้อมูลเสียจากเคสนี้
- **วันที่/commit/environment:** 29 ต.ค. 2026, commitข้างต้น, source/buildใหม่บน IAB ผ่าน CUA, temp fixture, viewport390×844; ทำซ้ำสองครั้ง ไม่เหมาว่าได้ทำซ้ำบน runtimeจริง
- **ขั้นทำซ้ำ:** เปิด fixture `/#bot` → ตั้งviewport390×844 → reload → วัดก่อน preview → กรอก “สมัครสมาชิก” ใน FAQ `#km-query` → กด “ลองคำตอบ” → วัดอีกครั้ง
- **Expected:** `document.documentElement.scrollWidth <= innerWidth` ทั้งก่อนและหลังลอง
- **Actual:** ก่อน375/390; หลัง631/390; DOM พบ `#km-answer-meta` และกรอบคำตอบกว้าง537.25px/ขอบขวา612.25px มีข้อความ SHA256 ยาวต่อเนื่อง ภาพประกอบเป็นข้อมูลสาธารณะใน temp เท่านั้น
- **ข้อสันนิษฐานจาก source/DOM (ยังไม่ใช่ผลแก้):** metadata SHA256 ไม่ตัดบรรทัดร่วมกับ grid mobile ที่ใช้ `1fr` ทำให้ min-content ขยายกรอบ แม้ `pre` คำตอบมี `overflow-wrap:anywhere`
- **ข้อเสนอแก้แยก:** ให้งานพัฒนาตรวจ min-width/grid และการ wrap metadata จากนั้นทดสอบก่อน/หลัง FAQ preview ที่390px รวม desktop/settings/เมนูเดิม ไม่แก้ source ในรอบ baseline นี้

## ข้อขัดแย้งเอกสาร

คู่มือบางส่วนเก็บประวัติก่อนพัฒนารวม เช่น CUSTOMERS_GUIDE ยังมีข้อความส่งข่าวปิด/ยังไม่เปิด push; CONVERSATIONS_GUIDE/COURSE_REQUESTS_GUIDE มีบันทึกยังไม่ restart; NEWS_GUIDE ตอนต้นบอกเชื่อม worker/เคยส่งจริงแล้ว แต่ตอนท้ายยังบอกยังไม่เชื่อม/ยังไม่ส่งจริง จึงอ่านตามลำดับเวลาและเทียบ source/runtime แทนการอ้างทุกย่อหน้าเป็นสถานะปัจจุบัน

Sourceล่าสุด `src/server.ts` สร้าง NewsService gated=true และ NewsWorker มี transport เมื่อไม่dryRun; `src/news.ts` ตรวจ grantตรง campaign+review digest+อายุ, confirmอีกครั้ง และตรวจ authorization ระหว่างdispatch การมี transport ไม่ได้เปิดข่าวทุกข่าว L03 ยืนยันเฉพาะ UI ปิด ณ จุดตรวจ ไม่ใช้ทดแทนการ audit ทุกข้อมูล outboxหรือการทดสอบส่งจริง

ไม่แก้คู่มือประวัติย้อนหลังในรอบนี้ ใช้บันทึกนี้และ TEST_PLAN เป็นจุดติดตามผลใหม่

## หลักฐานรอบก่อนที่คงไว้

วันที่28 ต.ค. ตาม CORE_STATUS_AUDIT และคำยืนยันเจ้าของ: LINE FAQและลิงก์เปิดได้; ค้นAI12รายการ/ดูต่อ; จองAIforResearch→confirmรหัส→receipt→เห็นบนเว็บ; /memoryอ่านได้ และเจ้าของเคยrestartแล้วยังจำอยู่; เคยทดลองกลุ่มแล้ว พฤติกรรม555แล้วดูต่อเป็น **ยอมรับข้อสังเกต** ไม่จัดเป็นบั๊ก

NEWS_GUIDE มีหลักฐานเจ้าของอนุญาตข่าวหนึ่งรายการหนึ่งผู้รับ กดยืนยันส่งเอง ผลaccepted attempts1 และเจ้าของได้รับแล้ว จึงคงผลส่งจริงผ่านเฉพาะเส้นทางนั้น ไม่ระบุว่ายังไม่เคยส่งข่าวจริง และไม่ขยายเป็นหลายผู้รับ/load test

## งานค้างและผลต่อ milestone

ยังไม่เรียกโมเดลจริงหรือส่ง LINE ในรอบ29 ต.ค. ไม่ทำ live manual handover ไม่เปลี่ยน consent/prompt/model/FAQ จริง ไม่ restart service ไม่เปลี่ยน credentials/tunnel/webhook ไม่อ่านเนื้อหา memory/logส่วนตัวหรือ .env ในรอบนี้ การดูหน้า3001ไม่รับรองว่า processเดิมโหลด source commitเดียวกับ buildที่เพิ่งตรวจ เพราะไม่ได้restartหรือยืนยัน process provenance

U04–U08 และ live model/LINE acceptance อยู่ใน [TEST_PLAN](./TEST_PLAN.md); ผล UI ของส่วนอื่นรอบ28 ต.ค.ยังคงเป็นหลักฐานเก่า ไม่ใส่ผ่านใหม่รอบนี้ ไม่อ้างว่า runtimeไฟล์จริงทุก byteคงเดิม เพราะบริการจริงยังทำงานและไม่ได้เทียบ hash

M5/M7 คงทำบางส่วน: มี baselineใหม่และพบข้อบกพร่อง UIหนึ่งข้อ ไม่ปิด quality/load/security/งบเงิน/login/durable inbound queue/สิทธิ์ผู้เรียนจริง ผล132/132และ9/9ไม่ใช่ E2E จริงครบระบบ

## คำยืนยันเพิ่มเติมจากเจ้าของ 29 ตุลาคม 2026

เจ้าของให้ข้ามการประเมินคุณภาพคำตอบโมเดลจริงไว้ก่อน (M01 ยังไม่ทดสอบ) และยืนยันว่า “ข้อ 2 ทำเสร็จแล้ว” อ้างถึงรายการทดสอบรับช่วงคุยผ่าน LINE → ส่งข้อความผู้ดูแล → คืนให้บอต จึงอัปเดต E03 เป็นผ่านตามเจ้าของยืนยัน ไม่อ้างว่าผู้ช่วยส่งข้อความหรือทดสอบสดเพิ่ม และไม่ขยายผลเป็นคุณภาพคำตอบทุกกรณี

Expected: workflow รับช่วง/ส่งผู้ดูแล/คืนบอตใช้งานจริงได้; Actual: เจ้าของรายงานว่าทำเสร็จแล้วในแชตทดสอบนี้ สภาพแวดล้อมตามงานคือ LINEจริงกับเว็บหลังบ้าน; ambient URL3001ไม่ใช่หลักฐานตรวจสดของผู้ช่วย ขณะบันทึก HEADยังเป็น12a6006แต่ working treeมีงานพัฒนาบทสนทนาและโมดูลใหม่ที่ยังไม่commit จึงไม่ผูกผลยืนยันนี้กับbaselineสะอาดหรือสรุปว่าruntimeใช้sourceรุ่นใดแน่นอน แก้เฉพาะเอกสารทดสอบสองไฟล์ ไม่แตะงานพัฒนาที่พบ
