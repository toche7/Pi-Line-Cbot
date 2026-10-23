# Pi SDK customer agent experiment

เดโม Node.js/TypeScript แยกจากระบบเดิม ยังไม่มี LINE integration หรือข้อมูลลูกค้าจริง

แผนพัฒนารุ่นแรกและสถานะ DONE/TODO: [CUSTOMER_AGENT_PLAN.md](./CUSTOMER_AGENT_PLAN.md)

## เริ่มใช้งาน

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm ci --ignore-scripts
npm run build
npm test
npm run check
```

ต้องใช้ Node >=22.19.0; เครื่องที่ทดสอบใช้ Node 23.11.1 และ npm 10.9.2

เมื่อพร้อมทดสอบโมเดลจริง ให้คัดลอก `.env.example` เป็น `.env` แล้วใส่ `GROQ_API_KEY` ใหม่ด้วยตัวเองในเครื่อง (ไม่ต้องส่ง key ในแชต) จากนั้น:

```sh
npm start
npm start -- "ตรวจสถานะ DEMO-1001"
```

## แชตต่อเนื่องใน Terminal

```sh
cd /Users/taweesaksamanchuen/Dev/codexOnPC/pi-sdk-demo
npm run build
npm run chat
```

พิมพ์ข้อความหลัง `คุณ >` แล้วกด Enter ทีละข้อความ โปรแกรมใช้ Pi session เดิมตลอดการเปิดครั้งนั้น จึงจำข้อความก่อนหน้าและใช้ tool ตรวจออเดอร์จำลองต่อเนื่องได้ เช่น:

```text
คุณ > ชื่อเล่นของฉันคือ มะลิ73 ช่วยจำไว้
คุณ > ชื่อเล่นของฉันคืออะไร แล้วตรวจออเดอร์ DEMO-1001 ให้ด้วย
```

พิมพ์ `/exit` หรือ `/quit` เพื่อออก หรือกด Ctrl-C เพื่อยกเลิกคำขอที่ค้างและออก กด Ctrl-D บนบรรทัดว่างเพื่อส่ง EOF และจบการรับข้อความ (หากส่งข้อความเข้าทาง pipe โปรแกรมจะตอบข้อความที่รับไว้ตามลำดับก่อนจบ) ประวัติอยู่ในหน่วยความจำเท่านั้น เปิดโปรแกรมใหม่จะเริ่ม session ใหม่ ข้อความว่างจะถูกข้าม หลัง timeout หรือข้อผิดพลาดราย turn สามารถพิมพ์ข้อความถัดไปได้ ยังคงแสดงสถานะระหว่างรอและ timeout เดิม

โหมดถามครั้งเดียว `npm start -- "คำถาม"` และ `npm run check` ยังใช้ได้ตามเดิม

ตรวจด้วยโมเดลจริง `groq/qwen/qwen3.8-27b`: turn แรกจำชื่อ มะลิ73 ได้ (559 ms) และ turn ที่สองเรียกชื่อเดิมพร้อมเรียก tool ตรวจ DEMO-1001 และตอบ shipped / DEMO-TRACK-001 ได้ (1018 ms) Tests offline ทั้ง 5 รายการผ่าน รวม chat หลาย turn ใน session เดียว, ข้อความที่ส่งมาต่อกัน, /exit, /quit, EOF และ Ctrl-C ระหว่างคำขอที่กำลังทำงาน นอกจากนี้ตรวจ Ctrl-C ตอนรอรับข้อความและ /exit ผ่าน Terminal จริงแล้ว

ค่าเริ่มต้นคือ Groq / `llama-3.3-70b-versatile` สามารถเปลี่ยน `PI_PROVIDER` และ `PI_MODEL` เป็นคู่ที่มีใน SDK catalog พร้อม credentials ของ provider นั้นได้ ส่วน `PI_AUTH_FILE` เป็นทางเลือกสำหรับอ่าน static API key จากไฟล์ Pi เดิม โดยอ่านเฉพาะ provider ที่เลือกเข้า memory ไม่เขียนไฟล์เดิม ไม่รัน key commands และไม่โหลด OAuth

`npm run check` เปิด session และแสดงรายการ tool กับสถานะการตั้งค่า credentials โดยไม่เรียกโมเดล สถานะ configured ไม่ได้ยืนยันว่า key ยังใช้งานได้

## ส่วนที่ทดลอง

- ใช้ `@earendil-works/pi-coding-agent@1.4.0` และ `@earendil-works/pi-ai@1.4.0` ตรึง dependencies ใน package-lock.json
- สร้าง `AgentSession` แบบ in-memory และกำหนด resource loader เอง เพื่อไม่โหลด extensions, skills หรือ context จากเครื่องโดยอัตโนมัติ
- อนุญาตเฉพาะ `lookup_demo_order` ซึ่งคืนข้อมูลออเดอร์สมมติ `DEMO-1001` ไม่มี shell/file tools หรือการเปลี่ยนข้อมูลจริง
- แสดง text streaming และ tool execution events พร้อม timeout 45 วินาที ปิด retry อัตโนมัติ และ dispose session เมื่อจบ
- `src/agent.ts` เป็นจุดเริ่มนำ engine ไปประกอบ backend ภายหลัง หนึ่ง session ใช้กับหนึ่งบทสนทนา โหมด chat ใช้ session เดิมทุก turn ส่วนการเปิด CLI ครั้งใหม่เริ่มบทสนทนาใหม่

## ผลตรวจสอบ — 23 ตุลาคม 2026

- ติดตั้ง SDK สำเร็จ npm audit ตอนติดตั้งรายงาน 0 vulnerabilities
- `npm run build`: ผ่าน
- `npm run check`: ผ่าน เปิด session ได้ มี active tool เพียง `lookup_demo_order`
- `npm test`: ผ่าน integration test โดยแทน model transport ด้วยผลจำลอง แต่ใช้ session/tool dispatch/validation/history ของ SDK จริง ตรวจทั้ง tool ที่อนุญาต การปฏิเสธ `bash` ที่ไม่ได้ลงทะเบียน และบทสนทนา 2 turns
- `npm start` เมื่อไม่มี credentials: แจ้งการตั้งค่าและออกด้วยสถานะ 1 ตามคาด
- Live model รอบแรก: key เก่าได้ HTTP 401 และหยุดใช้ตามคำสั่งผู้ใช้
- หลังผู้ใช้ใส่ key ใหม่และเลือก `groq/qwen/qwen3.8-27b` ใน `.env`: ยืนยันว่าโหลด `.env` ได้, ไม่ได้ใช้ `PI_AUTH_FILE`, endpoint เป็น `https://api.groq.com/openai/v1` แต่ได้ HTTP 400 `Unexpected message role` สาเหตุที่ reproduce ได้คือ SDK ส่ง `developer` role ให้ reasoning model ซึ่ง Qwen template ปฏิเสธ
- แก้เฉพาะ Groq Qwen โดยกำหนด `compat.supportsDeveloperRole: false` เพื่อใช้ `system` role หลังแก้ live model เรียก `lookup_demo_order` และตอบสถานะ shipped พร้อม `DEMO-TRACK-001` สำเร็จ ไม่ได้แก้ credentials หรือเปลี่ยนโมเดลที่ผู้ใช้เลือก
- แยกรายงาน authentication, HTTP error, network และ timeout จริง โดยไม่พิมพ์ raw provider error เดิมข้อความรวมว่า failed or timed out จึงอาจเข้าใจว่า HTTP 400 เป็น timeout
- ปรับ deadline ได้ด้วย `PI_TIMEOUT_MS` (1000–300000, ค่าเริ่มต้น 45000) ไม่จำเป็นต้องเพิ่มเวลาสำหรับปัญหา role นี้
- Tests ปัจจุบันผ่าน 5 รายการ รวม chat/การยกเลิก, regression ของ Groq Qwen compatibility และข้อความ error ที่ไม่เผย secrets

### การตรวจอาการ greeting เงียบ

ลอง `npm start -- "สวัสดี คุณช่วยอะไรได้บ้าง"` ด้วย provider/model และ `.env` เดิม ได้ข้อความตอบครบใน 558 ms จึงยัง reproduce รอบที่ผู้ใช้ต้องกด Ctrl-C ไม่ได้ และยังสรุปสาเหตุของรอบนั้นไม่ได้

เพิ่มสถานะทันทีเมื่อส่งคำถามและทุก 5 วินาทีระหว่างรอ แยกช่วงรอโมเดล/ประมวลผล/ใช้ tool พร้อม deadline เดิม 45 วินาที ไม่แสดง reasoning หรือ tool arguments หาก provider ส่ง final text โดยไม่มี `text_delta` จะพิมพ์ final text ให้ หากจบด้วยข้อความว่างหรือ reasoning อย่างเดียว จะรายงานข้อผิดพลาดแทนข้อความ completed

เพิ่มการตรวจแบบ offline ใน SDK integration test สำหรับ transport ที่หน่วงเวลา, final message ที่ไม่มี text deltas, empty และ reasoning-only responses ทั้งหมดผ่าน ไม่ได้ยืนยันว่ากรณีเหล่านี้เกิดขึ้นจริงในรอบที่ผู้ใช้พบปัญหา

สำหรับ backend จริงยังต้องเพิ่มการยืนยันสิทธิ์ลูกค้าก่อนเข้าถึงออเดอร์ การจัดเก็บ session และ LINE adapter ส่วนเหล่านี้อยู่นอกขอบเขตเดโมนี้

## เอกสารทางการที่ตรวจสอบ

- [Pi SDK](https://pi.dev/docs/latest/sdk)
- [Full control example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts)
- [Tool configuration example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)
- [Official repository](https://github.com/earendil-works/pi)

เอกสารปัจจุบันใช้ scope `@earendil-works` ต่างจากตัวอย่างเก่าที่ใช้ `@mariozechner` ตรวจ signatures กับ declarations และ examples ของ package 1.4.0 ที่ติดตั้งด้วย
