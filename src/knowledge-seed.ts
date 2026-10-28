export const capturedAt = '2026-10-23T06:17:59Z';
const faq = 'https://cbtumu.net/faq/';
export const contactText = 'ดูช่องทางเจ้าหน้าที่จากหน้า FAQ ของ CBTU โดยตรง ข้อมูลอีเมลในเว็บบางตอนต่างกัน จึงยังไม่เลือกยืนยันอีเมลให้ ซีบอตยังไม่ได้ส่งข้อความหรือเปิดเคสให้เจ้าหน้าที่';
export const knowledgeSeed = [
  { id: 'enroll', terms: ['สมัคร', 'ลงทะเบียน', 'enroll', 'สมาชิก'], text: 'เลือกคอร์สจากหน้า Home แล้วลงทะเบียน หากยังไม่มีสมาชิกให้สมัครตามขั้นตอนบนเว็บไซต์', source: faq },
  { id: 'payment', terms: ['จ่าย', 'ชำระ', 'โอน', 'บัญชี', 'สลิป', 'เริ่มเรียน', 'ทันที', 'กี่วัน', 'ยืนยันเงิน'], text: 'ข้อมูลเวลาเริ่มเรียนใน FAQ ขัดกัน: ส่วนสมัครระบุเริ่มทันที แต่ส่วนยืนยันเงินระบุตรวจ 1–2 วัน จึงยังยืนยันเวลาไม่ได้ กรุณาตรวจหน้า FAQ และสอบถามเจ้าหน้าที่ ไม่ยืนยันเลขบัญชีหรือรายละเอียดการโอนผ่านบอต', source: faq, conflict: true },
  { id: 'receipt', terms: ['ใบเสร็จ', 'ภาษี', 'เอกสาร', 'ใบเสนอราคา', 'ใบแจ้งหนี้'], text: 'FAQ แนะนำให้ขอเอกสารผ่านเมนู Payment ส่วนใบเสนอราคาให้ติดต่อเจ้าหน้าที่ ตรวจขั้นตอนล่าสุดจากหน้า FAQ', source: faq },
  { id: 'learning', terms: ['เข้าเรียน', 'เข้าสู่ระบบ', 'ไม่พบคอร์ส', 'ดูบทเรียน', 'เรียนยังไง', 'login'], text: 'เข้าสู่ระบบด้วยบัญชีที่ลงทะเบียน แล้วดู Dashboard > Enrolled Courses หากไม่พบคอร์ส ให้เจ้าหน้าที่ตรวจการลงทะเบียน', source: faq },
  { id: 'video', terms: ['วิดีโอ', 'วีดีโอ', 'เล่นไม่ได้', 'video'], text: 'ลองอัปเดตเบราว์เซอร์ หากวิดีโอยังเล่นไม่ได้ให้ติดต่อเจ้าหน้าที่ตามหน้า FAQ', source: faq },
  { id: 'certificate', terms: ['certificate', 'ใบประกาศ', 'เกียรติบัตร', 'ประกาศนียบัตร'], text: 'เมื่อเรียนจบและผ่านเกณฑ์ ดู Dashboard > Enrolled Courses > Completed Courses เพื่อดาวน์โหลด Certificate', source: faq },
  { id: 'contact', terms: ['เจ้าหน้าที่', 'ติดต่อ', 'อีเมล', 'email', 'ส่งต่อ', 'คนจริง', 'ช่วยต่อ', 'โทร'], text: contactText, source: faq, conflict: true },
  { id: 'courses', terms: ['หลักสูตร', 'คอร์ส', 'course', 'ราคา', 'เปิดรับ', 'ตาราง', 'อบรม', 'ส่วนลด'], text: 'ดูหลักสูตรที่หน้า Home ของ CBTU ข้อมูลอาจเปลี่ยน ซีบอตยังไม่ได้ตรวจราคา รอบอบรม หรือสถานะเปิดรับสมัครแบบสด กรุณาตรวจหน้าหลักสูตรก่อนตัดสินใจ', source: 'https://cbtumu.net/' },
  { id: 'about', terms: ['cbtu', 'หน่วยงาน', 'เกี่ยวกับ', 'มหิดล'], text: 'CBTU จัดการฝึกอบรมพัฒนาสมรรถนะ โดยมีเนื้อหาด้าน Data, AI และเทคโนโลยีดิจิทัล ดูรายละเอียดจากหน้า About CBTU', source: 'https://cbtumu.net/about-cbtu/' },
].map(item => ({ ...item, title: ({enroll:"สมัครและลงทะเบียน",payment:"ชำระเงินและเวลาเริ่มเรียน",receipt:"เอกสารและใบเสร็จ",learning:"เข้าเรียน",video:"วิดีโอ",certificate:"ใบประกาศ",contact:"ติดต่อเจ้าหน้าที่",courses:"หลักสูตร",about:"เกี่ยวกับ CBTU"} as Record<string,string>)[item.id], capturedAt, reviewedAt: capturedAt, conflict: !!item.conflict, conflictNote: item.conflict ? item.text : "", retired: false }));
