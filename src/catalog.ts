import { courseCatalog, type Course } from './course-catalog.js';

export type CatalogSelection = {
  kind: 'found' | 'ambiguous' | 'not_found' | 'interest';
  courses: Course[]; field: 'details' | 'price' | 'compare' | 'certificate'; recommendation: boolean;
  topic: string;
};
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const contains = (text: string, term: string) => /[ก-๙]/.test(term) ? text.includes(term) : (` ${text} `).includes(` ${term} `);
// Descriptive search aliases, not assertions of official abbreviations or new course facts.
const aliases: Record<string, string[]> = {
  'cbtu-01': ['data analysis with ai', 'วิเคราะห์ข้อมูลด้วย ai'],
  'cbtu-02': ['ai for research', 'ai เพื่อการวิจัย', 'prism'],
  'cbtu-03': ['ai for work', 'ai เพื่อการทำงาน'],
  'cbtu-04': ['mini ai agent', 'mini ai agent engineering'],
  'cbtu-05': ['mini data science', 'mds10', 'mini data science 10'],
  'cbtu-06': ['excel', 'เอ็กเซล', 'เอกเซล', 'microsoft excel'],
  'cbtu-07': ['canva', 'แคนวา'],
  'cbtu-08': ['health product marketing', 'การตลาดผลิตภัณฑ์สุขภาพ'],
  'cbtu-09': ['n8n', 'ai agent with n8n'],
  'cbtu-10': ['n8n', 'n8n workshop', 'เวิร์กช็อป n8n'],
  'cbtu-11': ['basic prompt engineering', 'prompt engineering 2026', 'prompt 2026'],
  'cbtu-12': ['ai agent for all'], 'cbtu-13': ['ai agents in action'], 'cbtu-14': ['ai for all'],
  'cbtu-15': ['data analytics'], 'cbtu-16': ['data science essentials', 'dse'],
  'cbtu-17': ['data analyst level 4'],
  'cbtu-18': ['basic prompt engineering', 'prompt engineering update', 'prompt update'],
  'cbtu-19': ['basic prompt engineering'],
  'cbtu-20': ['popular course bundle', 'bundle', 'ชุดรวมหลักสูตร'],
};
const stop = new Set(['หลักสูตร', 'คอร์ส', 'course', 'courses', 'เรียน', 'อยาก', 'สนใจ', 'แนะนำ', 'อะไร', 'มี', 'บ้าง', 'ไหม', 'ครับ', 'ค่ะ', 'ราคา', 'เท่าไร', 'เท่าไหร่', 'เปรียบเทียบ', 'compare', 'and', 'with', 'for', 'the', 'please',
  'ขอ', 'ดู', 'ด้วย', 'ตัว', 'อัน', 'รายการ', 'ทุก', 'แต่ละ', 'ทั้งหมด', 'จำนวน', 'กี่', 'มากกว่า', 'แพง', 'ถูก', 'ที่สุด', 'ได้', 'ตรวจสอบ', 'ทำไม', 'ไม่', 'ละ', 'หน่อย', 'สรุป', 'เขียน', 'กระชับ', 'บอก', 'รู้', 'ช่วย', 'เพิ่มเติม', 'list', 'count', 'price', 'prices', 'sort', 'all', 'more', 'most', 'expensive', 'cheapest', 'highest', 'lowest']);
function terms(query: string) {
  const words = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(normalize(query))]
    .filter(s => s.isWordLike).map(s => s.segment).filter(s => s.length > 1 && !stop.has(s));
  if (/วิเคราะห์ข้อมูล|ข้อมูล/.test(query)) words.push('data');
  if (/ปัญญาประดิษฐ์/.test(query)) words.push('ai');
  if (/งานวิจัย/.test(query)) words.push('research');
  if (/ออกแบบ|สร้างสื่อ/.test(query)) words.push('canva');
  return [...new Set(words)];
}

export function retrieveCourses(query: string) {
  const q = normalize(query);
  const full = courseCatalog.courses.filter(c => contains(q, normalize(c.name)));
  const hits = courseCatalog.courses.flatMap(c => [c.name, ...(aliases[c.id] ?? [])].map(alias => ({ id: c.id, alias: normalize(alias) })))
    .filter(h => contains(q, h.alias));
  const specific = hits.filter(h => !hits.some(other => other.alias.length > h.alias.length && contains(other.alias, h.alias)));
  let ids = [...new Set(specific.map(h => h.id))];
  // The unqualified Prompt Engineering name covers three distinct records.
  if (contains(q, 'basic prompt engineering') && !/2026|update|อัปเดต/.test(q)) ids = ['cbtu-11', 'cbtu-18', 'cbtu-19'];
  const cohort = q.match(/รุ่น(?:ที่)?\s*(\d+)/)?.[1] ?? q.match(/(?:mds|mini data science)\s*(\d+)/)?.[1];
  if (cohort) ids = ids.filter(id => new RegExp(`รุ่น(?:ที่)?\\s*${cohort}(?:\\D|$)`).test(courseCatalog.courses.find(c => c.id === id)!.name));
  const queryTerms = terms(query);
  const ranked = courseCatalog.courses.map(c => {
    const name = normalize(c.name), topics = normalize((c.topics ?? []).join(' '));
    const body = normalize([c.description_th, c.audience_th, ...(c.learning_outcomes_th ?? [])].join(' '));
    const score = queryTerms.reduce((sum, t) => sum + (contains(name, t) ? 6 : 0) + (contains(topics, t) ? 3 : 0) + (contains(body, t) ? 1 : 0), 0);
    return { course: c, score };
  }).filter(x => x.score >= 3 && (x.course.detail_access === 'public' || queryTerms.some(t => contains(normalize(x.course.name), t))) && (!cohort || ids.includes(x.course.id)))
    .sort((a, b) => b.score - a.score || a.course.id.localeCompare(b.course.id));
  return { named: courseCatalog.courses.filter(c => ids.includes(c.id)), mentioned: specific.length > 0, ranked, full: full.length > 0, terms: queryTerms };
}

export function selectCatalog(query: string, lastTopic?: string, interests?: string): CatalogSelection | undefined {
  const q = normalize(query);
  const previous = lastTopic?.startsWith('catalog:') ? lastTopic.slice(8).split(',') : [];
  const interestFlow = previous.includes('interest');
  if (/โอนเงิน|เลขบัญชี|สลิป|จ่ายแล้ว|ชำระแล้ว|ไม่พบคอร์ส|เข้าสู่ระบบ|เข้าเรียนไม่ได้|สมัครสมาชิก|ใบเสร็จ|ติดต่อเจ้าหน้าที่/.test(query) || /ไม่(?:อยาก|ต้องการ).{0,10}(?:คุย|ถาม|แนะนำ).{0,10}(?:คอร์ส|หลักสูตร)/.test(query)) return;
  if (/^(?:ฉัน|ผม|เรา)(?:ชื่อ|มีชื่อ|ชื่อเล่น|สนใจ|อยากเรียนเพื่อ)/.test(query.trim()) && !interestFlow) return;
  const personalized = /เหมาะกับ(?:ฉัน|ผม|เรา)|ตามความสนใจ|สำหรับ(?:ฉัน|ผม|เรา)/.test(query);
  const result = retrieveCourses(query + (personalized && interests ? ` ${interests}` : ''));
  const courseWords = /หลักสูตร|คอร์ส|\bcourses?\b|เรียนอะไร|เรียนอะไรดี|อยากเรียน|ต้องการเรียน|ไม่รู้.{0,6}เรียน/.test(q);
  const contextual = previous.length > 0 && /^(?:แล้ว\s*)?(?:อัน|ตัว|ข้อ|สองอัน|สองตัว|ทั้งสอง|ราคา|เท่า|เปรียบเทียบ|compare|พื้นฐาน|ระยะเวลา|รูปแบบ|รายละเอียด|เรียนยังไง|ขอ(?:ดู|รายละเอียด|ราคา|เทียบ))/i.test(query.trim());
  const namedRequest = result.mentioned && (result.full || result.named.some(c => (aliases[c.id] ?? []).some(a => normalize(a) === q))
    || /รุ่น|mini data science\s*\d|mds\s*\d|ราคา|เรียน|แนะนำ|สนใจ|รายละเอียด|เปรียบ|compare|\bvs\b|ต่างกัน|พื้นฐาน|นาน|ชั่วโมง|certificate|ใบประกาศ|price|cost|detail|\?$/.test(query));
  const interestReply = interestFlow && (result.ranked.length > 0 || /^(?:ฉัน|ผม|เรา)?(?:สนใจ|อยากเรียน)/.test(query.trim()));
  // A bare topic is a search; merely mentioning AI/Data inside chat is not.
  const topicOnly = q.length < 35 && result.terms.length <= 2 && result.ranked.length > 0
    && courseCatalog.courses.some(c => contains(normalize(c.name), q) || (c.topics ?? []).some(t => contains(normalize(t), q)));
  if (!courseWords && !namedRequest && !contextual && !interestReply && !topicOnly) return;
  const recommendation = /แนะนำ|เลือก|เหมาะ|สนใจ|recommend|ไม่รู้.{0,8}เรียน|เรียนอะไร/i.test(query) || interestFlow;
  const field: CatalogSelection['field'] = /เปรียบเทียบ|compare|\bvs\b|ต่างกัน/i.test(query) ? 'compare'
    : /ราคา|เท่าไหร่|เท่าไร|price|cost/i.test(query) ? 'price'
    : /certificate|ใบประกาศ|เกียรติบัตร/i.test(query) ? 'certificate' : 'details';
  const base = { field, recommendation };
  if (/ไม่รู้.{0,8}เรียน|เรียนอะไรดี|ยังไม่แน่ใจ|ไม่รู้จะเลือก/i.test(query) && result.named.length === 0) {
    return { ...base, kind: 'interest', courses: [], topic: 'catalog:interest' };
  }
  let candidates = result.named;
  const ordinals = [...query.matchAll(/(?:อัน|ตัว|ข้อ)(?:ที่)?\s*(แรก|หนึ่ง|สอง|สาม|1|2|3)/g)].map(m => m[1]);
  if (!candidates.length && ordinals.length && previous.length) {
    const ids = ordinals.map(ordinal => previous[['แรก', 'หนึ่ง', '1'].includes(ordinal) ? 0 : ['สอง', '2'].includes(ordinal) ? 1 : 2]);
    candidates = [...new Set(ids)].map(id => courseCatalog.courses.find(c => c.id === id)).filter((c): c is Course => !!c);
  }
  if (!candidates.length && contextual && !interestFlow && !result.terms.some(t => courseCatalog.courses.some(c => contains(normalize(c.name), t)))) {
    candidates = previous.map(id => courseCatalog.courses.find(c => c.id === id)).filter((c): c is Course => !!c);
  }
  if (!candidates.length && (courseWords || interestFlow || topicOnly) && result.ranked.length) candidates = result.ranked.slice(0, 3).map(x => x.course);
  if (!candidates.length) {
    const generic = /^(?:มี)?(?:หลักสูตร|คอร์ส|courses?)(?:อะไร|อะไรบ้าง|บ้าง)?$/.test(q.replace(/ครับ|ค่ะ/g, '').trim());
    return { ...base, kind: generic ? 'interest' : 'not_found', courses: [], topic: generic ? 'catalog:interest' : 'catalog:unknown' };
  }
  // Multiple name matches need clarification unless explicitly comparing/listing alternatives.
  const ambiguous = field === 'compare' ? candidates.length !== 2 : candidates.length > 1 && !recommendation;
  candidates = candidates.slice(0, 3);
  return { ...base, kind: ambiguous ? 'ambiguous' : 'found', courses: candidates, topic: 'catalog:' + candidates.map(c => c.id).join(',') };
}

const clip = (s: string | null, length = 180) => s ? (s.length > length ? s.slice(0, length) + '…' : s) : 'ไม่พบข้อมูลใน snapshot';
function price(c: Course) {
  if (c.price.displayed_amount === null) return 'ไม่พบราคาใน snapshot ไม่ถือว่าฟรี กรุณาตรวจหน้าหลักสูตร/เจ้าหน้าที่';
  if (c.price.label === 'Free') return 'หน้าเว็บแสดง Free ใน snapshot ต้องยืนยันสิทธิ์และเงื่อนไขปัจจุบัน';
  return `ราคาแสดงใน snapshot ${c.price.displayed_amount.toLocaleString('en-US')} ${c.price.currency ?? '(ไม่ระบุสกุลเงิน)'}${c.price.reference_amount === null ? '' : `; ราคาอ้างอิงที่หน้าเว็บแสดง ${c.price.reference_amount.toLocaleString('en-US')}`}`;
}
function caveats(c: Course) {
  const notes: string[] = [];
  if (c.detail_access !== 'public') notes.push('รายละเอียดถูกล็อกรหัสผ่าน อ่านได้เฉพาะรายการสาธารณะ ไม่อนุมานเนื้อหาที่ล็อก');
  if (c.flags.some(f => /dated_sessions|past_session|completed_cohort/.test(f))) notes.push('มีวันเรียนเก่าหรือข่าวรุ่นจบแล้ว ไม่ใช่รอบใหม่');
  if (c.flags.some(f => /conflict|separate_cohort|unverified|differs|requires_verification|NSN|not_read/.test(f))) notes.push('มีข้อจำกัด/ข้อมูลที่ต้องยืนยันเพิ่มเติม ไม่รวมข้อมูลคนละรุ่นหรือแก้ความขัดแย้งเอง');
  return notes.join('; ');
}
export function renderCatalog(selection: CatalogSelection, ids?: string[]) {
  if (selection.kind === 'interest') return 'ยินดีช่วยเลือกครับ สนใจพัฒนาทักษะด้านไหน เช่น วิเคราะห์ข้อมูลด้วย Excel, งาน Data, AI, งานวิจัย หรือสร้างสื่อ และอยากนำไปใช้ทำอะไรครับ? จะเลือกจากหลักสูตรที่มีใน snapshot แล้วค่อยเทียบพื้นฐานกับรูปแบบเรียน';
  if (selection.kind === 'not_found') return 'ยังไม่พบหลักสูตรที่ตรงในชุดข้อมูล CBTU ที่เก็บไว้ครับ ไม่ได้หมายความว่าไม่มีหลักสูตรนั้นจริง ลองระบุชื่อเต็มหรือหัวข้อเพิ่มเติม หรือตรวจ https://cbtumu.net/ และติดต่อผ่าน https://cbtumu.net/faq/';
  if (selection.kind === 'ambiguous') return `${selection.field === 'compare' ? 'กรุณาระบุสองหลักสูตรที่ต้องการเทียบครับ ตอนนี้ยังเลือกคู่ไม่ชัดเจน' : 'ชื่อ/หัวข้อนี้ตรงหลายรายการครับ ต้องการตัวไหน? ระบุชื่อเต็มหรือ “อันแรก/อันที่สอง/อันที่สาม”'}\n${selection.courses.map((c, i) => `${i + 1}. ${c.name}\n${c.canonical_url}\nเก็บ ${c.provenance.retrieved_at}${c.detail_access !== 'public' ? ' (หน้ารายละเอียดล็อก)' : ''}`).join('\n')}\nเป็นข้อมูลสำเนา ไม่ยืนยันราคา/รอบที่เปิดตอนนี้`;
  const selected = ids ? ids.map(id => selection.courses.find(c => c.id === id)!) : selection.courses;
  const cards = selected.map(c => [
    c.name,
    ...(selection.field === 'price' ? [price(c)] : selection.field === 'certificate' ? [
      `ใบประกาศที่หน้าเดิมระบุ: ${clip(c.certificate.observed_text)}`,
      `เกณฑ์ผ่านเฉพาะวิชา: ${clip(c.certificate.course_specific_pass_criteria)}`,
    ] : [
      `เนื้อหา: ${clip(c.description_th, 180)}`,
      `หัวข้อ: ${clip((c.topics ?? []).join(', ') || null, 180)}`,
      `เหมาะกับ: ${clip(c.audience_th, 120)}`,
      `พื้นฐาน: ${clip(c.prerequisites_th, 160)}`,
      `รูปแบบ: ${clip(c.format_th, 140)} | ระยะเวลา: ${clip(c.duration_text, 90)}`,
      price(c),
      ...(selection.field === 'details' ? [`วันเรียนที่หน้าเดิมระบุ: ${clip(c.session_dates_text, 130)}`] : []),
    ]),
    `ข้อความสถานะบนหน้าเดิม: ${clip(c.enrollment.observed_text, 80)}`,
    ...(caveats(c) ? [`ข้อควรตรวจ: ${caveats(c)}`] : []),
    `แหล่ง: ${c.canonical_url}\nเก็บ: ${c.provenance.retrieved_at}`,
  ].join('\n'));
  return `${selection.recommendation ? 'จากหัวข้อที่สนใจ ลองพิจารณารายการเหล่านี้ครับ (ยังไม่ยืนยันความเหมาะสมแทนคุณ):\n' : selection.field === 'compare' ? 'เปรียบเทียบเฉพาะข้อมูลที่มีใน snapshot:\n' : ''}${cards.join('\n\n')}\n\nข้อมูลสำเนา ไม่ใช่ราคา/การเปิดรับสมัครสด Add to Cart/Enroll Now ไม่ยืนยันว่ามีรอบใหม่ ตรวจหน้าหลักสูตรและเจ้าหน้าที่ผ่าน https://cbtumu.net/faq/ ก่อนตัดสินใจ`;
}

// Only the ranked candidates enter the model request; facts are always rendered by the host.
export function catalogContext(selection: CatalogSelection) {
  return selection.courses.map(c => ({ id: c.id, name: c.name, description: c.description_th, topics: c.topics,
    audience: c.audience_th, prerequisites: c.prerequisites_th, format: c.format_th, duration: c.duration_text,
    price: c.price, flags: c.flags, missingFields: c.missing_fields, source: c.canonical_url, capturedAt: c.provenance.retrieved_at }));
}
export function renderCatalogPlan(plan: any, selection: CatalogSelection) {
  const ids = plan?.courseIds;
  if (plan?.intent !== 'catalog' || !Array.isArray(ids) || ids.length === 0 || ids.length > selection.courses.length
    || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !selection.courses.some(c => c.id === id))
    || (selection.field === 'compare' && ids.length !== selection.courses.length)) throw new Error('Invalid catalog selection');
  return renderCatalog(selection, ids);
}

export function catalogTopicForAnswer(answer: string, selection: CatalogSelection) {
  const lines = answer.split('\n');
  const displayed = selection.courses.filter(c => lines.includes(c.name)).sort((a, b) => lines.indexOf(a.name) - lines.indexOf(b.name));
  return displayed.length ? 'catalog:' + displayed.map(c => c.id).join(',') : selection.topic;
}
