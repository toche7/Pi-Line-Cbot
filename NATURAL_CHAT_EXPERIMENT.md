# ซีบอตเวอร์ชันทดลอง: สนทนาตามเจตนาและบริบท

31 ตุลาคม 2026 · ฐาน commit `37114e8` · ทดลองบน Terminal แยกจาก LINE

**อัปเดตหลังเจ้าของสั่งรวม:** นำวิธีคุยที่ตรวจรับเข้าทางTerminalและLINEคุยส่วนตัวในsource/buildแล้ว ใช้คำสั่ง `npm run chat` ตามปกติ ความจำ/คำขอกลับใช้storeเดิม คำสั่ง `chat:natural` ยังคงเป็นพื้นที่tempแยกต่างหาก โปรเซสLINEจริงยังไม่restartตามข้อจำกัดเดิม ผลและขอบเขตรอบรวมอยู่ท้ายเอกสาร ข้อความที่เล่าว่าentrypointsเดิมยังใช้rules-firstด้านล่างเป็นประวัติช่วงทดลองก่อนรวม

## เป้าหมายและขอบเขต

ลดการตอบผิดเรื่องจากการพบคำสำคัญ เช่น “ไม่ได้ถามเรื่องใบเสร็จ” แล้วกลับตอบวิธีขอใบเสร็จ หรือทัก “hi” แล้วได้รับรายการความสามารถยาว ๆ

รุ่นนี้เปลี่ยน **วิธีเลือกคำตอบ** ก่อน: ให้โมเดลอ่านบริบท คำปฏิเสธ การแก้ความเข้าใจ และการเปลี่ยนเรื่อง จากนั้นเลือก chat/knowledge/catalog_query ตามสัญญาเดิม ข้อเท็จจริง FAQ/หลักสูตรยังให้ host แสดงจากข้อมูลที่ตรวจแล้ว ไม่เปิดให้โมเดลแต่งราคา แหล่งข้อมูล หรือการส่งเรื่องเอง จึงยังมีคำตอบ FAQ ที่เป็นข้อความคงที่ ไม่รับรองว่าทุกคำตอบจะลื่นไหลแล้ว

ไม่มี provider/model ใหม่: อ่านสำเนา active settings และ published knowledge จาก repo ณ ตอนเปิด; ถ้ายังไม่มีไฟล์ ใช้ baseline เดิมจาก environment/seed ไม่อ่านร่างมาเป็นคำตอบ ใช้ SDK และ memory/request workflows เดิม แต่เก็บข้อมูลทดลองใน temp เท่านั้น ไม่อ่าน memory ประวัติ ทะเบียน หรือคำขอของลูกค้าจริง ไม่มี LINE adapter/transport/worker ใน entrypoint นี้

## เปิดใช้งาน

รันจากโฟลเดอร์ `pi-sdk-demo`:

```sh
npm run build
npm run check:natural
npm run chat:natural
```

- `check:natural` สร้าง session เพื่อตรวจ config/credential presence โดยไม่เรียกโมเดล สถานะ configured=true ไม่รับรองว่า key ยังใช้ได้ โควตาพอ หรือมีสิทธิ์โมเดล
- `chat:natural` เป็น model-first; ข้อความทั่วไป รวมคำทักทายและ FAQ จะเรียก provider จริงและใช้โควตา ต้องมี key ที่ใช้งานได้ใน environment เดิม ไม่เปลี่ยนหรือสร้าง key ผ่านคำสั่งนี้
- `/help`, `/memory`, `/reset`, `/exit` และขั้นยืนยันคำขอที่ชัดเจนยังเป็น host workflows; ไม่ใช่ทุกคำสั่งที่ต้องเรียกโมเดล
- ออกจากโปรแกรมแล้วลบ temp memory/requests/config/cache ใน finally การเปิดครั้งถัดไปเริ่มใหม่ ข้อความยืนยันบันทึกในแชตหมายถึง temp ของรอบนี้เท่านั้น ไม่ใช่งานจริงที่จะขึ้นเว็บ3001
- การปิดแบบ SIGKILL/เครื่องดับอาจเหลือ temp directory ชื่อ `cbot-natural-*` ใน OS temp ไม่ใช่ข้อมูลเข้า runtime จริง

เปิดเทียบ **กฎเดิม** โดยยังใช้ temp ที่แยกเหมือนกัน:

```sh
npm run chat:natural -- --rules-first
```

สองคำสั่งเปิดเป็นคนละ session ไม่มีประวัติร่วมกัน ค่าบอตจริง FAQ จริง `.env` และ LINE ไม่ถูกแก้ ไม่ต้อง restart LINE ไม่มีการสลับโหมดจากหน้า admin หรือ environment flag ที่เผลอเปลี่ยน server ทั้งระบบ

## สิ่งที่เปลี่ยนในโค้ด

- `CustomerCore` มีอาร์กิวเมนต์ mode ท้าย constructor ค่าเริ่มต้น `rules-first`; main/server เดิมไม่ส่งอาร์กิวเมนต์นี้ จึงใช้พฤติกรรมเดิม
- `model-first` ข้าม lexical catalog/FAQ และกฎอ้างหัวข้อก่อนหน้า แล้วให้ planner ตัดสินใจตามข้อความปัจจุบัน กติกาการยืนยัน/ความจำ/การกรองข้อมูลเดิมยังอยู่
- prompt เสริมเฉพาะโหมดทดลองบอกให้รับคำแก้ความเข้าใจ ไม่จับ keyword เป็นคำขอ ไม่ถือเสียงหัวเราะเป็นดูต่อ และทักทายสั้น ๆ
- เมื่อเลือกคำตอบจาก host จะเพิ่มคำตอบจริงลงบริบทสำหรับรอบต่อไป โมเดลจึงไม่เห็นเพียง topic ID
- auth/deadline/format repair และเพดาน token/calls ใช้กลไกเดิม รุ่นทดลองต้องใช้โมเดลกับ FAQ ด้วย จึงไม่มี FAQ fallback อัตโนมัติเมื่อ key/โควตามีปัญหา และไม่แสดงข้อความชวนใช้ FAQ ระหว่าง429แบบโหมดเดิม

## แผนลองโมเดลจริงชุดเริ่มต้น — ยังไม่รันครบชุด

เริ่มสองสถานการณ์สั้น ๆ แยกกันก่อน ไม่ใช้ข้อมูลลูกค้าจริง ไม่ส่ง LINE และไม่ทดสอบกลุ่มที่ยังรอสรุปความหมาย

| สถานการณ์ | ข้อความตามลำดับ | เกณฑ์ตรวจรับ |
|---|---|---|
| แก้ความเข้าใจ | “ขอใบเสร็จ” → “ไม่ได้ถามเรื่องใบเสร็จแล้ว แค่อยากคุย” → “ทำไรอยู่” → “555” | ข้อ1มีคำตอบ/แหล่งข้อมูล; หลังแก้เรื่องไม่ตอบFAQใบเสร็จซ้ำ; คุยทั่วไปตรงข้อความ; หัวเราะไม่เลื่อนรายการ |
| บริบทและความกำกวม | “hi” → “อยากรู้เรื่องใบประกาศ” → “เมื่อกี้บอกให้เข้าหน้าไหนนะ” → “ไม่ใช่เรื่องใบประกาศแล้ว” | ทักสั้น ๆ; ตอบFAQที่มีจริง; อ้างบริบทเดิมถูกหรือถามกลับสั้น ๆ; ยอมเปลี่ยนเรื่อง ไม่ส่งFAQซ้ำ |

บันทึกแต่ละ turn: input/output, วันที่/commit/settings version, elapsedMs, provider/model, จำนวน calls/tokens, error/fallback และผ่าน/พบปัญหา/ยังไม่ทดสอบ แยกความตรงคำถาม ความต่อเนื่อง ความยาว/การถามกลับ และเวลา ไม่ใช้ผลmockตัดสินความเป็นธรรมชาติ

ขอบเขตก่อนเริ่มจริง: 8ข้อความรวมสองสถานการณ์; โดยทั่วไป1requestต่อข้อความ มีformat repairเพิ่มได้หนึ่งครั้งในdeadlineเดิมและไม่เกินcall budget จาก config ที่แสดงตอนเปิด ไม่มีretry401/429อัตโนมัติ หากเกิดauth/quotaให้หยุดวิเคราะห์ก่อน ไม่ยิงต่อเพื่อให้ครบจำนวน หากใช้ค่าเริ่มต้น800 output tokens/call จะมีเพดานสร้างคำตอบสูงสุด12,800tokensสำหรับ16requests; input context/tokensคิดแยกและยังมีค่าใช้จ่ายได้ ไม่ได้จองหรือรับรองค่าใช้จ่ายเป็นเงิน

## หลักฐานตอนสร้างรุ่นแรก 31 ต.ค. 2026

- Buildผ่าน; ชุดเฉพาะ natural/core/dialogue/chat14/14ผ่านด้วย SDK + mock transport
- naturalใหม่6ข้อ: คำปฏิเสธ/แก้ความเข้าใจ/ทักทายเข้าตัวplanner, follow-up/เสียงหัวเราะไม่โดนhostดักตอบ, คำปฏิเสธที่กล่าวถึงหลักสูตรไม่โดนcatalogดัก, ค่าเริ่มต้นproductionยังตอบFAQ/ทักทายโดยไม่ยิงmodel, CLIcheckใช้tempและคงcwd/ไฟล์ตัวอย่างส่วนตัวเดิม, help/exitระบุพื้นที่ทดลองและไม่อ้างเก็บข้ามรอบ
- `npm run check:natural` ผ่าน, รายงาน groq/qwen/qwen3.8-27b configured=true โดยไม่เรียกprovider; ไม่ได้ยืนยันสิทธิ์keyปัจจุบัน
- Full regression175/175ผ่าน (fail/skip/cancel0, 11.00s), [ผลดิบ](./test-evidence/2026-10-31-natural/runtime.txt) เป็น working treeหลังฐาน37114e8 ไม่ใช่ผลของcommitใหม่ รอบแรกในsandboxติดHTTP listeners `EPERM` จึงรันนอกsandboxด้วยtemp/mockแล้วผ่านทั้งหมด
- CLIจริง `/help` → `/exit` ผ่าน exit0 ไม่มีmodel turn; แสดงคำขอเป็นพื้นที่ทดลองและข้อความลบtempเมื่อจบ ไม่อ้างว่าความจำจะอยู่รอบถัดไป
- ตรวจ listeners หลังทดสอบ LINEยังเป็น PID6419 บน3000/3001 ไม่ได้restart ไม่ได้เทียบbytesของruntimeทุกไฟล์เพราะบริการจริงยังทำงาน
- ยังไม่เรียกโมเดลจริง ไม่ส่งLINE ไม่restartหรือเปลี่ยนconfig/credentials/tunnel/webhook ไม่commit/push

ณจุดส่งรุ่นแรกยังไม่ได้ประเมินคุณภาพจริง; ผลเพิ่มเติมภายหลังอยู่ด้านล่าง ไม่ปรับ milestone เป็นคุยธรรมชาติผ่านครบแล้ว

## ปรับหลังผู้ใช้พบ “เยอะเลยนะ” แล้วตอบไม่พบข้อมูล

31 ตุลาคม 2026 · working treeหลังฐาน37114e8 · Terminalทดลอง model-first · ไม่เปลี่ยนโหมดproduction/LINE

**หลักฐานจากผู้ใช้:** ค้นAIได้12รายการ → ถามหลักสูตรทั้งหมดได้20รายการ → แสดงความคิดเห็น “เยอะเลยนะ” แต่บอตตอบข้อความ unknown สำเร็จรูป ผลเป็น **พบปัญหา P2** ด้านความต่อเนื่องของบทสนทนา เวลาที่ผู้ใช้รายงานคือ466/688/810ms แต่ไม่มีraw planของรอบนั้น จึงยังสรุปไม่ได้ว่าต้นเหตุในturnจริงเป็นunknown intentหรือchatที่ถูกrendererปัดทิ้ง

**ทำซ้ำที่ host ได้:** แม้planเป็นchatและreplyว่า “มีหลักสูตรให้เลือกหลายแบบเลยครับ อยากให้ช่วยคัดให้ไหมครับ” ตัวตรวจข้อเท็จจริงเดิมก็คืนunknown เพราะตรงกฎ `มี…หลักสูตร` แสดงว่ามีเส้นทางทำให้คำคุยทั่วไปกลายเป็นnot-foundได้ ไม่ใช่หลักฐานว่าโมเดลต้นทางเลือกunknownแน่นอน

**ปรับเฉพาะ model-first:** เสริมคำสั่งให้แยกความเห็น/ความรู้สึกต่อคำตอบก่อนหน้าออกจากคำถามข้อเท็จจริง หากchatถูกrendererเปลี่ยนเป็นunknown ให้เรียบเรียงคุยทั่วไปใหม่ได้หนึ่งครั้งในdeadlineและcall budgetเดิม กติกาตรวจข้อเท็จจริงยังเดิม ไม่ทำkeyword bypassหรือhardcodeคำตอบให้ “เยอะเลยนะ” ถ้าซ่อมยังมีข้ออ้างที่ไม่ผ่านหรือเปลี่ยนเป็นintentอื่น ให้แจ้งล้มเหลวโดยไม่commitประวัติและไม่executecatalog actionแทนคำคุย

**Expected:** รายการหลักสูตรยังมาจากhost; “เยอะเลยนะ” ได้คำรับความเห็น/เสนอช่วยคัดอย่างสั้น ไม่ตอบunknown ไม่เลื่อนหน้า ไม่บันทึกความชอบหรือส่งคำขอเอง

**Actual หลังปรับ — โมเดลจริง:** replayสามข้อความเดียวกันในtemp sessionใหม่ ใช้groq/qwen/qwen3.8-27b, settings initial, สูงสุด6requestsที่แจ้งก่อนเริ่ม ใช้จริง3requests ไม่มีrepairในรอบนี้ providerรายงานtotalTokensรวม12,868 (input/outputรวมกัน ไม่ใช่ค่าเงินหรือbilling reconciliation):

| ข้อความ | ผล | เวลา core wall-clock | requests |
|---|---|---|---|
| มีอะไรเกี่ยวกับ ai บ้าง | catalog_query/list; พบ12 แสดง1–5 | 520ms | 1 |
| มีหลักสูตรอะไรบ้าง | catalog_query/list; พบ20 แสดง1–10 | 551ms | 1 |
| เยอะเลยนะ | chat: “เยอะจริง ๆ เลยครับ อยากให้ช่วยคัดตามความสนใจหรือรูปแบบเรียนไหมครับ เช่น เรียนออนไลน์อย่างเดียว หรือเน้น AI/ข้อมูล” | 711ms | 1 |

สถานะ **ผ่านเฉพาะreplay3ข้อความนี้**; ยังไม่ครอบคลุมประวัติก่อนหน้า/compactionทั้งหมดในsessionผู้ใช้หรือคุณภาพทุกประโยค [ผลโมเดลจริง](./test-evidence/2026-10-31-natural/reaction-live.json) เป็นข้อมูลทดลองสาธารณะ ไม่มีข้อมูลลูกค้า ไม่มีLINE transport และลบtempเมื่อจบ

เพิ่มcontract tests3ข้อ: chatguardแล้วrepairกลับคุยได้และไม่เปลี่ยนcatalogstate; repairสองครั้งไม่ผ่านต้องหยุดโดยไม่ล้างguard; repairเปลี่ยนintentไม่ได้ ชุดnatural/core/dialogue15/15ผ่านด้วยmock; full regressionรันซ้ำ178/178ผ่าน (fail/skip/cancel0, 11.95s) [ผลชุดเต็มหลังแก้](./test-evidence/2026-10-31-natural/reaction-runtime.txt) แยกจาก175/175ของรุ่นแรกและรอบที่พบtestfalse positiveด้านล่าง

การลองproviderครั้งแรกในsandboxติดnetworkก่อนรับคำตอบ จึงขอescalationแล้วreplayภายนอกจนจบ ไม่มีการลองkeyใหม่/แก้.env/restartLINE ไม่ใช้ผลนี้อ้างว่าLINEรับkeyล่าสุดแล้ว Terminal chatที่เปิดอยู่ก่อนbuildต้อง `/exit` และเปิด `npm run chat:natural` ใหม่จึงใช้โค้ดล่าสุด (เริ่มtemp sessionใหม่)

**ข้อสังเกตชุดทดสอบเดิม:** full regressionหลังแก้รอบแรก177/178 พบ `src/memory.test.ts:144` ใช้regex `/private-fixture|GROQ_API_KEY|429|reasoning/` กับJSONทั้งไฟล์ แล้ว `429` ไปตรงกับtimestamp `1793402191429` ไม่ใช่error/ข้อมูลลับหลุด หลักฐาน [ผลรอบที่มีfalse positive](./test-evidence/2026-10-31-natural/reaction-runtime-flaky.txt) แยกรันmemory4/4ผ่าน ไม่แก้testเดิมเงียบ ๆ ข้อเสนอแยกคือใช้clockคงที่ในtestหรือตรวจเฉพาะfieldข้อความแทนทั้งJSON

## แก้รายการหลักสูตรล้มแม้ /reset แล้ว

31 ตุลาคม 2026 · ฐาน37114e8พร้อมworking treeทดลอง · ขอบเขตTerminal model-first/temp · ผู้ใช้รายงาน “ขอดูหลักสูตรหน่อย” ไม่ผ่านรูปแบบสองครั้ง แม้resetแล้ว ผลก่อนแก้ **พบปัญหา P2**

**ทำซ้ำกับโมเดลจริงก่อนแก้ได้:** Groqส่งJSONที่parseได้ทั้งสองครั้งเหมือนกัน:

```json
{"intent":"catalog_query","operation":"list","scope":"all","query":"","fields":["name"],"filters":[],"limit":10,"order":"asc"}
```

ต้นเหตุคือ `validCourseFilters` ไม่รับarrayว่าง แต่templateคำสั่งเดิมชวนให้เติมทุกช่อง จึงเกิดคำสั่งที่หมายถึงไม่กรองแต่ไม่ผ่านschema ตัวcatchแสดงเป็นJSON/รูปแบบผิดและrepairไม่ได้บอกช่องที่ผิด โมเดลจึงส่งแผนเดิมซ้ำ `/reset`ล้างบริบทแต่ไม่เปลี่ยนความขัดแย้งระหว่างtemplateกับschema [หลักฐานก่อนแก้](./test-evidence/2026-10-31-natural/catalog-before.json)

**แก้:** ในโหมดmodel-firstเท่านั้น normalize `filters:[]` เป็นไม่ระบุตัวกรอง โดยไม่แก้objectต้นฉบับ/ไม่ทิ้งfilterที่มีจริงและไม่ผ่อนfield/value/limit แก้promptให้ยกตัวอย่างคำสั่งขั้นต่ำและomitช่องที่ไม่ใช้ กรณีschemaผิดจริงให้repairด้วยcontractค้นหลักสูตรที่ชัดเจนหนึ่งครั้งในbudget/deadlineเดิม หากยังผิดแจ้งว่า “คำสั่งค้นหลักสูตร” ไม่ผ่าน ไม่โทษJSONหรือชวนreset; repairห้ามเปลี่ยนเป็นchatเพื่อซ่อนว่าค้นไม่สำเร็จ โหมดstrictที่productionใช้ยังปฏิเสธแบบเดิม ไม่มีเพิ่มkeyword routingสำหรับประโยคนี้

**Expected/Actualหลังแก้:** คำถามทั่วไปแสดงรายชื่อจากcatalogจริงได้ เริ่มsessionใหม่ถาม “ขอดูหลักสูตรหน่อย” ได้ “พบ20รายการ แสดง1–3” ภายใน507ms ใช้1request โมเดลเลือก `catalog_query/list/all/limit3` ไม่มีrepair [หลักฐานหลังแก้](./test-evidence/2026-10-31-natural/catalog-after.json) เป็นผลผ่านเฉพาะเคสนี้ ไม่ใช่ทุกคำถามและไม่ใช่LINE E2E

ขอบเขตที่แจ้งก่อนเรียกจริง: ก่อนแก้สูงสุด2requests ใช้จริง2; หลังแก้สูงสุด2 ใช้จริง1; provider/modelเดิม groq/qwen/qwen3.8-27b; tempถูกลบหลังจบ ไม่แก้keyหรือrestartLINE

เพิ่มcontract tests3ข้อ: แผนจริงfiltersว่างทำงานได้ครั้งเดียวและparserเดิมยังstrict; filterจริงคงเดิมและfield/limitผิดยังถูกปฏิเสธพร้อมrepairเฉพาะเรื่อง; schemaผิดซ้ำ/repairเปลี่ยนเป็นchatต้องล้มด้วยข้อความตรงเหตุ ชุดnatural/core/dialogue/catalog-query23/23ผ่าน; full regression181/181ผ่าน (fail/skip/cancel0, 10.21s) [ผลชุดเต็ม](./test-evidence/2026-10-31-natural/catalog-runtime.txt) รันนอกsandboxเพราะHTTP tests5ข้อติดlisten EPERMในsandbox ไม่มีเปลี่ยนไฟล์testเดิมเพื่อให้ผ่าน

## รวมวิธีคุยเข้าฟังก์ชันเดิมตามคำสั่งเจ้าของ

31 ตุลาคม 2026 · working treeหลังฐาน37114e8 · เจ้าของขอ “เอากลับไปร่วมในฟังก์ชันเดิม” หลังตรวจรับรุ่นทดลอง

- `src/customer-runtime.ts` เป็นfactoryร่วมของ `main.ts` และcoreสำหรับLINEคุยส่วนตัวใน `server.ts` เลือกmodel-firstตามรุ่นที่ผ่าน; ตัวcoreระดับล่างยังมีrules-firstสำหรับcompatibilityและgroup pathเดิม ไม่สลับโหมดของกลุ่มในงานนี้
- `npm run chat` / `npm start` ใช้การคุยใหม่จากโค้ดที่buildแล้ว เก็บmemoryที่`.customer-memory`และคำขอ`runtime/course-requests`ตามเดิม LINEคง`.line-memory`, control/handover/waitingและstoreอื่นเดิม ไม่มีmigration/reset/forgetหรือย้ายtempเข้าreal data
- `chat:natural`คงไว้เป็นsandboxข้อมูลชั่วคราว; sourceการอ่านเจตนา การซ่อมคำคุยและschemafiltersใช้ร่วมกับทางปกติแล้ว ไม่ต้องคัดลอกชุดกฎอีกชุด
- เพิ่มdialogueModeในoperational metadataโดยไม่มีข้อความ/key และแก้fallbackของLINEคุยส่วนตัวให้ไม่อ้างว่าFAQในแชตยังใช้ได้ขณะmodel-firstติด429/timeout/format ใช้ลิงก์FAQสาธารณะเป็นทางเลือก; กลุ่ม/legacyยังใช้ข้อความเดิมตามความสามารถจริง

**Expected/Actual mock integration:** เปิดทางปกติแล้วเลือกmodel-first, filtersว่างแสดง20รายการได้, ตอบความเห็นต่อเนื่อง, profile/history/คำขอยืนยันคงอยู่เมื่อเปิดใหม่, แยกidentity และ signedLINEผ่านhelp/request confirmation/waiting/pause-release/reset พร้อมข้อความfallbackที่ตรงโหมด — ผ่านด้วยtemp storesและSDK/mock transport จำนวน4integration testsใหม่ ชุดเฉพาะruntime/natural/diagnostics/help21/21ผ่าน; CLIentrypointจริงเรียกเฉพาะ/help,/memory,/exitในcwdชั่วคราวและไม่เรียกmodel

**Full regression185/185ผ่าน**, fail/skip/cancel0, 10.85s [หลักฐาน](./test-evidence/2026-10-31-natural/integration-runtime.txt) รันนอกsandboxสำหรับHTTP loopback; Buildผ่าน; ไม่เรียกproviderจริงหรือส่งLINEเพิ่มในรอบรวมนี้

**สถานะเปิดใช้:** source/buildรวมแล้ว แต่ไม่ได้restartLINEตามข้อจำกัดเดิม ตรวจlistenersยังเป็นPID14614บน3000/3001 ณรอบตรวจ จึงไม่อ้างว่าLINEกำลังใช้โค้ดใหม่หรือE2Eหลังรวมผ่านแล้ว การเปิดTerminalใหม่ด้วย`npm run chat`จะโหลดโค้ดใหม่ หากมีsessionเก่าให้/exitก่อน เปิดใช้LINEต้องรอคำสั่งrestartจากเจ้าของ ไม่แก้credentials/.env/tunnel/webhook ไม่commit/push

## แก้ร่างจองที่รอชื่อหลักสูตรดักทุกข้อความ

31 ตุลาคม 2026 · working treeหลังฐาน37114e8 · ผู้ใช้ส่งหลักฐานLINEจริงเวลา06:41: รอชื่อหลักสูตร → “จองได้แต่สมัครไม่ได้ใช่ไหม” → “เธอทำอะไรได้บ้าง” → “อ้าว” ทุกturnกลับถามชื่อหลักสูตรเดิม สถานะก่อนแก้ **พบปัญหา P2** ด้านconversation lock-in ไม่ใช่หลักฐานว่าโมเดลไม่ทำงาน

**สาเหตุจากcode:** `mayRequestCourseAction`เดิมตรวจคำว่าจองที่ตำแหน่งใดก็ได้ จึงเริ่มร่างใหม่จากคำถามเรื่องความสามารถ; เมื่อdraftเป็นbookingและยังไม่มีcourse ทุกข้อความถูกส่งให้chooseCourseแล้วคืนcoursePrompt แม้ไม่ใช่การเลือกหลักสูตร เกิดก่อนเข้าคิวโมเดล `/reset`ไม่ใช่การแก้สาเหตุด้านroutingนี้

**แก้ในsource/build:** การเริ่มactionธรรมชาติจำกัดเป็นคำขอที่ชัดเจน ไม่ถือcapability question/ข้อความอ้างถึงเป็นการเริ่มจอง ขณะรอเลือกให้รับหมายเลขที่มีอยู่หรือชื่อ/aliasตรงจากcatalogเท่านั้น คำถามที่กล่าวถึงชื่อคอร์ส เช่น “Excel เรียนเกี่ยวกับอะไร” และคำคุยทั่วไปคืนundefinedให้coreคุยต่อ รักษาร่างที่ยังไม่มีtokenภายในexpiryเดิมโดยไม่เลือก/ยืนยันแทนผู้ใช้ เพิ่มhostข้อมูลเฉพาะenabled/pendingStageให้โมเดลอธิบายข้อจำกัดการจองกับสมัครได้ถูก และคำตอบidentityแสดง/book,/contactตามความสามารถจริง ไม่ส่งข้อความร่าง/ข้อมูลลูกค้าเข้าcontextเพิ่ม

**Expected/Actual mock:** capability questionไม่สร้างร่าง; bookingdraftปล่อยสามข้อความตัวอย่างเข้าสนทนา; ชื่อและหมายเลขที่เลือกกลับมาpreviewได้; ไม่มีrecordก่อนconfirm; รหัสยืนยันและข้อมูลแยกidentityคงเดิม — ผ่านทั้งstore testsและsignedLINEกับSDK/mock ชุดเฉพาะ33/33ผ่าน

**Actual model replay:** groq/qwen/qwen3.8-27bในtempและไม่มีLINE transport เริ่ม/book (host,0requests) แล้วถามสามข้อความเดิม ใช้จริง3requestsจากเพดาน6ที่แจ้งก่อนเริ่ม:

| ข้อความ | ผล | เวลา | requests |
|---|---|---|---|
| จองได้แต่สมัครไม่ได้ใช่ไหม | อธิบายว่ารับคำขอจอง/เตรียมประสานงานได้ แต่ยังไม่สมัครสมาชิกหรือลงทะเบียนแทน | 602ms | 1 |
| เธอทำอะไรได้บ้าง | identityพร้อมFAQ/หลักสูตรและคำสั่ง/book,/contact ข้อจำกัดการยืนยันและการส่งต่อ | 537ms | 1 |
| อ้าว | “มีอะไรให้ช่วยเพิ่มเติมไหมครับ?” | 639ms | 1 |

ไม่มีการถามชื่อหลักสูตรซ้ำ ไม่มีคำขอถูกบันทึก (`records=0`) และลบtempเมื่อจบ [หลักฐานโมเดลจริง](./test-evidence/2026-10-31-natural/booking-dialogue-live.json) ไม่ใช่LINE E2Eหลังแก้ ไม่ได้ตัดสินว่าทุกสำนวนเป็นธรรมชาติผ่านแล้ว

**Full regression188/188ผ่าน**, fail/skip/cancel0, 10.57s [หลักฐาน](./test-evidence/2026-10-31-natural/booking-dialogue-runtime.txt) Buildผ่าน ไม่ล้างdraft/memory/requestของลูกค้าจริง ไม่เปลี่ยนkey/config/tunnel/webhook และแมนไม่ได้restartLINE ตรวจlistenersณจุดท้ายรอบเป็นPID34250บน3000/3001 ซึ่งต่างจากรอบรวมก่อนหน้า ไม่อ้างว่าเป็นPIDเดิมหรือยืนยันว่าโปรเซสนี้โหลดpatchล่าสุดแล้ว

ขอบเขตการแก้เฉพาะการเริ่มคำขอและbooking-course selection การรับรายละเอียดcontactและการยืนยันหลังpreviewยังใช้workflowเดิม ข้อมูลจริงที่ยืนยันไว้ไม่ถูกยกเลิก ทางออกชั่วคราวสำหรับผู้ใช้ที่ตั้งใจทิ้งร่างค้างคือ/cancel-request ซึ่งยกเลิกเฉพาะร่าง ไม่ใช่คำขอที่บันทึกแล้ว

## ปรับsystem promptให้แยกสิทธิ์โมเดลกับความสามารถของบอต

31ตุลาคม2026 · เจ้าของพบLINEตอบว่ารับคำขอจองได้ในidentity แต่ปฏิเสธว่าจองไม่ได้เมื่อถามย้ำ และชี้ว่าsystem promptยังอธิบายความสามารถไม่ตรงกัน

ปรับ `cbtuPolicy` ให้แยกMODELที่ไม่มีสิทธิ์ทำรายการเองออกจากHOST workflowที่เปิดใช้จริง: รับร่าง/ยืนยันคำขอจองหรือฝากเรื่องได้ แต่ไม่สมัครสมาชิก ลงทะเบียน ชำระเงิน หรือยืนยันที่นั่ง โมเดลต้องยึดhost capabilities/statusที่เติมรายturn ไม่เดาจากtool allowlistอย่างเดียว และแยกการรับคำขอออกจากexternal dispatch/การรับช่วงLINE

เพิ่มhost topicสงวน `host:course-requests` เฉพาะเมื่อมีCourseRequestsจริง โมเดลเลือกหัวข้อเชิงความหมายจากคำถาม/คำถามย้ำ/คำสะกดผิด จากนั้นhostให้คำอธิบายความสามารถจากconstantเดียวกัน ไม่ใช้replyที่โมเดลแต่งเพื่อปฏิเสธหรืออ้างว่าทำรายการเสร็จแล้ว topicนี้ไม่เข้าKMและไม่เพิ่มสิทธิ์ยืนยัน; ถ้าไม่มีrequest support การเลือกtopicนี้ไม่เปิดฟังก์ชันและได้unknownตามเดิม คำตอบจริงเพิ่มเข้าcontextให้turnต่อไปไม่กลับไปยึดข้อความผิดก่อนหน้า

เก็บpromptฐานสำหรับตรวจเทียบ: [ฐานHEAD37114e8ก่อนแก้](./test-evidence/2026-10-31-natural/system-prompt-before.txt) และ [cbtuPolicyล่าสุดที่เสนอ](./test-evidence/2026-10-31-natural/system-prompt-review.txt) ทั้งสองเป็นpromptหลักจากsource ค่าบุคลิกเพิ่มเติมและคำสั่ง/statusในแต่ละturnอยู่ในagent.ts/dialogue.ts ไม่ใช่dumpจากโปรเซสLINEจริง

Buildผ่าน; ชุดเฉพาะruntime/natural/request/settings42/42 และfull regression190/190ผ่าน (fail/skip/cancel0,10.91s) [ผลชุดเต็ม](./test-evidence/2026-10-31-natural/capability-runtime.txt) เพิ่มสองcontract testsที่ตรวจsystem promptจริงในSDKและhost topicตอบเหมือนกันแม้modelreplyปฏิเสธ/อ้างสำเร็จ รวมถึงtopicปลอมไม่เปิดrequest support ข้อทดสอบบริบทปรับให้รับทั้งhost-grounded messageกับcanonical host-rendered historyหลังauto compaction โดยยังตรวจว่าข้อมูลรายการจริงอยู่ครบในส่วนที่เก็บ

รอบนี้ยังไม่ลองโมเดลจริงหลังแก้promptและไม่ได้restartLINE เจ้าของขอดูpromptก่อน จึงคงเป็นsource/buildพร้อมทบทวน ไม่อ้างว่าแก้บนLINEสดแล้ว ไม่เปลี่ยนcredentials/config store/tunnel/webhook ไม่commit/push การเปลี่ยนfixed policyทำให้context fingerprintของsettings trial/reviewเดิมเปลี่ยนตามกลไกเดิมเมื่อโหลดโค้ดใหม่

## แยกคำถามความสามารถออกจากการแนะนำตัว

31ตุลาคม2026 · ผู้ใช้รายงานTerminalถาม “ทำไรได้บ้าง” แล้วได้identityparagraphเดิมที่ยาวและไม่สรุปฟังก์ชันที่มีจริง แม้เพิ่มข้อมูลในsystem promptแล้ว สถานะก่อนแก้ **พบปัญหา P2** ด้านความเหมาะสมของคำตอบ

สาเหตุในโค้ดคือintent identityเดิมรวมทั้งwho/nameและcapabilities แล้วrendererให้identityAnswerตายตัว ไม่ได้สร้างรายการตามช่องทาง การแก้system promptเรื่องจองอย่างเดียวจึงไม่เปลี่ยนข้อความนี้

เพิ่มhost topicสงวน `host:capabilities` และ `ConversationCapabilities` จากcoreจริง: channel, host commands, request service และhumanSupport โมเดลเลือกหัวข้อจากความหมายของคำถาม ไม่เพิ่มregexจับสำนวนเพื่อแทนplanner แล้วhostแสดงFAQ/catalog/คำขอ/การจัดการความจำตามที่มี พร้อม/helpเฉพาะช่องที่ใช้คำสั่งได้ LINEเพิ่มขอรับช่วงเฉพาะเมื่อhostส่งsupportจริง ไม่โฆษณาbackend/ส่งข่าว/สมัคร/ชำระเงินให้ลูกค้าสั่งเอง ในกลุ่มไม่แสดงคำสั่งส่วนตัวหรือบริการคำขอที่ไม่มี คำตอบจริงส่งเข้าcontextต่อด้วย

System promptแยกidentity=who/nameออกจากwhat-can-you-do และชี้host:capabilitiesเมื่อtopicเปิดให้ใช้ ส่วนคำถามเฉพาะการรับคำขอจองยังใช้host:course-requests rendererที่กำหนดไว้ ไม่เพิ่มสิทธิ์ทำรายการหรือแก้ข้อมูลใด ๆ

**Expected/Actual:**

- Temp SDK/mockทั้งTerminal/LINEเลือกhosttopicแล้วแสดงรายการจริง+help; LINEมีhandoverเฉพาะที่เปิด; runtimeที่ไม่มีrequestsไม่อ้างรับคำขอ และกลุ่มไม่โฆษณาคำสั่งส่วนตัว ชุดเฉพาะruntime/natural/core/dialogue27/27ผ่าน
- Groqจริง groq/qwen/qwen3.8-27b: “ทำไรได้บ้าง” → host:capabilities/รายการ5หมวด+ข้อจำกัด+/help565ms; “เธอเป็นใคร” → identity628ms; “ช่วยอะไรได้บ้าง” → host:capabilities/รายการเดิม502ms ใช้3requestsจากเพดาน6ที่แจ้งก่อนเริ่ม ไม่มีrepairและrecords0 [หลักฐานจริง](./test-evidence/2026-10-31-natural/capabilities-live.json) เป็นtempไม่มีLINE transport ไม่ครอบคลุมทุกสำนวน
- Buildผ่านและfull regression192/192ผ่าน (fail/skip/cancel0,10.54s) [หลักฐาน](./test-evidence/2026-10-31-natural/capabilities-runtime.txt) ยังไม่ได้restartLINEหรือทดสอบE2Eผ่านLINEหลังแก้รอบนี้ ไม่แก้key/config store/tunnel/webhook ไม่commit/push

เปิดTerminalใหม่ด้วยnpm run chatเพื่อโหลดcodeล่าสุด (/resetล้างบริบทแต่ไม่โหลดmoduleใหม่) snapshot system-prompt-review.txtปรับให้ตรงcbtuPolicyล่าสุดแล้ว

## เจ้าของตรวจรับเวอร์ชันทดลองแล้ว

31 ตุลาคม 2026 (Asia/Bangkok) เจ้าของยืนยันในแชตทดสอบนี้ว่า **“ผ่านแล้ว”** หลังลองสนทนาบนTerminalรุ่นทดลอง จึงบันทึกX04เป็นผ่านตามเจ้าของยืนยัน Expectedคือยอมรับพฤติกรรมการคุยของรุ่นทดลองหลังปรับ; Actualคือคำยืนยันนี้ โดยไม่มีรายละเอียดผลรายข้อ จึงไม่อ้างว่าผ่านครบ30ข้อความ/ครบทุกสถานการณ์หรือความเร็วทุกturn

ขณะบันทึก HEADยังเป็น37114e8 และมีworking treeของรุ่นทดลองที่ยังไม่commit แยกคำยืนยันจากผลmock181/181และreplayโมเดลจริงที่มีหลักฐานก่อนหน้า ไม่ได้รันทดสอบซ้ำ ไม่ได้เปลี่ยนโหมดLINE/restart/credentials และไม่ได้commit/push การตรวจรับนี้ยังไม่ใช่คำสั่งให้นำรุ่นทดลองขึ้นLINE


## แยกการอ่านความจำออกจากคำขอบันทึก

31 ตุลาคม 2026 · เจ้าของอนุญาตให้แก้หลังพบ “จำไรได้บ้าง” ถูกตอบว่าให้ระบุข้อมูลที่จะบันทึก สาเหตุคือ keyword hint ก่อนเข้า planner กับ fallback ท้าย core ทับคำตอบจาก semantic intent

เพิ่ม memory action `recall` ให้ host อ่านเฉพาะ profile, longTerm และเรื่องค้างของ identity ที่ adapter ผูกไว้ ไม่ใช้ข้อความจากโมเดลแต่งข้อเท็จจริง ไม่รับ owner/identity หรือ payload บันทึกในแผนอ่าน เลือกอ่านเฉพาะหมวดได้ และไม่แสดง recent/summary notes ภายใน การอ่านยังบันทึกประวัติสนทนาตามปกติ แต่ไม่เพิ่มหรือเปลี่ยนข้อเท็จจริงที่จำ

ตัด fallback ที่ทับคำตอบเมื่อพบคำว่า “จำ” และใน model-first ให้ catalog planner ยังใช้งานได้แม้มี memory hint ปรับ policy/contract ให้สอดคล้องกัน: อ่าน → recall, ขอจำเพิ่ม → save, ขอจำคลุมเครือ → clarify, คุยทั่วไป → chat การตรวจหลักฐาน สิทธิ์ขอบันทึก การแยก identity การหมดอายุคำขอ และการยืนยันหลังเขียนสำเร็จยังอยู่

ทดสอบ regression เพิ่ม 4 กรณี ครอบคลุมอ่านเฉพาะข้อมูลจริงโดยไม่เปลี่ยน facts, chat ไม่ถูกทับ/คำถามไม่ให้สิทธิ์บันทึก, schema/identity isolation และอ่านแล้วไม่คงสิทธิ์ clarification ไว้ ชุดเฉพาะ memory/natural/runtime ผ่าน 32/32; หลังเพิ่มตรวจ fields=null ชุด memory ผ่าน 11/11

โมเดลจริงใน temp Terminal ใช้ข้อมูลสมมติ 4 requests ไม่มี repair: “จำไรได้บ้าง” → ทวนชื่อที่มีจริง; “เรื่องนี้จำยากจัง” → chat; “ช่วยจำว่าฉันสะดวกเรียนวันเสาร์” → บันทึกหลัง host commit; “จำอะไรได้บ้าง” → ทวนชื่อพร้อม preference ที่เพิ่ม ไม่มี LINE transport หรือ request records ดู memory-recall-live.json

Full regression รอบแรกนอก sandbox ผ่าน195/196 พบ assertion เวลาเดิมคาด1000ms แต่ actual999ms ใน response-settings deadline test ไม่ได้แก้ production deadline หรือข้อทดสอบนั้น หลักฐาน memory-recall-timing-flaky.txt ส่วน sandbox ก่อนหน้านั้นไม่อนุญาต listen localhost จึงแยกจากผลแอป

ยังไม่ได้รีสตาร์ต LINE ไม่เปลี่ยน key/config/tunnel/webhook ไม่ commit/push Terminal ต้องปิดแล้วเปิดใหม่จึงโหลดโค้ด build ล่าสุด /reset ไม่โหลด module ใหม่

ผลรันซ้ำหลัง build ล่าสุด: full regression ผ่าน196/196 (fail/skip/cancel0) หลักฐาน memory-recall-runtime.txt; git diff --check ผ่าน ไม่มีการแก้ข้อทดสอบเวลาเดิม
