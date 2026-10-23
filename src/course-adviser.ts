import { courseCatalog } from './course-catalog.js';
import { courseBrief, briefCard, briefSourceNote } from './course-briefs.js';
import { retrieveCourses } from './catalog.js';
import type { CatalogState, CatalogRoute } from './catalog-query.js';

export type AdviceState = { stage: 'goal' | 'background' | 'time' | 'ready'; goal?: string; background?: string; time?: string };
export function validAdvice(value: unknown): value is AdviceState {
  const a = value as AdviceState;
  return !!a && ['goal', 'background', 'time', 'ready'].includes(a.stage)
    && [a.goal, a.background, a.time].every(s => s === undefined || typeof s === 'string' && s.length <= 200);
}
const usefulGoal = (q: string) => /ยอดขาย|รายงาน|แดชบอร์ด|dashboard|อัตโนมัติ|workflow|บทความ|วิจัย|research|สื่อ|โปสเตอร์|สไลด์|เอกสาร|โมเดล|วิเคราะห์ข้อมูล|ออกแบบ|แชตบอต|แชทบอท|คอนเทนต์|marketing|การตลาด/.test(q.toLowerCase())
  || !recommendation(q) && q.trim().length >= 5 && !/^(?:สนใจ\s*)?(?:ai|data|excel|canva|python|n8n|เทคโนโลยี|พัฒนาตัวเอง|พัฒนาตนเอง)[ ครับค่ะ]*$/i.test(q.trim());
const recommendation = (q: string) => /แนะนำ|เลือก.{0,12}(?:เรียน|วิชา|คอร์ส|หลักสูตร)|เหมาะกับ|เรียนอะไร|อยากเรียน/.test(q);
const matches = (q: string, term: string) => /[ก-๙]/.test(term) ? q.includes(term) : (` ${q.replace(/[^a-z0-9]+/g, ' ')} `).includes(` ${term} `);

export function rankForGoal(advice: AdviceState) {
  const goal = (advice.goal ?? '').toLowerCase();
  const named = retrieveCourses(goal).named.map(c => c.id);
  return courseCatalog.courses.filter(c => c.detail_access === 'public' && (c.record_type === 'course' || /bundle|ชุดรวม/.test(goal)))
    .map(course => {
      const b = courseBrief(course);
      const signals = b.signals.filter(s => matches(goal, s));
      let score = signals.reduce((sum, s) => sum + (/excel|canva|python|sql|prism|n8n|looker/.test(s) ? 8 : 3), 0) + (named.includes(course.id) ? 10 : 0);
      const goalScore = score;
      if (!score) return { course, score: 0, goalScore: 0 };
      if (/มือใหม่|ไม่เคย|ไม่มีพื้นฐาน|ไม่.*เขียนโปรแกรม/.test(advice.background ?? '') && /ไม่ต้อง.{0,15}(?:พื้นฐาน|เขียนโปรแกรม)/.test(b.prerequisites ?? '')) score += 2;
      if (/ตามสะดวก|วิดีโอ|วันละ|นาที|เวลาน้อย/.test(advice.time ?? '') && /วิดีโอ|ด้วยตนเอง|self/i.test(b.format ?? '')) score += 2;
      return { course, score, goalScore };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.course.id.localeCompare(b.course.id));
}

export function adviseCourses(query: string, previous?: CatalogState, semanticAnswer = false): CatalogRoute | undefined {
  const old = previous?.advice;
  const start = recommendation(query);
  // Explicit lookups and controls may interrupt advice without being stored as answers.
  if (/ราคา|กี่|จำนวน|เปรียบเทียบ|\bcompare\b|ดูต่อ|รายการ|ทั้งหมด|ใบประกาศ|เหมาะกับใคร|ใครควรเรียน|เนื้อหา|หัวข้อ|สอนอะไร|รายละเอียด|\/|ฉันชื่อ|ผมชื่อ/.test(query)) return;
  const pending = old && old.stage !== 'ready';
  const answerLike = pending && !/[?？]|ไหม|เหรอ|ทำไม|สวัสดี|เหนื่อย|พักก่อน|คุยเล่น/.test(query)
    && (semanticAnswer || old.stage === 'goal' && usefulGoal(query) && (/(?:อยาก|ต้องการ|ทำ|งาน|ใช้|สร้าง|สรุป|วิเคราะห์|เขียน|พัฒนา|จัดการ|ออกแบบ|ผลิต|แก้|เพิ่ม|ลด)/.test(query) || rankForGoal({ stage: 'goal', goal: query }).length > 0)
      || old.stage === 'background' && /พื้นฐาน|เคย|เป็น|เริ่ม|ใหม่|ใช้|เขียน|ได้|beginner|experience/i.test(query)
      || old.stage === 'time' && /เวลา|นาที|ชั่วโมง|วัน|สัปดาห์|เดือน|สะดวก|วิดีโอ|ออนไลน์|hour|week/i.test(query));
  if (!start && !answerLike && !semanticAnswer) return;
  const advice: AdviceState = old ? { ...old } : { stage: 'goal' };
  if (start && old?.stage === 'ready' && !usefulGoal(query)) advice.goal = undefined;
  if (start && usefulGoal(query)) advice.goal = query.slice(0, 200);
  else if (answerLike || semanticAnswer) {
    if (advice.stage === 'goal') advice.goal = query.slice(0, 200);
    if (advice.stage === 'background') advice.background = query.slice(0, 200);
    if (advice.stage === 'time') advice.time = query.slice(0, 200);
  }
  // Explicit facts supplied together can skip questions, but nothing is guessed.
  advice.background ??= query.match(/(?:มือใหม่|ไม่มีพื้นฐาน|ไม่เคยใช้|เคยใช้|เขียนโปรแกรมเป็น|ไม่เขียนโปรแกรม)[^,.\n]{0,70}/)?.[0];
  advice.time ??= query.match(/(?:วันละ|สัปดาห์ละ|มีเวลา|สะดวก|เรียนได้)[^,.\n]{0,70}/)?.[0];
  advice.stage = !advice.goal || !usefulGoal(advice.goal) ? 'goal' : !advice.background ? 'background' : !advice.time ? 'time' : 'ready';
  const state: CatalogState = { ...(previous ?? { matchedIds: [], shownIds: [], offset: 0, limit: 3, query: '', field: 'list' }), advice };
  if (advice.goal && !rankForGoal(advice).length) return { answer: 'ยังไม่มีข้อมูลหลักสูตรในชุดนี้ที่เชื่อมกับงานดังกล่าวได้ชัดเจนครับ อยากระบุชิ้นงานที่ต้องทำ หรือทักษะอื่นที่อยากพัฒนาเพิ่มไหม?',
    state: { ...state, advice: { ...advice, goal: undefined, stage: 'goal' } }, topic: 'catalog:interest' };
  if (advice.stage !== 'ready') {
    const answer = advice.stage === 'goal' ? 'อยากนำสิ่งที่เรียนไปช่วยงานอะไร หรือทำอะไรให้ได้เป็นหลักครับ? เช่น สรุปยอดขาย ทำสื่อ หรือทำงานซ้ำให้อัตโนมัติ'
      : advice.stage === 'background' ? 'ตอนนี้มีพื้นฐานหรือเคยใช้เครื่องมือที่เกี่ยวข้องกับงานนี้แค่ไหนครับ?'
      : 'มีเวลาเรียนประมาณเท่าไร และสะดวกเรียนแบบไหนครับ เช่น วิดีโอตามเวลาว่าง หรือเรียนสดตามตาราง';
    return { answer, state, topic: 'catalog:interest' };
  }
  const scores = rankForGoal(advice);
  const bestGoalScore = Math.max(0, ...scores.map(x => x.goalScore));
  const ranked = scores.filter(x => x.goalScore >= bestGoalScore * 0.6).slice(0, 3).map(x => x.course);
  if (!ranked.length) return { answer: 'ยังไม่มีหลักสูตรในชุดนี้ที่เชื่อมกับเป้าหมายดังกล่าวได้ชัดพอครับ ลองบอกงานหรือชิ้นงานที่อยากทำให้เจาะจงขึ้นได้ไหม?', state: { ...state, advice: { ...advice, stage: 'goal', goal: undefined } }, topic: 'catalog:interest' };
  const selected = ranked.map(c => c.id);
  return { answer: `จากงานที่อยากทำและพื้นฐานที่บอก ${ranked.length === 1 ? 'ตัวเลือกที่ตรงชัดที่สุดคือ' : `ลองพิจารณา ${ranked.length} ตัวเลือกนี้ครับ`}:\n\n${ranked.map(c => briefCard(c)).join('\n\n')}\n\n${briefSourceNote(ranked)}\nอยากดูหัวข้อเรียนหรือค่าใช้จ่ายต่อไหมครับ?`,
    state: { ...state, matchedIds: selected, shownIds: selected, offset: 0, limit: selected.length, query: advice.goal!, field: 'details' }, topic: 'catalog:' + selected.join(',') };
}
