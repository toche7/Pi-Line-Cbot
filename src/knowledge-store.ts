import { mkdirSync, chmodSync, lstatSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { knowledgeSeed } from './knowledge-seed.js';

export const knowledgeActor = 'ผู้ใช้บนเครื่องนี้ (ยังไม่มี login)';
export type KnowledgeEntry = { id: string; title: string; terms: string[]; text: string; source: string; capturedAt: string; reviewedAt: string; conflict: boolean; conflictNote: string; retired: boolean };
export type KnowledgeVersion = { id: string; entries: KnowledgeEntry[]; at: string; actor: string; event: string; digest: string };
type Review = { revision: number; digest: string; at: string; actor: string };
export type KnowledgeState = { schema: 1; revision: number; draft: KnowledgeEntry[]; active: string; versions: KnowledgeVersion[]; review?: Review; history: { at: string; actor: string; event: string }[] };
export class KnowledgeError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const fail = (message: string, status = 400): never => { throw new KnowledgeError(status, message); };
export const knowledgeDigest = (v: unknown) => createHash('sha256').update(JSON.stringify(v) ?? 'null').digest('hex');
const plain = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function keys(v: any, allowed: string[]) { if (!plain(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('ข้อมูลมีช่องที่ไม่รองรับ'); }
function text(v: unknown, max: number, required = true): string {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) || (required && !v.trim())) fail('กรุณากรอกข้อความให้ครบและไม่เกินกำหนด');
  return (v as string).trim();
}
function date(v: unknown) { const s = text(v, 40); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s) || !Number.isFinite(Date.parse(s))) fail('วันที่ต้องเป็น ISO UTC เช่น 2026-10-28T12:00:00Z'); return s; }
export function validateKnowledgeEntry(v: unknown): KnowledgeEntry {
  keys(v, ['id','title','terms','text','source','capturedAt','reviewedAt','conflict','conflictNote','retired']); const x = v as KnowledgeEntry;
  const id = text(x.id, 64); if (!/^[a-z][a-z0-9-]*$/.test(id) || ['constructor','prototype','__proto__'].includes(id)) fail('รหัสใช้ a-z ตัวเลข และขีดกลาง');
  if (!Array.isArray(x.terms) || !x.terms.length || x.terms.length > 30) fail('ต้องมีคำค้น 1–30 คำ');
  const entry: KnowledgeEntry = { id, title: text(x.title, 120), terms: [...new Set(x.terms.map(t => text(t, 80)))], text: text(x.text, 2000), source: text(x.source, 500), capturedAt: date(x.capturedAt), reviewedAt: date(x.reviewedAt), conflict: x.conflict, conflictNote: text(x.conflictNote, 1000, false), retired: x.retired };
  if (typeof entry.conflict !== 'boolean' || typeof entry.retired !== 'boolean' || (entry.conflict && !entry.conflictNote)) fail('ระบุสถานะและรายละเอียดข้อขัดแย้ง');
  let url: URL; try { url = new URL(entry.source); } catch { return fail('แหล่งอ้างอิงต้องเป็น URL ทางการ'); }
  if (url.protocol !== 'https:' || url.hostname !== 'cbtumu.net' || url.port || url.username || url.password || url.search || url.hash || /[<>\s]/.test(entry.source)) fail('ใช้ URL HTTPS ของ cbtumu.net เท่านั้น ไม่รับ query หรือข้อมูลลับ');
  // This is a public content boundary, never an authority or customer-data editor.
  const content = [entry.title, ...entry.terms, entry.text, entry.conflictNote].join('\n');
  if (/\b(?:sk-[a-z0-9]{12,}|Bearer\s+\S+|(?:api[_ -]?key|access[_ -]?token|password|รหัสผ่าน)\s*[:=]\s*\S+)|-----BEGIN|\b\d{10,16}\b|(?:เลขบัญชี|เลขประจำตัวผู้เรียน|รหัสนักศึกษา)\s*[:=]?\s*[\d-]+|ignore.{0,30}(?:instructions|policy)|(?:system|developer)\s*(?:prompt|message)\s*[:=]|(?:เพิ่มสิทธิ์|ข้ามสิทธิ์|ละเว้นคำสั่งระบบ)/i.test(content)) fail('ไม่รับข้อมูลลับ บัญชีชำระเงิน ข้อมูลผู้เรียน หรือคำสั่งเพิ่มสิทธิ์ในความรู้สาธารณะ');
  // Arbitrary links inside answers could bypass the source whitelist.
  for (const link of content.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    try { const u = new URL(link); if (u.protocol !== 'https:' || u.hostname !== 'cbtumu.net' || u.username || u.password || u.port || u.search) fail('ลิงก์ในเนื้อหาต้องเป็นเว็บไซต์ทางการ'); } catch { fail('ลิงก์ในเนื้อหาไม่ถูกต้อง'); }
  }
  return entry;
}
function entries(v: unknown): KnowledgeEntry[] {
  if (!Array.isArray(v) || !v.length || v.length > 100) return fail('ต้องมีความรู้ 1–100 รายการ');
  const out = v.map(validateKnowledgeEntry); if (new Set(out.map(e => e.id)).size !== out.length || out.every(e => e.retired)) fail('รหัสซ้ำหรือไม่มีรายการใช้งาน'); return out;
}
const seedState = (): KnowledgeState => { const e = entries(knowledgeSeed); return { schema: 1, revision: 0, draft: structuredClone(e), active: 'seed', versions: [{ id: 'seed', entries: e, at: e[0].capturedAt, actor: 'ชุดข้อมูลเริ่มต้นที่ตรวจแล้ว', event: 'seed', digest: knowledgeDigest(e) }], history: [] }; };
function validateState(v: any): KnowledgeState {
  keys(v, ['schema','revision','draft','active','versions','review','history']);
  if (v.schema !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0 || !Array.isArray(v.versions) || !v.versions.length || v.versions.length > 40 || !Array.isArray(v.history) || v.history.length > 200) fail('ที่เก็บความรู้ไม่ถูกต้อง');
  v.draft = entries(v.draft); const ids = new Set<string>();
  for (const version of v.versions) { keys(version, ['id','entries','at','actor','event','digest']); text(version.id, 64); date(version.at); text(version.actor, 120); text(version.event, 120); version.entries = entries(version.entries); if (version.digest !== knowledgeDigest(version.entries) || ids.has(version.id)) fail('ตรวจ checksum เวอร์ชันไม่ผ่าน'); ids.add(version.id); }
  if (!ids.has(v.active)) fail('ไม่พบเวอร์ชันใช้งาน');
  for (const h of v.history) { keys(h, ['at','actor','event']); date(h.at); text(h.actor,120); text(h.event,120); }
  if (v.review) { keys(v.review, ['revision','digest','at','actor']); if (v.review.revision !== v.revision || v.review.digest !== knowledgeDigest(v.draft)) fail('ผลตรวจไม่ตรงร่าง'); date(v.review.at); text(v.review.actor,120); }
  return v;
}
export class KnowledgeStore {
  private file: string; private backup: string; private lastGood: KnowledgeState;
  private unhealthy = false;
  private initialized = false;
  constructor(readonly root: string, private now = () => new Date().toISOString(), private beforeCommit?: () => void) {
    mkdirSync(root, { recursive: true, mode: 0o700 }); if (lstatSync(root).isSymbolicLink()) fail('ที่เก็บความรู้ไม่ปลอดภัย',503); chmodSync(root,0o700);
    this.file = join(root,'knowledge.json'); this.backup = join(root,'last-good.json'); this.lastGood = seedState();
    this.read(); this.initialized = true;
  }
  private load(file: string) { const stat = lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20_000_000) throw Error(); return validateState(JSON.parse(readFileSync(file,'utf8'))); }
  private read(): KnowledgeState {
    try { const s = this.load(this.file); this.lastGood = structuredClone(s); this.unhealthy = false; return s; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { try { lstatSync(this.backup); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT' && this.lastGood.revision === 0) return structuredClone(this.lastGood); } }
      this.unhealthy = true;
      let recovered = false;
      try { const backup = this.load(this.backup); if (backup.revision >= this.lastGood.revision) this.lastGood = backup; recovered = true; } catch { /* Preserve process last-good; never replace damaged files. */ }
      if (!recovered && !this.initialized) fail('ที่เก็บความรู้เสียและไม่มี last-good ที่ตรวจผ่าน ไม่เริ่มใช้งานหรือเขียนทับ',503);
      return structuredClone(this.lastGood);
    }
  }
  snapshot() { const s = this.read(); return { ...structuredClone(s), healthy: !this.unhealthy, actor: knowledgeActor, warning: this.unhealthy ? 'ที่เก็บความรู้เสียหรือหาย ใช้ last-good แบบอ่านอย่างเดียว กรุณากู้ไฟล์ก่อนแก้หรือเผยแพร่' : '' }; }
  activeEntries() { const s = this.read(); return structuredClone(s.versions.find(v => v.id === s.active)!.entries.filter(e => !e.retired)); }
  private atomic(file: string, json: string) {
    const tmp = join(this.root,'.'+randomUUID()+'.tmp'); let fd: number | undefined;
    try { fd = openSync(tmp,'wx',0o600); writeFileSync(fd,json); fsyncSync(fd); closeSync(fd); fd = undefined; renameSync(tmp,file); }
    finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(tmp); } catch {} }
  }
  mutate(input: any) {
    keys(input, ['action','revision','entry','id','digest','confirm','version']);
    const lockPath = join(this.root,'.write-lock'); let lock: number;
    try { lock = openSync(lockPath,'wx',0o600); } catch { return fail('ความรู้กำลังถูกบันทึก ลองใหม่อีกครั้ง',409); }
    try {
      const s = this.read(); if (this.unhealthy) fail('ที่เก็บเสีย ไม่เขียนทับข้อมูลเดิม',503);
      if (input.revision !== s.revision) fail('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุด ข้อความที่กรอกยังอยู่',409);
      const at = date(this.now()); let event = text(input.action,30);
      if (input.action === 'save') {
        const e = validateKnowledgeEntry(input.entry), index = s.draft.findIndex(v => v.id === e.id);
        if (index < 0) s.draft.push(e); else s.draft[index] = e;
        entries(s.draft); delete s.review;
      } else if (input.action === 'retire' || input.action === 'remove') {
        const e = s.draft.find(e => e.id === input.id); if (!e) fail('ไม่พบรายการ',404);
        // Existing public IDs keep a tombstone so follow-ups cannot silently refer to another topic.
        if (input.action === 'remove' && !s.versions.some(v => v.entries.some(e => e.id === input.id))) s.draft = s.draft.filter(e => e.id !== input.id);
        else e!.retired = true;
        entries(s.draft); delete s.review;
      } else if (input.action === 'restore') {
        const v = s.versions.find(v => v.id === input.version); if (!v) fail('ไม่พบเวอร์ชัน',404);
        s.draft = structuredClone(v!.entries); delete s.review; event = 'restore:'+v!.id;
      } else if (input.action === 'review') {
        entries(s.draft); s.review = { revision: s.revision+1, digest: knowledgeDigest(s.draft), at, actor: knowledgeActor };
      } else if (input.action === 'publish') {
        if (input.confirm !== true || !s.review || input.digest !== s.review.digest || s.review.digest !== knowledgeDigest(s.draft) || s.review.revision !== s.revision) fail('ต้องตรวจร่างล่าสุดและยืนยันเผยแพร่อย่างชัดเจน',409);
        const version: KnowledgeVersion = { id: randomUUID(), entries: structuredClone(s.draft), at, actor: knowledgeActor, event: 'publish', digest: s.review!.digest };
        s.versions.push(version); s.active = version.id; delete s.review;
        // Retain the active snapshot and the newest 39 previous versions.
        s.versions = s.versions.slice(-40);
      } else fail('ไม่รองรับคำสั่ง');
      s.revision++; s.history.push({ at, actor: knowledgeActor, event }); s.history = s.history.slice(-200); validateState(s);
      const json = JSON.stringify(s); if (Buffer.byteLength(json) > 20_000_000) fail('ที่เก็บความรู้เต็ม',413);
      this.beforeCommit?.(); this.atomic(this.file,json); this.lastGood = structuredClone(s);
      // Primary rename is the commit point. Backup failure must not misreport a committed publish.
      try { this.atomic(this.backup,json); const fd = openSync(this.root,'r'); try { fsyncSync(fd); } finally { closeSync(fd); } } catch { /* Main remains authoritative and valid. */ }
      return this.snapshot();
    } finally { closeSync(lock); unlinkSync(lockPath); }
  }
}
let activeStore: KnowledgeStore | undefined;
export function configureKnowledge(store?: KnowledgeStore) { activeStore = store; }
export function activeKnowledge(): KnowledgeEntry[] { return activeStore ? activeStore.activeEntries() : structuredClone(knowledgeSeed); }
export function knowledgeTopics() { return activeKnowledge().map(({ id, title }) => ({ id, title })); }
