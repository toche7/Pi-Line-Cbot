# ตั้งค่าการตอบของซีบอต

เปิดใช้งานบนเว็บเดิม http://127.0.0.1:3001/#bot แล้ว ในเมนู “จัดการบอต” ส่วนตั้งค่าการตอบอยู่บนและความรู้บอตอยู่ล่างเป็นหน้าเดียว ไม่มีแท็บย่อยเพิ่ม ลิงก์ #knowledge เดิมยังใช้ได้

## ขั้นตอนใช้งาน

1. เลือก provider/model จากรายการ SDK ในเครื่อง ปรับบุคลิก คำสั่งการตอบเพิ่มเติม และข้อจำกัด แล้วกด **บันทึกร่างตั้งค่า** ร่างยังไม่กระทบคำตอบจริง
2. ใส่คำถามทดลองที่ไม่มีข้อมูลผู้เรียน/ข้อมูลลับ ติ๊กยอมรับการใช้โควตา แล้วกด **ลองค่าปัจจุบันเทียบค่าร่าง** ปุ่มนี้เรียก provider จริง อาจมีค่าใช้จ่าย ไม่เรียกเองตอนเปิดหน้า การจัดรูปแบบไม่สำเร็จอาจมีการซ่อมได้หนึ่งครั้งภายใน deadline/budget เดิม
3. อ่านคำตอบสองฝั่งและจำนวน tokens ดูความต่างของค่าปัจจุบันกับค่าร่าง แล้วกด **ตรวจความต่างตั้งค่าล่าสุด**
4. ติ๊กยืนยันและกด **ยืนยันใช้ค่าร่างกับบอตจริง** ระบบตรวจ revision, config digest, fingerprint ของความรู้/กติกา, อายุผลลอง และสถานะ credentials ซ้ำ แล้วเตรียม session โดยไม่เรียกโมเดลก่อน commit
5. ย้อนค่าได้จาก **เวอร์ชันตั้งค่าและประวัติ** การย้อนนำค่ากลับเป็นร่าง ต้องลอง ตรวจ และยืนยันใหม่ ไม่สลับค่าจริงทันที

แก้ร่างแล้วผลลอง/ผลตรวจเดิมหมดอายุ ความรู้หรือกติกาที่ใช้ตอบเปลี่ยนแล้วต้องลองใหม่ ผลลองมีอายุ15นาที แต่ละการลองเว้นอย่างน้อย15วินาที และมีได้เพียงหนึ่งงานลองต่อ process การลองครั้งใหม่ล้างสิทธิ์ review เดิมตั้งแต่เริ่ม แม้รอบใหม่ล้มเหลว การแก้ชนจากหลายแท็บตอบ409โดยเก็บข้อความที่พิมพ์ไว้ในฟอร์ม

ผู้ดำเนินการบันทึกว่า “ผู้ใช้บนเครื่องนี้ (ยังไม่มี login)” ไม่ใช่การยืนยันชื่อเจ้าหน้าที่หรือระบบแบ่งสิทธิ์รายคน

## เลือกโมเดลและ credentials

รายชื่อใช้ `ModelRuntime.getModels()` ของ SDK ที่ติดตั้ง ตรวจคู่ provider/model จริงและรองรับข้อความ ไม่รับ model ID หรือ endpoint ที่แต่งขึ้น กรอง maxTokens กับเพดานโมเดลอีกครั้ง ข้อมูลในเว็บมีเฉพาะ ID/ชื่อ/API/ความพร้อมแบบboolean ไม่มี API key, access token หรือ credential object

สถานะ configured ตรวจจาก host ที่ใช้ InMemoryCredentialStore + environment เดิม ไม่ค้น auth file เก่า ไม่มี endpoint รับหรือเปลี่ยน key ไม่บันทึก credentials ลง settings store ผู้ให้บริการที่ยังไม่มี credentials เลือกเก็บเป็นร่างได้แต่ลอง/ใช้จริงไม่ได้ เจ้าของต้องตั้ง credentials แยกนอกหน้าเว็บตามวิธีของ SDK แล้วเริ่มบริการใหม่ ไม่มีการขอ key ผ่านแชต

configured ไม่รับรองสิทธิ์ของแต่ละรุ่น โควตา หรือรูปแบบคำตอบ การลองค่าร่างต้องสำเร็จก่อนใช้จริง หากค่าปัจจุบันลองไม่สำเร็จแต่ค่าร่างสำเร็จ จะแสดงข้อจำกัดฝั่งปัจจุบันและยังให้ตรวจร่างได้เพื่อรองรับการเปลี่ยนออกจากรุ่นที่มีปัญหา

ตรวจเครื่องรอบส่งงานพบ configured เฉพาะ Groq และมีโมเดลข้อความใน SDK1,599รายการรวมทุก provider ไม่ได้รับรองว่าทุกโมเดลเรียกได้จริงหรือเหมาะกับซีบอต

## บุคลิกและคำสั่งหลัก

แก้ได้เฉพาะบุคลิก/น้ำเสียง (800ตัวอักษร) และคำสั่งการตอบเพิ่มเติม (1,600ตัวอักษร) ส่งเป็น presentation preferences แยกจาก policy คงที่ มีการตรวจรูปแบบข้อมูลลับ URL และคำสั่งข้ามกติกา ตัวกรองรูปแบบไม่ใช่หลักประกันตรวจพบข้อความอันตรายหรือข้อมูลส่วนบุคคลทุกแบบ

คำสั่งหลัก `cbtuPolicy`, JSON/schema, ตัวตน, host grounding, memory consent, tool allowlist, การปกป้องข้อมูลผู้เรียน และขั้นยืนยันการส่งยังอยู่ในโค้ด แก้จาก config ไม่ได้ แสดงคำสั่งหลักแบบอ่านอย่างเดียวในหน้าเว็บ ไม่ให้ config เพิ่ม shell/file/LINE tools หรือรับรองข้อเท็จจริงแทนแหล่งข้อมูล

บุคลิกมีผลกับข้อความที่โมเดลเรียบเรียง ส่วนตัวตน/FAQ/ข้อเท็จจริงจาก host ยังคงข้อความที่อนุมัติในระบบความรู้ ไม่ใช้ prompt editor แก้เนื้อหา FAQ หรือข้อมูลหลักสูตร

## ข้อจำกัดที่มีผลจริง

| ค่า | ช่วงที่รับ | บังคับใช้ที่ |
|---|---|---|
| ข้อความเข้า | 100–2,000ตัวอักษร | Core ก่อนทำงาน และตรวจซ้ำเมื่อเริ่ม turn ที่เข้าคิว |
| Output | 128–1,600tokens และไม่เกินเพดานโมเดล | SDK stream options ไม่ตัด FAQ/citations ที่ host สร้าง |
| LINE deadline | 1–25วินาที | runDialogue/runConversation รวมการซ่อมรูปแบบ |
| Terminal deadline | 1–60วินาที | Core แยกตาม channel; SDK request แต่ละครั้งยังมีเพดาน30วินาทีเดิม |
| Model calls | 1–4ครั้ง/รอบ | stream wrapper และ event guard รวม format repair ใน budget เดียว |
| Model tool calls | 0–4ครั้ง/รอบ | beforeToolCall + event guard ไม่เพิ่ม tool ใหม่ |

เป้าหมายแชตสั้น350ตัวอักษร, temperature0.2สำหรับ Groq dialogue, thinking off และข้อจำกัดsession/queueเดิมยังเป็นกติกาในโค้ด ไม่ได้เพิ่มฟิลด์ปรับทุกตัวในรุ่นนี้ ข้อจำกัด tools หมายถึงการเรียกโดยโมเดล ไม่ใช่ปิด host retrieval หรือคำขอที่ผู้ใช้ยืนยันผ่าน workflow เดิม

## Session และการครอบคลุมช่องทาง

Server และ Terminal main bind `runtime/bot-settings/` เดียวกัน แต่ยังใช้ memory ของแต่ละ channel/identity แยกเหมือนเดิม Core อ่าน active snapshot ตอนเริ่มแต่ละงานในคิว จึงไม่สลับค่ากลางคำถามที่กำลังตอบ งานเข้าคิวที่เริ่มหลัง apply ใช้ค่าใหม่

หากเวอร์ชันเปลี่ยน สร้าง session ใหม่ด้วย provider/model/prompt/limits ที่ bind กับ turn นั้นจาก canonical memory เดิมก่อน dispose session เก่า คง profile, recent/summary, long-term, pending, catalog context และ lastTopic ไม่ reset/forget ไม่ย้ายข้อมูลข้ามลูกค้า มี settingsVersion ใน operational metadata เพื่อระบุเวอร์ชันที่ใช้ โดยไม่ log prompt/credentials

ไม่ต้อง restart เมื่อกดใช้ค่าตั้งค่าในเว็บแล้ว Terminal ที่รันผ่าน main รุ่นใหม่นี้จะเห็นไฟล์ active ใน turn ถัดไปด้วย โปรแกรม SDK ที่สร้าง session เองโดยไม่ผ่าน Core/main ไม่อยู่ใน lifecycle นี้

## การลองโมเดล

ใช้ SDK session และ SessionManager แบบ in-memory แยกสำหรับค่าปัจจุบันกับร่าง ไม่มี MemoryStore ลูกค้า ไม่มี LINE transport และปิด tools ใน dialogue ไม่มีการจอง/ฝากเรื่องหรือการส่งใดจากการลอง ใช้คำถามเดียวกัน เปรียบเทียบคำตอบที่ renderer ยอมรับ และรายงาน token usage ที่ provider คืน

รอบลองเป็นการตรวจโมเดล/บุคลิกและ FAQ ไม่จำลอง memory หรือ catalog/request workflow เต็มรูปแบบ ข้อกำหนด JSON/host renderer ยังใช้กติกาจริง คำถามที่ต้องใช้ catalog planning แบบเต็มอาจไม่สำเร็จในรอบลองนี้ ไม่ใช้ผลลองคำถามเดียวอ้างว่าทุกคำถามหรือทุก provider ผ่านแล้ว

หากผู้ใช้ปิด/ยกเลิก HTTP request ระบบ abort session ที่กำลังลอง ผลที่ stale จากการแก้ร่าง/ความรู้ระหว่างลองไม่ถูกเก็บเป็นผลอนุมัติ ไม่มีการเรียก provider จาก GET/save/review/apply/rollback; เฉพาะปุ่มลองที่ติ๊กยอมรับโควตาแล้วเท่านั้น

## การเก็บข้อมูลและกู้คืน

- `runtime/bot-settings/settings.json` authoritative, `last-good.json` สำเนาหลัง commit; runtime ถูก Git ignore, directory0700/files0600 แยกจากKM/memory/customer
- atomic temp+fsync+rename, exclusive `.write-lock`, CAS revision, strict schema/unknown keys/prototype checks; ไม่เกิน2MB เก็บ30เวอร์ชันล่าสุดรวมactiveและ200เหตุการณ์
- Primary เขียนไม่สำเร็จไม่สลับ active; เตรียม session ไม่สำเร็จก็ไม่ commit ถ้า backup เขียนไม่ได้หลัง primary commit primaryยังเป็นผลสำเร็จที่authoritative ไม่รายงานว่าล้มเหลวแล้วใช้ค่าจริงใหม่เงียบ ๆ
- Primary เสีย/หาย ใช้last-goodที่ตรวจผ่านแบบอ่านอย่างเดียว ไม่เขียนทับไฟล์เสีย; ถ้าทั้งสองเสียตั้งแต่ startup จะไม่เริ่มด้วยค่าปลอม ต้องกู้ไฟล์โดยผู้ดูแลก่อน ไม่ใช่ระบบbackupข้ามเครื่อง
- ล็อกค้างหลัง crash ไม่ลบอัตโนมัติ ผู้ดูแลต้องหยุด writer และตรวจว่าไม่มี process เขียนก่อนกู้ lock/ไฟล์ ไม่รองรับหลายhostบนshared filesystem
- API loopback/Host/Origin/Fetch-Site/CSRF/JSON/16KiB ไม่รับ credential/policy/actor จาก browser; UIใช้textContent/valueสำหรับข้อมูลที่ไม่เชื่อถือ

## ผลตรวจและสถานะเปิดใช้ 28 ตุลาคม 2026

- Buildผ่าน, regression132/132 และ catalog import9/9ผ่าน
- Settings tests16รายการ ใช้SDKจริงกับmock transportและtemp stores: bounds/pair/secret/prototype, trial/review/apply/rollback/restart, expiry/context invalidation, concurrent/stale/lock, failed trial/preflight/atomic commit, corruption/checksum/last-good, bounded history, system prompt/token/call budget, next-turn/inflight/queued model replacementพร้อมmemory, deadline1วินาทีบนTerminal/LINE และ cooldown429แยกprovider/modelไม่ไปขวางรุ่นใหม่
- Browser CUA temp fixture ผ่านเลือกproviderยังไม่พร้อม, เปลี่ยนโมเดล/บุคลิก/limits, save/trial/review/explicitapply/reload, แก้หลังreviewแล้วต้องตรวจใหม่, HTMLเป็นtext, rollbackครบขั้น และKMร่างที่ยังไม่บันทึกคงอยู่เมื่อสลับเมนูหรือapplysettings มือถือ390pxไม่ล้น ไม่มีconsoleerrorที่แท็บตรวจ
- Browserพบปุ่มย้อนเวอร์ชันค้างdisabledระหว่างพัฒนา แก้controlsให้ปลดหลังโหลดแล้วทดสอบrollbackซ้ำผ่าน ไม่ปล่อยปุ่มที่ใช้จริงไม่ได้
- เปิด source ใหม่บนserverเดิมแล้ว หลังตรวจงานอื่นidleและข่าวไม่มีpending/inflight; /health200, GETsettings healthy=true active=initial revision0, modelgroq/qwen/qwen3.8-27b, ไม่มีtrial/review; KMhealthy/revision0 ยังเดิม
- ตรวจเว็บจริงแบบอ่านอย่างเดียว เห็นฟอร์มพร้อมใช้งานและprovider/modelจากSDKจริง มือถือ390pxไม่ล้น ไม่มีconsoleerror ไม่กดลองหรือใช้ค่าใหม่บนstoreจริง
- ณจุดตรวจหลังเปิดฟังก์ชันครั้งแรก เทียบhashข้อมูลเดิม10ไฟล์: .env/monitor/memory/customer/คำขอ9ไฟล์ตรงเดิม news.jsonเปลี่ยนจากstartup recoveryของworker ไม่กล่าวอ้างว่าทุกruntime byteคงเดิม
- ภายหลังจุดเทียบhashพบ incoming LINE ที่ผู้ใช้เริ่มเอง บริการรับ–ตอบตามปกติ (logระบุsettingsVersion=initial) ไม่ใช่ข้อความที่แมนส่งทดสอบ จึงไม่ใช้hashเก่าอ้างว่าประวัติ/memoryต้องคงbytesเดิมหลังมีการใช้งานจริง
- **ไม่มีการเรียกโมเดลจริงหรือส่ง LINE โดยแมนจากการทดสอบรอบนี้** ผลเปลี่ยนโมเดล/limitsครบขั้นเป็นSDK mock + temp เท่านั้น ไม่อ้างว่าเรียกทุกโมเดลหรือLINE E2Eจริงผ่าน ต้องให้เจ้าของเลือก/ลอง/ตรวจ/ยืนยันค่าที่ต้องการเอง
- ไม่เปลี่ยนcredentials/webhook/tunnel/generatedcatalog/research ไม่commit/push ภาพจริงอยู่ใน `design/knowledge/response-settings-*-live.png`; ภาพtempระบุชัดว่าfixture

```sh
npm run build
node --test dist/response-settings.test.js dist/response-settings-api.test.js
npm test
CATALOG_PYTHON=/Users/taweesaksamanchuen/.pyenv/versions/3.11.8/bin/python3 npm run test:catalog-import
```

ภาพหน้าระบบจริงที่ชื่อมี `-live.png` เก็บเฉพาะเครื่องและถูก Git ignore เพราะอาจมีข้อมูลปฏิบัติการ ภาพที่ commit เป็นภาพร่างหรือข้อมูลทดสอบชั่วคราวเท่านั้น
