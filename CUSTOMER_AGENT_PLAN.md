# แผน Customer Agent รุ่นแรก

วันที่: 23 ตุลาคม 2026

สถานะ: M1 — ตั้ง Git และเก็บ baseline แล้ว; ยังไม่ได้เริ่มพัฒนา core รุ่นแรกใน M2

## เป้าหมาย

สร้าง Customer Agent ที่ใช้ Pi SDK core เดียวกันผ่านสองช่องทาง: Terminal สำหรับทดสอบเร็ว และ LINE สำหรับกลุ่มทดสอบ โดยใช้กติกา แหล่งข้อมูล และ tools ชุดเดียวกัน ทดสอบพฤติกรรมใน Terminal ให้ผ่านก่อนเชื่อม LINE

รุ่นแรกต้องตอบ FAQ/ข้อมูลสินค้าและเงื่อนไขจากแหล่งที่กำหนด ตรวจสถานะออเดอร์จำลอง และรับคำขอให้เจ้าหน้าที่ช่วยต่อได้ ต้องบอกตรง ๆ เมื่อไม่มีข้อมูลหรือยังส่งต่อไม่ได้ ไม่กล่าวอ้างว่าดำเนินการสำเร็จหากยังไม่มีหลักฐาน

## สถานะปัจจุบัน: เดโมทดลอง engine

ตรวจโค้ด `src/agent.ts`, `src/main.ts`, `src/chat.ts`, `src/conversation.ts`, `src/diagnostics.ts`, tests, package.json และ .gitignore แล้ว โดยไม่อ่านไฟล์ secrets สถานะผลทดสอบจริงด้านล่างอ้างอิงการทดสอบที่ทำสำเร็จในงานก่อนหน้า งานเขียนแผนนี้ไม่ได้เรียกโมเดลซ้ำ

| สถานะ | สิ่งที่มีแล้ว | หลักฐานและขอบเขต |
|---|---|---|
| DONE | ติดตั้ง Pi SDK และ TypeScript | SDK 1.4.0, package-lock.json; build และ tests ล่าสุด 5 รายการผ่าน |
| DONE | ถามครั้งเดียว | `npm start -- "คำถาม"` |
| DONE | แชตต่อเนื่องใน Terminal | `npm run chat`; ใช้ session เดิมในหน่วยความจำจนจบโปรเซส |
| DONE | เรียกโมเดลจริง | ทดสอบ Groq Qwen ด้วย .env ที่ผู้ใช้ตั้งเอง; แก้ compatibility ของ message role แล้ว |
| DONE | Tool ตรวจออเดอร์จำลอง | `lookup_demo_order`; DEMO-1001 คืน shipped / DEMO-TRACK-001; เลขอื่นคืน found=false |
| DONE | จำกัด tools | อนุญาตเฉพาะ tool จำลอง; ไม่โหลด extensions/skills/context อัตโนมัติ; ทดสอบปฏิเสธ bash แล้ว |
| DONE | ความจำใน session และ live tool calling | ทดสอบจริงสอง turn: จำชื่อจากข้อความก่อนและตรวจออเดอร์ได้ |
| DONE | Progress, timeout และ error เบื้องต้น | แจ้งทันทีและทุก 5 วินาที; deadline เริ่มต้น 45 วินาที; แยก HTTP/network/timeout และคำตอบว่าง; ไม่พิมพ์ raw provider error |
| DONE | ออกจากแชตและ cleanup | /exit, /quit, EOF, Ctrl-C; มี tests สำหรับยกเลิกงานที่กำลังทำ |
| TODO | Core สำหรับบริการหลายลูกค้า | ปัจจุบันมีฟังก์ชันสร้างเดโม ยังไม่มีบริการกลางที่แยก adapter และ customer context อย่างครบถ้วน |
| TODO | Session แยกลูกค้าและเก็บถาวร | ปัจจุบันหนึ่งโปรเซสแชตมีหนึ่ง session ไม่ใช่ระบบหลายลูกค้า และปิดแล้วลืม |
| TODO | FAQ/สินค้า/เงื่อนไข | ยังไม่มี dataset, retrieval tool, แหล่งอ้างอิงหรือการจัดการเวอร์ชันข้อมูล |
| TODO | LINE adapter | ยังไม่มี webhook, ตรวจความถูกต้องของ event, ป้องกัน event ซ้ำ หรือส่งคำตอบ LINE |
| TODO | Customer identity และสิทธิ์ | ยังไม่มีการ map/verify ลูกค้า หรือ backend authorization สำหรับข้อมูลจริง |
| TODO | รับคำขอส่งต่อเจ้าหน้าที่ | ยังไม่มี case store, สถานะคำขอ หรือช่องทางส่งต่อจริง |
| TODO | Logging และ cost control ระดับบริการ | ปัจจุบันเป็น output ใน Terminal และข้อความ error ที่ผ่านการกรอง ยังไม่มี structured audit log หรือเพดาน token/ค่าใช้จ่าย |
| DONE | Git baseline (M1) | Repository แยกที่ pi-sdk-demo, branch main; เก็บ source/tests/config/เอกสารและ .env.example; กัน secrets/runtime ออก; ไม่มี remote และไม่ push |

ข้อจำกัดที่ยังเห็น: พฤติกรรมตอบของโมเดลยังไม่ผ่านชุดประเมิน FAQ/การไม่แต่งข้อมูลทั้งหมด และอาการ greeting ค้างที่ผู้ใช้เคยพบยังไม่ reproduce แม้ทดสอบครั้งหลังตอบได้ จึงไม่ถือว่าพิสูจน์ความเสถียรทุกกรณีแล้ว

## ขอบเขตรุ่นแรก

- ตอบคำถามจาก FAQ ข้อมูลสินค้า และเงื่อนไขที่เจ้าของข้อมูลรับรอง พร้อมระบุแหล่ง/เวอร์ชันที่ใช้ หากไม่พบหรือข้อมูลขัดกันให้บอกข้อจำกัดและเสนอรับคำขอเจ้าหน้าที่
- ตรวจออเดอร์จำลองเท่านั้น แยกผล found/not_found ชัดเจน ไม่สร้างเลขติดตามหรือสถานะเอง
- รับคำขอส่งต่อ: เก็บเป็นเคสภายในพร้อมเลขอ้างอิงและสถานะ เช่น `requested` โดยขอรายละเอียดเท่าที่จำเป็น แจ้งว่าเป็นเพียงการรับคำขอจนกว่าจะมีการส่งต่อที่ตรวจสอบได้
- มี Terminal adapter และ LINE adapter สำหรับกลุ่มทดสอบ ใช้ core/policy/tool registry เดียวกัน ความต่างเฉพาะการรับส่งข้อความและแสดงสถานะ
- แยก session รายลูกค้า กำหนดวิธีเก็บ/หมดอายุ/ลบ และกันข้อความพร้อมกันของลูกค้าคนเดียวไม่ให้ชนกัน
- มี logging ที่ลดข้อมูลส่วนบุคคลและไม่เก็บ secrets, error handling, timeout และงบการใช้งานที่ enforce ในโค้ด

## ไม่รวมในรุ่นแรก

- อ่านหรือเปลี่ยนออเดอร์จริง ชำระเงิน คืนเงิน ยกเลิกออเดอร์ เปลี่ยนที่อยู่ หรือแก้ข้อมูลลูกค้า
- เปิดใช้งานสาธารณะให้ลูกค้าทั้งหมด หรือเชื่อมระบบเดิมโดยอัตโนมัติ
- ให้อำนาจโมเดลใช้ shell/file tools หรือเลือกสิทธิ์ลูกค้าด้วยตัวเอง
- ส่งข้อความหาเจ้าหน้าที่/บุคคลอื่นจริงในงานปัจจุบัน การส่งต่อจริงต้องกำหนดช่องทาง ผู้รับ ข้อมูลที่จะส่ง และได้รับคำสั่งอนุญาตให้เชื่อม/ส่งก่อน
- Action ที่เปลี่ยนข้อมูลธุรกิจในอนาคตต้องมี preview และ confirmation ที่ผูกกับ action/พารามิเตอร์/ผู้ใช้ พร้อมตรวจสิทธิ์ซ้ำก่อน execute ไม่ใช้ข้อความยืนยันที่โมเดลสร้างเองแทนการอนุมัติ

## องค์ประกอบที่เสนอ

1. **Agent core:** รับข้อความและ customer context ที่ backend สร้าง ใช้ Pi session, system policy และ tools กลาง คืนคำตอบพร้อมผลลัพธ์ที่ adapter นำไปแสดงได้ ตัดการพิมพ์ stdout/stderr ออกจาก business logic
2. **Terminal adapter:** ให้ผู้ทดสอบเลือกลูกค้าจำลองผ่านกลไกทดสอบที่กำหนด ส่งข้อความเข้า core และแสดง progress; ตัวตนจำลองนี้ใช้เฉพาะทดสอบ ไม่ถือเป็นการยืนยันลูกค้าจริง
3. **LINE adapter:** ตรวจความถูกต้องของ webhook ก่อนสร้าง trusted channel identity, จำกัดกลุ่มทดสอบ, แปลง event เป็นข้อความกลาง, ป้องกัน event ซ้ำ และจัดการส่งคำตอบตามข้อจำกัดของช่องทาง ไม่ส่งข้อความ progress ทุก 5 วินาทีเข้า LINE โดยอัตโนมัติ
4. **Identity/authorization layer:** map ตัวตนจากช่องทางเป็น customer ID ฝั่ง server ค่าที่ผู้ใช้พิมพ์หรือโมเดลเสนอไม่ใช่หลักฐานสิทธิ์ ห้ามรวมประวัติ Terminal กับ LINE เพียงเพราะชื่อหรือหมายเลขที่อ้างตรงกัน
5. **Session service/store:** ใช้ key ที่มีขอบเขตช่องทาง/tenant/customer/conversation ชัดเจน หนึ่งลูกค้าไม่เห็นข้อมูลอีกคน จัดคิวราย session; กำหนดนโยบาย restart, retention และการลบก่อนเลือก storage
6. **Knowledge service:** นำเข้าข้อมูลจากแหล่งที่กำหนด ให้ tool ค้นหาเฉพาะข้อมูลที่อนุญาต คืนเนื้อหากับ source/version จัดการ not_found/conflict และไม่ถือคำสั่งที่แฝงในเอกสารเป็นกติกาของ agent
7. **Tools:** คง `lookup_demo_order`; เพิ่ม tool ค้น FAQ และ tool บันทึกคำขอเจ้าหน้าที่ภายใน ทุก tool validate input และตรวจสิทธิ์ที่ backend แม้โมเดลเรียกผิด ไม่เปิด built-in file/shell tools
8. **Handoff service:** เก็บคำขอและติดตามสถานะภายใน การมีเลขเคสไม่เท่ากับเจ้าหน้าที่ได้รับข้อความ ตัวเชื่อมส่งต่อจริงยังปิดไว้จนกว่าจะตกลง destination และขอบเขตการส่ง
9. **Operations:** configuration ตรวจตอนเริ่มระบบ, log แบบ structured, metrics เวลา/token/cost/error, timeout/cancellation, จำกัดขนาด input/output/history และจำนวน tool/model calls ต่อ turn

## กติกาความปลอดภัยและความถูกต้อง

- ก่อนแตะข้อมูลจริงต้องยืนยันตัวตนและตรวจ ownership ของข้อมูลใน backend; LINE user ID เพียงอย่างเดียวไม่พิสูจน์ว่าเป็นเจ้าของออเดอร์ใด
- ข้อความลูกค้าและเนื้อหาจากแหล่งความรู้เป็นข้อมูลที่ไม่ควรเชื่อถือเป็นคำสั่งเพิ่มสิทธิ์ ไม่มี prompt ใดเปิด tool ใหม่หรือเปลี่ยน customer ID ที่ backend รับรองได้
- Logging เก็บ request ID, ตัวระบุลูกค้าที่ลดการระบุตัว, latency, tool name, result category, token usage และ cost ที่วัด/ประมาณได้ ห้ามเก็บ API keys, tokens, headers, webhook secrets หรือ raw provider payload ไม่บันทึกข้อความลูกค้าทั้งหมดเป็นค่าเริ่มต้น
- Terminal ปัจจุบันแสดงข้อความที่พิมพ์และคำตอบตามปกติ นี่ไม่ใช่หลักฐานว่ามี production logging policy แล้ว ประวัติสนทนาที่จะเก็บต้องมี access control และ retention แยกจาก operational logs
- กำหนดเพดานต่อข้อความ/ลูกค้า/ช่วงเวลา, max output tokens, context budget และจำนวน tool calls/retries ในโค้ด หาก usage/cost วัดไม่ได้ต้องระบุว่า unknown ไม่บันทึกเป็นศูนย์
- เมื่อ timeout, rate limit หรือ provider ล้มเหลว ให้ข้อความที่ไม่เผยข้อมูลภายในและสถานะที่ไม่กล่าวอ้างว่างานสำเร็จ ห้าม retry แบบไม่จำกัด

## Milestones และเกณฑ์ผ่าน

ดำเนินตามลำดับ โดย M1 เสร็จแล้ว ขั้นพัฒนาถัดไปคือ M2 ยังไม่เริ่มในรอบ Git นี้

| ลำดับ | งาน | Acceptance criteria ที่ทดสอบได้ |
|---|---|---|
| M1 — DONE | เริ่ม Git และเก็บ baseline | ตรวจรายการไฟล์และสแกน secrets ก่อน commit; .env, credentials, .pi-runtime, logs, session data และ node_modules ไม่ถูก track; .env.example เป็นค่าตัวอย่างไม่มีคีย์; build/tests 5 รายการผ่าน; ไม่มี remote/push |
| M2 — ถัดไป | สรุปข้อมูล/ข้อตกลง และแยก core | ระบุ FAQ source/version, owner, policy และค่าจำกัดที่แน่นอน; core เรียกได้โดยไม่ผูก Terminal; one-shot/chat เดิมยังผ่าน; adapters ใช้ registry/policy เดียวกัน |
| M3 | แยก customer sessions และวาง identity gate | ทดสอบลูกค้า A/B สลับข้อความโดยไม่เห็นประวัติอีกฝ่าย; คำอ้างว่าเป็นลูกค้าอื่นเปลี่ยน identity ไม่ได้; concurrent messages ลูกค้าเดียวเรียงลำดับ; restart/expiry/delete เป็นไปตาม retention ที่ตกลง |
| M4 | เพิ่ม knowledge และรับคำขอเจ้าหน้าที่ภายใน | ชุดคำถามอ้างอิงอย่างน้อย 10 เคสครอบคลุม FAQ/สินค้า/เงื่อนไข; มี not_found, conflict และ prompt injection; ทุกคำตอบข้อเท็จจริงตรวจกลับแหล่งได้; mock order ถูก/ไม่พบไม่แต่งข้อมูล; เคสส่งต่อได้เลขอ้างอิงและไม่อ้างว่าส่งจริง |
| M5 | ผ่าน Terminal และ operational gates | สถานการณ์หลาย turn/หลายลูกค้า, tool denial, timeout, 401/429, empty response, cancellation ผ่าน; fault injection ยืนยัน budget/loop cap; ใส่ secret จำลองแล้วตรวจ log ไม่พบ; ชุด acceptance ที่ตกลงผ่านทั้งหมดก่อนต่อ LINE |
| M6 | เชื่อม LINE สำหรับกลุ่มทดสอบ | เมื่อมี OA/credentials/hosting: webhook ที่ตรวจสอบไม่ผ่านถูกปฏิเสธ, event ซ้ำไม่ทำงานซ้ำ, จำกัดผู้ทดสอบ, ส่งคำตอบได้; identity/session isolation และคำถามชุดเดียวกับ Terminal ผ่าน; secret อยู่ใน config ฝั่ง server |
| M7 | ทดลองกลุ่มเล็กและตัดสินใจรุ่นถัดไป | บันทึกผล correctness, latency, error rate, tokens/cost เทียบเกณฑ์ที่ตกลงก่อนทดลอง; ทดสอบ restart/retention; มีวิธีปิด LINE adapter และกลับไป Terminal; สรุปข้อผิดพลาดที่เหลือก่อนเปิดกว้าง |

เกณฑ์ M4 เป็นขั้นต่ำของชุดทดสอบ ไม่ใช่การรับรองความถูกต้องทุกคำถาม ต้องกำหนด expected answer และผล tool ที่คาดหวังก่อนรัน ไม่ใช้เพียงการที่โมเดลตอบได้เป็นเกณฑ์ผ่าน

## ข้อมูลและการตัดสินใจที่ยังขาด

| เรื่อง | ต้องกำหนดก่อนเริ่มส่วนใด |
|---|---|
| FAQ/สินค้า/เงื่อนไข | แหล่งข้อมูลที่อนุญาต เจ้าของข้อมูล เวอร์ชัน/วันมีผล รอบปรับปรุง และวิธีตัดสินเมื่อข้อมูลขัดกัน — ก่อน M4 |
| LINE ทดสอบ | Test OA, กลุ่มผู้ทดสอบ, credentials ที่ตั้งฝั่ง server, HTTPS webhook hosting และผู้ดูแล deployment — ก่อน M6; ไม่ส่ง secrets ผ่านแชต |
| Customer mapping/verification | นิยามลูกค้า/tenant และวิธีเชื่อมตัวตนข้ามช่องทาง; วิธี verify และตรวจสิทธิ์ออเดอร์จริง — ออกแบบใน M3, ต้องผ่านก่อนเพิ่มข้อมูลจริงในรุ่นอนาคต |
| Handoff destination | ช่องทาง ผู้รับ/ทีม ข้อมูลที่จะส่ง เวลารับเรื่อง และขอบเขตที่อนุญาต — ก่อนเพิ่มการส่งต่อจริง; รุ่นแรกเริ่มรับเคสภายในได้ |
| Retention | เก็บประวัตินานเท่าไร ใครอ่านได้ วิธีลบ และเปิดโปรเซสใหม่ต้องจำอะไร — ก่อนเลือก persistent store ใน M3 |
| Cost/quality limits | งบต่อวัน/ลูกค้า/turn, token/context/tool-call caps, latency และ error threshold — ก่อน M5 และทดลองกลุ่มจริง |
| Git/remote | มี local repository ที่ pi-sdk-demo แล้ว; หากจะ push ภายหลังต้องกำหนด remote และ private access ก่อน ยังไม่มี remote/push |

ข้อมูลเหล่านี้ยังไม่จำเป็นต้องขอเพื่อเขียนแผน แต่เป็น dependency ก่อนลงมือ milestone ที่เกี่ยวข้อง

## จุดจบของงานรอบนี้

งานเขียนแผนเดิมส่งมอบเอกสารและลิงก์จาก README จากนั้นผู้ใช้อนุญาตให้ทำ M1 จึงตั้ง local Git และเก็บ baseline โดยกัน secrets และข้อมูล runtime ออก ไม่เปลี่ยน core หรือพฤติกรรมเดโม ไม่อ่าน/แก้ credentials ไม่ตั้ง remote/push ไม่เรียกโมเดลหรือส่ง LINE และไม่ส่งข้อความหาเจ้าหน้าที่ ขั้นพัฒนาถัดไปคือ M2: สรุปข้อมูล/ข้อตกลงและแยก core ซึ่งยังไม่ได้เริ่มในรอบนี้
