# เปิด ngrok และตั้ง LINE webhook

ต้องมี Node, npm, ngrok ที่ตั้ง authtoken แล้ว และ `.env` เดิมของ DemoB1

## เปิดระบบ

Terminal แรก:

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm run server
```

ถ้าแก้โค้ดให้ `npm run build` ก่อนเปิด server

Terminal ที่สอง:

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm run ngrok
```

คำสั่งนี้ตรวจ server พอร์ต 3000 แล้วใช้ tunnel เดิมที่ตรงกัน หรือเปิด ngrok ใหม่เฉพาะพอร์ต 3000 พร้อมปิด request inspector ตรวจ OA DemoB1 และ channel ของ token ตรวจ public health/signature และ LINE Verify ก่อนเปลี่ยน webhook ผ่าน API เก็บ webhook เดิมใน `runtime/line-webhook-backup-*.json` อ่านค่ากลับยืนยัน และอัปเดตเฉพาะ `PUBLIC_BASE_URL` ใน `.env` ไม่เปลี่ยน dry run/allowlist/โหมดตอบ และไม่ส่งข้อความทดสอบหาผู้ใช้

ถ้าคำสั่งเปิด ngrok ให้ เปิด Terminal นี้ค้างไว้ กด Ctrl+C เพื่อหยุด tunnel ส่วน Server หยุดด้วย Ctrl+C ในหน้าต่างแรก ถ้าใช้ ngrok เดิมที่เปิดจากที่อื่น คำสั่งจะจบหลังตรวจเสร็จ และไม่หยุด tunnel นั้น

## ngrok ปิดหรือ URL เปลี่ยน

- ngrok ปิด: รัน `npm run ngrok` ใหม่ สคริปต์จะจัดการ URL ใหม่ให้
- เปิด ngrok เองอยู่แล้ว: รัน `npm run ngrok:sync` เพื่อตรวจและตั้ง webhook ตาม URL ปัจจุบัน คำสั่งนี้ไม่เปิด tunnel ให้
- Server ปิด: เปิด Server ก่อน แล้วรัน `npm run ngrok`
- รีสตาร์ตเครื่อง: เปิดทั้งสอง Terminal ตามขั้นตอนเดิม
- คำสั่งล้มเหลว: อ่านข้อความแล้วแก้ก่อนรันใหม่ ถ้าเปลี่ยน LINE สำเร็จแต่บันทึก `.env` ไม่สำเร็จ สามารถรันซ้ำเพื่อปรับให้ตรงกันได้

เมื่อสำเร็จต้องเห็น `LINE Verify ผ่าน; webhook เปิดใช้งาน` แล้วลองคุยกับบอตใน LINE อีกครั้ง

สคริปต์ไม่ได้เฝ้าดูหรือ restart tunnel อัตโนมัติ ถ้า ngrok หลุดต้องรันใหม่ พอร์ตเป็น 3000 และ ngrok local API เป็น 4040 ตามระบบเดิม ถ้าพบ tunnel อื่นหรือหลายรายการจะหยุดแทนการเลือกเอง หาก Use webhook ปิดอยู่ ต้องเปิดใน LINE Developers Console ก่อน

ไฟล์ backup เก็บ endpoint เดิมสำหรับกู้คืนด้วย LINE API/Console และอยู่ใน runtime ที่ไม่เข้า Git ไม่ใช้กับคำสั่ง rollback ของ `line-webhook-admin.mjs` ซึ่งเป็น workflow รุ่นเดิม

ตรวจคำสั่ง: `npm run ngrok -- --help` · ทดสอบอัตโนมัติ: `npm run test:ngrok`
