import { mkdirSync, chmodSync, lstatSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export type PendingLineUser = { account: string; userId: string; firstSeenAt: string; lastSeenAt: string };
// Metadata only, for owner-reviewed tester admission. Never store the incoming
// message, reply token or credentials, and never change the actual allowlist.
export class PendingLineUsers {
  constructor(readonly root: string, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw Error('Unsafe pending-user directory');
    chmodSync(root, 0o700);
  }
  private name(account: string, userId: string) { return createHash('sha256').update(JSON.stringify([account, userId])).digest('hex') + '.json'; }
  list(): PendingLineUser[] {
    return readdirSync(this.root).filter(n => /^[a-f0-9]{64}\.json$/.test(n)).map(n => {
      const file = join(this.root, n), stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048) throw Error('Invalid pending-user file');
      const row = JSON.parse(readFileSync(file, 'utf8')) as PendingLineUser;
      if (typeof row.account !== 'string' || row.account.length > 200 || !/^U[0-9a-f]{32}$/i.test(row.userId)
        || !Number.isFinite(Date.parse(row.firstSeenAt)) || !Number.isFinite(Date.parse(row.lastSeenAt)) || n !== this.name(row.account, row.userId)) throw Error('Invalid pending-user data');
      return row;
    }).filter(row => this.now() - Date.parse(row.lastSeenAt) < 7 * 86400000).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }
  record(account: string, userId: string) {
    if (!account || account.length > 200 || !/^U[0-9a-f]{32}$/i.test(userId)) return;
    const rows = this.list(), existing = rows.find(r => r.account === account && r.userId === userId);
    // Expire metadata from disk on the next incoming observation.
    const active = new Set(rows.map(r => this.name(r.account, r.userId)));
    for (const name of readdirSync(this.root)) if (/^[a-f0-9]{64}\.json$/.test(name) && !active.has(name)) unlinkSync(join(this.root, name));
    if (!existing && rows.length >= 200) return;
    const at = new Date(this.now()).toISOString(), row = { account, userId, firstSeenAt: existing?.firstSeenAt ?? at, lastSeenAt: at };
    const temp = join(this.root, '.' + randomUUID() + '.tmp');
    try { writeFileSync(temp, JSON.stringify(row), { mode: 0o600, flag: 'wx' }); renameSync(temp, join(this.root, this.name(account, userId))); }
    finally { try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
  }
}
