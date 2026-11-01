# แผนทดสอบซีบอตและเว็บหลังบ้าน

เริ่ม 29 ตุลาคม 2026 (Asia/Bangkok) · ศูนย์ติดตามงานทดสอบในแชตนี้ · ทำงานเฉพาะ repo นี้

## วิธีอ่านสถานะ

ใช้ **ผ่าน / พบปัญหา / ยังไม่ทดสอบ / ยอมรับข้อสังเกต / ไม่มีฟังก์ชัน** แยกตามชั้นการทดสอบ ผลจำลองไม่ยกระดับเป็นโมเดลจริงหรือ LINE E2E และผลรอบเก่าไม่กลายเป็นผลวันนี้

ทุกผลต้องมี ID, วันที่/เขตเวลา, commit, working tree, สภาพแวดล้อม/fixture, ขอบเขต, expected/actual และหลักฐาน ปัญหาเพิ่มขั้นทำซ้ำ severity/impact และข้อเสนอแก้แยกจากงานทดสอบ ผลbaseline: [29 ต.ค. ก่อนแก้](./TEST_BASELINE_2026-10-29.md); ผลบทสนทนาหลังแก้: [คู่มือ/คำยืนยันเจ้าของ](./CONVERSATIONS_GUIDE.md#ผลยืนยันล่าสุด-29-ตุลาคม-2026)

P1 = เสียข้อมูล/ส่งผิดคน/สิทธิ์รั่วหรือใช้งานหลักไม่ได้, P2 = workflow หรือ UI ผิดแต่มีทางเลี่ยง, P3 = ข้อความหรือความสะดวกเล็กน้อย การประเมินนี้เป็นผลทดสอบ ไม่อนุญาตให้แก้โค้ดโดยอัตโนมัติ

## ทะเบียนการทดสอบ

| ID | ชั้น / ขอบเขตและ expected | สถานะ 29 ต.ค. 2026 | หลักฐาน / งานถัดไป |
|---|---|---|---|
| B01 | Git / build: ระบุ commit และ compile ผ่าน | ผ่าน | baseline B01–B02 |
| A01 | Runtime: tests ทั้งหมดผ่าน ไม่มีส่งจริง | ผ่าน | ล่าสุด145/145ในแชตบทสนทนา บนworking treeหลังฐาน12a6006; baselineเดิม132/132; temp stores / mock SDK transport |
| A02 | Import: validation ผ่านและ invalid input ไม่ทับ last-good | ผ่าน | 9/9; Python 3.11.8; output ชั่วคราว |
| U01 | Settings temp: save → mock trial → review → explicit apply → reload คงค่า | ผ่าน | baseline U01; ไม่เรียก provider จริง |
| U02 | FAQ temp: preview แสดงคำตอบและแหล่งข้อมูลทั้งร่าง/active | ผ่าน | baseline U02; ไม่ใช้โมเดล |
| U03 | มือถือ 390px: preview FAQ แล้ว document ไม่ล้น | พบปัญหา | BUG-001, P2; 375 → 631px หลัง preview |
| U04 | ลูกค้า/กลุ่ม temp: profile/provenance/notes/tags/membership/consent/conflict/reload | ยังไม่ทดสอบ | มีผล browser รอบ 28 ต.ค.; ยังไม่รัน CUA ใหม่รอบนี้ |
| U05 | บทสนทนา temp: ค้น/รับช่วง/ยกเลิกยืนยัน/ส่ง mock หนึ่งครั้ง/คืนบอต/draft isolation | ผ่าน (Playwright temp) | scripts/conversation-ui.test.mjs: เพิ่มตัวกรอง/ป้ายรอและStaff ตรวจจอใหญ่/มือถือผ่าน29ต.ค.; ไม่ใช่การรันCUAชุดbaselineซ้ำ |
| U06 | งานรอดูแล temp: รับงาน/มอบหมาย/note/timeline/retry/conflict/link ตัวตน/reload | ยังไม่ทดสอบ | รัน CUA ใหม่กับคำขอจำลอง ไม่เปลี่ยนคำขอจริง |
| U07 | ข่าว temp: consent filter/dedupe/review invalidation/grant เฉพาะข่าว/mock dispatch | ยังไม่ทดสอบ | API/runtime ผ่านแยกจาก UI; ไม่สร้างสิทธิ์ข่าวจริง |
| U08 | KM temp: draft/diff/publish/rollback/conflict/reload | ยังไม่ทดสอบ | รอบนี้ตรวจ preview เท่านั้น; ผล publish รอบเก่ายังอยู่ใน KM_GUIDE |
| L01 | เว็บจริง: จัดการบอตอ่านได้, settings/KM revision และ news gate ระบุชัด | ผ่าน | baseline L01–L03; ไม่ใช้ปุ่มเขียนข้อมูลจริง |
| M01 | โมเดลจริง: คำถามสาธารณะ ได้คำตอบตามเกณฑ์โดยไม่เปลี่ยน active | ยังไม่ทดสอบ — ผู้ใช้ให้ข้ามไว้ก่อน | คำสั่งในแชตทดสอบ29ต.ค.; ยังไม่นับผ่านและไม่เรียกเพิ่มเพื่อประเมินคุณภาพ |
| X01 | แชตทดลอง model-first: อ่านเจตนา/บริบทก่อนเลือก FAQ; temp isolation | ผ่านเฉพาะ implementation mock/check | 31ต.ค. รุ่นแรกfull175/175; หลังแก้คำคุยทั่วไป178/178; หลังแก้filtersว่างล่าสุด181/181ผ่าน มีtestเดิมfalse positive timestampรอบก่อนบันทึกแยก; ผลโมเดลจริงอยู่X02/X03 ดู NATURAL_CHAT_EXPERIMENT.md |
| X02 | ความเป็นธรรมชาติและเวลาตอบของเวอร์ชันทดลอง | ผ่านเฉพาะ replay3ข้อความหลังปรับ | ผู้ใช้พบ “เยอะเลยนะ” → unknown; ปรับเฉพาะทดลองแล้วGroqจริงตอบchatตรงบริบท711ms ใช้3requestsรวมทั้งreplay; ยังไม่ครบชุด8ข้อความ/compactionเดิม ดู NATURAL_CHAT_EXPERIMENT.md |
| X03 | ขอรายชื่อหลักสูตรหลังresetต้องแสดงได้ | ผ่านเฉพาะเคสหลังแก้ | ทำซ้ำก่อนแก้ได้ว่าJSONถูกแต่filters:[]ไม่ผ่านschema; normalizeเฉพาะmodel-firstและปรับrepair หลังแก้Groqจริงแสดง20รายการ/หน้าแรก3รายการ507ms/1request; ดูหลักฐานbefore/afterในNATURAL_CHAT_EXPERIMENT.md |
| X04 | ตรวจรับเวอร์ชันสนทนาทดลองบนTerminalร่วมกับเจ้าของ | ผ่านตามเจ้าของยืนยัน | 31ต.ค. เจ้าของระบุ “ผ่านแล้ว” หลังทดลองรุ่นที่ปรับ; ไม่ระบุรายข้อจึงไม่อ้างครบ30ข้อความหรือทุกกรณี ยังไม่ใช่การอนุมัติสลับLINE/commit/push |
| X05 | รวมการคุยใหม่เข้าทางปกติTerminal/LINEส่วนตัว โดยคงstores/workflows | ผ่านเฉพาะ source/build/mock integration | เจ้าของสั่งรวม31ต.ค.; ชุดเฉพาะ21/21/full185/185ผ่าน ใช้temp/mock; npm run chatโหลดโค้ดใหม่เมื่อเปิดใหม่ ส่วนLINEจริงยังไม่restartและยังไม่ทดสอบE2Eหลังรวม กลุ่มคงเดิม |
| X06 | ร่างจองที่รอชื่อหลักสูตรต้องไม่ดักคำถาม/คำคุยทั่วไป | ผ่านเฉพาะ source/build/mock และtemp model replay | ผู้ใช้พบวนถามชื่อคอร์สในLINE06:41; แก้action trigger/selectionและhost capabilitycontext ชุดเฉพาะ33/33/full188/188ผ่าน; modelจริง3คำถามไม่วนและrecords0 ยังไม่ยืนยันLINE E2Eหลังแก้ |
| X07 | system promptและคำอธิบายความสามารถจอง/สมัครต้องสอดคล้องกัน | ผ่านเฉพาะ source/build/mock — รอทบทวนprompt | เจ้าของพบคำตอบขัดกัน06:48; แยกMODEL permissionกับHOST capabilitiesและhost capabilitytopic ชุดเฉพาะ42/42/full190/190ผ่าน ยังไม่replaymodelจริงหรือrestartLINEหลังแก้prompt ดูsnapshotbefore/review |
| X08 | ถามทำอะไรได้บ้างต้องสรุปความสามารถจริงและชี้/help | ผ่านเฉพาะ source/build/mock และtemp model replay | แยกcapabilitytopicจากidentityตามhost flags ชุดเฉพาะ27/27/full192/192ผ่าน; modelจริงสามข้อความแยกwhat/whoถูก ใช้3requests records0; ยังไม่LINE E2E/restartหลังแก้ |
| X09 | ถามความจำ/ขอจำเพิ่ม/คุยทั่วไปต้องแยกกัน | ผ่าน source/build/mock และ temp model replay | เพิ่ม host recall เฉพาะ identity ปัจจุบัน ตัด keyword fallback; mock เฉพาะ32/32, full regression196/196 โมเดลจริง4ข้อความถูก flow ไม่มี LINE transport ดู NATURAL_CHAT_EXPERIMENT.md และ memory-recall-live.json; ยังไม่ restart LINE |
| X10 | ถามคอร์สกว้างให้เลือกด้านหนึ่งครั้ง แล้วแสดงรายการตามด้านทันที | ผ่าน source/build/mock และ temp model replay | เฉพาะ25/25, full249/249; real4turns/5calls broad→chat, AI→list, all→list, personal→advise; ไม่มี LINE transport/restart ดู test-evidence/2026-11-01-browsing |
| X11 | กลุ่มเข้าใจคำถามความสามารถแบบเดียวกับส่วนตัว และชี้บริการส่วนตัว | ผ่าน source/build/mock และ temp model replay | group model-first+host referral ตาม flags; เฉพาะ33/33, full252/252 หลังแก้ compaction commit, real2turns/2calls; slash/identity isolationยังอยู่ ไม่มี LINE transport/restart ดู test-evidence/2026-11-01-group-capabilities |
| X12 | จำลอง LINE ส่วนตัว/กลุ่มผ่าน Terminal ด้วยข้อมูลชั่วคราว | ผ่าน source/build/mock และ CLI model smoke | chat:line/chat:group ผ่าน adapter จริงแต่ใช้ reply sink, slash/คำขอ/ความจำ/waiting/กลุ่มแยกกัน; เฉพาะ21/21 full257/257, modelจริงโหมดละหนึ่งข้อความ ไม่มี LINE transport/restart ดู test-evidence/2026-11-01-terminal-line |
| X13 | ประวัติผู้สอนแยกจากคอร์สที่สอน และวิธีแอดบอตแยกจากเจ้าหน้าที่ | ผ่าน source/build/mock และ temp model replay | profileตอบหลักฐานบทบาท+ระบุmissingbio ไม่แต่งประวัติ; private-helpไม่เดาID/link; เฉพาะ28/28 full261/261, modelจริง4turns/4calls ไม่มี LINE transport/restart ดู test-evidence/2026-11-01-person-private-chat |
| X14 | รุ่นทดลองค้นหลักฐานแล้วเรียบเรียง ไม่ผูกกับคำตอบ FAQ ตายตัว | ผ่าน source/build/mock และ temp comparison ตามเกณฑ์หลัก | grounded opt-in, sourcesตรวจID/quote, unknownไม่แนบFAQ; เฉพาะ13/13 full269/269; standardจริง8messages/10calls, core6/6จากผลเดิม ภาษาadvisoryตามเจ้าของสั่ง ยังไม่รับรองsemantictruth/naturalnessทุกคำตอบหรือ LINE E2E ดู test-evidence/2026-11-01-grounded |
| X15 | หลายquoted passagesจากแหล่งเดียวไม่ทำให้คำตอบถูกทิ้ง | ผ่าน source/build/mock และ exact-plan/live replay | exact12quotes/1sourceผ่านและตรวจทุกquote; distinctsource<=6 ผลค้นยังtop6keywordเดิม; เฉพาะ17/17 full273/273, live4turns/8callsตอบข้อมูลผู้สอนได้ aiกำกวมขอclarify ยังไม่ LINE E2E ดู test-evidence/2026-11-01-grounded-references |
| X16 | รายการไม่ล้มเพราะunused fields และquoteจริงไม่ล้มเพราะยาวเกิน800 | ผ่าน source/build/mock และ exact-plan/live replay | normalized non-read projection, readยัง1-5fields, longquoteต้องsubstringจริง; เฉพาะ20/20 full276/276, live2turns/4calls canvaตอบคอร์ส+sourceได้ ไม่มีLINEtransport ดู test-evidence/2026-11-01-grounded-canva |
| X17 | ถามต่อใช้บริบทพร้อมหลักฐานที่เพิ่งอ้าง | ผ่าน source/build/mock และ live replay | bounded source pointers reloadเฉพาะpublished docs; compaction/reopenคงอยู่ reset/identity/handoverแยกชัด; เฉพาะ30/30 full280/280, live research→ใครสอน2turns/3calls คำถามต่อ1call ไม่มี LINE transport ดู test-evidence/2026-11-01-grounded-followup |
| X18 | คำตอบขาด/ว่าง/JSONไม่สำเร็จมีbounded recovery ไม่ทิ้งcurrent validated read | ผ่าน source/build/mock และ normal-path live replay | forcedfailuresตรวจfallback/shortrepair/no stale data/no network retry; เฉพาะ24/24 full285/285 liveสองประโยค2turns/4callsไม่มีformatfail แต่ก่อนแก้ก็ไม่reproduceทุกครั้ง จึงไม่อ้างroot providerfailureแน่นอน ดู test-evidence/2026-11-01-grounded-format-recovery |
| X19 | คำถามกว้างในnextถามด้านที่สนใจก่อนหนึ่งครั้ง | ผ่าน source/build/ชุดเดิม และ live replay | grounded may→must subject questionตามcopyเจ้าของ; เฉพาะ29/29, real3turns/5calls ถามด้าน→AIlist→moreไม่ถามซ้ำ ไม่มีLINEtransport ดู test-evidence/2026-11-01-grounded-interest |
| X20 | Workshop n8nมีผู้สอนจากคำยืนยันโครงการโดยไม่ปลอมwebprovenance | ผ่าน source/build/mock และ live replay | fill-only confirmationผูกID+URL, reader/search/RAG/APIตรงกัน, แยกperson_profileกับcourse instructor; เฉพาะ40/40 full290/290, live2turns/4callsแยกWorkshop/Videoถูก ไม่มีLINEtransport ดู test-evidence/2026-11-01-workshop-instructor |
| X21 | จัดข้อมูลหลักสูตรเป็นหมวด แยกจากโค้ด และคงข้อมูลเดิมครบ | ผ่าน build/runtime/import | เปรียบเทียบ snapshot เดิมครบทั้ง20รายการและ metadata; runtime292/292, importer11/11 รวม atomic rejection และการเก็บคำยืนยันตาม ID+URL ดู test-evidence/2026-11-01-catalog-layout |
| X22 | ชื่อผู้สอนปกติ ไม่มีส่วนคำยืนยันจากแชต | ผ่าน build/runtime/import | teaching.instructors ใช้ร่วมกับ reader/search/RAG/API; เฉพาะ13/13 importer11/11 runtime292/292 ดู test-evidence/2026-11-01-ordinary-instructors |
| X23 | เติมผู้สอน4หลักสูตร คอร์สฟรี3รายการ และล้างตัวเตือนผู้สอนที่แก้แล้ว | ผ่าน build/runtime/import | ชื่อผู้สอนครบ ราคาFreeแสดงเรียนฟรี เก็บชื่อ/ราคาหลังนำเข้าเมื่อเว็บว่าง; เฉพาะ22/22 importer11/11 runtime293/293 ดู test-evidence/2026-11-01-course-completion |
| X24 | grounded เป็นค่าเริ่มต้นของคำสั่งปกติบน local | ผ่าน build/runtime/จำลอง LINE | old-memory reopen/isolation, catalog/unknown, direct/group defaultsและgates, CLIไม่ต้องnext; เฉพาะ57/57 full295/295 ไม่มีdeploy/restart/LINEจริง ดู test-evidence/2026-11-01-grounded-default-local |
| E01 | LINE: FAQ/ลิงก์, AI ค้น/ดูต่อ, คำขอ confirm → receipt → เว็บ, memory | ผ่าน (หลักฐานรอบก่อน) | เจ้าของยืนยัน 28 ต.ค.; ไม่ขอให้ทำซ้ำเพราะแยกแชต |
| E02 | LINE: ข่าวที่เจ้าของอนุญาตหนึ่งข่าว/หนึ่งผู้รับ | ผ่าน (หลักฐานรอบก่อน) | NEWS_GUIDE: เจ้าของกดยืนยันและได้รับแล้ว; ไม่ครอบคลุมหลายผู้รับ |
| E03 | LINE: รับช่วงคุย/ส่งผู้ดูแล/คืนบอตจริง | ผ่าน (เจ้าของยืนยัน) | เจ้าของยืนยันในแชตทดสอบ29ต.ค.ว่า “ข้อ 2 ทำเสร็จแล้ว” ตามรายการรับช่วง→ส่งผู้ดูแล→คืนบอต; ไม่ขยายผลเป็นการประเมินคุณภาพคำตอบครบทุกกรณี |
| E05 | LINE: ขอคุยกับเจ้าหน้าที่ → รายการรอ; หยุดบอต/ยกเลิกรอ | ผ่านเฉพาะขอคุย→รายการรอ | เจ้าของยืนยัน29ต.ค.; หยุดบอต/ยกเลิก/ซ้ำ/restartผ่านtestsจำลอง ยังไม่มีผลLINEจริงแยกรายกรณี; แจ้งในเว็บเท่านั้น |
| E04 | กลุ่ม/คุณภาพ/error/cost/rollback เทียบเกณฑ์ครบ | ยังไม่ทดสอบครบ | เจ้าของเคยลองกลุ่มแล้ว; ยังต้องรวบรวมผลที่ขาด |
| O01 | “555” แล้วเลื่อนหน้า | ยอมรับข้อสังเกต | เจ้าของยอมรับรอบก่อน ไม่เปิดเป็นบั๊ก |
| N01 | ภาพรวม | ไม่มีฟังก์ชัน | เมนู disabled ตามหน้าจอปัจจุบัน |

## ลำดับการดำเนินงาน

1. Baseline และ automation ให้เสร็จก่อน → บันทึกรอบนี้แล้ว
2. CUA กับ temp stores: เติม U04–U08 และตรวจ settings error/rollback เพิ่ม; บันทึก BUG-001 แยกไว้ ไม่แก้ระหว่างทดสอบ
3. การประเมินคุณภาพโมเดลจริง: ผู้ใช้ให้ข้ามไว้ก่อน ยังไม่นับผ่าน หากกลับมาทำให้แสดง provider/model จำนวน sessions และงบ call/token ก่อนเริ่ม ใช้คำถามสาธารณะ ไม่เปลี่ยน active; ปุ่มเปรียบเทียบเรียกสอง sessions และอาจ repair ภายใน budget เดิม ไม่ถือหนึ่งคลิกเท่ากับหนึ่ง model call
4. LINE ร่วมเจ้าของ: ทดสอบเฉพาะช่องว่างที่ยังไม่มีหลักฐาน ถามทีละข้อและรอผล; ส่ง/รับช่วง/คืนบอต/แก้ข้อมูลจริงต้องยืนยันตาม workflow ก่อนทำ
5. สรุป acceptance และอัปเดต milestone เฉพาะผลที่มีหลักฐาน ไม่เหมาว่าระบบพร้อม production

## Acceptance ที่ต้องร่วมกับเจ้าของ

- คุณภาพคำตอบโมเดลจริง: ผู้ใช้ให้ข้ามไว้ก่อน ยังไม่ผ่านการประเมิน
- รับช่วงคุย → ส่งข้อความผู้ดูแล → คืนให้บอต: เจ้าของยืนยันเสร็จแล้ว29ต.ค. ไม่ขอให้ทดสอบซ้ำในรอบนี้
- เรื่องกลุ่มรอเจ้าของสรุปความหมาย/รูปแบบกับแชตลูกค้าและกลุ่มก่อน แล้วแจ้งกลับ; ไม่นำมาเป็นงานตรวจรับของรอบสนทนานี้ และยังคงข้อเท็จจริงว่าเคยลองกลุ่มแล้ว

ไม่ใช้ข้อมูลจริงสร้าง fixture, ไม่ reset/forget ลูกค้าจริง, ไม่เปลี่ยน consent/FAQ/prompt/model จริงเพื่อทดสอบ, ไม่ส่ง LINE/email/push/campaign เอง ไม่ restart หรือเปลี่ยน credentials/tunnel/webhook และไม่ commit/push หากไม่มีคำสั่งใหม่ ภาพ live เก็บเฉพาะเครื่องตาม .gitignore; ภาพใน repo ต้องเป็น temp เท่านั้น

## ข้อจำกัดที่ต้องแยกจากผลทดสอบ

ยังไม่มี login รายเจ้าหน้าที่, durable inbound LINE queue/dedupe ข้าม restart, งบเงิน/daily budget, และสิทธิ์ผู้เรียนจริงครบถ้วน Outbox ข่าวขาออกไม่ใช่ durable inbound queue การมี transport/worker ไม่ใช่สิทธิ์ส่งข่าว และข้อกำหนด 1,000 ผู้รับต่อข่าวยังไม่ใช่ผล load test ผ่าน

## คำสั่งรันซ้ำ

```sh
npm run build
npm test
CATALOG_PYTHON=/Users/taweesaksamanchuen/.pyenv/versions/3.11.8/bin/python3 npm run test:catalog-import
node scripts/knowledge-ui-fixture.mjs
```

คำสั่งสุดท้ายเปิดเฉพาะ temp QA สำหรับใช้ CUA แล้วหยุด fixture เมื่อจบ หาก sandbox ปิด loopback ให้ขอ escalation ตามระบบ ไม่รัน scripts UI เดิมที่เปิด Playwright เอง; ใช้ศึกษา setup/เกณฑ์แล้วควบคุม UI ผ่าน CUA เท่านั้น
