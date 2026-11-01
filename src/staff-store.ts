import { mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { staffRoles, extraPermissions, type StaffPrincipal, type StaffRole, type ExtraPermission } from './staff-policy.js';

type Account = { id: string; email: string; subject?: string; role: StaffRole; enabled: boolean; extras: ExtraPermission[] };
type Audit = { at: string; actor: string; event: string; target: string };
type State = { schema: 1; revision: number; accounts: Account[]; history: Audit[] };
export class StaffError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const validEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export class StaffStore {
  private file: string;
  constructor(readonly root: string, bootstrapEmail: string) {
    if (!validEmail(bootstrapEmail)) throw new StaffError(503, 'ต้องตั้งอีเมลผู้ดูแลระบบคนแรก');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new StaffError(503, 'ที่เก็บบัญชีไม่ปลอดภัย');
    chmodSync(root, 0o700); this.file = join(root, 'accounts.json');
    try { lstatSync(this.file); this.read(); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      const initial: State = { schema: 1, revision: 0, accounts: [{ id: randomUUID(), email: bootstrapEmail.toLowerCase(), role: 'admin', enabled: true, extras: [] }], history: [] };
      writeFileSync(this.file, JSON.stringify(initial), { mode: 0o600, flag: 'wx' });
    }
  }
  private read(): State {
    try {
      const stat = lstatSync(this.file);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 2_000_000) throw Error();
      const s: State = JSON.parse(readFileSync(this.file, 'utf8'));
      if (s.schema !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.accounts) || s.accounts.length > 1000
        || !Array.isArray(s.history) || s.history.length > 300 || new Set(s.accounts.map(a => a.email)).size !== s.accounts.length
        || new Set(s.accounts.map(a => a.id)).size !== s.accounts.length
        || s.accounts.some(a => !validEmail(a.email) || a.email !== a.email.toLowerCase() || typeof a.id !== 'string' || !staffRoles.includes(a.role)
          || typeof a.enabled !== 'boolean' || !Array.isArray(a.extras) || a.extras.some(p => !extraPermissions.includes(p))
          || a.subject !== undefined && (typeof a.subject !== 'string' || !/^[\w-]{1,100}$/.test(a.subject)))
        || new Set(s.accounts.filter(a => a.subject).map(a => a.subject)).size !== s.accounts.filter(a => a.subject).length
        || s.history.some(h => !h || !Number.isFinite(Date.parse(h.at)) || typeof h.actor !== 'string' || h.actor.length > 100
          || typeof h.event !== 'string' || h.event.length > 100 || typeof h.target !== 'string' || h.target.length > 200)
        || !s.accounts.some(a => a.role === 'admin' && a.enabled)) throw Error();
      return s;
    } catch { throw new StaffError(503, 'อ่านบัญชีเจ้าหน้าที่ไม่ได้ จึงปฏิเสธการเข้าถึง'); }
  }
  private change<T>(fn: (s: State) => T): T {
    let fd: number;
    try { fd = openSync(this.file + '.lock', 'wx', 0o600); }
    catch { throw new StaffError(409, 'กำลังบันทึกบัญชี กรุณาลองใหม่'); }
    const temp = this.file + '.' + randomUUID();
    try {
      const s = this.read(), result = fn(s); s.revision++; s.history = s.history.slice(-300);
      writeFileSync(temp, JSON.stringify(s), { mode: 0o600, flag: 'wx' }); renameSync(temp, this.file); return result;
    } finally { closeSync(fd); try { unlinkSync(temp); } catch {} unlinkSync(this.file + '.lock'); }
  }
  snapshot() { return this.read(); }
  identity(subject: string, verifiedEmail?: string): StaffPrincipal | undefined {
    if (!/^[\w-]{1,100}$/.test(subject)) return;
    let account = this.read().accounts.find(a => a.subject === subject);
    if (!account && verifiedEmail) {
      const invited = this.read().accounts.find(a => !a.subject && a.enabled && a.email === verifiedEmail.toLowerCase());
      if (invited) account = this.change(s => {
        const a = s.accounts.find(a => a.id === invited.id);
        if (!a?.enabled || a.subject || s.accounts.some(other => other.subject === subject)) throw new StaffError(409, 'บัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่');
        a.subject = subject; s.history.push({ at: new Date().toISOString(), actor: subject, event: 'google-bound', target: a.id }); return a;
      });
    }
    if (!account?.enabled || account.subject !== subject) return;
    return { subject, email: account.email, role: account.role, enabled: true, extras: [...account.extras] };
  }
  mutate(actor: StaffPrincipal, input: any) {
    return this.change(s => {
      const owner = s.accounts.find(a => a.subject === actor.subject);
      if (!owner?.enabled || owner.role !== 'admin') throw new StaffError(403, 'เฉพาะผู้ดูแลระบบ');
      if (!input || !['invite', 'update'].includes(input.action) || input.revision !== s.revision) throw new StaffError(409, 'โหลดรายชื่อเจ้าหน้าที่ล่าสุดก่อนบันทึก');
      if (!staffRoles.includes(input.role) || typeof input.enabled !== 'boolean' || !Array.isArray(input.extras)
        || input.extras.some((p: any) => !extraPermissions.includes(p)) || new Set(input.extras).size !== input.extras.length
        || input.role === 'staff' && input.extras.includes('knowledge.publish')) throw new StaffError(400, 'บทบาทหรือสิทธิ์ไม่ถูกต้อง');
      let target: Account;
      if (input.action === 'invite') {
        if (!validEmail(input.email) || s.accounts.length >= 1000 || s.accounts.some(a => a.email === input.email.toLowerCase())) throw new StaffError(400, 'อีเมลไม่ถูกต้อง ซ้ำ หรือรายชื่อเต็ม');
        target = { id: randomUUID(), email: input.email.toLowerCase(), role: input.role, enabled: input.enabled, extras: input.extras }; s.accounts.push(target);
      } else {
        const found = s.accounts.find(a => a.id === input.id); if (!found) throw new StaffError(404, 'ไม่พบบัญชี'); target = found;
        Object.assign(target, { role: input.role, enabled: input.enabled, extras: input.extras });
      }
      if (!s.accounts.some(a => a.role === 'admin' && a.enabled && a.subject)) throw new StaffError(400, 'ต้องเหลือผู้ดูแลระบบที่ผูก Google และเปิดใช้งานอย่างน้อยหนึ่งคน');
      s.history.push({ at: new Date().toISOString(), actor: actor.subject, event: input.action, target: target.id });
    });
  }
  audit(actor: string, event: string, target: string) {
    this.change(s => { s.history.push({ at: new Date().toISOString(), actor, event: event.slice(0,100), target: target.slice(0,200) }); });
  }
}
