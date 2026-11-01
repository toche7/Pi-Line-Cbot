# ซีบอตเวอร์ชันทดลอง: สนทนาตามเจตนาและบริบท

## สถานะล่าสุด: ใช้รุ่นใหม่เป็นค่าเริ่มต้นบน local

คำสั่ง `npm run chat` / `npm start` / `npm run chat:line` / `npm run chat:group` ใช้ grounded แล้ว ไม่ต้องเติม next เพื่อเลือกทางใหม่ คำสั่ง next เดิมยังเป็น alias ชั่วคราวจนตรวจ LINE จริงครบ createCustomerCore เลือก grounded เป็นค่าเริ่มต้น ฝั่ง server ส่วนตัวและกลุ่มใช้ factory นี้เหมือนกัน ไม่มีการเปลี่ยน model/key/settings หรือที่เก็บข้อมูลถาวร

ตรวจด้วย synthetic model plans และ signed LINE simulations: ข้อมูลหลักสูตร/ฟรี/ผู้สอน, ตอบไม่รู้ไม่พ่วง FAQ, ประวัติจากทางเก่าเปิดต่อได้, แยก identity, host help/memory/requests และข้อจำกัดกลุ่ม ชุดเฉพาะ57/57 ชุดรวม295/295 Build ผ่าน ไม่ได้เรียก provider จริงรอบนี้ จึงไม่ใช่ผลประเมินคุณภาพโมเดลเพิ่มเติม

สำเนาก่อนเปลี่ยนค่าเริ่มต้น 184 ไฟล์พร้อม checksum เก็บชั่วคราวที่ `/var/folders/ly/kq_n217s673dj1jc6gckrs3h0000gn/T/cbot-before-grounded-default-v0xdheiy` ตรวจ checksum ทั้งหมดแล้ว ตัวเลือกเก่า experimentalGrounding:false ยังอยู่สำหรับเทียบ/rollback ในโค้ด สำเนาไม่มี .env, runtime หรือข้อมูลลูกค้า หากต้องย้อน local ให้คืน source/build manifests จากสำเนาก่อนเปลี่ยนและ build ใหม่ โดยคง store เดิม ไม่ reset หรือย้ายข้อมูล

รอบนี้ทำเฉพาะ local ตามที่ผู้ใช้ย้ำ ยังไม่ deploy/restart LINE จริง ไม่มีการเปลี่ยน webhook หรือส่งข้อความจริง ตรวจ Railway ในช่วงเริ่มงานเป็น read-only เท่านั้น ไม่พบโปรเซส local ที่ฟังพอร์ต3000/3001 ขณะตรวจ ไม่ได้เริ่ม server จริงแทนผู้ใช้ แก้ตัวเตรียม source ให้รวม course-catalog-data.json แล้ว ตรวจแพ็กเกจใน temp ว่ามีข้อมูลและไม่มี .env/runtime แต่ไม่ได้ upload

หลักฐาน `test-evidence/2026-11-01-grounded-default-local/` ขั้นต่อไปคือทดลองคำสั่งปกติบน local แล้วจึงดำเนินงาน LINE จริงแยกจากรอบนี้ การลบทางเก่าและชื่อ next รอจนยืนยัน LINE จริงครบตามข้อตกลง

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


## ถามด้านที่สนใจครั้งเดียวก่อนแสดงรายการ

1 พฤศจิกายน 2026 · เจ้าของขอปรับคำถามกว้าง เช่น “มีหลักสูตรอะไรไหม” ให้ถามสั้น ๆ ว่าสนใจด้านไหน พร้อมตัวอย่าง เมื่อผู้ใช้ตอบด้าน เช่น AI ต้องแสดงรายการทันที ไม่เข้าแบบสัมภาษณ์เป้าหมาย/พื้นฐาน/เวลา เว้นแต่ผู้ใช้ขอคำแนะนำเฉพาะตัว หากระบุหัวข้อมาแล้วหรือขอดูรายการ/ทั้งหมดโดยตรง ให้ค้นหรือแสดงรายการทันที

ปรับเฉพาะ policy กับ per-turn model-first contract ให้ LLM แยกเจตนานี้ ไม่เพิ่ม regex จับคำถามของผู้ใช้ ไม่เปลี่ยน adviser เดิมหรือสิทธิ์การทำรายการ เพิ่ม SDK mock conversation regression ว่าคำถามกว้าง → chat ถามด้าน → AI list และ explicit all/Canva list ยังทำงาน โดยไม่เพิ่ม profile/preferences ชุดเฉพาะ natural/runtime/adviser ผ่าน25/25, buildผ่าน

ทดลองโมเดลจริงใน temp Terminal ข้อมูลสมมติ ไม่มี LINE transport: broad question → ถามด้านหนึ่งคำถาม, AI → list search AI, ขอทั้งหมด → list all, ขอเลือกที่เหมาะกับฉัน → advise ใช้5calls/4turns จากเพดาน6 (turnแรกมี bounded retryหนึ่งครั้ง) รายการและจำนวนอ้างอิง snapshot ไม่ใช่การตรวจรอบเปิดปัจจุบัน การเลือก advise ถูกทาง แต่คำตอบ adviser ยังถามชิ้นงานด้วยข้อความเดิม ไม่อ้างว่าแก้คุณภาพคำแนะนำทั้งระบบแล้ว หลักฐาน test-evidence/2026-11-01-browsing/live.json

ฐานงานก่อนแก้ clean ที่106c81f ไม่มี restart LINE/เปลี่ยนkey/config/tunnel/webhook หรือ deploy/commit/push Terminalต้องเปิดใหม่จึงโหลดbuildล่าสุด

ผลตรวจสุดท้าย: full regression249/249ผ่าน ไม่มีfail/skip/cancel; git diff --checkผ่าน หลักฐาน test-evidence/2026-11-01-browsing/runtime.txt


## ความสามารถในกลุ่มและบริการที่ต้องทักส่วนตัว

1 พฤศจิกายน 2026 · เจ้าของอนุญาตให้กลุ่มใช้ semantic routing เช่นเดียวกับแชตส่วนตัว และเมื่อถามความสามารถให้บอกด้วยว่าบริการใดต้องไป LINE ส่วนตัว

server เปลี่ยน groupCore เป็น createCustomerCore แบบ model-first โดยยังใช้ groupMemory เดิมที่แยกจาก direct และไม่ติดตั้ง request/human-support service ในกลุ่ม เพิ่ม privateChatCapabilities เป็น metadata อธิบายบริการส่วนตัวเท่านั้น ส่งเฉพาะ identity กลุ่ม ผ่าน model contract และ host capability renderer ไม่เพิ่มสิทธิ์ทำรายการ ไม่โอนความจำหรือส่งเรื่องให้เจ้าหน้าที่จริง แนะนำฝากคำขอจอง/ฝากเรื่อง ดูความจำ/reset/forget/help และขอเจ้าหน้าที่ใน LINE ส่วนตัว โดยยังระบุว่าไม่ได้สมัคร ชำระเงิน หรือยืนยันที่นั่งแทน

LineGroupReplies ยังรับเฉพาะ trigger ที่เปิดใช้งานและบล็อก slash ตามเดิม ปรับข้อความ error ให้รับ faqWithoutModel จริงเพื่อไม่สัญญาว่า FAQ ออฟไลน์ใช้ได้หลังเปลี่ยน mode

เพิ่ม mock integration ผ่าน group adapter + SDK: ถามความสามารถเข้าทางโมเดล/host renderer, แยกส่วนบริการที่ทักส่วนตัว, /book ในกลุ่มไม่เข้าโมเดล, ความจำส่วนตัวไม่ปรากฏใน group context, ค้น AI ยังทำงานและ request records0 พร้อม renderer gating ไม่โฆษณาบริการที่ host ไม่ได้ส่ง และไม่แสดง referral ใน Terminal/direct ชุดเฉพาะ33/33และbuildผ่าน

โมเดลจริง 2ข้อความใน group coreชั่วคราว (ไม่มี LINE transport): “เธอทำอะไรได้บ้าง” และ “แล้วอะไรต้องทักส่วนตัว” เลือก knowledge และได้ host capability summary ที่แยกส่วนตัวถูกต้อง ใช้2callsไม่มีrepair เป็นการตรวจ routing/referral ไม่ใช่ LINE E2E หรือการตรวจว่าทุก follow-up ตอบกระชับเหมาะสม หลักฐาน test-evidence/2026-11-01-group-capabilities/live.json

Full regression สองรอบแรก250/251: ตรวจละเอียดพบ memory.test ล้มที่เปรียบเทียบ recent หลัง model429 เพราะ core commit compaction ก่อนโมเดลตอบ ไม่ใช่ regexจับtimestampตามที่ประเมินแรก (runtime-flaky.txt) Promptที่ยาวขึ้นทำให้ถึง threshold ได้เร็วขึ้น แก้ core ให้ stage compaction และ commit พร้อมturnสำเร็จเท่านั้น เพิ่ม deterministic regression บังคับ12turns+model429 ตรวจทั้งdisk/in-memoryไม่เปลี่ยนและturnถัดไปสำเร็จจึงcommit ข้อทดสอบเดิมไม่ได้แก้เพื่อให้ผ่าน

ยังไม่ได้รีสตาร์ต LINE/deploy ไม่เปลี่ยนkey/config/tunnel/webhook ไม่ commit/push การตอบแบบใหม่ใน LINE ที่กำลังรันยังไม่ยืนยันจนโหลดbuildนี้

หลังแก้ compaction: build ผ่าน ชุดเฉพาะ memory/runtime/group ผ่าน24/24 และ full regression ผ่าน252/252 (fail/skip/cancel0) โดยไม่ได้แก้ assertion เดิม หลักฐาน test-evidence/2026-11-01-group-capabilities/runtime.txt และ targeted-final.txt; git diff --check ผ่าน

## จำลอง LINE ส่วนตัวและกลุ่มใน Terminal

1 พฤศจิกายน 2026 · เจ้าของสั่งเพิ่มโหมดเพื่อทดสอบสองบริบทผ่าน Terminal ได้สะดวก เพิ่ม `npm run chat:line` (ส่วนตัว) และ `npm run chat:group` (กลุ่ม) หรือใช้ flags `--line-direct` / `--line-group` กับ natural entrypoint; `--check` ตรวจการตั้งค่าโดยไม่ inference ไม่รับสองโหมดพร้อมกันหรือ rules-first ใน LINE simulation

ใช้ temp workspace เดิมของ natural-chat คัดลอกเฉพาะ settings/knowledge แยก direct/group memory, requests, conversation control และ room store แล้วลบทิ้งหลังออก ไม่อ่าน memory/requestsจริง ไม่สร้าง webhook/tunnel ไม่ใช้ LINE token หรือ lineReply/linePush transport ใช้ LineAdapter และ LineGroupReplies จริงกับ synthetic events/signature และ in-process reply sink ที่แสดงกลับ Terminal เท่านั้น รวม human waiting/cancel ฝั่งส่วนตัวเป็นสถานะจำลอง ไม่มีเจ้าหน้าที่จริงรับช่วง

runChat ใน simulation ส่ง slash commands ให้ adapter ตัดสินตามช่องทาง ยกเว้น /exit หรือ /quit ที่ใช้ปิด CLI กลุ่มเติม CBOT ให้อัตโนมัติเพื่อให้พิมพ์คำถามได้ตรง ๆ และยังบล็อกคำสั่งส่วนตัวตามกฎจริง ข้อความตอบจาก adapter คงรูปแบบเดียวกับ LINE จึงอาจมีคำว่า “ระบบกลาง” แต่ทั้งหมดอยู่ใน temp ตามหัวหน้าจอ

เพิ่ม5regressions: direct help/requests/memory/forget/waiting/cancel; group trigger/slash/private-referral/isolation; CLI forward slash/local exit; child-process checkทั้งสองmodeพร้อมcleanupและinvalid flags; legacy-mode reject ชุดเฉพาะ21/21ผ่าน, buildผ่าน, full257/257ผ่านไม่มีfail/skip/cancel

CLI smoke /help→/exit ทั้งสองnpm scriptsผ่านโดยไม่ inference จากนั้นลองโมเดลจริงคำถาม “เธอทำอะไรได้บ้าง” โหมดละหนึ่งturn ได้ข้อความส่วนตัวกับกลุ่มแยกบริการตามhost flagsถูกต้อง ไม่มี LINE transport; logsไม่ได้เก็บจำนวนprovider calls จึงไม่อ้างตัวเลขcallsจริง ดู test-evidence/2026-11-01-terminal-line

ผลนี้ตรวจ pipeline ภายในและ CLI ไม่ใช่ LINE E2E/network delivery/native mentionจริง ไม่restart/deploy LINE ไม่เปลี่ยนkey/configจริง ไม่commit/push

## สีแยกผู้ใช้กับบอตใน Terminal

1 พฤศจิกายน 2026 · ตามคำขอเจ้าของ เพิ่มสีใน runChat ที่ใช้ร่วมทุกโหมด: ป้ายผู้ใช้ฟ้า ป้ายและคำตอบผู้ช่วยเขียว callbackสถานะจาง เปิดเฉพาะ output/status ที่เป็น TTY เคารพ NO_COLOR และ TERM=dumb ไม่ใส่ ANSI ใน pipe/file ไม่เปลี่ยน routing/คำตอบหรือ LINE

Buildผ่าน ชุด chat/simulation7/7ผ่าน ตรวจ ANSI แบบ offline ด้วย fake client อีก3กรณี TTY/pipe/NO_COLORผ่าน (ไม่ได้เรียกโมเดล) ไม่เพิ่มไฟล์ทดสอบสำหรับการเปลี่ยนสีที่ย้อนกลับง่าย หลักฐานชุดเดิม test-evidence/2026-11-01-terminal-colors/runtime.txt

## ประวัติผู้สอนและวิธีเปิด LINE ส่วนตัวเป็นคนละเจตนา

1 พฤศจิกายน 2026 · เจ้าของรายงาน “ทวีศักดิ์ สมานชื่นเป็นใคร” กลับได้รายการคอร์ส และ “add line ส่วนตัวอย่างไร” กลับได้ contact FAQ เรื่องอีเมล เพิ่ม catalog operation=instructor สำหรับ who-is/biography แยกจาก list/filterผู้สอนและ readชื่อผู้สอนของคอร์ส ใช้เฉพาะชื่อใน structured instructors พร้อม source_url ไม่ใช้ catalog author/legacy instructors_text และไม่แต่งการศึกษา ประสบการณ์งาน ตำแหน่งองค์กร หรือความเชี่ยวชาญจากหัวข้อคอร์ส ปรับความต่างจุด/ช่องว่างของชื่อให้เท่ากันเท่านั้น ไม่รวมชื่อคนละแบบหรือนามสกุลต่างกัน

ปัจจุบัน snapshot มีหลักฐานการเป็นผู้สอน แต่ไม่มี biography เต็ม จึงตอบบทบาทที่ยืนยันได้และบอกส่วนที่ยังไม่มีข้อมูล หากไม่มีชื่อ/ชื่อกำกวมให้บอกตามจริง ไม่ fallback ไปแสดงคอร์ส stateรายการเดิมไม่ถูกเปลี่ยนเพราะถามประวัติ และไม่ได้ refresh/import catalog หรือเพิ่มข้อมูลชีวประวัติจากเว็บ

เพิ่ม host:line-private-chat ให้ LLM เลือกจากความหมายของคำถามวิธีแอดบอต/เปิดแชตส่วนตัว โดย hostตอบขั้นตอนเปิดโปรไฟล์บอต เพิ่มเพื่อน และกดแชต ถ้าเป็น direct LINE อธิบายว่าแชตแบบตัวต่อตัวที่คุยอยู่คือส่วนตัวแล้ว ไม่มีการเดา LINE ID/linkจากdisplayNameหรือchannel ID และไม่ย้ายคำถามขอข้อมูลติดต่อส่วนตัวของบุคคลอื่นมาทางบอต ไม่เปลี่ยน contact FAQ เจ้าหน้าที่เดิม ส่ง hostanswerเข้าcontextสำหรับ follow-up ด้วย

ตรวจแนวทางเพิ่มเพื่อนกับเอกสาร LINE: https://help-o.line.me/line/smartphone?contentId=200000585&lang=en และ https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/ (ไม่ได้ใช้ API อ่านtoken/profileของบัญชีจริง และยังไม่มีบัญชี add-friend URL ที่ยืนยันในruntime)

เพิ่ม4tests: hostอ่านprofile/ไม่เปลี่ยนcatalogstate/schema,ไม่ใช้author/รวมเฉพาะpunctuation/ชื่อกำกวม, semantic distinction person→courses taught→course teacher, และ private-help topicไม่รับmodelreplyแต่ง ID/คงstaffFAQ ชุดเฉพาะ28/28 buildผ่าน full261/261ผ่าน (fail/skip/cancel0)

โมเดลจริง temp Terminal4ข้อความ/4callsไม่มีrepair: who-is→instructor role+missingbio, เขาสอนคอร์สอะไรบ้าง→listที่กรองผู้สอน11รายการ, add line ส่วนตัวอย่างไร→private-chat guide, เพิ่มเพื่อนบอตยังไง→guideเดียวกัน หลักฐาน test-evidence/2026-11-01-person-private-chat/live.json ไม่ใช่ LINE E2E; ไม่มีrestart/deploy/key/config/tunnel/webhook/commit/push

## รุ่นทดลองค้นหลักฐานก่อนเรียบเรียงคำตอบ

1 พฤศจิกายน 2026 · เจ้าของอนุญาตหลังดูผังเปรียบเทียบ ให้ทำรุ่นทดลองก่อนใน Terminal ส่วนตัว/กลุ่ม ไม่ใช้การเพิ่มหัวข้อคำตอบเฉพาะรายคำถาม เป้าหมายคือเข้าใจบริบท ค้นข้อมูลที่อนุญาตแล้วเรียบเรียง ถ้าไม่รู้บอกตรง ๆ ไม่พ่วง FAQ อัตโนมัติ และยังคง host workflow สำหรับการทำรายการ

เพิ่มโหมด opt-in `grounded`: chat:next (Terminal), chat:line:next (จำลองส่วนตัว), chat:group:next (จำลองกลุ่ม) ทุกโหมดอยู่ใน temp เดิม รุ่นปกติ/เซิร์ฟเวอร์ไม่เลือก grounded อัตโนมัติ ไม่restart/deploy LINE ไม่เปลี่ยน key/model/config จริง ไม่commit/push

ระบบใช้ system policy สำหรับการสนทนารุ่นทดลองโดยเฉพาะ ไม่บังคับเลือก topic ID เพื่อรับ FAQ renderer เดิม publicEvidence สร้างเอกสารจาก published knowledge, public course fields และหลักฐานผู้สอน; hostEvidence แสดงเฉพาะ capabilities/วิธีเปิดส่วนตัว/สถานะที่ hostส่งให้ โมเดลส่ง contextual lookup query และเลือก document IDs จากดัชนีได้ ค้นแบบ lexical ที่มี LLM ช่วยแปล/ขยายคำและเลือกเอกสาร ไม่ใช่ vector search และไม่ค้นเว็บสด เอกสารสูงสุด6รายการ รายการละ2400ตัวอักษร ไม่มี file/shell/LINE transport tool ให้โมเดล

คำตอบ fact ใช้ intent=answer พร้อม evidence ID และ quote ที่ตรงกับข้อความเอกสารซึ่งส่งให้จริงในturnนั้น hostตรวจschema/ID/quoteและแนบเฉพาะ source URLs ที่อ้าง พร้อม capturedAtเมื่อมี โมเดลเรียบเรียง reply ได้โดยไม่ถูก business-fact regexของlegacy chatทับ ห้ามใส่ URLเองหรืออ้างทำรายการสำเร็จใน prose ส่วน list/count/price/paging/readยังใช้ host catalog executor แล้วนำผลเป็น evidence ให้เรียบเรียง ไม่ให้โมเดลคำนวณจำนวนหรือทำรายการแทน host

chat/unknownตอบตามบริบท ไม่มีคำตอบสำรอง FAQ ตายตัว ภาษาให้โมเดลเลือกตามคำถาม แต่ข้อความยืนยันความจำ/คำสั่ง/ข้อผิดพลาด hostยังเป็นชุดเดิม การอ่าน/เขียนความจำต้องผ่าน decideMemory และ durable commitตามเดิม retrieval phase ไม่อนุญาตให้ source หรือ final modelแทรก memory/action คำตอบจริงทุกturnส่งกลับเข้าcontextหลังcommit คำตอบ/errorสำรองใน LINE adapter ของโหมดทดลองไม่พ่วง FAQ

ใช้deadlineรวมและcall budgetเดิม จำกัดสูงสุด3provider calls/turn (ค้น+ตอบปกติ2ครั้ง มีrepairได้หนึ่งครั้ง) ปิดSDK toolsระหว่างสนทนาและrestoreเมื่อจบ ถ้าตั้งbudgetต่ำเกินค้น+ตอบจะจบด้วยข้อผิดพลาด ไม่ข้ามการตรวจหรือส่งคำตอบที่ยังไม่ผ่าน จำนวนครั้งนี้อาจมากกว่าทางตอบเดิม

**ผลทดสอบและข้อจำกัด**

- เพิ่ม8mock regressions: contextual retrieval+English answer, unknownหลายภาษา/reactionไม่ถูกkeywordทับ, ID/quote/URL/action checks, boundedrepairและsourceไม่ให้สิทธิ์เขียน, host catalog+translated answer, explicit memory guards, retrievalbounds/no-match, และdirect/group adapterunknown/errorไม่แนบFAQ พร้อม CLI checkรองรับgroundedทั้งสองช่องทาง
- Buildผ่าน ชุดgrounded+simulation13/13 และ full269/269ผ่าน fail/skip/cancel0 หลักฐาน test-evidence/2026-11-01-grounded/runtime.txt, targeted.txt
- initial comparison 8messages/10calls ยืนยันlegacyunknownพ่วงFAQในทั้งสองช่องทาง แต่groundedไม่พ่วง พบEnglishqueryค้นThaiไม่ครบ เก็บหลักฐาน initial-comparison.json แล้วเพิ่มgeneric translated lookup/document-ID selection ไม่เพิ่มแพตเทิร์นคำถามสมัครรายประโยค
- หลังแก้ค้นข้ามภาษา 6messages/8calls ดึงenroll/learningเอกสารไทยมาเรียบเรียงEnglishได้ แต่พบreactionบางครั้งหลุดบริบท/ปนภาษา จึงแยกป้าย internal index ว่าไม่ใช่รายการที่ผู้ใช้เห็น และส่งprevious rendered answerชัดเจน รอบfollow-up4messages/6callsอ้างขั้นตอนสมัครได้ตรงเรื่องและไม่มีภาษาแทรกในตัวอย่างที่ลอง ดู cross-language-comparison.json / follow-up-comparison.json ไม่อ้างว่าครอบคลุมทุกสำนวน
- ชุดมาตรฐานที่บันทึกในrepoรันจริง8messages/10callsเสร็จ พบ4คำถามEnglishในรุ่นทดลองได้คำตอบThai จึงเก็บ standard-eval-original.json ว่าเกณฑ์ภาษาเดิมไม่ผ่าน เจ้าของบอก “ภาษาไม่ได้ serious” และให้หยุดไล่แก้ จึงแยกภาษาเป็นadvisory ไม่ใช่blocking ไม่ได้รันซ้ำเพื่อล้างผลเสีย ประเมินผลเดิมแบบofflineแล้ว core checks รุ่นทดลอง6/6ผ่าน (unknownไม่โยงCBTU, factualsignupแนบFAQที่เกี่ยวข้อง, reactionไม่พ่วงURL) ใน accepted-core-report.json
- การตรวจ ID/quote/source ไม่ใช่ข้อพิสูจน์เชิงความหมายว่าทุกข้อความสรุปตรงหลักฐานหรือการประเมิน naturalness ต้องทบทวนคำตอบจริง ข้อมูลยังเป็นsnapshot ไม่รับรองรอบเปิด/ราคา/ประวัติผู้สอนเต็ม ภาษาอาจไม่ตรงทุกครั้งตามผลจริง และยังไม่มี LINE E2E

**รันชุดเดิมเมื่อเปลี่ยนโมเดล**

`npm run eval:chat:next` แสดงขอบเขตโดยไม่ inference; ใส่ `-- --live` จึงทดสอบจริง 8messages สูงสุด14provider calls (direct/group, baselineunknown+next unknown/signup/reaction) ใช้ provider/modelที่เลือกปัจจุบันและเขียนชื่อไว้ในรายงาน ต้องเก็บรายงานแต่ละรอบเพื่อเทียบข้ามโมเดล ไม่ได้สลับโมเดลให้เอง ชุดนี้คัดลอกเฉพาะ public settings/knowledge ไม่มีข้อมูลลูกค้าจริง ไม่มี LINE API transport หยุดเมื่อproviderผิดพลาดหรือถึงcap และลบtempในfinally ภาษาเก็บเป็นadvisoryและไม่ทำให้exitล้มเหลว ส่วนchecksอัตโนมัติจำกัดแค่links/source presence ต้องตรวจความหมายแยกด้วย

อาการภาษาต่างจากที่ถามเกิดตั้งแต่ข้อความแรกในmemoryทดลองใหม่ จึงไม่มีหลักฐานจากรอบนี้ว่าcontextเต็ม ไม่ได้ตรวจtoken usageจริงครบทุกrequestและไม่อ้างว่าไม่มีโอกาสเกิดcontext pressure ในการคุยยาว โค้ดยังย่อบริบทตามthresholdเดิม

## อ้างหลายข้อความจากแหล่งเดียวต้องไม่ถูกนับเป็นหลายแหล่ง

1 พฤศจิกายน 2026 · เจ้าของรายงาน who-is/ผู้สอน/ai แล้วได้ generic service failure หรืออ้างว่าไม่มีข้อมูล ทั้งที่หลักฐานมีอยู่ การจำลอง4turns/9provider calls พบอาการgeneric failureในturnแสดงรายการ AI: โมเดลให้คำตอบพร้อม12ข้อความอ้างอิง ทุกข้อความมีอยู่จริงใน host catalog result แหล่งเดียว แต่ validator เดิมจำกัด references.length<=6 จึงปัดทิ้งทั้งคำตอบ และrepairไม่ระบุข้อจำกัดทำให้โมเดลส่งแบบเดิมซ้ำ ไม่พบstopReason length/context overflowในตัวอย่างนี้ (input+outputสูงสุดที่บันทึก10383tokens) who-is/ข้อมูลผู้สอนในรอบนั้นตอบได้ จึงไม่อ้างว่าทุกสาเหตุของรายงานต้นฉบับตรงกันหมด

แก้ให้นับdistinct source IDsสูงสุด6 แยกจากจำนวนquoted passages (bounded32รายการ) ตรวจทุกquoteว่าเป็นsubstringจริงของsourceที่ได้รับ รวมURLซ้ำตอนแสดง ไม่ตัดquoteที่ผิดทิ้งแล้วปล่อยclaimที่ไม่มีหลักฐาน ทดลอง replay exactplan12quotesจากแหล่งเดียวที่เคยถูกปัดทิ้งแล้วผ่าน โดยยังrejectquoteปลอมที่อยู่หลังลำดับ6, quote payloadเกินbound และ7distinctsources

ผลค้นยังเป็น weighted keyword search + LLM query translation/expansion/document-ID selection ไม่ใช่embedding/vector search และยังตัดผลค้นเป็น6เอกสารตามคะแนนเหมือนเดิม ไม่มีการเปลี่ยนระบบค้นในรอบนี้

เพิ่มtyped validation reasonและบอกข้อจำกัดจริงในmodel protocol/repair เพื่อไม่วนแก้โดยไม่รู้เหตุ เพิ่มgeneral follow-up principleให้รักษาชนิดข้อมูล/fieldเดิมเมื่อผู้ใช้ตอบเพียงtarget/category ไม่เพิ่มregexจับaiหรือประโยคตัวอย่างรายคำถาม

ข้อผิดพลาดในexperimental LINE adaptersแยกเป็นตรวจหลักฐาน/รูปแบบไม่ผ่าน, budgetหมด, timeout, โควตา, auth, network, memory-write โดยใช้ข้อความคงที่จากcategory ไม่echorawprovidererror/credentialsและไม่พ่วงFAQ อาการoperational failureแยกจากunknownที่เป็นคำตอบว่าไม่มีข้อมูล

เพิ่ม4regressions (12quotes/same-source+ตรวจทุกquote+source/payloadbound, precise repair reason, shorttargetรักษาinstructorsfieldและpreviousclarification, fixed diagnostic categoriesไม่รั่วข้อมูล) Buildผ่าน ชุดเฉพาะ17/17 full273/273ผ่าน fail/skip/cancel0

หลังแก้จำลองชุดเดิม4turns/8calls: AIlistingตอบได้11quotes/1source (มีrepair1ครั้งเพราะโมเดลส่งcatalog_queryซ้ำหลังได้ผลค้นแล้ว); who-isตอบ7quotes/6sourcesได้; ถามผู้สอนต่ออ้างข้อมูลบุคคลเดิม; aiสั้น ๆ ขอความชัดเจน ไม่อ้างว่าค้นไม่กลับมา การขอclarifyยังอาจต้องประเมินความลื่นด้วยเจ้าของ ไม่อ้างว่าแก้ทุกfollow-upหรือเปลี่ยนเป็นsemantic searchแล้ว หลักฐาน test-evidence/2026-11-01-grounded-references

ใช้คำสั่งnextเดิมโดยออกและเปิดCLIใหม่ ไม่มี restart/deploy LINE, key/config/model/credentialsเปลี่ยนแปลง, commit/push

## รายการ Canva และข้อจำกัดที่ตรวจเกินหน้าที่

1 พฤศจิกายน 2026 · เจ้าของรายงานพิมพ์ canva แล้วได้ข้อความตรวจรูปแบบ/หลักฐานไม่ผ่าน จำลอง2turns (มีคอร์สอะไรบ้าง→canva) พบ5callsและfailureทั้งสองturn:

- รายการทั้งหมดตอบพร้อมquoteยาว2026ตัวอักษรซึ่งตรงhost resultจริง แต่ถูกจำกัดquote<=800 จึงถูกปัดทิ้งทั้งก่อนและหลังrepair
- Canvaเลือกoperation=listแต่พ่วงfields11รายการที่ไม่ได้ใช้ แล้วตัวตรวจไปใช้กติกาread fields1-5กับlistจึงreject ต่อมาmodelrepairเป็นreadแต่ยังเลือก11fieldsและไม่มีfeedbackระบุboundนี้

แก้ทั่วไปในexperimentalroute ไม่เพิ่มkeyword/FAQ/คำตอบเฉพาะCanva: executeGroundedCatalogตัดprojection fieldsที่ไม่ได้ใช้กับnon-readก่อนส่งexecutor ส่วนreadยังตรวจ1-5publicfieldsและให้precise validation reason; ไม่เปลี่ยนstrict legacy catalog parser ไม่ทิ้งfilters/limitsหรือขยายสิทธิ์อ่าน

ยกเลิกความยาว800เป็นข้อห้ามของquote ใช้nonempty exact substringของsourceที่ส่งให้จริงเป็นเกณฑ์ ขนาดsource/response/modeltokenbudgetและจำนวนreferencesยังboundedตามเดิม ไม่ตัดquoteยาวแล้วปล่อยclaim ไม่ยอมรับแม้เพิ่มข้อความปลอมท้ายsourceจริง กติกานี้แทนquote-length boundในหัวข้อก่อนหน้า และmodelได้รับคำแนะนำให้เลือกข้อความอ้างอิงกระชับ

เพิ่ม3regressions: listไม่ล้มเพราะunusedfieldsแต่readยังstrict, longexactquoteผ่าน/inventedsuffixไม่ผ่าน, broad→subjectreplyพร้อมunusedprojection ทำงานด้วยSDKmock Buildผ่าน ชุดเฉพาะgrounded/catalog20/20 full276/276ผ่าน ไม่มีfail/skip/cancel; exact captured2026char quoteและlist11unusedfields replayผ่านโดยไม่inference

Liveหลังแก้2turns/4callsไม่มีrepair: broadlistแสดง20รายการ/3ตัวแรก, canvaแสดงคอร์สสร้างสื่อสวยด้วยCanvaพร้อมลิงก์ ใช้เวลาประมาณ1.95s/2.10sตามลำดับ เป็นผลตัวอย่าง ไม่รับรองทุกสำนวนหรือทุกโมเดล ไม่มีLINEtransport/real customer data/restart/deploy/key/config/model change/commit/push หลักฐาน test-evidence/2026-11-01-grounded-canva

## ต่อคำถามพร้อมหลักฐานเดิม ไม่เริ่มจากศูนย์ทุกข้อความ

1 พฤศจิกายน 2026 · เจ้าของพบ research ตอบชื่อคอร์ส/วิทยากรพร้อมsource แต่ถาม “ใครสอน” กลับบอกว่าไม่มีเอกสารในข้อความปัจจุบัน ตรวจโค้ดพบว่าแม้recentและpreviousAssistantมีคำตอบเดิม แต่ evidence Mapของแต่ละturnเริ่มด้วยhost factsเท่านั้น เอกสารสาธารณะที่ค้นรอบก่อนถูกทิ้ง ทำให้follow-upต้องค้นซ้ำหรือโมเดลเลือกunknownทั้งที่หลักฐานอยู่ในระบบ

แก้การส่งต่อบริบททั่วไป ไม่จับkeyword research/ใครสอน: หลังanswerผ่านการตรวจ ให้จำsource IDsสาธารณะที่อ้างจริงไว้ในcanonical Memory.evidenceIds สูงสุด6ตัว ไม่เก็บสำเนาbodyเอกสารหรือhost waiting/capabilitiesเก่า เริ่มturnถัดไปโหลดIDsเหล่านี้จากpublicEvidenceที่ยังเผยแพร่ปัจจุบัน พร้อมกรองขนาดเอกสารเท่าเดิม จึงใช้คำถามต่อได้ทันทีโดยอ้างหลักฐานจริงในturnใหม่ หากlookup/catalogใหม่จะล้างชุดpublic evidenceเดิมก่อนใส่ผลใหม่ ไม่เอาผลเก่ามาปนโดยอัตโนมัติ

Metadatafieldเป็นoptionalในmemoryv1เพื่ออ่านไฟล์เดิมได้ มีvalidatorจำกัดprefix faq/course/person, ความยาว/จำนวน/ความซ้ำ ใช้ตามidentity/channel/scopeของstoreเดิม บันทึกพร้อมturnสำเร็จเท่านั้น จึงคงอยู่ผ่านcompaction/เปิดsessionใหม่ แต่reset/forget/handoverล้างบริบทนี้ เอกสารที่retireแล้วไม่ถูกนำกลับมาใช้แม้เคยมีpointer ถ้าเป็นบทสนทนาเก่าที่ยังไม่มีpointer มีfallbackจากURLที่hostอ้างในprevious rendered answerหรือshown course IDs โดยเทียบกับเอกสารที่ยังมีจริงเท่านั้น ไม่อ่านraw userข้อความเป็นหลักฐานใหม่ ไม่เพิ่มข้อมูลส่วนตัวระยะยาว/permissionจากsource

เพิ่ม4tests: research→ใครสอนใช้หลักฐานเดิมไม่lookup, pointerผ่าน13turns/compaction/reopenแต่ไม่ข้ามreset/identity, ตรวจcurrent/retiredrecordsและunsafe pointers, และnewretrievalแทนoldresult ชุดเฉพาะgrounded/memory/handover30/30 buildผ่าน full280/280ผ่าน fail/skip/cancel0 (targetedรอบsandboxแรกติดlisten EPERMของHTTP จึงรันนอกsandboxตามขั้นตอน)

LiveในTerminalจำลองส่วนตัว2turns/3provider calls: researchค้น+ตอบ2calls, “ใครสอน” ตอบ ผศ. ดร.ทวีศักดิ์ สมานชื่นพร้อมsourceคอร์สResearchถูกต้อง ใช้1callประมาณ689ms (ตัวอย่างเดียวไม่ใช่SLA) ไม่มีrepair ไม่ให้ระบุชื่อคอร์สซ้ำ หลักฐาน test-evidence/2026-11-01-grounded-followup/live.json เป็นcacheรหัสอ้างอิงบทสนทนา ไม่ใช่embedding/vector search และไม่รับรองว่าทุกfollow-upเข้าใจถูกเสมอ

ใช้nextคำสั่งเดิมโดยออกและเปิดใหม่ ไม่มี LINE transport/อ่านข้อมูลลูกค้าจริง/restart/deploy/key/model/config change/commit/push

## ฟื้นตัวจากคำตอบขาด/ว่าง/JSONไม่สำเร็จ โดยไม่โยนผลค้นที่ถูกต้องทิ้ง

1 พฤศจิกายน 2026 · เจ้าของรายงาน “มีคอร์สออะไรบ้าง” / “มีหลักสูตรอะไรบ้าง” ได้ model-format error ตรวจพบ runGroundedDialogue เรียก runConversation อยู่นอก validation-repair catch จึงไม่ขอคำตอบสั้นใหม่เมื่อ providerส่งstopReason=length, empty/reasoning-only หรือJSONgenerationerror แม้hostอาจค้นสำเร็จแล้ว ต่างจากlegacy dialogueที่รับมือบางกรณีนี้อยู่แล้ว

Liveก่อนแก้ในtemp2turns/4callsรอบนี้ตอบได้ทั้งคู่ จึงไม่อ้างว่าreproduceproviderfailureต้นฉบับได้แน่นอน สาเหตุย่อยของข้อความผู้ใช้ยังแยกไม่ได้จากtranscriptเพียงอย่างเดียว แต่ช่องโหว่ในcontrol-flowยืนยันจากโค้ด และจำลองforced failuresด้วยSDKmockได้

แก้ให้format/empty/truncationมีshort repairได้หนึ่งครั้งในdeadline/call capเดิม หากมีcurrent-turn catalog resultที่hostตรวจแล้ว ให้ใช้ผลอ่านนั้นแทนcomposerJSONที่ล้ม ไม่ส่งpartialJSON/คำตอบที่proofไม่ผ่านให้ผู้ใช้ ไม่ต้องค้นซ้ำ ไม่เอาผลคอร์สเก่าจากturnก่อนมาสวมเป็นคำตอบใหม่ และไม่ใช้rawlookupเอกสารทั่วไปเป็นคำตอบแทนโดยเดาเอง กรณีlookupทั่วไปยังต้องเรียบเรียงด้วยevidenceหรือแจ้งข้อผิดพลาดตามจริง Auth/quota/network/timeoutไม่เข้าformat retry และไม่มีการเพิ่มtoken/model/config/key

เพิ่ม5regressions: truncatedcomposer→currentcatalogfallback+sourcepointers, invalidproof→safehostread, empty/length/JSONrepairbounded, evidenceคงอยู่ตอนrepairแต่ไม่retrynetwork/quota, และไม่fallbackoldturn/ไม่commitselectionเมื่อproviderfail Buildผ่าน เฉพาะgrounded24/24 full285/285ผ่าน fail/skip/cancel0

Liveหลังแก้สองประโยคเดิม2turns/4callsตอบรายการได้ทั้งคู่ ไม่มีformatfailure/repairในตัวอย่างนี้ จึงแยกผลliveที่เป็นnormalpathออกจากforced-failuretestsที่ยืนยันfallback/recovery คำถามกว้างครั้งที่สองในliveถูกmodelเลือกoperation=more; ไม่อ้างว่าชุดนี้ประเมินเจตนาpaginationหรือนaturalnessผ่านทุกสำนวน หลักฐาน test-evidence/2026-11-01-grounded-format-recovery

ใช้nextคำสั่งเดิมโดยปิดแล้วเปิดCLIใหม่ ไม่มี LINE transport/restart/deploy/อ่านข้อมูลลูกค้าจริง/key/model/config change/commit/push

## คำถามกว้างต้องถามด้านที่สนใจก่อนหนึ่งครั้งในรุ่น next

1 พฤศจิกายน 2026 · เจ้าของยืนยันโดยรวมโอเค แล้วขอให้ “มีคอร์สอะไรบ้าง” ถามว่า “สนใจด้านไหนครับ เช่น AI วิเคราะห์ข้อมูล หรือออกแบบสื่อ?” ก่อน รุ่นgroundedเดิมใช้ may ask จึงยังเลือกแสดงรายการทันทีได้ ปรับsystem policyและper-turn contractจากoptionalเป็นต้องถามหนึ่งsubject questionด้วยchatก่อนlookup/catalog หากไม่ระบุด้าน ไม่เพิ่มregexหรือFAQhandlerเฉพาะประโยค เมื่อผู้ใช้ตอบด้านให้listทันที ไม่ถามงาน/พื้นฐาน/เวลา และไม่resumeadviser/fieldreadingเก่า คำถามที่ระบุด้าน/ชื่อ/ตัวกรองหรือขอดูทุกคอร์สโดยตรงข้ามคำถามนี้

Buildผ่าน ชุดgrounded/simulation29/29ผ่าน (รอบนี้เป็นprompt/copy changeจึงไม่เพิ่มmockที่ตรวจซ้ำข้อความinstruction) Live3turns/5calls: “มีคอร์สอะไรบ้าง” → ข้อความที่ขอเป๊ะ1call680ms; “AI” → list/searchAI2calls; “ขอดูทั้งหมดเลย” → modelเลือกmoreในกลุ่มAIเดิมและแสดงส่วนที่เหลือ2calls ไม่ถามด้านซ้ำ ไม่อ้างว่าประโยคทั้งหมดที่กำกวมหมายถึงglobalcatalogแน่นอน หลักฐาน test-evidence/2026-11-01-grounded-interest

ใช้nextคำสั่งเดิมโดยปิดแล้วเปิดใหม่ ไม่มีLINEtransport/restart/deploy/key/model/config changes/commit/push

## คำยืนยันผู้สอน AI Agent Workshop with n8n

1 พฤศจิกายน 2026 · ผู้ใช้แจ้งว่า AI Agent Workshop with n8n สอนโดย “ผศ.ดร. ทวีศักดิ์ สมานชื่น” เดิมsnapshot cbtu-10มีเพียงlegacy instructors_textจากชื่อByในcatalog จึงจงใจไม่promoteauthorเป็นteacher ไม่ใช่ชื่อหล่นระหว่างนำเข้า ตรวจหน้า https://cbtumu.net/coursenew/n8n-workshop/ ผ่านweb readerยังไม่พบชื่อผู้สอนระบุชัดในเนื้อหาที่อ่าน จึงไม่สร้างwebexcerpt/hashใหม่เพื่ออ้างข้อมูลที่ผู้ใช้ยืนยัน

เพิ่มregistryคำยืนยันโครงการ course-instructor-confirmations.ts ผูกcourseId+canonicalURLเติมเฉพาะstructuredinstructorsที่หาย ระบุวันที่2026-11-01และsource=user_confirmation_in_project_chat ไม่แตะgenerated course-catalog.ts/archives/import fingerprints ถ้าอนาคตมีexplicit structuredwebteacherจะใช้webrecordก่อน ไม่ใช้By/แชตลูกค้าทั่วไปเรียนรู้คำยืนยันนี้เอง

course reader/filter/retrieval/person-profile/RAGใช้courseInstructors helperเดียวกัน จึงค้นผู้สอนพบworkshopเพิ่มด้วย ค่าruntimeผู้สอนแก้แล้วแต่ยังรักษาข้อมูลsnapshotเก่าไว้ RAG evidence bodyและSourceNotesระบุคำยืนยันในแชตโครงการแยกจากหน้าเว็บ hostrendererแสดงmetadataนี้ตามsourceที่อ้าง ไม่อ้างว่าURLหน้าเว็บยืนยันชื่อที่เพิ่มเอง KM APIแสดงteacherConfirmationกับfieldSourcesและไม่ถือinstructorsเป็นmissingในeffectiveview แต่rawwebteacherEvidence/flagsยังคงเดิม

ทดสอบmodelรอบแรก2turns/4callsพบว่าเลือกoperation=instructorด้วยชื่อคอร์ส ซึ่งAPIเดิมหมายถึงประวัติคน จึงยังตอบunknownทั้งWorkshopและVideoแม้ข้อมูลพร้อม (before-routing.json) แก้planner protocolให้ชื่อperson_profileชัดว่าใช้กับชื่อบุคคล ส่วนผู้สอนของคอร์สใช้read/instructors และnormalizelegacyinstructor+knowncourse-titleให้เป็นreadอย่างปลอดภัยในgroundedwrapper ไม่เพิ่มregexจับประโยคหรือคำตอบเฉพาะคอร์ส

เพิ่ม5regressionsเรื่องconfirmation provenance/rawsnapshotไม่ถูกแก้, instructorsearch/ไม่promoteauthor, futurewebprecedence, source attribution, และcourse-vs-person operation; ปรับassertionเดิมที่ถือว่าrawsnapshotunknownต้องเป็นruntimeunknownเสมอให้ยอมรับเฉพาะconfirmedrecord Buildผ่าน ชุดเฉพาะ40/40 full290/290ผ่าน fail/skip/cancel0

Liveหลังแก้2turns/4calls: Workshopตอบ ผศ.ดร. ทวีศักดิ์ สมานชื่นพร้อมcourseURLและคำยืนยันโครงการ; “แล้ว AI Agent with n8n ล่ะ” ตอบผู้สอนคนเดียวกันโดยใช้web-evidencedrecordของคอร์สวิดีโออีกURL ไม่รวมสองcourseเป็นรายการเดียว ไม่มีLINEtransport/realcustomerdata/restart/deploy/key/model/config changes/commit/push หลักฐาน test-evidence/2026-11-01-workshop-instructor

## ชื่อผู้สอนเป็นข้อมูลปกติ

ยกเลิกกลไกคำยืนยันจากแชตตามคำสั่งล่าสุด เก็บชื่อผู้สอนใน teaching.instructors โดยไม่มีวันที่ยืนยันหรือที่มาจากผู้ใช้ ตัวอ่าน ค้นหา RAG และ API ใช้ชื่อปกติ ไม่มีข้อความต่อท้ายคำยืนยันหรือ teacherConfirmation ใน API หลักฐานเว็บย้อนหลังคงแยกไว้ ไม่สร้างหลักฐานเว็บใหม่ ตัวนำเข้าเก็บชื่อปัจจุบันเมื่อเว็บไม่มีชื่อและ ID/URL ตรงกัน ปรับคู่มือแล้ว

Build ผ่าน; เฉพาะส่วน 13/13, importer 11/11, runtime 292/292 ไม่มี provider call, LINE จริง, restart หรือ deploy หลักฐาน test-evidence/2026-11-01-ordinary-instructors/

## เติมชื่อผู้สอนและหลักสูตรฟรี

เติม AI for All, Basic Prompt Engineering (Update), Basic Prompt Engineering เป็น ผศ.ดร. ทวีศักดิ์ สมานชื่น และ Data Analyst Level 4 รุ่นที่ 4 เป็น ผศ. ดร.วรัญญู วงษ์เสรี ในช่องชื่อผู้สอนปกติ ไม่มี metadata คำยืนยัน เปลี่ยน AI Agent for ALL, AI Agents in Action, AI for All เป็นราคา 0 THB/Free แสดงเรียนฟรี ไม่มีค่าใช้จ่าย ล้าง missing_fields และตัวเตือนผู้สอนที่แก้แล้ว รวม Workshop n8n ทั้งระดับรายการและ validationWarnings ไม่เปลี่ยน archive/research หรือหลักฐานเว็บเดิม ชื่อผู้สอนครบ 19 หลักสูตรและ Bundle เหลือราคาไม่ทราบ Basic Prompt Engineering (Update) และ Basic Prompt Engineering

ตัวนำเข้าเก็บชื่อ/ราคาเดิมเมื่อเว็บไม่มีข้อมูลและ ID/URL ตรงกัน พร้อมล้างตัวเตือนที่แก้แล้ว Build ผ่าน; เฉพาะ22/22, importer11/11, runtime293/293 ไม่มี provider call, ข้อความ LINE, restart หรือ deploy รอบนี้ หลักฐาน test-evidence/2026-11-01-course-completion/
