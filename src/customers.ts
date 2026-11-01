import { currentStaffActor, staffIdentity, validStoredActor } from './staff-context.js';
import { mkdirSync, chmodSync, lstatSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Identity } from './core.js';
import type { MonitorEvent } from './monitor.js';
import type { CourseRequest } from './course-requests.js';

export const localActor = 'ผู้ใช้บนเครื่องนี้ (ยังไม่มีระบบเข้าสู่ระบบ)';
export class CustomerError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
type Provenance = { source: string; reference: string; at: string; actor: string };
type Profile = { nickname: string; fullName: string; email: string; phone: string; organization: string };
type NoteRevision = { text: string; kind: 'customer' | 'observation'; reference: string; at: string; actor: string };
type Note = { id: string; createdAt: string; actor: string; text: string; kind: 'customer' | 'observation'; reference: string;
  updatedAt?: string; deletedAt?: string; deletedBy?: string; revisions: NoteRevision[] };
type Consent = { status: 'unknown' | 'subscribed' | 'unsubscribed'; evidence: string; at: string; actor: string };
export type Customer = {
  id: string; identity: Identity; createdAt: string; profile: Profile;
  lineProfile?: { displayName: string; fetchedAt: string };
  provenance: Partial<Record<keyof Profile, Provenance>>; profileHistory: { field: keyof Profile; value: string; provenance?: Provenance }[];
  tags: string[]; groupIds: string[]; notes: Note[]; consentHistory: Consent[];
};
type Group = { id: string; name: string; description: string; createdAt: string; updatedAt: string; actor: string };
type State = { schema: 1; revision: number; customers: Customer[]; groups: Group[] };
type Sources = { events: MonitorEvent[]; requests: CourseRequest[] };
const profileFields = ['nickname', 'fullName', 'email', 'phone', 'organization'] as const;
const identityKey = (i: Identity) => JSON.stringify([i.channel, i.scope, i.user]);
export const customerId = (i: Identity) => 'C-' + createHash('sha256').update(identityKey(i)).digest('hex');
const fail = (message: string, status = 400): never => { throw new CustomerError(status, message); };
function string(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('ข้อมูลข้อความไม่ถูกต้องหรือยาวเกินกำหนด');
  const result = (value as string).trim();
  if (required && !result) fail('กรุณากรอกข้อมูลให้ครบ');
  return result;
}
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('รูปแบบข้อมูลไม่ถูกต้อง');
  return value as Record<string, any>;
}
function validIdentity(i: Identity) {
  return i && ['line', 'terminal'].includes(i.channel) && typeof i.scope === 'string' && i.scope.length > 0 && i.scope.length <= 200
    && typeof i.user === 'string' && i.user.length > 0 && i.user.length <= 200;
}
function list(value: unknown, max: number, itemMax: number): string[] {
  if (!Array.isArray(value) || value.length > max) fail('จำนวนรายการเกินกำหนด');
  const rows = (value as unknown[]).map(s => string(s, itemMax, true));
  return [...new Set(rows)];
}

// The customer registry is independent of bot memory, monitor history and requests.
// All changes are serialized under an exclusive lock and published atomically.
export class CustomerStore {
  private file: string;
  constructor(readonly root: string, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('Unsafe customer directory');
    chmodSync(root, 0o700); this.file = join(root, 'customers.json');
    this.read();
  }
  private read(): State {
    try {
      const stat = lstatSync(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 30_000_000) throw new Error();
      const s = JSON.parse(readFileSync(this.file, 'utf8')) as State;
      if (s.schema !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.customers) || !Array.isArray(s.groups)
        || s.customers.length > 10000 || s.groups.length > 500) throw new Error();
      const ids = new Set<string>(), groupIds = new Set(s.groups.map(g => g.id));
      if (groupIds.size !== s.groups.length) throw new Error();
      for (const g of s.groups) {
        string(g.id, 100, true); string(g.name, 80, true); string(g.description, 500); string(g.actor, 200, true);
        if (!Number.isFinite(Date.parse(g.createdAt)) || !Number.isFinite(Date.parse(g.updatedAt))) throw new Error();
      }
      for (const c of s.customers) {
        if (!validIdentity(c.identity) || c.id !== customerId(c.identity) || ids.has(c.id)) throw new Error();
        if (!Number.isFinite(Date.parse(c.createdAt))) throw new Error();
        if (c.lineProfile) {
          string(c.lineProfile.displayName, 1000, true);
          if (c.identity.channel !== 'line' || !Number.isFinite(Date.parse(c.lineProfile.fetchedAt))) throw new Error();
        }
        ids.add(c.id);
        for (const field of profileFields) string(c.profile[field], field === 'email' ? 254 : 200);
        if (!c.provenance || !Array.isArray(c.profileHistory) || !Array.isArray(c.notes) || c.notes.length > 500 || !Array.isArray(c.consentHistory)) throw new Error();
        list(c.tags, 50, 50); list(c.groupIds, 500, 100);
        if (c.groupIds.some(id => !groupIds.has(id))) throw new Error();
        const provenance = (p: Provenance) => {
          string(p.source, 80, true); string(p.reference, 500); string(p.actor, 200, true);
          if (!Number.isFinite(Date.parse(p.at))) throw new Error();
        };
        for (const field of profileFields) if (c.provenance[field]) provenance(c.provenance[field]!);
        for (const h of c.profileHistory) {
          if (!profileFields.includes(h.field)) throw new Error();
          string(h.value, h.field === 'email' ? 254 : 200); if (h.provenance) provenance(h.provenance);
        }
        const noteIds = new Set<string>();
        for (const n of c.notes) {
          string(n.id, 100, true); string(n.text, 2000, true); string(n.reference, 500); string(n.actor, 200, true);
          if (noteIds.has(n.id) || !['customer', 'observation'].includes(n.kind) || !Array.isArray(n.revisions) || !Number.isFinite(Date.parse(n.createdAt))) throw new Error();
          if (n.updatedAt && !Number.isFinite(Date.parse(n.updatedAt))) throw new Error();
          if (n.deletedAt) {
            if (!Number.isFinite(Date.parse(n.deletedAt))) throw new Error();
            string(n.deletedBy, 200, true);
          }
          for (const h of n.revisions) {
            string(h.text, 2000, true); string(h.reference, 500); string(h.actor, 200, true);
            if (!['customer', 'observation'].includes(h.kind) || !Number.isFinite(Date.parse(h.at))) throw new Error();
          }
          noteIds.add(n.id);
        }
        for (const h of c.consentHistory) {
          if (!['unknown', 'subscribed', 'unsubscribed'].includes(h.status) || !Number.isFinite(Date.parse(h.at))) throw new Error();
          string(h.evidence, 1000, h.status !== 'unknown'); string(h.actor, 200, true);
        }
      }
      return s;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { schema: 1, revision: 0, customers: [], groups: [] };
      throw new CustomerError(503, 'อ่านทะเบียนลูกค้าไม่ได้ กรุณาตรวจไฟล์ข้อมูลก่อนลองใหม่');
    }
  }
  private transaction<T>(run: (s: State) => { value: T; changed: boolean }): T {
    let lock: number;
    try { lock = openSync(join(this.root, '.write-lock'), 'wx', 0o600); }
    catch { throw new CustomerError(409, 'ทะเบียนลูกค้ากำลังถูกใช้งาน กรุณาลองใหม่'); }
    let temp: string | undefined;
    try {
      const s = this.read(), result = run(s);
      if (result.changed) {
        s.revision++;
        temp = join(this.root, '.' + randomUUID() + '.tmp');
        const fd = openSync(temp, 'wx', 0o600);
        try {
          const json = JSON.stringify(s);
          if (Buffer.byteLength(json) > 30_000_000) fail('ทะเบียนลูกค้ามีขนาดเต็ม กรุณาจัดการข้อมูลก่อนบันทึก', 413);
          writeFileSync(fd, json); fsyncSync(fd);
        } finally { closeSync(fd); }
        renameSync(temp, this.file); temp = undefined;
      }
      return result.value;
    } finally {
      if (temp) { try { unlinkSync(temp); } catch {} }
      closeSync(lock); unlinkSync(join(this.root, '.write-lock'));
    }
  }
  private discover(s: State, sources: Sources) {
    const known = new Set(s.customers.map(c => c.id)); let changed = false;
    const identities: Identity[] = sources.events.map(e => ({ channel: 'line', scope: e.account + ':direct', user: e.userId }));
    identities.push(...sources.requests.map(r => r.owner));
    for (const identity of identities) {
      if (!validIdentity(identity)) continue;
      const id = customerId(identity);
      if (known.has(id)) continue;
      if (s.customers.length >= 10000) fail('ทะเบียนลูกค้าเต็ม', 503);
      s.customers.push({ id, identity: { ...identity }, createdAt: new Date(this.now()).toISOString(),
        profile: { nickname: '', fullName: '', email: '', phone: '', organization: '' }, provenance: {}, profileHistory: [], tags: [], groupIds: [], notes: [], consentHistory: [] });
      known.add(id); changed = true;
    }
    return changed;
  }
  snapshot(sources: Sources, discover = true) {
    if (discover) this.transaction(s => ({ value: undefined, changed: this.discover(s, sources) }));
    const s = this.read();
    const customers = s.customers.map(c => {
      const events = c.identity.channel === 'line' ? sources.events.filter(e => e.account + ':direct' === c.identity.scope && e.userId === c.identity.user) : [];
      const requests = sources.requests.filter(r => identityKey(r.owner) === identityKey(c.identity));
      return { ...c, lastContactAt: events.reduce<string | null>((v, e) => !v || e.at > v ? e.at : v, null),
        requestCount: requests.length, displayName: c.lineProfile?.displayName ?? null, consent: c.consentHistory.at(-1)?.status ?? 'unknown' };
    });
    return { revision: s.revision, customers, groups: s.groups, actor: currentStaffActor(localActor), authenticated: Boolean(staffIdentity()), pushEnabled: false };
  }
  saveLineProfile(id: string, displayName: string) {
    const name = string(displayName, 1000, true);
    return this.transaction(s => {
      const c = s.customers.find(row => row.id === id && row.identity.channel === 'line');
      if (!c) fail('ไม่พบลูกค้า LINE รายนี้', 404);
      c!.lineProfile = { displayName: name, fetchedAt: new Date(this.now()).toISOString() };
      return { value: undefined, changed: true };
    });
  }
  mutate(raw: unknown) {
    const input = object(raw);
    return this.transaction(s => {
      if (!Number.isSafeInteger(input.revision) || input.revision !== s.revision) fail('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุดก่อนบันทึกอีกครั้ง ข้อความที่กรอกยังอยู่', 409);
      const at = new Date(this.now()).toISOString();
      const action = string(input.action, 50, true);
      const data = object(input.data);
      if (action === 'group.members') {
        const group = s.groups.find(g => g.id === input.id);
        if (!group) fail('ไม่พบกลุ่ม', 404);
        const ids = list(data.customerIds, 10000, 100);
        if (ids.some(id => !s.customers.some(c => c.id === id))) fail('ไม่พบลูกค้าที่เลือก กรุณาโหลดล่าสุด');
        const members = new Set(ids);
        for (const c of s.customers) {
          c.groupIds = c.groupIds.filter(id => id !== input.id);
          if (members.has(c.id)) c.groupIds.push(input.id);
        }
        group!.updatedAt = at;
      } else if (action.startsWith('group.')) {
        const name = action === 'group.delete' ? '' : string(data.name, 80, true);
        const description = action === 'group.delete' ? '' : string(data.description, 500);
        if (name && s.groups.some(g => g.id !== input.id && g.name.toLocaleLowerCase() === name.toLocaleLowerCase())) fail('มีกลุ่มชื่อนี้แล้ว');
        if (action === 'group.create') {
          if (s.groups.length >= 500) fail('จำนวนกลุ่มเต็ม');
          s.groups.push({ id: randomUUID(), name, description, createdAt: at, updatedAt: at, actor: currentStaffActor(localActor) });
        } else {
          const group = s.groups.find(g => g.id === input.id);
          if (!group) fail('ไม่พบกลุ่ม', 404);
          if (action === 'group.update') Object.assign(group!, { name, description, updatedAt: at, actor: currentStaffActor(localActor) });
          else if (action === 'group.delete') {
            s.groups = s.groups.filter(g => g.id !== input.id);
            for (const c of s.customers) c.groupIds = c.groupIds.filter(id => id !== input.id);
          } else fail('ไม่รองรับคำสั่งนี้');
        }
      } else {
        const c = s.customers.find(row => row.id === input.id);
        if (!c) fail('ไม่พบลูกค้ารายนี้', 404);
        if (action === 'profile.update') {
          const profile = object(data.profile), source = string(data.source, 80, true), reference = string(data.reference, 500);
          if (!['ลูกค้าแจ้ง', 'ทีมตรวจสอบ', 'ทีมตั้งชื่อเรียก'].includes(source)) fail('กรุณาระบุที่มาของข้อมูล');
          for (const field of profileFields) {
            const value = string(profile[field], field === 'email' ? 254 : 200);
            if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('รูปแบบอีเมลไม่ถูกต้อง');
            if (source === 'ทีมตั้งชื่อเรียก' && field !== 'nickname' && value !== c!.profile[field]) fail('ที่มาทีมตั้งชื่อเรียกใช้เปลี่ยนได้เฉพาะชื่อที่ใช้เรียก');
            if (value !== c!.profile[field]) {
              c!.profileHistory.push({ field, value: c!.profile[field], provenance: c!.provenance[field] });
              c!.profile[field] = value; c!.provenance[field] = { source, reference, at, actor: currentStaffActor(localActor) };
            }
          }
        } else if (action === 'tags.update') c!.tags = list(data.tags, 50, 50);
        else if (action === 'memberships.update') {
          const ids = list(data.groupIds, 500, 100);
          if (ids.some(id => !s.groups.some(g => g.id === id))) fail('ไม่พบกลุ่มที่เลือก กรุณาโหลดล่าสุด');
          c!.groupIds = ids;
        } else if (action === 'note.add' || action === 'note.update') {
          if (!['customer', 'observation'].includes(data.kind)) fail('กรุณาเลือกประเภทโน้ต');
          const fields = { text: string(data.text, 2000, true), kind: data.kind as Note['kind'], reference: string(data.reference, 500) };
          if (action === 'note.add') {
            if (c!.notes.length >= 500) fail('จำนวนโน้ตเต็ม');
            c!.notes.push({ id: randomUUID(), ...fields, createdAt: at, actor: currentStaffActor(localActor), revisions: [] });
          } else {
            const note = c!.notes.find(n => n.id === data.noteId && !n.deletedAt);
            if (!note) fail('ไม่พบโน้ตนี้', 404);
            note!.revisions.push({ text: note!.text, kind: note!.kind, reference: note!.reference, at: note!.updatedAt ?? note!.createdAt, actor: note!.actor });
            Object.assign(note!, fields, { updatedAt: at });
          }
        } else if (action === 'note.delete') {
          const note = c!.notes.find(n => n.id === data.noteId && !n.deletedAt);
          if (!note) fail('ไม่พบโน้ตนี้', 404);
          note!.deletedAt = at; note!.deletedBy = currentStaffActor(localActor); // Keep content and revisions for the local audit trail.
        } else if (action === 'consent.update') {
          if (!['unknown', 'subscribed', 'unsubscribed'].includes(data.status)) fail('สถานะรับข่าวสารไม่ถูกต้อง');
          const evidence = string(data.evidence, 1000, data.status !== 'unknown');
          c!.consentHistory.push({ status: data.status, evidence, at, actor: currentStaffActor(localActor) });
        } else fail('ไม่รองรับคำสั่งนี้');
      }
      return { value: { ok: true, revision: s.revision + 1 }, changed: true };
    });
  }
}
