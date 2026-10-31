import { mkdirSync, chmodSync, lstatSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { localActor } from './customers.js';
import type { PendingLineUsers } from './line-pending-users.js';

export class LineAccessError extends Error { constructor(readonly status: number, message: string) { super(message); } }
type Grant = { userId: string; at: string; actor: string; lastSeenAt: string };
type AccessState = { version: 1; account: string; revision: number; grants: Grant[] };
const validId = (id: unknown): id is string => typeof id === 'string' && /^U[0-9a-f]{32}$/i.test(id);
const validDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));

// Additional owner-approved testers are persisted separately from secrets in
// .env. The shared Set is the same object checked by the running LINE adapter.
export class LineAccess {
  private file: string;
  constructor(readonly root: string, readonly account: string, private allowedUsers: Set<string>, private now = () => Date.now()) {
    if (!account || account.length > 200) throw Error('Invalid LINE account');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw Error('Unsafe access directory');
    chmodSync(root, 0o700);
    this.file = join(root, createHash('sha256').update(account).digest('hex') + '.json');
    this.snapshot();
  }
  private read(): AccessState {
    try {
      const stat = lstatSync(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1_000_000) throw Error();
      const s = JSON.parse(readFileSync(this.file, 'utf8')) as AccessState;
      if (s.version !== 1 || s.account !== this.account || !Number.isSafeInteger(s.revision) || s.revision < 0
        || !Array.isArray(s.grants) || s.grants.length > 1000 || new Set(s.grants.map(g => g.userId)).size !== s.grants.length
        || s.grants.some(g => !validId(g.userId) || !validDate(g.at) || !validDate(g.lastSeenAt) || typeof g.actor !== 'string' || !g.actor || g.actor.length > 200)) throw Error();
      return s;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, account: this.account, revision: 0, grants: [] };
      throw new LineAccessError(503, 'อ่านข้อมูลสิทธิ์ไม่ได้ จึงยังไม่เปลี่ยนสิทธิ์ใคร');
    }
  }
  snapshot() {
    const s = this.read();
    for (const grant of s.grants) this.allowedUsers.add(grant.userId);
    return { revision: s.revision, grants: s.grants, allowedUserCount: this.allowedUsers.size };
  }
  allow(userId: unknown, revision: unknown, pending: PendingLineUsers) {
    if (!validId(userId) || !Number.isSafeInteger(revision)) throw new LineAccessError(400, 'รหัสหรือสถานะข้อมูลไม่ถูกต้อง');
    const lockPath = this.file + '.lock'; let lock: number;
    try { lock = openSync(lockPath, 'wx', 0o600); }
    catch { throw new LineAccessError(409, 'กำลังบันทึกสิทธิ์ กรุณาโหลดล่าสุดแล้วลองใหม่'); }
    let temp: string | undefined;
    try {
      const s = this.read();
      if (this.allowedUsers.has(userId) || s.grants.some(g => g.userId === userId)) {
        for (const g of s.grants) this.allowedUsers.add(g.userId);
        return { ok: true, alreadyAllowed: true, userId, revision: s.revision };
      }
      if (revision !== s.revision) throw new LineAccessError(409, 'รายชื่อเปลี่ยนแล้ว กรุณาโหลดล่าสุดและตรวจรหัสอีกครั้ง');
      const candidate = pending.list().find(r => r.account === this.account && r.userId === userId);
      if (!candidate) throw new LineAccessError(404, 'ไม่พบผู้ทักใหม่รายนี้ หรือเกินช่วงเก็บแล้ว กรุณาให้ทักเข้ามาใหม่');
      if (s.grants.length >= 1000) throw new LineAccessError(400, 'รายชื่อสิทธิ์เพิ่มเติมเต็มแล้ว');
      s.grants.push({ userId, at: new Date(this.now()).toISOString(), actor: localActor, lastSeenAt: candidate.lastSeenAt }); s.revision++;
      temp = join(this.root, '.' + randomUUID() + '.tmp');
      const fd = openSync(temp, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(s)); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, this.file); temp = undefined;
      // Publish to the live gate only after durable storage succeeds.
      this.allowedUsers.add(userId);
      return { ok: true, alreadyAllowed: false, userId, revision: s.revision };
    } finally {
      if (temp) { try { unlinkSync(temp); } catch {} }
      closeSync(lock); unlinkSync(lockPath);
    }
  }
}
