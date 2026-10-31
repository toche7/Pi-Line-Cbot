import { mkdirSync, chmodSync, lstatSync, readFileSync, readdirSync, openSync, writeFileSync, fsyncSync, closeSync, linkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Identity } from './core.js';
import type { CatalogState } from './catalog-query.js';
import { courseCatalog, type Course } from './course-catalog.js';
import { isExactCourseName, retrieveCourses } from './catalog.js';
import { safeMemoryInput } from './memory-request.js';

export type CourseRequest = {
  version: 1; id: string; kind: 'booking' | 'contact'; createdAt: string;
  owner: Identity; course: { id: string; name: string; url: string; flags: string[] } | null;
  message: string; status: 'pending_team'; delivery: { channel: null; status: 'not_selected' }; sourceSha256: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sameOwner = (a: Identity, b: Identity) => a.channel === b.channel && a.scope === b.scope && a.user === b.user;
const ownerKey = (a: Identity) => JSON.stringify([a.channel, a.scope, a.user]);
const noteOK = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 500 && safeMemoryInput(s) === s && !/[\u0000-\u0008\u000b-\u001f]/.test(s);
function validRecord(r: any): r is CourseRequest {
  return r?.version === 1 && uuid.test(r.id) && ['booking', 'contact'].includes(r.kind) && typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt))
    && ['line', 'terminal'].includes(r.owner?.channel) && typeof r.owner.scope === 'string' && r.owner.scope.length > 0 && r.owner.scope.length <= 200
    && typeof r.owner.user === 'string' && r.owner.user.length > 0 && r.owner.user.length <= 200 && noteOK(r.message)
    && r.status === 'pending_team' && r.delivery?.channel === null && r.delivery.status === 'not_selected'
    && /^[a-f0-9]{64}$/.test(r.sourceSha256) && (r.course === null ? r.kind === 'contact'
      : /^cbtu-\d{2}$/.test(r.course?.id) && typeof r.course.name === 'string' && r.course.name.length <= 300
      && /^https:\/\/cbtumu\.net\/(?:coursenew|course-bundle)\//.test(r.course.url) && Array.isArray(r.course.flags) && r.course.flags.every((s: unknown) => typeof s === 'string'));
}

// Immutable files + exclusive hard-link publication permit independent Terminal
// and LINE processes to share this store without a stale whole-file overwrite.
export class CourseRequestStore {
  constructor(readonly root: string, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('Unsafe request directory');
    chmodSync(root, 0o700);
  }
  list(owner?: Identity, includeExpired = false): CourseRequest[] {
    const rows: CourseRequest[] = [];
    for (const name of readdirSync(this.root)) {
      if (!uuid.test(name.replace(/\.json$/, '')) || !name.endsWith('.json')) continue;
      const path = join(this.root, name), stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error('Invalid request record');
      const row = JSON.parse(readFileSync(path, 'utf8'));
      if (!validRecord(row) || name !== row.id + '.json') throw new Error('Invalid request record');
      if (!includeExpired && this.now() - Date.parse(row.createdAt) > 90 * 86400000) { unlinkSync(path); continue; }
      if (!owner || sameOwner(owner, row.owner)) rows.push(row);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  save(row: CourseRequest): CourseRequest {
    if (!validRecord(row)) throw new Error('Invalid request');
    const active = this.list();
    const existing = active.find(r => r.id === row.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row)) throw new Error('Request ID conflict');
      return existing;
    }
    if (active.length >= 500) throw new Error('Request inbox full');
    const temp = join(this.root, '.' + randomUUID() + '.tmp'), target = join(this.root, row.id + '.json');
    try {
      const fd = openSync(temp, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(row)); fsyncSync(fd); } finally { closeSync(fd); }
      try { linkSync(temp, target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const winner = this.list().find(r => r.id === row.id);
        if (!winner || JSON.stringify(winner) !== JSON.stringify(row)) throw new Error('Request ID conflict');
      }
    } finally { try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
    return row;
  }
  deleteOwner(owner: Identity) {
    for (const row of this.list(owner, true)) unlinkSync(join(this.root, row.id + '.json'));
  }
}

type Draft = { id: string; kind: CourseRequest['kind']; courses: Course[]; course?: Course; message?: string; token?: string; expires: number; record?: CourseRequest };
const guidance = 'ใช้ /book ชื่อหลักสูตร เพื่อขอจอง หรือ /contact เรื่องที่ต้องการฝาก ให้ตรวจสรุปและยืนยันก่อนบันทึก';
export function mayRequestCourseAction(text: string) {
  const q = text.trim();
  if (/ไม่อยาก|ไม่ต้อง|อย่าจอง|ยังไม่|ไม่สนใจ|ยกเลิก/.test(q)) return false;
  // Host actions require an explicit request, not a keyword inside a capability question/quote.
  const action = q.match(/^(?:(?:ผม|ฉัน|เรา)\s*)?(?:(?:อยาก|ต้องการ|ขอ|ช่วย)\s*)?(จอง|สำรองที่|ฝากเรื่อง|ส่งเรื่อง|ส่งข้อมูลให้ทีมงาน)([\s\S]*)$/);
  if (action) return !/^(?:ได้|ไม่ได้|ทำได้|คือ|หมายถึง|ยังไง|อย่างไร|อย่างเดียว|เท่านั้น|หรือ|ไหม|มั้ย|ใช่ไหม)/.test(action[2].trim());
  return /^(?:(?:ผม|ฉัน|เรา)\s*)?(?:ขอ|ช่วย|ต้องการ|อยาก)ให้(?:ทีมงาน|เจ้าหน้าที่).{0,12}ติดต่อกลับ/.test(q);
}

export type RequestSupport = { enabled: true; pendingStage?: 'booking-course' | 'contact-note' | 'confirmation' };
export const requestCapabilityTopic = { id: 'host:course-requests', title: 'บอตรับคำขอจอง/ฝากเรื่องได้ แต่ไม่สมัครเรียนหรือยืนยันที่นั่งแทน' };
export const requestCapabilities = Object.freeze({
  prepareBookingRequest: true, prepareContactRequest: true, saveOnlyAfterHostConfirmation: true,
  completeEnrollment: false, createWebsiteAccount: false, confirmSeat: false, pay: false, automaticallyDispatchToStaff: false,
});
export const requestCapabilityAnswer = 'รับคำขอจองได้ครับ ใช้ /book ชื่อคอร์ส หรือฝากเรื่องด้วย /contact ข้อความ ระบบจะให้ตรวจสรุปและยืนยันก่อนบันทึกคำขอให้ทีมงาน ยังไม่ส่งต่ออัตโนมัติ ไม่ใช่การยืนยันที่นั่ง และยังสมัครสมาชิก ลงทะเบียนเรียน หรือชำระเงินแทนไม่ได้ครับ';

export class CourseRequests {
  private drafts = new Map<string, Draft>();
  private receipts = new Map<string, { token: string; record: CourseRequest; expires: number }>();
  constructor(readonly store: CourseRequestStore, private now = () => Date.now()) {}
  support(owner: Identity): RequestSupport {
    const draft = this.drafts.get(ownerKey(owner));
    return { enabled: true, pendingStage: !draft || draft.expires <= this.now() ? undefined
      : draft.kind === 'booking' && !draft.course ? 'booking-course'
      : draft.kind === 'contact' && !draft.message ? 'contact-note' : 'confirmation' };
  }
  cancel(owner: Identity) { const key = ownerKey(owner); this.drafts.delete(key); this.receipts.delete(key); }
  forget(owner: Identity) { this.store.deleteOwner(owner); this.cancel(owner); }
  handle(owner: Identity, text: string, catalog?: CatalogState): string | undefined {
    const q = text.trim(), key = ownerKey(owner);
    for (const [k, d] of this.drafts) if (d.expires <= this.now()) this.drafts.delete(k);
    for (const [k, r] of this.receipts) if (r.expires <= this.now()) this.receipts.delete(k);
    if (q === '/cancel-request') {
      const pending = this.drafts.has(key); this.cancel(owner);
      return pending ? 'ยกเลิกฉบับร่างแล้ว ยังไม่ได้บันทึกคำขอนี้ในระบบกลาง' : 'ไม่มีฉบับร่างที่รอยืนยัน คำขอที่บันทึกแล้วดูได้ด้วย /requests';
    }
    if (q === '/requests') {
      try {
        const rows = this.store.list(owner);
        return rows.length ? rows.slice(0, 10).map(r => `${r.id}\n${r.kind === 'booking' ? 'คำขอจอง' : 'ฝากเรื่อง'}: ${r.course?.name ?? r.message}\nรอทีมงานดำเนินการ · ยังไม่ได้เลือกช่องทางส่งต่อ`).join('\n\n')
          : 'ยังไม่มีคำขอของคุณในระบบกลาง';
      } catch { return 'อ่านรายการคำขอไม่ได้ชั่วคราว กรุณาลองใหม่'; }
    }
    if (/^\/confirm-request(?:\s|$)/.test(q)) {
      const token = q.slice('/confirm-request'.length).trim(), receipt = this.receipts.get(key);
      if (receipt?.token === token && this.store.list(owner).some(r => r.id === receipt.record.id)) return this.confirmed(receipt.record);
      const draft = this.drafts.get(key);
      if (!draft?.token || !token || token !== draft.token) return 'ไม่มีคำขอพร้อมยืนยัน หรือรหัสไม่ถูกต้อง/หมดอายุ กรุณาเริ่มใหม่ด้วย /book หรือ /contact';
      draft.record ??= { version: 1, id: draft.id, kind: draft.kind, createdAt: new Date(this.now()).toISOString(), owner: { ...owner },
        course: draft.course ? { id: draft.course.id, name: draft.course.name, url: draft.course.canonical_url, flags: [...draft.course.flags] } : null,
        message: draft.message!, status: 'pending_team', delivery: { channel: null, status: 'not_selected' }, sourceSha256: courseCatalog.sourceSha256 };
      try {
        const saved = this.store.save(draft.record);
        this.receipts.set(key, { token, record: saved, expires: this.now() + 5 * 60_000 }); this.drafts.delete(key);
        return this.confirmed(saved);
      } catch { return 'ยังยืนยันการบันทึกไม่ได้ครับ ตรวจคำขอด้วย /requests หรือลองยืนยันด้วยรหัสเดิมได้จนกว่าจะหมดอายุ ยังไม่ได้ส่งต่อทีมงาน'; }
    }
    const book = q.match(/^\/book(?:\s+([\s\S]+))?$/i), contact = q.match(/^\/contact(?:\s+([\s\S]+))?$/i);
    let draft = this.drafts.get(key);
    const natural = !(draft?.kind === 'contact' && !draft.message) && mayRequestCourseAction(q);
    if (book || contact || natural) {
      if (safeMemoryInput(q) !== q) return 'กรุณาไม่ใส่รหัสผ่าน ข้อมูลชำระเงิน เบอร์โทร หรืออีเมลในคำขอ ระยะนี้ใช้แชตต้นทางเพื่อติดต่อกลับครับ';
      if (!draft && this.drafts.size >= 100) return 'ขณะนี้มีฉบับร่างเต็ม กรุณาลองภายหลัง';
      const kind = contact ? 'contact' : book || (natural && /จอง|สำรองที่/.test(q)) ? 'booking' : 'contact';
      draft = { id: randomUUID(), kind, courses: [], expires: this.now() + 5 * 60_000 };
      this.drafts.set(key, draft); this.receipts.delete(key);
      if (kind === 'contact') {
        draft.message = contact?.[1] ?? (natural && q.length > 30 ? q : undefined);
        if (!draft.message) return 'ต้องการฝากเรื่องอะไรให้ทีมงานครับ? ส่งเฉพาะเรื่องที่ต้องการให้ติดต่อกลับ ไม่ต้องใส่เบอร์โทรหรืออีเมล';
        if (!noteOK(draft.message)) { draft.message = undefined; return 'กรุณาสรุปเรื่องไม่เกิน 500 ตัวอักษร โดยไม่ใส่ข้อมูลลับหรือข้อมูลติดต่อเพิ่มเติม'; }
        return this.preview(draft);
      }
      const query = book ? book[1] : q;
      if (query) return this.chooseCourse(draft, query);
      const previous = catalog?.shownIds.map(id => courseCatalog.courses.find(c => c.id === id)!).filter(Boolean) ?? [];
      if (previous.length === 1) { draft.course = previous[0]; return this.preview(draft); }
      draft.courses = previous;
      return this.coursePrompt(draft);
    }
    if (!draft) return q.startsWith('/request-note') ? 'ยังไม่มีฉบับร่างครับ ' + guidance : undefined;
    if (q.startsWith('/')) {
      if (q === '/help' || q === '/memory') return;
      const note = q.match(/^\/request-note\s+([\s\S]+)$/);
      if (note) {
        if (!noteOK(note[1])) return 'กรุณาสรุปข้อความไม่เกิน500ตัวอักษรโดยไม่ใส่ข้อมูลลับหรือข้อมูลติดต่อ';
        draft.message = note[1]; draft.token = undefined; draft.record = undefined;
        return draft.kind === 'booking' && !draft.course ? this.coursePrompt(draft) : this.preview(draft);
      }
      return;
    }
    if (draft.kind === 'booking' && !draft.course) {
      const number = /^\d+$/.test(q) ? Number(q) - 1 : -1;
      if (number >= 0 && number < draft.courses.length) { draft.course = draft.courses[number]; return this.preview(draft); }
      const name = q.replace(/^(?:เลือก|เอา|ขอ)(?:หลักสูตร|คอร์ส)?\s*/, '')
        .replace(/\s*(?:นะครับ|นะคะ|ครับ|ค่ะ|คะ)[.!\s]*$/, '').trim();
      if (isExactCourseName(name)) return this.chooseCourse(draft, name);
      // Keep the unsigned draft until expiry, but let ordinary dialogue/questions continue.
      // Do not turn an arbitrary mention or a question about a course into a selection.
      return;
    }
    if (draft.kind === 'contact' && !draft.message) {
      if (!noteOK(q)) return 'กรุณาสรุปเรื่องไม่เกิน500ตัวอักษรโดยไม่ใส่ข้อมูลลับหรือข้อมูลติดต่อ';
      draft.message = q; return this.preview(draft);
    }
    // A draft never turns arbitrary chat into consent. Submission requires the
    // exact fresh host command printed in the review, not a model-written plan.
    if (/^(?:ยืนยัน|ตกลง|โอเค|ok|confirm)$/i.test(q) && draft.token) return `ยังไม่ได้บันทึกคำขอครับ\n${draft.course?.name ?? 'ฝากเรื่องให้ทีมงาน'}\nเรื่อง: ${draft.message}\nยืนยันสรุปนี้ด้วย /confirm-request ${draft.token} หรือ /cancel-request เพื่อยกเลิก`;
    this.drafts.delete(key); // Switching topic invalidates the old review.
    return;
  }
  private chooseCourse(draft: Draft, query: string) {
    const result = retrieveCourses(query);
    draft.courses = result.named.length ? result.named : result.ranked.slice(0, 5).map(r => r.course);
    if (result.named.length === 1) { draft.course = draft.courses[0]; return this.preview(draft); }
    return this.coursePrompt(draft);
  }
  private coursePrompt(draft: Draft) {
    return draft.courses.length ? `เลือกหลักสูตรที่ต้องการฝากคำขอจอง โดยพิมพ์หมายเลขหรือชื่อเต็ม:\n${draft.courses.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}\n/cancel-request ยกเลิก`
      : 'ต้องการขอจองหลักสูตรไหนครับ? พิมพ์ชื่อหลักสูตร เช่น Excel หรือ Canva หรือ /cancel-request เพื่อยกเลิก';
  }
  private preview(draft: Draft) {
    draft.message ??= 'ขอให้ทีมงานติดต่อกลับเรื่องหลักสูตรนี้';
    draft.token = randomBytes(4).toString('hex').toUpperCase(); draft.expires = this.now() + 5 * 60_000; draft.record = undefined;
    return [`ตรวจคำขอก่อนบันทึก: ${draft.kind === 'booking' ? 'ขอจองหลักสูตร' : 'ฝากเรื่องให้ทีมงาน'}`,
      ...(draft.course ? [`หลักสูตร: ${draft.course.name}`, draft.course.canonical_url] : []), `เรื่อง: ${draft.message}`,
      'ติดต่อกลับ: แชตต้นทางนี้ · เก็บคำขอ90วันและลบเมื่อระบบตรวจอายุข้อมูล',
      'สถานะหลังบันทึก: รอทีมงานดำเนินการ · ยังไม่ส่งอีเมล/LINE และยังไม่ยืนยันที่นั่ง ราคา หรือรอบเรียน',
      `หากถูกต้องและยินยอมให้เก็บเพื่อประสานงาน พิมพ์ /confirm-request ${draft.token} ภายใน5นาที`,
      'แก้ข้อความด้วย /request-note ข้อความใหม่ · เปลี่ยนคอร์สด้วย /book ชื่อใหม่ · /cancel-request เพื่อยกเลิก'].join('\n');
  }
  private confirmed(record: CourseRequest) {
    return `บันทึกคำขอในระบบกลางแล้วครับ\nเลขอ้างอิง: ${record.id}\n${record.course?.name ?? record.message}\nสถานะ: รอทีมงานดำเนินการ\nยังไม่ได้ส่งอีเมลหรือ LINE ให้ทีมงาน และยังไม่ใช่การยืนยันการจอง\nดูคำขอของคุณด้วย /requests`;
  }
}
