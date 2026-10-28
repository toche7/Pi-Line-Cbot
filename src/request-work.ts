import { mkdirSync, chmodSync, lstatSync, readFileSync, readdirSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { customerId, localActor } from './customers.js';
import type { CourseRequest, CourseRequestStore } from './course-requests.js';

export class RequestWorkError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export type WorkStatus = 'new' | 'in_progress' | 'done';
type Event = { operationId: string; fingerprint: string; action: string; at: string; actor: string; text: string };
export type RequestWork = { schema: 1; requestId: string; customerId: string; revision: number; status: WorkStatus; assignee: string; timeline: Event[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const statuses = ['new', 'in_progress', 'done'];
const fail = (status: number, message: string): never => { throw new RequestWorkError(status, message); };
function text(v: unknown, max: number, required = false): string {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b-\u001f]/.test(v) || (required && !v.trim())) return fail(400, 'ข้อความไม่ถูกต้องหรือยาวเกินกำหนด');
  return v.trim();
}
const initial = (r: CourseRequest): RequestWork => ({ schema: 1, requestId: r.id, customerId: customerId(r.owner), revision: 0, status: 'new', assignee: '', timeline: [] });

// Source requests remain immutable. Only references and internal work events live here.
export class RequestWorkStore {
  constructor(readonly root: string, readonly requests: CourseRequestStore, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('Unsafe work directory');
    chmodSync(root, 0o700);
  }
  private read(r: CourseRequest): RequestWork {
    try {
      const file = join(this.root, r.id + '.json'), stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000) throw Error();
      const s = JSON.parse(readFileSync(file, 'utf8')) as RequestWork;
      if (s.schema !== 1 || s.requestId !== r.id || s.customerId !== customerId(r.owner) || !Number.isSafeInteger(s.revision) || s.revision < 0 || !statuses.includes(s.status)
        || !Array.isArray(s.timeline) || s.timeline.length > 500 || s.revision !== s.timeline.length) throw Error();
      text(s.assignee, 100);
      const ids = new Set();
      for (const e of s.timeline) {
        if (!uuid.test(e.operationId) || ids.has(e.operationId) || !/^[a-f0-9]{64}$/.test(e.fingerprint) || !['claim', 'assign', 'status', 'note'].includes(e.action)
          || !Number.isFinite(Date.parse(e.at)) || e.actor !== localActor) throw Error();
        text(e.text, 2000, true); ids.add(e.operationId);
      }
      return s;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return initial(r);
      return fail(503, 'อ่านข้อมูลงานไม่ได้ กรุณาตรวจไฟล์ก่อนลองใหม่');
    }
  }
  private locked<T>(run: () => T): T {
    let lock: number;
    try { lock = openSync(join(this.root, '.write-lock'), 'wx', 0o600); }
    catch { return fail(409, 'งานกำลังถูกบันทึก กรุณาลองใหม่'); }
    try { return run(); } finally { closeSync(lock); unlinkSync(join(this.root, '.write-lock')); }
  }
  private prune(rows: CourseRequest[]) {
    const active = new Set(rows.map(r => r.id));
    for (const name of readdirSync(this.root)) if (name.endsWith('.json') && uuid.test(name.slice(0, -5)) && !active.has(name.slice(0, -5))) unlinkSync(join(this.root, name));
  }
  snapshot() {
    return this.locked(() => {
      const rows = this.requests.list(); this.prune(rows);
      return { requests: rows.map(r => ({ ...r, customerId: customerId(r.owner), work: this.read(r) })), actor: localActor, authenticated: false, deliveryEnabled: false };
    });
  }
  mutate(raw: unknown) {
    const d = raw as Record<string, unknown>;
    if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(k => !['requestId', 'customerId', 'revision', 'operationId', 'action', 'value'].includes(k))
      || typeof d.requestId !== 'string' || !uuid.test(d.requestId) || typeof d.operationId !== 'string' || !uuid.test(d.operationId)
      || !Number.isSafeInteger(d.revision) || Number(d.revision) < 0 || !['claim', 'assign', 'status', 'note'].includes(String(d.action))) return fail(400, 'รูปแบบคำสั่งไม่ถูกต้อง');
    const action = String(d.action), value = action === 'claim' ? text(d.value, 0) : text(d.value, action === 'assign' ? 100 : action === 'status' ? 20 : 2000, action !== 'assign');
    if (action === 'status' && !statuses.includes(value)) return fail(400, 'สถานะไม่ถูกต้อง');
    const fingerprint = createHash('sha256').update(JSON.stringify([d.requestId, d.customerId, action, value])).digest('hex');
    return this.locked(() => {
      const rows = this.requests.list(); this.prune(rows);
      const r = rows.find(r => r.id === d.requestId);
      if (!r) return fail(404, 'คำขอนี้ไม่มีแล้วหรือหมดอายุ');
      if (d.customerId !== customerId(r.owner)) return fail(400, 'ตัวตนลูกค้าไม่ตรงกับคำขอ');
      const s = this.read(r), previous = s.timeline.find(e => e.operationId === d.operationId);
      if (previous) { if (previous.fingerprint !== fingerprint) return fail(409, 'รหัสทำรายการซ้ำแต่ข้อมูลต่างกัน'); return s; }
      if (s.revision !== d.revision) return fail(409, 'งานเปลี่ยนแล้ว โหลดล่าสุดและตรวจเทียบก่อนบันทึกใหม่');
      if (s.timeline.length >= 500) return fail(413, 'ประวัติงานเต็ม');
      let description = value;
      if (action === 'claim') {
        if (s.status !== 'new') return fail(409, 'รับงานได้เฉพาะงานใหม่');
        s.status = 'in_progress'; s.assignee = 'ผู้ใช้บนเครื่องนี้'; description = 'รับงาน → กำลังดูแล · มอบหมายให้ผู้ใช้บนเครื่องนี้';
      } else if (action === 'assign') { s.assignee = value; description = 'ป้ายผู้รับผิดชอบ: ' + (value || 'ยังไม่มอบหมาย'); }
      else if (action === 'status') {
        const allowed: Record<WorkStatus, string[]> = { new: ['in_progress'], in_progress: ['new', 'done'], done: ['in_progress'] };
        if (!allowed[s.status].includes(value)) return fail(409, 'เปลี่ยนสถานะนี้ไม่ได้ ให้เริ่มดูแลก่อนปิดงาน หรือเปิดงานเสร็จแล้วกลับมาดูแล');
        description = s.status + ' → ' + value; s.status = value as WorkStatus;
      }
      s.timeline.push({ operationId: String(d.operationId), fingerprint, action, at: new Date(this.now()).toISOString(), actor: localActor, text: description }); s.revision++;
      const temp = join(this.root, '.' + randomUUID() + '.tmp');
      try {
        const fd = openSync(temp, 'wx', 0o600);
        try { writeFileSync(fd, JSON.stringify(s)); fsyncSync(fd); } finally { closeSync(fd); }
        // Recheck source after preparing the write; never recreate a removed source.
        if (!this.requests.list().some(row => row.id === r.id && customerId(row.owner) === s.customerId)) return fail(404, 'คำขอนี้ไม่มีแล้วหรือหมดอายุ');
        renameSync(temp, join(this.root, r.id + '.json'));
        const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      } finally { try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
      return s;
    });
  }
}
