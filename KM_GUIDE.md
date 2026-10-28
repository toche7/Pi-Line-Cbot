# ความรู้บอต (KM)

สถานะล่าสุด 28 ตุลาคม 2026: เปิดใช้งานบนเว็บเดิมแล้ว เมนูหลักชื่อ “จัดการบอต” ภายในเป็นสอง section เรียงแนวตั้ง ตั้งค่าการตอบอยู่บน ความรู้บอตอยู่ล่าง ไม่เพิ่มแท็บย่อย คงห้าแท็บงานเดิม ลิงก์ #knowledge เดิมยังเปิดหน้าเดียวกันได้ ส่วนตั้งค่าการตอบพัฒนาต่อจนใช้งานได้แล้ว ดู RESPONSE_SETTINGS_GUIDE.md โดยค่าใช้งานจริงยังเป็นค่าเดิม ไม่มีการ apply ค่าตั้งค่าทดสอบหรือเผยแพร่เนื้อหา KM ทดสอบเข้าบอตจริง

## วิธีใช้หลังเริ่มเซิร์ฟเวอร์รุ่นใหม่

เปิด http://127.0.0.1:3001/#knowledge เมนู “จัดการบอต” แยกจากห้าแท็บงานลูกค้าเดิม เลื่อนลงมาส่วน “ความรู้บอต” ไม่เปลี่ยนชื่อหรือถอดแท็บเดิม ไม่มีเว็บใช้งานถาวรอีกพอร์ต

1. เลือก FAQ หรือเพิ่มรายการใหม่ กรอก ID, หัวข้อ, คำค้น, เนื้อหาคำตอบ, URL ทางการ, วันที่เก็บ/วันที่ตรวจแบบ ISO UTC และข้อขัดแย้งถ้ามี วันที่ต้องอ้างการตรวจจริง ไม่ใช้วันที่วันนี้แทนโดยอัตโนมัติ
2. บันทึกร่าง เพิ่ม/แก้/เลิกใช้ยังไม่เปลี่ยนคำตอบบอต ค้นร่างด้วยหัวข้อ คำค้น เนื้อหา หรือแหล่งอ้างอิงได้ รายการที่ต่างจากเผยแพร่มีเครื่องหมายกำกับ
3. เปิดรายการความต่างเพื่อดูข้อมูลก่อน/หลังครบทุกช่อง ทดลองคำถามเพื่อเทียบ FAQ ที่เผยแพร่กับร่างที่บันทึกแล้ว ผลระบุ revision, digest และ found/conflict/not_found ไม่เรียกโมเดล ไม่ส่ง LINE และไม่ดึงเว็บ
4. กด “ตรวจร่างล่าสุด” ตรวจเนื้อหา/หลักฐาน/ความต่าง แล้วติ๊กยืนยันอย่างชัดเจนและกด “ยืนยันเผยแพร่ความรู้” ระบบตรวจ revision และ SHA256 ซ้ำในล็อกเดียวกับการบันทึก หากแก้ร่างหรืออีกแท็บแก้ข้อมูล ต้องตรวจใหม่
5. ดูเวอร์ชัน/ผู้ดำเนินการ/เวลาได้ที่ “เวอร์ชันและประวัติ” การย้อนเวอร์ชันคือนำเนื้อหากลับเป็นร่าง แล้วตรวจและยืนยันเผยแพร่เป็นเวอร์ชันใหม่ ไม่เปลี่ยนชุดใช้งานทันที

รายการที่ไม่เคยเผยแพร่ลบออกจากร่างได้ รายการที่เคยเผยแพร่จะเก็บเป็นเลิกใช้เพื่อคงประวัติ ID ไม่เปลี่ยนตามหัวข้อ หากแก้ชนกัน API ตอบ 409 และฟอร์มยังเก็บข้อความที่พิมพ์ ผู้ดูแลต้องคัดข้อความที่ต้องการก่อนโหลดล่าสุด

ผู้ดำเนินการระบุว่า “ผู้ใช้บนเครื่องนี้ (ยังไม่มี login)” เป็นตัวตนระดับเครื่อง ไม่ใช่การยืนยันชื่อเจ้าหน้าที่หรือระบบแบ่งสิทธิ์ผู้อนุมัติ

## ขอบเขตคำตอบทดลองและบอตจริง

เมื่อเผยแพร่ สำเนา active ถูกอ่านร่วมกันผ่าน `publicAnswer`, `searchKnowledge`, `renderKnowledge`, semantic knowledge renderer และ `knowledgeTool` บนเซิร์ฟเวอร์จริง รวมถึง Terminal ที่เริ่มจาก main รุ่นใหม่ รายชื่อหัวข้อสำหรับ semantic planning อ่าน active ทุก turn จึงรองรับ FAQ ใหม่ใน session เดิม ร่างไม่เข้าโมเดลหรือ tool

หน้าทดลองจำลองเฉพาะตัวค้น/renderer FAQ ไม่ใช่บทสนทนาทั้งระบบ: ไม่จำลอง memory, catalog routing, คำขอจอง/ฝากเรื่อง, การรับช่วงคุย หรือโมเดล คำถามไม่ตรงคำค้นแสดง unknown ในหน้าทดลอง แม้บอตจริงอาจเลือกหัวข้อด้วย semantic planning ได้ บอตจริงอาจเพิ่มคำแนะนำ /contact ตาม workflow คำขอเดิม

ตัวตน ชื่อบอต unknown answer กติกาข้อมูลสาธารณะ ข้อจำกัด และสิทธิ์ tools อยู่ในโค้ด ไม่ใช่ฟิลด์ที่แก้ใน KM การเผยแพร่ FAQ ไม่ให้สิทธิ์ส่ง LINE เข้าถึงข้อมูลผู้เรียน หรือเปลี่ยน system prompt

## หลักสูตรและรายการรอตรวจ

อ่านข้อมูลหลักสูตร 20 รายการพร้อม field labels ภาษาไทย แหล่งอ้างอิง วันที่เก็บ หลักฐานผู้สอน ข้อมูลที่ไม่พบ flags และ warnings จาก projection เดิม ค่า null แสดงว่ายังไม่พบข้อมูลยืนยัน ไม่ตีความว่าไม่มี/ฟรี ไม่รวมชื่อผู้เขียนหน้าเป็นผู้สอน ราคาและสถานะเป็น snapshot ไม่รับรองราคา/วันเรียน/เปิดรับปัจจุบัน

รุ่นแรกแก้ FAQ ผ่านเว็บได้ ส่วนหลักสูตร/ผู้สอน/ราคา/รอบเรียนอ่านอย่างเดียว ไม่มีปุ่มแก้ข้าม validation เมื่อต้องปรับให้ทบทวน research/report/evidence และใช้ importer เดิมตาม COURSE_CATALOG_GUIDE.md และ COURSE_INSTRUCTORS_GUIDE.md งานนี้ไม่แก้ generated catalog, research, reviewed briefs หรือรัน crawler สด

## ข้อมูลและความปลอดภัย

- ที่เก็บ `runtime/knowledge/` แยกจาก customer/history/memory และอยู่ใต้ runtime ที่ Git ignore ไว้แล้ว directory 0700 / files 0600
- `knowledge.json` เป็น authoritative state ประกอบด้วยร่าง เวอร์ชันใช้งาน review และประวัติ การ rename แบบ atomic เป็นจุด commit จึงไม่สลับ active ก่อนบันทึกสำเร็จ ล็อก `.write-lock` และ CAS revision ป้องกันหลาย request/process เขียนชนกัน
- เก็บไม่เกิน 100 FAQ, 40 เวอร์ชันล่าสุดรวม active, 200 เหตุการณ์ และไฟล์ไม่เกิน 20 MB การเล็มเวอร์ชันเก่าจะไม่ลบชุด active; รุ่นเก่าที่พ้นขอบเขตย้อนจาก UI ไม่ได้
- หลัง commit ทำ `last-good.json` เป็นสำเนาที่ตรวจ schema/checksum ได้ หาก primary เสีย/หาย ใช้สำเนาที่ตรวจผ่านและเปิดอ่านอย่างเดียว ไม่เขียนทับไฟล์เสีย หาก startup เสียทั้งสองไฟล์จะไม่เริ่มด้วยข้อมูลปลอม/ว่าง ต้องกู้ไฟล์โดยผู้ดูแลก่อน
- ถ้าบันทึก primary ไม่สำเร็จ บอตคง active เดิม หาก backup เขียนไม่สำเร็จหลัง primary commit ตัว primary ยังคงเป็นผลสำเร็จที่ authoritative; การสูญทั้ง primary และ backup เป็นเหตุที่ต้องกู้จากสำรองภายนอก ไม่ใช่ระบบสำรองข้ามเครื่อง
- ล็อกค้างหลัง crash ไม่ถูกลบอัตโนมัติ ผู้ดูแลต้องหยุดผู้เขียนและตรวจว่าไม่มี writer ก่อนกู้ล็อก/ไฟล์ เก็บไฟล์เสียไว้เพื่อวิเคราะห์ ไม่เปิดหลาย host บน shared filesystem
- API ตรวจ loopback, exact Host, Origin, Fetch-Site, CSRF token, JSON และ payload 32 KiB ไม่รับ actor/policy/authority หรือ unknown keys ตรวจ prototype pollution, lengths, ID, timestamps, required source/conflict notes และข้อมูลลับที่ตรวจรูปแบบได้
- Source URL ต้อง HTTPS บน `cbtumu.net` เท่านั้น ไม่มี credentials/query/port; ลิงก์ HTTP/เว็บไซต์อื่นในเนื้อหาไม่ผ่าน การตรวจเป็นแบบอ่านในเครื่อง ไม่ fetch remote หรือรัน shell ตามเนื้อหา ไม่เท่ากับตรวจข้อเท็จจริง/ความสดของหน้าเว็บแทนผู้ดูแล
- ข้อความที่ไม่เชื่อถือ render ด้วย textContent/value ข้อความ HTML เป็นข้อความ ไม่ execute การกรองรูปแบบ secret/บัญชีไม่รับรองจับข้อมูลส่วนบุคคลได้ทุกแบบ ผู้ดูแลยังต้องตรวจว่าเป็นข้อมูลสาธารณะจริง ห้าม credentials, payment accounts, ข้อมูลผู้เรียนจริง หรือโน้ตลูกค้า

## ผลตรวจรอบนี้

- Build ผ่าน; full runtime regression ล่าสุด 116/116 (รวมการเปลี่ยนส่งข่าวล่าสุด ณ จุดตรวจ); catalog import 9/9 ด้วย Python 3.11.8 ที่มี jsonschema
- KM tests 13/13: draft isolation/create/update/remove/retire, required source/dates/conflict, review revision+digest+explicit confirmation, publish/restart/core/host/semantic/tool, rollback, atomic failure injection, stale conflict/lock, corrupt state/checksum/backup restart, prototype/secret/URL, bounded history และ semantic session เดิมอ่านหัวข้อเผยแพร่ใหม่โดยไม่มีร่างหลุดเข้าโมเดล
- CUA browser กับ integrated admin และ temp stores: สร้าง/แก้/ค้น, diff ของรายการใหม่, FAQ preview, HTML เป็น text, แก้หลัง review แล้วปิด confirmation, explicit publish, rollback/reload, สองแท็บชนแล้วเก็บข้อความ, หน้าหลักสูตร/ข้อขัดแย้ง/unknown, สลับเมนูเดิม และมือถือ 390px ไม่ล้นแนวนอน ไม่มี console error ที่อ่านจากแท็บตรวจรุ่นสุดท้าย
- ทุก publish ใน tests/browser อยู่ใน temp เท่านั้น ไม่มีส่ง LINE จริง ไม่มีตัวอย่างเข้า runtime/knowledge จริง ไม่แก้ .env/config/tunnel/webhook/credentials ไม่ commit/push
- ภาพหน้าจอ `design/knowledge/km-*-temp.png` เป็น UI ที่พัฒนาแล้ว ไม่ใช่หลักฐานว่ารัน KM บนพอร์ต 3001 จริง
- รอบพัฒนา KM ครั้งแรกส่งต่อให้รวม runtime; รอบเปลี่ยนเมนูภายหลังตรวจเว็บจริงแล้วตามบันทึกท้ายไฟล์ ไม่อ้าง LINE E2E ใหม่จากผล mock

```sh
npm run build
node --test dist/knowledge.test.js dist/knowledge-api.test.js
npm test
CATALOG_PYTHON=/Users/taweesaksamanchuen/.pyenv/versions/3.11.8/bin/python3 npm run test:catalog-import
```

สำหรับ browser QA ใช้ `node scripts/knowledge-ui-fixture.mjs` ซึ่งเปิด listener ชั่วคราวด้วย temp stores, ไม่มี LINE adapter/model/transport และลบ temp stores เมื่อหยุดด้วย SIGINT/SIGTERM ไม่ใช่บริการใช้งานเพิ่มอีกพอร์ต


## จัดการบอตและแผนตั้งค่าการตอบ — ประวัติรอบเตรียมเมนู

อัปเดตภายหลัง: เจ้าของสั่งให้ทำส่วนตั้งค่าจนเสร็จแล้ว จึงพัฒนาและเปิดใช้งานจริงครบตาม [RESPONSE_SETTINGS_GUIDE.md](./RESPONSE_SETTINGS_GUIDE.md) ข้อความอ่านอย่างเดียว/กำลังเตรียมด้านล่างเป็นหลักฐานช่วงก่อนพัฒนาต่อ ไม่ใช่สถานะปัจจุบัน

เปิด http://127.0.0.1:3001/#bot หรือ #knowledge เดิม เป็นหน้าเดียวที่เรียง “ตั้งค่าการตอบ” ไว้ก่อน “ความรู้บอต” ไม่มีแท็บย่อยเพิ่ม ส่วน FAQ/หลักสูตร/ประวัติของ KM ยังใช้ workflow เดิม การสลับเมนูเพียงซ่อน/แสดง panel ไม่รื้อฟอร์ม KM และไม่แก้ store

ตั้งค่าการตอบขณะนี้อ่านอย่างเดียว แสดงสถานะ “กำลังเตรียม · ยังไม่เชื่อมการแก้ไข” ไม่มี input, textarea, select, ปุ่มบันทึก, endpoint เปลี่ยนค่า หรือการเปลี่ยน runtime config จากหน้านี้

ค่าที่ตรวจ: provider Groq, model qwen/qwen3.8-27b, PI_TIMEOUT_MS=45000 แต่ server จำกัดเหลือ25วินาที, maxTokens800/การเรียก, model calls4และtool calls4ต่อรอบ, input2000ตัวอักษร, เป้าหมายแชตสั้น350ตัวอักษร; Groq dialogue ใช้ temperature0.2 และ thinking off ตามโค้ดเดิม การแสดงเวลา25วินาทีคือ deadline ของเซิร์ฟเวอร์ ไม่ใช่เวลา SLA ที่รับรองว่าจะตอบเสร็จ

ขอบเขตที่เตรียมไว้เพื่อพัฒนาภายหลัง (ยังไม่ได้รับอนุญาตให้ใช้ค่าใหม่):

1. **ข้อมูลตั้งค่า:** แยก runtime/bot-settings จาก KM/customer data มี draft/active/version/actor/time/revision และตรวจ schema/CAS/atomic/last-good แบบเดียวกับ KM ไม่ย้าย API keys หรือ credentials เข้าฐานข้อมูลหรือหน้าเว็บ
2. **โมเดล:** ให้เลือกเฉพาะ provider/model ที่รองรับและมี credential configured ฝั่ง host ตรวจความเข้ากันได้ JSON/tool/thinking/ขนาดบริบทก่อนใช้ ไม่ให้กรอก URL ปลายทางอิสระหรือเปลี่ยนสิทธิ์ tools ด้วย config
3. **บุคลิก/คำสั่งหลัก:** แยกคำสั่งที่ปรับได้ (น้ำเสียง ความกระชับ รูปแบบช่วยผู้เรียน) จากกติกาที่ล็อก (ตัวตน แหล่งข้อมูล ความปลอดภัย ความเป็นส่วนตัว สิทธิ์เครื่องมือ และขั้นตอนยืนยันการส่ง) ข้อมูล KM เป็นเนื้อหา ไม่ใช่คำสั่งเพิ่มสิทธิ์
4. **ข้อจำกัด:** รองรับเฉพาะค่าภายในขอบเขตที่ host ยอมรับ เช่น deadline/output length/call budget ต้องตรวจความสัมพันธ์กับ LINE deadline/token/output schema ไม่แสดงตัวเลขที่ host ไม่ได้ใช้จริง
5. **ทดลอง:** เปรียบเทียบคำถามเดียวกันระหว่าง active/draft โดยผูกผลกับ digest/revision ทั้ง config และความรู้ ใช้ ephemeral session ไม่มี memory/customer state จริง ไม่เปิด sending tools ระบุเมื่อจำเป็นต้องเรียกโมเดลจริงและมีค่าใช้จ่าย ไม่เรียกตอนเปิดหน้าเอง ผล deterministic ไม่ใช่หลักฐานว่าโมเดลใหม่ผ่านจริง
6. **ใช้จริง/ย้อนค่า:** ตรวจความต่างและผลทดลอง ยืนยัน explicit ก่อน apply; เปลี่ยน draft แล้ว review หมดอายุทันที เตรียมกลไกผูก session/turn กับ config version และสลับ model อย่างปลอดภัย ตรวจใหม่ก่อน commit หากโหลดรุ่นใหม่ไม่ได้คง active เดิม พร้อมคืนค่าเวอร์ชันก่อนผ่านขั้นตรวจและยืนยัน ห้ามเรียก model/เปลี่ยน prompt/credentials จากรอบเตรียมเมนูนี้

### ผลเปิดเมนูรอบล่าสุด

- เปลี่ยนเฉพาะส่วน UI/admin navigation และอ่านค่าที่เปิดเผยได้ผ่าน bot-admin.ts ไม่มีการแก้ agent/core/dialogue/policy/credentials/limits ในรอบเมนูนี้
- Build ผ่าน; tests116/116 ผ่านหลังรวมเมนูใหม่ KM regression เดิมยังผ่าน; ไม่มี import/catalog เปลี่ยนจากรอบ import9/9เดิม
- ตรวจเซิร์ฟเวอร์เดิมก่อนรีสตาร์ต ข่าวมี complete1/draft1 และไม่มี pending/inflight จึงหยุดอย่างนุ่มนวลแล้วเริ่ม npm run server ด้วย .envเดิม ไม่ส่ง LINE จากการตรวจ
- Rootและ/health200, /api/knowledge healthy=true, revision0, active=seed, FAQ9/หลักสูตร20 ตรวจแบบอ่านเท่านั้น
- CUA บน3001: ชื่อจัดการบอตถูกต้อง มี5แท็บเดิม ตั้งค่าการตอบอยู่ก่อนKMและทั้งสองส่วนมองเห็นในหน้าเดียว #knowledgeยังใช้ได้ ตั้งค่ามี0form controls และไม่มีปุ่มบันทึกปลอม มือถือ390pxไม่ล้น ไม่มีerror/warnจากแท็บตรวจ
- Hashของ.env, monitor, memory, customerและคำขอเดิม9ไฟล์ตรงก่อนรีสตาร์ต news.jsonเปลี่ยนจากstartup recoveryของNewsWorkerที่เพิ่มrevision ไม่ใช่การแก้โมเดลหรือเผยแพร่KM; ไม่อ้างว่าทุกruntime byteไม่เปลี่ยน
- ภาพจริงหลังเปลี่ยนเมนู: design/knowledge/bot-management-live.png และ bot-management-mobile-live.png รูปKMเดิมที่ลงท้ายtempยังเป็นหลักฐานจากfixtures

ภาพหน้าระบบจริงที่ชื่อมี `-live.png` เก็บเฉพาะเครื่องและถูก Git ignore เพราะอาจมีข้อมูลปฏิบัติการ ภาพที่ commit เป็นภาพร่างหรือข้อมูลทดสอบชั่วคราวเท่านั้น
