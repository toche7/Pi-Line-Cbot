# ส่งข่าว — คู่มือและสถานะพัฒนา

## อัปเดตหลังเจ้าของอนุญาตเปิดข่าวเฉพาะรายการ

เปิดใช้งานบนเซิร์ฟเวอร์เดิมแล้วหลังงาน KM หยุดแก้ไฟล์ร่วม: server เชื่อม LINE push transport เดิมและ NewsWorker แบบ gated เปิดได้เฉพาะ campaign ที่มี authorization ตรง review เท่านั้น ข่าวอื่นยังไม่ได้รับสิทธิ์ ไม่เปลี่ยน LINE config/credentials/tunnel

เจ้าของอนุญาตข่าว “แนะนำหลักสูตรใหม่” จากนั้นบันทึก consent พร้อมหลักฐานและตรวจผู้รับจริง 1 คนแล้ว ฝั่ง host ตรวจข้อความ/selection/digest ตรงฉบับที่อนุญาต จึงต่ออายุ review เดิมและบันทึกสิทธิ์โดยไม่เข้าคิวส่ง ตรวจ API จริงพบ canConfirm=true และข่าวอื่นไม่มีสิทธิ์

เจ้าของกดยืนยันส่งจากหน้าเว็บเอง ผลล่าสุด campaign=complete, ผู้รับ 1 คน accepted, attempts=1 และมี provider request id เจ้าของยืนยันว่าได้รับข้อความแล้ว นับเป็น LINE ส่งจริงผ่านเฉพาะข่าวและผู้รับนี้ ไม่เหมาว่าทดสอบส่งจริงหลายคนหรืออ่านแล้วทุกคน การกดครั้งก่อนรีโหลดถูกปฏิเสธเพราะ CSRF จากก่อนรีสตาร์ต ไม่ได้เข้าคิวหรือส่งออก รีโหลดหน้าแล้วเจ้าของกดยืนยันสำเร็จ ไม่ได้ส่งซ้ำจากผู้ช่วย

ผลหลังนำขึ้น: health 200; hash ของ .env/ทะเบียนลูกค้า/monitor/คำขอเดิม 5 ไฟล์ตรงก่อนรีสตาร์ต (news store เปลี่ยนตาม authorization และผลส่งที่ตั้งใจบันทึก) Owner authorization ถูกใช้กับข่าวสิ้นสุดแล้ว ไม่สามารถยืนยันข่าวเดิมซ้ำ ผู้ใช้เลือกคงขอบเขต 1,000 คนต่อข่าวก่อน และพักการขยายหลักหมื่น/หลักแสนไว้ ยังไม่ได้ load test หรือส่งจริงครบ 1,000 คน ต้องตรวจ throughput/deadline/quota ก่อนรับรองขนาดนั้น ปัจจุบัน dispatch ทีละคำขอเว้นอย่างน้อย 1 วินาที และ deadline 15 นาทีอาจทำให้ข่าวเต็ม 1,000 คนจบไม่ครบก่อนหมดเวลา จึงเป็นงานตรวจและปรับรอบถัดไป ไม่ใช่ขนาดที่ยืนยันผ่านแล้ว

เพิ่มสิทธิ์แบบ durable ผูก campaign และ review digest อายุ 30 นาที เก็บใน outbox เดิม ออกสิทธิ์ได้จาก trusted host เท่านั้น ไม่มี HTTP action ให้หน้าเว็บออกสิทธิ์เอง การตรวจตัวอย่างซ้ำเมื่อ digest เดิมคงสิทธิ์ไว้ แต่การแก้ร่างหรือเปลี่ยนผู้รับ/consent ทำให้สิทธิ์เดิมใช้ไม่ได้ ปุ่มส่งปิดเมื่อผลตรวจเกิน 10 นาที ต้องตรวจใหม่ก่อนส่ง

เพิ่ม NewsWorker: มี lock เจ้าของ worker เพียงตัวเดียว กู้ inflight เป็นกำกวมก่อนเริ่ม ไม่ส่งจนกว่าผู้ใช้กดยืนยันให้ข่าวเข้าคิว และ drain งานค้างก่อน shutdown หากบันทึกผลล้มเหลวหยุด worker ไม่ retry ไม่ทราบผลเอง หากโปรเซส crash ต้องตรวจว่าไม่มี worker เดิมก่อนกู้ `.worker-lock` ที่ค้าง

ผลตรวจรอบนี้: runtime 115/115 ผ่าน รวมส่งข่าว 16 รายการ และ integrated browser QA ผ่านด้วย temp/mock ไม่มีการส่ง LINE จริง ระหว่างเตรียมเชื่อม server ยังไม่มีการเปิดส่งจริง ข้อความสถานะด้านล่างเป็นหลักฐานรอบก่อน

28 ตุลาคม 2026: **เชื่อมแท็บส่งข่าวบนเว็บเดิม http://127.0.0.1:3001/#news แล้ว** รอทั้งงานบทสนทนาและงานรอดูแล idle และอ่านไฟล์ร่วมล่าสุดก่อนเชื่อม คง navigation และ API ของทั้งสองงาน จากนั้นรีสตาร์ต shared server ด้วย .env เดิมแล้ว การส่งข่าวจริงยังปิด ไม่มี campaign ได้รับอนุญาต ไม่มีการส่ง LINE จริง ไม่เปลี่ยน credentials/config/tunnel และไม่แก้ consent ลูกค้าจริง

## สิ่งที่ทำได้

- สร้างชื่อข่าวภายในทีม เขียนข้อความล้วนสูงสุด 5,000 ตัวอักษร บันทึกฉบับร่าง เปิดแก้และโหลดใหม่ได้
- เลือกรายคนและหลายกลุ่มจาก CustomerStore เดิม คนซ้ำส่งครั้งเดียว กลุ่มเป็นหมวดหมู่ภายใน ไม่ใช่ห้อง LINE
- เลือกเฉพาะ channel LINE / OA ตรงกัน / subscribed และประวัติ consent ล่าสุดมีหลักฐาน unknown และ unsubscribed ไม่เข้าเงื่อนไข รวมถึงการเลือกรายคนโดยตรง allowlist ไม่ใช่ consent
- ตรวจผู้รับจริง แสดงชื่อ/รหัสทุกคน จำนวนผู้ผ่านและไม่ผ่าน พร้อมตัวอย่างข้อความ LINE โดยประมาณ
- แก้ข้อความหรือผู้รับแล้วต้องบันทึกและตรวจใหม่ ตรวจหมดอายุใน 10 นาที ก่อนยืนยันเทียบ digest ของข้อความ/selection/ผู้รับ/หลักฐาน consent ใหม่ ไม่ใช้โน้ต/ข้อมูลทีมเป็นเนื้อหาส่ง
- ยืนยันได้เมื่อ host มี transport **และ** เจ้าของอนุญาต campaign id + digest นั้นโดยเฉพาะผ่าน trusted host integration เท่านั้น API หน้าเว็บไม่มีคำสั่งเปิด transport หรือสร้าง grant การอนุญาตพัฒนานี้ไม่ใช่ grant ส่งข่าว
- ประวัติการทำรายการเป็นผู้ใช้บนเครื่องนี้ (ยังไม่มี login) ไม่อ้างยืนยันตัวเจ้าหน้าที่
- ยังไม่รองรับรูป: ไม่มี uploader หรือที่เก็บ HTTPS สาธารณะพร้อมใช้ จึงไม่มีปุ่มแนบรูปที่ทำงานไม่จริง

## Outbox และผลส่ง

`NewsStore` เก็บ campaign/review/ผู้รับ/retry key/ผลรายคน/history แบบ atomic temp + fsync + rename มี exclusive file lock และ revision กันกดซ้ำ/เขียนทับ เก็บไฟล์ 0600 และ directory 0700 ไม่ได้เข้ารหัส จำกัด 200 campaign / 1,000 ผู้รับต่อ campaign / 20 MB ล้าง campaign สิ้นสุดที่เกิน 90 วันเมื่อมี transaction; draft และงานค้างคงไว้จนจัดการเอง จำกัดจำนวนเพื่อไม่ให้โตไม่สิ้นสุด หากไฟล์อ่านไม่ได้จะไม่เขียนว่างทับ

หนึ่ง push ต่อคน เก็บ UUID retry key **ก่อน** เรียก LINE ใช้ key เดิมตั้งแต่ครั้งแรก ไม่มี replyToken และไม่มีการสร้าง key ทดแทนให้รายการเดิม

- accepted: 2xx หรือ 409 ที่มี `x-line-accepted-request-id` หมายถึง LINE API รับคำขอแล้ว **ไม่ยืนยันส่งถึงหรืออ่านแล้ว**
- failed: provider 4xx อื่นหรือหมด deadline
- ambiguous: network timeout / 5xx / 409 ที่ไม่มีหลักฐาน accepted / โปรเซสหยุดขณะ inflight **ไม่ retry อัตโนมัติ**
- 429: backoff 30 / 60 วินาที สูงสุด 3 ครั้ง ภายใน deadline ใช้ key/ข้อความ/ผู้รับเดิม หลังหมดจำนวนถือ failed
- จ่ายงานทีละคำขอทั่ว outbox เว้นอย่างน้อย 1 วินาที (ต่ำกว่า provider push rate) ตั้ง timeout สูงสุด 8 วินาทีและไม่เกินเวลาคงเหลือ deadline 15 นาที จึงไม่เข้าใกล้อายุ retry key 24 ชั่วโมง
- เทียบข้อความ/กลุ่ม/รายชื่อ/consent กับ review ซ้ำก่อนจ่ายงาน ถ้าเปลี่ยนให้ยกเลิก pending ทั้งหมดและต้องตรวจข่าวใหม่ ตรวจ consent ล่าสุดอีกครั้งก่อน claim แต่ละคน ถ้าไม่ยินยอมหรือหลักฐานเปลี่ยน ยกเลิกคนนั้น ต้องจัดข่าวใหม่หากต้องการส่งตาม consent ใหม่
- cancel หยุดเฉพาะ pending งาน inflight อาจถูก LINE รับแล้ว จึงยังเก็บผลจริงและยกเลิกข้อความที่ส่งไปแล้วไม่ได้
- recover เปลี่ยน inflight เป็น ambiguous ก่อนเริ่ม worker หลัง restart ไม่ส่งซ้ำ Startup ต้องมี worker supervisor เพียงตัวเดียว ห้ามเรียก recover ระหว่าง worker ตัวอื่นยังส่งอยู่
- file lock ที่ค้างหลัง crash ต้องตรวจว่าไม่มี writer แล้วจึงกู้ lock โดยผู้ดูแล ไม่ลบอัตโนมัติ ไม่เปิดหลาย host ที่แชร์ filesystem นี้

อ้างอิงทางการ: [LINE retry API](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/) และ [Push message](https://developers.line.biz/en/reference/messaging-api/#send-push-message) การ retry ด้วย key กันประมวลผลซ้ำ แต่ไม่รับประกัน delivery

## การเชื่อมต่อและการเปิดส่งในอนาคต

1. เชื่อมแล้ว: import newsStyle/newsBody/newsScript ใน adminPage เพิ่มแท็บ id `tab-news` และ panel `news-panel` ลงรายการ tabs เดิม ยังคงห้าเมนู ภาพรวมปิดเหมือนเดิม Script ใช้ CUSTOMER_CSRF_TOKEN เดิม (API ส่ง header X-News-Token)
2. เชื่อมแล้ว: เพิ่ม NewsService optional argument ท้าย adminHandler และ route `/api/news` ผ่าน newsHandler(service, token) ก่อน monitor fallback
3. เชื่อมแล้ว: server สร้าง `new NewsService(new NewsStore(resolve('runtime/news')), customerStore, LINE_CHANNEL_ID)` **ไม่ส่ง transport** ทำให้ default ปิด ไม่อ่าน env เพื่อเปิดการส่งโดยอัตโนมัติ
4. งานปัจจุบันไม่มีอนุญาต campaign ใด จึงไม่เชื่อม token กับ newsLineTransport หรือเริ่ม worker ส่งจริง หากได้รับอนุญาตข่าวเฉพาะในอนาคต host ต้อง wire transport + authorizeCampaign(id,digest) ตรง review + startup recovery + worker scheduler และ graceful drain อย่างระวัง ควรทำเส้นทางเปิดบริการที่ตรวจได้ก่อนใช้งานจริง ไม่แก้ credentials
5. ตรวจ integration browser ใน temp บน handler รวมแล้ว ผ่านเมนูห้าแท็บและ flow ส่งข่าว/mock ทั้งหมด รีสตาร์ตเซิร์ฟเวอร์เดิมหลังทั้งสองงาน idle แล้ว ไม่สร้างเว็บใช้งานถาวรพอร์ตใหม่

## ผลตรวจ

- Build ผ่าน; full runtime regression 101/101 และ catalog import 9/9 ผ่าน
- Tests เฉพาะส่งข่าว 14/14 ผ่าน: dedupe/consent/OA gate, review invalidation, double confirm, concurrent ticks, crash recovery, deadline, 429 stable key, ambiguous no retry, 409 semantics, partial failure/cancel, สองโปรเซสแก้ revision เดียวกัน, lock/corrupt store, mock provider payload และ HTTP Host/loopback/Origin/CSRF/JSON/size
- Browser QA ผ่านด้วย Chrome: draft/reload, กลุ่ม+รายคนซ้ำ, consent filter, ชื่อและจำนวนผู้รับจริง, preview HTML เป็น text, ส่งจริง disabled, แก้แล้วต้องตรวจใหม่, conflict เก็บข้อความที่กรอก และมือถือ ทดสอบ host grant + confirm + ผล accepted ด้วย mock transport อีกหนึ่งรอบ ไม่มี page error บล็อกทุก external request และนับได้ 0
- รูป `design/news/implemented-news-*-test-data.png` เป็น UI ที่พัฒนาแล้วกับข้อมูลจำลองใน temp
- Live smoke หลังรีสตาร์ต: root มีห้าแท็บและ panel ส่งข่าว, /api/news enabled=false, campaign จริงว่าง (ไม่มี fixture), /health 200; SHA256 ของ .env, monitor, customers และคำขอเดิมรวม 5 ไฟล์ตรงก่อนรีสตาร์ต
- ยังไม่ทดสอบส่ง LINE จริง ไม่อ้างว่า production พร้อม เส้นทางส่งพร้อมระดับโมดูลและ mock; host transport/worker ยังไม่เปิด ต้อง wire และตรวจ lifecycle สำหรับ campaign ที่เจ้าของอนุญาตเฉพาะในอนาคต

```sh
npm run build
node --test dist/news*.test.js
PLAYWRIGHT_MODULE=/Users/taweesaksamanchuen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node scripts/news-ui.test.mjs --integrated
```

Browser ใช้ loopback listener ชั่วคราวและปิดเมื่อจบ เก็บข้อมูลใน temp เท่านั้น ไม่เขียนตัวอย่างลง runtime จริง
