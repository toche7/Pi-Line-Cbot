import { courseCatalog, type Course } from './course-catalog.js';
import { retrieveCourses, renderCatalog, selectCatalog, type CatalogSelection } from './catalog.js';
import { adviseCourses, validAdvice, type AdviceState } from './course-adviser.js';
import { briefCard, briefSourceNote, renderBriefField, type BriefField } from './course-briefs.js';
import { readCourseFields, validCourseFields, validCourseFilters, filterCourses, type CourseField, type CourseFilter } from './course-reader.js';

export type CatalogState = { matchedIds: string[]; shownIds: string[]; offset: number; limit: number; query: string; field: 'list' | 'price' | 'summary' | 'details'; advice?: AdviceState; readFields?: CourseField[] };
export type CatalogQuery = { operation: 'list' | 'count' | 'price' | 'sort_price' | 'more' | 'summary' | 'advise' | 'read'; scope: 'all' | 'previous' | 'search'; query?: string; limit?: number; order?: 'asc' | 'desc'; fields?: CourseField[]; filters?: CourseFilter[] };
export type CatalogRoute = { answer?: string; selection?: CatalogSelection; state?: CatalogState; topic?: string };
const rows = courseCatalog.courses;
const byIds = (ids: string[]) => ids.map(id => rows.find(c => c.id === id)).filter((c): c is Course => !!c);
const ids = (cs: Course[]) => cs.map(c => c.id);
const footer = 'ข้อมูลสำเนา ไม่ใช่ราคา/การเปิดรับสมัครสด ปุ่ม Add to Cart/Enroll Now ไม่ยืนยันรอบใหม่ ตรวจหน้าหลักสูตรและเจ้าหน้าที่ https://cbtumu.net/faq/ ก่อนตัดสินใจ';
const limited = (s: string | null, n = 90) => s ? s.slice(0, n) + (s.length > n ? '…' : '') : 'ไม่พบข้อมูลใน snapshot';

export function validCatalogState(value: unknown): value is CatalogState {
  const s = value as CatalogState;
  const validIds = (v: unknown) => Array.isArray(v) && v.length <= 20 && new Set(v).size === v.length && v.every(x => typeof x === 'string' && /^cbtu-\d{2}$/.test(x));
  return !!s && validIds(s.matchedIds) && validIds(s.shownIds) && s.shownIds.every(id => s.matchedIds.includes(id))
    && Number.isInteger(s.offset) && s.offset >= 0 && s.offset <= 20 && Number.isInteger(s.limit) && s.limit >= 1 && s.limit <= 10
    && typeof s.query === 'string' && s.query.length <= 200 && ['list', 'price', 'summary', 'details'].includes(s.field)
    && (s.advice === undefined || validAdvice(s.advice)) && (s.readFields === undefined || validCourseFields(s.readFields));
}
export function parseCatalogQuery(value: any): CatalogQuery {
  if (!value || !['list', 'count', 'price', 'sort_price', 'more', 'summary', 'advise', 'read'].includes(value.operation)
    || !['all', 'previous', 'search'].includes(value.scope) || (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 200))
    || (value.scope === 'search' && !value.query?.trim())
    || (value.operation === 'advise' && !value.query?.trim())
    || (value.operation === 'read' && !validCourseFields(value.fields))
    || (value.fields !== undefined && !validCourseFields(value.fields))
    || (value.filters !== undefined && !validCourseFilters(value.filters))
    || (value.limit !== undefined && (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 10))
    || (value.order !== undefined && !['asc', 'desc'].includes(value.order))) throw new Error('Invalid catalog operation');
  return { operation: value.operation, scope: value.scope, query: value.query, limit: value.limit, order: value.order, fields: value.fields, filters: value.filters };
}
function search(query: string) {
  const result = retrieveCourses(query);
  return result.named.length ? result.named : result.instructorMatches.length ? result.instructorMatches : result.ranked.map(x => x.course);
}
function snapshotPrice(c: Course) {
  if (c.price.displayed_amount === null) return 'ไม่พบราคา (ไม่ถือว่าฟรี)';
  return c.price.label === 'Free' ? 'หน้าเดิมแสดง Free (ต้องยืนยันเงื่อนไขปัจจุบัน)'
    : `${c.price.displayed_amount.toLocaleString('en-US')} ${c.price.currency ?? '(ไม่ระบุสกุลเงิน)'}`;
}
function card(c: Course, index: number, field: CatalogState['field']) {
  if (field !== 'price') return `${index}. ${briefCard(c, field === 'list' ? 'list' : 'details')}`;
  return [`${index}. ${c.name}`,
    ...(field === 'price' ? [`ราคาใน snapshot: ${snapshotPrice(c)}`] : []),
    ...(c.detail_access !== 'public' ? ['หน้ารายละเอียดล็อก อ่านได้เฉพาะชื่อ/metadata สาธารณะ'] : []),
    ...(c.flags.some(f => /dated|past_session|completed/.test(f)) ? ['มีวันเรียนเก่า/รุ่นจบแล้ว ไม่ใช่หลักฐานรอบใหม่'] : []),
    ...(c.flags.some(f => /conflict|unverified|separate_cohort|requires_verification|differs|NSN/.test(f)) ? ['มีข้อจำกัด/ข้อมูลต่างรุ่นที่ต้องยืนยันเพิ่มเติม'] : []),
    c.canonical_url].join('\n');
}

export function executeCatalogQuery(command: CatalogQuery, previous?: CatalogState): CatalogRoute {
  command = parseCatalogQuery(command);
  if (command.operation === 'advise') {
    const result = adviseCourses(command.query!, previous, true);
    if (!result) throw new Error('Invalid advice request');
    return result;
  }
  let matches = command.scope === 'all' ? rows : command.scope === 'search' ? search(command.query!) : previous ? byIds(previous.matchedIds) : [];
  if (command.filters) matches = filterCourses(matches, command.filters);
  if (command.operation === 'read') {
    const displayed = command.scope === 'previous' && previous?.shownIds.length ? byIds(previous.shownIds).filter(c => matches.includes(c)) : matches;
    const shown = displayed.slice(0, Math.min(command.limit ?? 3, 3));
    const state: CatalogState | undefined = shown.length ? { matchedIds: ids(matches), shownIds: ids(shown),
      offset: command.scope === 'previous' ? previous?.offset ?? 0 : 0, limit: shown.length,
      query: (command.query ?? previous?.query ?? '').slice(0, 200), field: 'details', advice: previous?.advice, readFields: command.fields } : previous;
    return { answer: readCourseFields(shown, command.fields!), state, topic: shown.length ? 'catalog:' + ids(shown).join(',') : undefined };
  }
  if (!matches.length) return { answer: command.scope === 'previous'
    ? 'ยังไม่มีรายการหลักสูตรอ้างอิงครับ อยากดูทั้งหมด หรือสนใจหัวข้อ/ชื่อหลักสูตรไหน?'
    : 'ไม่พบรายการที่ตรงใน snapshot นี้ครับ ไม่ได้หมายความว่าไม่มีหลักสูตรนั้นจริง ลองชื่อเต็มหรือหัวข้ออื่น และตรวจ https://cbtumu.net/ ได้', state: previous };
  if (command.operation === 'count') {
    const courses = matches.filter(c => c.record_type === 'course').length, bundles = matches.length - courses;
    return { answer: `ใน${command.scope === 'all' ? 'ข้อมูลเว็บที่เก็บไว้ทั้งหมด' : 'ชุดรายการที่กำลังดู'} มี ${courses} หลักสูตร${bundles ? ` + ${bundles} bundle` : ''} รวม ${matches.length} รายการครับ\nhttps://cbtumu.net/\n${briefSourceNote(matches)}`,
      state: command.scope === 'previous' && previous && !command.filters ? previous : { matchedIds: ids(matches), shownIds: [], offset: 0, limit: 3,
        query: command.filters ? command.filters.map(f => `${f.field}:${f.value}`).join('; ').slice(0, 200) : command.query ?? '', field: 'list', advice: previous?.advice } };
  }
  const missingPrices = matches.filter(c => c.price.displayed_amount === null).length;
  if (command.operation === 'sort_price') {
    matches = matches.filter(c => c.price.displayed_amount !== null).sort((a, b) => (a.price.displayed_amount! - b.price.displayed_amount!) * (command.order === 'asc' ? 1 : -1));
    if (!matches.length) return { answer: `ทุกรายการในกลุ่มนี้ไม่มีราคาใน snapshot จึงเรียงราคาไม่ได้ครับ\n${footer}`, state: previous };
  }
  const field: CatalogState['field'] = command.operation === 'price' || command.operation === 'sort_price' ? 'price'
    : command.operation === 'summary' ? 'summary' : command.operation === 'more' ? previous?.field ?? 'list' : 'list';
  const useShown = command.scope === 'previous' && !command.filters && ['price', 'summary'].includes(command.operation) && previous?.shownIds.length;
  const offset = command.operation === 'more' ? (previous?.offset ?? 0) + (previous?.shownIds.length ?? 0) : 0;
  const limit = command.limit ?? (useShown ? previous!.shownIds.length : previous?.limit ?? 3);
  const shown = useShown ? byIds(previous!.shownIds) : matches.slice(offset, offset + limit);
  if (!shown.length) return { answer: `แสดงครบ ${matches.length} รายการในกลุ่มนี้แล้วครับ ต้องการค้นหัวข้ออื่นหรือดูราคาก็บอกได้`, state: previous };
  const state: CatalogState = { matchedIds: ids(matches), shownIds: ids(shown), offset: useShown ? previous!.offset : offset,
    limit, query: (command.filters ? command.filters.map(f => `${f.field}:${f.value}`).join('; ') : command.scope === 'search' ? command.query! : previous?.query ?? '').slice(0, 200), field, advice: previous?.advice };
  if (command.operation === 'more' && previous?.readFields) {
    state.readFields = previous.readFields;
    return { answer: readCourseFields(shown.slice(0, 3), state.readFields), state: { ...state, shownIds: ids(shown.slice(0, 3)), limit: Math.min(limit, 3) }, topic: 'catalog:' + ids(shown.slice(0, 3)).join(',') };
  }
  const label = command.operation === 'sort_price' ? `เรียงราคา snapshot ${command.order === 'asc' ? 'ต่ำไปสูง' : 'สูงไปต่ำ'} เฉพาะ ${matches.length} รายการที่มีราคา${missingPrices ? `; อีก ${missingPrices} รายการไม่มีราคา จึงไม่รวมในการจัดอันดับ` : ''}`
    : field === 'price' ? 'แสดงราคาที่หน้าเว็บเคยระบุได้ครับ แต่ยังยืนยันราคาปัจจุบันไม่ได้' : field === 'summary' ? 'สรุปรายการก่อนหน้าแบบกระชับครับ' : `พบ ${matches.length} รายการ แสดง ${offset + 1}–${offset + shown.length}`;
  return { answer: `${label}\n${shown.map((c, i) => card(c, (useShown ? previous!.offset : offset) + i + 1, field)).join('\n\n')}\n${offset + shown.length < matches.length ? `\nยังมีรายการต่อ พิมพ์ “ดูต่อ” ได้\n` : '\n'}${briefSourceNote(shown, field === 'price')}`, state,
    topic: 'catalog:' + ids(shown).join(',') };
}

function inferOperation(query: string, state?: CatalogState): CatalogQuery | undefined {
  const q = query.normalize('NFKC').trim().toLowerCase();
  if (/โอนเงิน|เลขบัญชี|สลิป|จ่ายแล้ว|ชำระแล้ว|สมัครสมาชิก|ไม่พบคอร์ส|เข้าสู่ระบบ|ใบเสร็จ|ติดต่อเจ้าหน้าที่/.test(q)) return;
  const courseWords = /หลักสูตร|คอร์ส|\bcourses?\b/.test(q);
  const retrieval = retrieveCourses(q);
  // Operation/request verbs can overlap description text. A new filter needs a
  // name/title match or a technical topic token, not just any lexical body hit.
  const subject = retrieval.named.length > 0 || retrieval.instructorMatches.length > 0 || retrieval.terms.some(term => rows.some(c => {
    const title = c.name.normalize('NFKC').toLowerCase();
    return /[a-z0-9]/i.test(term)
      ? new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i').test([title, ...(c.topics ?? [])].join(' '))
      : title.includes(term);
  }));
  const scope = /ทั้งหมด|ทั้งสิ้น|\ball\b/.test(q) && !subject ? 'all' : subject ? 'search' : state ? 'previous' : 'all';
  const number = q.match(/(?:มากกว่า|ครั้งละ|ขอ|ดู|อีก|สัก|แสดง|จำนวน|limit|show)\s*(\d+)/)?.[1];
  const limit = number ? Math.max(1, Math.min(10, Number(number) + (/มากกว่า/.test(q) ? 1 : 0))) : undefined;
  const base = { scope, query: subject ? q.slice(0, 200) : undefined, limit } as Omit<CatalogQuery, 'operation'>;
  if (/แพง|ถูกที่สุด|ราคาสูง|ราคาต่ำ|expensive|cheapest|highest|lowest/.test(q) && (state || courseWords || subject)) return { ...base, operation: 'sort_price', order: /ถูก|ต่ำ|cheap|lowest/.test(q) ? 'asc' : 'desc', limit: /ที่สุด|most|highest|lowest|cheapest/.test(q) ? 1 : limit };
  if (/(?:กี่|จำนวน|count|how many)/.test(q) && (state || courseWords || subject)) return { ...base, operation: 'count', scope: courseWords && !subject ? 'all' : scope };
  if (/ราคา|\bprices?\b|\bcost\b/.test(q) && (state || courseWords || subject)) return { ...base, operation: 'price' };
  if (/สรุป|กระชับ|ย่อ|summari|concise|shorter/.test(q) && state) return { ...base, operation: 'summary', scope: 'previous' };
  if (/ดูต่อ|ถัดไป|เพิ่มเติม|next|more/.test(q) && state && !subject && !limit) return { ...base, operation: 'more', scope: 'previous' };
  if ((/\blist\b|รายการ|อะไรบ้าง|มีอะไร|ทั้งหมด/.test(q) && (courseWords || state || subject)) || (number && state)) return { ...base, operation: 'list' };
  return;
}

export function routeCatalog(query: string, previous?: CatalogState, lastTopic?: string, interests?: string): CatalogRoute | undefined {
  const advice = adviseCourses(query, previous);
  if (advice) return advice;
  const focus: BriefField | undefined = /หัวข้อ|เนื้อหา|สอนอะไร/.test(query) ? 'topics'
    : /เหมาะกับใคร|ใครควรเรียน|กลุ่มเป้าหมาย/.test(query) ? 'audience'
    : /พื้นฐาน|ต้องรู้|ต้องเตรียม/.test(query) ? 'prerequisites'
    : /ระยะเวลา|กี่ชั่วโมง|กี่วัน|รูปแบบ|เรียนแบบไหน/.test(query) ? 'format'
    : /รอบเรียน|วันเรียน|เปิดรับ|ตารางเรียน/.test(query) ? 'sessions' : undefined;
  if (focus) {
    const named = retrieveCourses(query).named;
    const cs = named.length ? named.slice(0, 3) : previous?.shownIds.length ? byIds(previous.shownIds).slice(0, 3) : [];
    if (cs.length) return { answer: `${cs.map(c => renderBriefField(c, focus)).join('\n\n')}\n\n${briefSourceNote(cs, focus === 'sessions')}`,
      state: { ...(previous ?? { matchedIds: ids(cs), offset: 0, limit: cs.length, query: query.slice(0, 200), field: 'details' }),
        ...(named.length ? { matchedIds: ids(cs), offset: 0, limit: cs.length, query: query.slice(0, 200) } : {}), shownIds: ids(cs) }, topic: 'catalog:' + ids(cs).join(',') };
  }
  const operation = inferOperation(query, previous);
  if (operation) return executeCatalogQuery(operation, previous);
  const selection = selectCatalog(query, lastTopic, interests);
  if (!selection) return;
  const found = retrieveCourses(query);
  // Topic browse is a list operation; ambiguity applies to names/versions, not all multi-match searches.
  if (selection.kind === 'ambiguous' && selection.field !== 'compare' && found.named.length === 0 && (found.ranked.length || found.instructorMatches.length)) {
    return executeCatalogQuery({ operation: 'list', scope: 'search', query: query.slice(0, 200) }, previous);
  }
  const candidates = selection.courses;
  const all = found.named.length ? found.named : found.ranked.map(x => x.course);
  const state: CatalogState | undefined = candidates.length ? {
    matchedIds: ids(all.length ? all : candidates), shownIds: ids(candidates), offset: 0, limit: candidates.length,
    query: query.slice(0, 200), field: 'details', advice: previous?.advice,
  } : previous;
  return { selection, state, topic: selection.topic, ...(selection.kind !== 'found' ? { answer: renderCatalog(selection) } : {}) };
}

// Recover only valid course references from this identity's own bounded rendered history.
export function recoverCatalogState(recent: { user: string; assistant: string }[]): CatalogState | undefined {
  for (const turn of [...recent].reverse()) {
    const shown = rows.filter(c => turn.assistant.includes(c.canonical_url)).sort((a, b) => turn.assistant.indexOf(a.canonical_url) - turn.assistant.indexOf(b.canonical_url));
    if (!shown.length) continue;
    const found = search(turn.user), all = [...new Map([...found, ...shown].map(c => [c.id, c])).values()];
    return { matchedIds: ids(all), shownIds: ids(shown), offset: 0, limit: shown.length, query: turn.user.slice(0, 200), field: 'list' };
  }
}
export function catalogPlanningContext(state?: CatalogState) {
  return state ? { matchedCount: state.matchedIds.length, shown: byIds(state.shownIds).map(c => ({ id: c.id, name: c.name })), filter: state.query, pageSize: state.limit, lastReadFields: state.readFields, advice: state.advice } : null;
}
