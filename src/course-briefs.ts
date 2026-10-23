import { courseCatalog, type Course } from './course-catalog.js';

type EditorialBrief = { workExamples: string[]; outcomes: string[]; signals: string[] };
// Work examples are applications inferred from documented topics, not promises
// or additional syllabus facts. Outcomes paraphrase the same public snapshot.
const editorial: Record<string, EditorialBrief> = {
  'cbtu-01': { workExamples: ['เตรียมและสำรวจข้อมูลโดยใช้ AI ช่วย', 'วิเคราะห์ข้อมูลและทำงานกับฐานข้อมูล'], outcomes: ['ฝึก EDA และใช้ Python/Pandas กับข้อมูล', 'ฝึก Machine Learning และ SQL'], signals: ['วิเคราะห์ข้อมูล', 'data', 'python', 'sql', 'ai'] },
  'cbtu-02': { workExamples: ['ค้นคว้าและวางโครงบทความวิชาการ'], outcomes: ['ใช้ Prism AI ช่วยค้นและสรุปข้อมูล', 'วางโครงงานเขียนโดยคำนึงถึงจริยธรรม AI'], signals: ['วิจัย', 'บทความ', 'วิชาการ', 'research', 'prism'] },
  'cbtu-03': { workExamples: ['ช่วยร่างงานและทำสื่อสำหรับงานประจำ'], outcomes: ['ฝึกใช้ Claude และการเขียน prompt', 'ทำ Presentation/Poster/Infographic ด้วย Canva AI'], signals: ['งานประจำ', 'เอกสาร', 'สื่อ', 'presentation', 'claude', 'ai'] },
  'cbtu-04': { workExamples: ['พัฒนา AI Agent เป็นโครงงานต่อเนื่อง'], outcomes: ['ฝึกเชื่อม LLM เครื่องมือ และ RAG', 'ทำ Capstone พร้อมเรียนเรื่อง guardrails'], signals: ['agent', 'เอเจนต์', 'โครงงาน', 'rag', 'mcp', 'python'] },
  'cbtu-05': { workExamples: ['ศึกษางาน Data Science ตั้งแต่โมเดลถึงการประยุกต์ธุรกิจ'], outcomes: ['ฝึก Supervised/Unsupervised Learning และ Data Mining', 'เรียน Business Intelligence และการนำไปใช้'], signals: ['data science', 'machine learning', 'โมเดล', 'วิทยาศาสตร์ข้อมูล'] },
  'cbtu-06': { workExamples: ['สรุปยอดขายหรือข้อมูลจากตาราง Excel', 'จัดทำตารางสรุปและกราฟสำหรับรายงาน'], outcomes: ['ฝึกสูตร IF และ Lookup', 'สรุปข้อมูลด้วย PivotTable และ Charts'], signals: ['excel', 'เอ็กเซล', 'ตาราง', 'ยอดขาย', 'pivot', 'สูตร', 'รายงาน'] },
  'cbtu-07': { workExamples: ['ทำโปสเตอร์และสไลด์นำเสนอ', 'ออกแบบสื่อด้วย Canva'], outcomes: ['ฝึกใช้ Elements และจัดการงานออกแบบ', 'ทำ Presentation/Video และใช้ Canva AI'], signals: ['canva', 'แคนวา', 'ออกแบบ', 'โปสเตอร์', 'สไลด์', 'สื่อ'] },
  'cbtu-08': { workExamples: ['ใช้ AI ช่วยงานการตลาดผลิตภัณฑ์สุขภาพ'], outcomes: ['ฝึกหา Marketing insights ด้วยเครื่องมือ AI', 'ตรวจความถูกต้องและความเสี่ยงของผลลัพธ์'], signals: ['การตลาด', 'สุขภาพ', 'marketing', 'ผลิตภัณฑ์', 'gemini'] },
  'cbtu-09': { workExamples: ['เชื่อมงานซ้ำและเครื่องมือด้วย workflow', 'ทดลองทำแชตบอต LINE เชื่อม AI'], outcomes: ['ฝึกเชื่อม Sheets/Email/Webhook กับ LLM', 'ใช้งาน tools และ memory ใน Agent'], signals: ['n8n', 'workflow', 'อัตโนมัติ', 'งานซ้ำ', 'แชตบอต', 'แชทบอท', 'line', 'agent'] },
  'cbtu-10': { workExamples: ['ฝึกสร้าง AI workflow ในรูปแบบ workshop'], outcomes: ['ฝึก n8n, LLM chain และ Agent tools', 'เรียน RAG และแนวทางติดตั้ง Local/Cloud'], signals: ['n8n', 'workflow', 'อัตโนมัติ', 'workshop', 'rag', 'agent'] },
  'cbtu-11': { workExamples: ['สั่งงาน AI เพื่อช่วยเอกสาร ภาพ และตาราง'], outcomes: ['ฝึก Prompt Engineering กับ AI/LLM', 'รู้ข้อจำกัดและแนวทางใช้งานอย่างปลอดภัย'], signals: ['prompt', 'พรอมต์', 'เอกสาร', 'สั่งงาน', 'gemini', 'ai'] },
  'cbtu-12': { workExamples: ['รู้จักการใช้ AI Agent เชื่อมงานและเครื่องมือ'], outcomes: ['เรียนแนวคิด Agentic AI และ Tools/Memory', 'ดูการใช้ n8n, Claude Co-Work และ OpenClaw'], signals: ['agent', 'เอเจนต์', 'อัตโนมัติ', 'n8n', 'openclaw'] },
  'cbtu-13': { workExamples: ['สำรวจการใช้ Agent กับคอนเทนต์ เว็บ และไฟล์ข้อมูล'], outcomes: ['เรียน Agent workflow/CLI', 'ดูการประยุกต์กับ CSV/Excel และ Web Application'], signals: ['agent', 'เอเจนต์', 'คอนเทนต์', 'เว็บไซต์', 'csv', 'excel'] },
  'cbtu-14': { workExamples: ['ทำความเข้าใจ AI ก่อนนำไปใช้กับงาน'], outcomes: ['เรียนพื้นฐาน NLP/Transformer และ Prompting', 'รู้จัก ChatGPT, RAG และข้อจำกัดด้านความเป็นส่วนตัว'], signals: ['ai', 'เริ่มต้น', 'พื้นฐาน ai', 'chatgpt', 'ปัญญาประดิษฐ์'] },
  'cbtu-15': { workExamples: ['วิเคราะห์ความสัมพันธ์ของข้อมูล', 'สรุปข้อมูลและนำเสนอด้วย Looker Studio'], outcomes: ['ฝึก Statistics/Regression และ Join/Union', 'เรียน Pivot, Data quality และ PDPA'], signals: ['วิเคราะห์ข้อมูล', 'data', 'สถิติ', 'looker', 'รายงาน', 'dashboard', 'แดชบอร์ด'] },
  'cbtu-16': { workExamples: ['วิเคราะห์และสร้างโมเดลข้อมูลด้วย Python'], outcomes: ['ฝึก Regression/Classification และ Clustering', 'ประเมินโมเดลด้วย Cross-validation'], signals: ['python', 'machine learning', 'โมเดล', 'data science', 'scikit'] },
  'cbtu-17': { workExamples: ['สร้าง dashboard สำหรับนำเสนอข้อมูล'], outcomes: ['ฝึก Looker Studio และ Interactive Dashboard', 'เชื่อมข้อมูลและสร้าง Calculated Fields/Parameter'], signals: ['dashboard', 'แดชบอร์ด', 'looker', 'รายงาน', 'นำเสนอข้อมูล'] },
  'cbtu-18': { workExamples: [], outcomes: [], signals: [] },
  'cbtu-19': { workExamples: ['ฝึกสั่งงาน AI กับเอกสาร ภาพ และตาราง'], outcomes: ['เรียน Prompt Engineering และ ChatGPT', 'รู้ข้อจำกัดและแนวทางใช้งานอย่างปลอดภัย'], signals: ['prompt', 'พรอมต์', 'เอกสาร', 'สั่งงาน', 'chatgpt'] },
  'cbtu-20': { workExamples: ['เลือกฝึกหลายด้านจากชุดรวม Canva/Excel/n8n/Prompt'], outcomes: ['เข้าถึงเนื้อหาหลายวิชาที่รวมอยู่ใน bundle'], signals: ['bundle', 'ชุดรวม', 'หลายด้าน'] },
};

// Select the substantive topics, not simply the first five syllabus headings.
const topicIndices: Record<string, number[]> = {
  'cbtu-01': [1, 2, 3, 4, 6], 'cbtu-02': [0, 1, 2, 3], 'cbtu-03': [0, 1, 2, 3, 5],
  'cbtu-04': [0, 3, 4, 8, 9], 'cbtu-05': [1, 2, 3, 4, 5], 'cbtu-06': [2, 3, 4, 6, 7],
  'cbtu-07': [0, 3, 4, 5, 7], 'cbtu-08': [0, 1, 5, 6], 'cbtu-09': [0, 2, 3, 5, 6],
  'cbtu-10': [0, 1, 2, 3, 5], 'cbtu-11': [0, 1, 3, 4, 5], 'cbtu-12': [0, 1, 2, 5],
  'cbtu-13': [0, 1, 3, 4], 'cbtu-14': [1, 2, 3, 4, 7], 'cbtu-15': [0, 1, 3, 5, 6],
  'cbtu-16': [0, 1, 2, 3, 4], 'cbtu-17': [0, 1, 2, 3, 5], 'cbtu-18': [],
  'cbtu-19': [0, 1, 2, 3, 4], 'cbtu-20': [0, 1, 2, 3],
};

export function courseBrief(c: Course) {
  const brief = editorial[c.id];
  if (!brief) throw new Error('Missing reviewed course brief');
  return { id: c.id, name: c.name, ...brief,
    audience: c.audience_th, prerequisites: c.prerequisites_th,
    topics: topicIndices[c.id].map(i => c.topics?.[i]).filter((t): t is string => !!t), format: c.format_th, duration: c.duration_text,
    price: c.price, sessions: c.session_dates_text,
    evidence: { source: c.canonical_url, capturedAt: c.provenance.retrieved_at,
      workExamplesBasis: 'inference_from_documented_topics_not_guaranteed_outcomes',
      sourceFields: ['description_th', 'topics', 'learning_outcomes_th', 'audience_th', 'prerequisites_th', 'format_th', 'duration_text'],
      flags: c.flags, missingFields: c.missing_fields },
  };
}
export const courseBriefs = courseCatalog.courses.map(courseBrief);
const short = (s: string | null, n = 100) => s ? s.slice(0, n) + (s.length > n ? '…' : '') : 'เว็บยังไม่ระบุ';
export function briefCard(c: Course, mode: 'list' | 'details' | 'compare' = 'details') {
  const b = courseBrief(c);
  if (c.detail_access !== 'public') return `${c.name}\nรายละเอียดถูกล็อก จึงยังมีข้อมูลไม่พอแนะนำวิชานี้\n${c.canonical_url}`;
  return [c.name,
    `ใช้กับงาน: ${b.workExamples[0]}`,
    ...(mode === 'list' ? [] : [`ฝึกทำ: ${b.outcomes.slice(0, 2).join('; ')}`,
      `พื้นฐาน: ${short(b.prerequisites)}`]),
    `การเรียน: ${short(b.format, 75)}${b.duration ? ` · ${short(b.duration, 60)}` : ''}`,
    c.canonical_url,
  ].join('\n');
}
export function briefSourceNote(courses: Course[], commercial = false) {
  const notes = [`ข้อมูลเว็บที่เก็บ ${courseCatalog.collectionDate}`];
  if (commercial) notes.push('ตรวจราคาหรือรอบปัจจุบันกับเจ้าหน้าที่ https://cbtumu.net/faq/');
  else if (courses.some(c => c.flags.some(f => /past_session|dated|completed/.test(f)))) notes.push('บางรายการเป็นรุ่นเก่า ต้องตรวจรอบใหม่');
  return notes.join(' · ');
}

export type BriefField = 'topics' | 'audience' | 'prerequisites' | 'format' | 'sessions';
export function renderBriefField(c: Course, field: BriefField) {
  const b = courseBrief(c);
  const text = field === 'topics' ? b.topics.length ? b.topics.map(t => `• ${t}`).join('\n') : 'ยังไม่มีข้อมูลหัวข้อที่อ่านได้'
    : field === 'audience' ? b.audience ?? 'เว็บยังไม่ระบุกลุ่มผู้เรียนโดยตรง'
    : field === 'prerequisites' ? b.prerequisites ?? 'เว็บยังไม่ระบุพื้นฐานที่ต้องมี จึงยังยืนยันว่าเริ่มจากศูนย์ได้หรือไม่ได้'
    : field === 'format' ? `${b.format ?? 'ไม่พบรูปแบบเรียน'}${b.duration ? ` · ${b.duration}` : ' · เว็บยังไม่ระบุระยะเวลา'}`
    : b.sessions ?? 'ยังไม่พบรอบเรียนที่ระบุในข้อมูลที่เก็บไว้';
  return `${c.name}\n${text}\n${c.canonical_url}`;
}
