import { mkdirSync, chmodSync, lstatSync, readdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type GroupObservation = { groupId: string; eventId?: string; type: string; userId?: string; text?: string; at: string };
type GroupMessage = { eventId: string; userId?: string; text: string; at: string; direction?: 'in' | 'out'; status?: string };
export type LineRoom = { groupId: string; account?: string; seenAt: string; firstSeenAt?: string;
  name?: string; nameFetchedAt?: string; leftAt?: string; messages?: GroupMessage[]; status?: 'observed' | 'joined' | 'left'; replyMode?: 'mention' | 'cbot' };
const groupPattern = /^C[0-9a-f]{32}$/i;
const userPattern = /^U[0-9a-f]{32}$/i;
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

// Kept separate from customer categories, direct-message history, memory and jobs.
export class LineGroupStore {
  constructor(readonly root: string, private account: string, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw Error('Unsafe room directory');
    chmodSync(root, 0o700);
    this.list();
  }
  private prune(room: LineRoom) {
    room.messages = (room.messages ?? []).filter(m => this.now() - Date.parse(m.at) < 90 * 86400000).slice(-1000);
    return room;
  }
  list(): LineRoom[] {
    return readdirSync(this.root).filter(name => /^C[0-9a-f]{32}\.json$/i.test(name)).map(name => {
      const path = join(this.root, name), stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32_000_000) throw Error('Invalid room file');
      const r = JSON.parse(readFileSync(path, 'utf8')) as LineRoom;
      if (!groupPattern.test(r.groupId) || name !== r.groupId + '.json' || !validDate(r.seenAt)
        || (r.account !== undefined && typeof r.account !== 'string') || (r.name !== undefined && (typeof r.name !== 'string' || r.name.length > 1000))
        || (r.nameFetchedAt !== undefined && !validDate(r.nameFetchedAt)) || (r.firstSeenAt !== undefined && !validDate(r.firstSeenAt))
        || (r.leftAt !== undefined && !validDate(r.leftAt)) || (r.status !== undefined && !['observed', 'joined', 'left'].includes(r.status))
        || (r.replyMode !== undefined && !['mention', 'cbot'].includes(r.replyMode))
        || (r.messages !== undefined && (!Array.isArray(r.messages) || r.messages.length > 1000 || r.messages.some(m =>
          typeof m.eventId !== 'string' || m.eventId.length > 128 || typeof m.text !== 'string' || m.text.length > 4000
          || !validDate(m.at) || (m.userId !== undefined && !userPattern.test(m.userId))
          || (m.direction !== undefined && !['in', 'out'].includes(m.direction))
          || (m.status !== undefined && !['pending', 'accepted', 'failed', 'cancelled'].includes(m.status)))))) throw Error('Invalid room data');
      const before = r.messages?.length ?? 0;
      this.prune(r);
      if (r.account === this.account && before !== r.messages!.length) this.write(r);
      return r;
    }).filter(r => !r.account || r.account === this.account).sort((a, b) => b.seenAt.localeCompare(a.seenAt));
  }
  private write(room: LineRoom) {
    const temp = join(this.root, '.' + randomUUID() + '.tmp');
    try {
      const fd = openSync(temp, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(this.prune(room))); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, join(this.root, room.groupId + '.json'));
    } finally { try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
  }
  observe(event: GroupObservation) {
    if (!groupPattern.test(event.groupId) || !validDate(event.at)) return;
    const existing = this.list().find(r => r.groupId === event.groupId);
    if (!existing && this.list().length >= 1000) throw Error('Room registry full');
    const room: LineRoom = existing ?? { groupId: event.groupId, account: this.account, seenAt: event.at, firstSeenAt: event.at, messages: [] };
    const latest = event.at >= room.seenAt;
    room.account = this.account;
    room.firstSeenAt ??= room.seenAt;
    if (latest) {
      room.seenAt = event.at;
      if (event.type === 'leave') { room.status = 'left'; room.leftAt = event.at; }
      else if (event.type === 'join') { room.status = 'joined'; delete room.leftAt; }
      else if (event.type === 'message') { room.status = 'observed'; delete room.leftAt; }
    }
    if (event.type === 'message' && event.eventId && event.eventId.length <= 128 && typeof event.text === 'string'
      && !(room.messages ?? []).some(m => m.eventId === event.eventId && m.direction !== 'out')) {
      room.messages ??= [];
      room.messages.push({ eventId: event.eventId, text: event.text.slice(0, 4000), at: event.at,
        ...(event.userId && userPattern.test(event.userId) ? { userId: event.userId } : {}) });
      room.messages.sort((a, b) => a.at.localeCompare(b.at));
    }
    this.write(room);
  }
  enableMentions(groupId: string) {
    const room = this.list().find(r => r.groupId === groupId);
    if (!room || room.status === 'left') throw Error('Room unavailable');
    room.account = this.account; room.replyMode = 'mention'; this.write(room);
  }
  enableCallWord(groupId: string) {
    const room = this.list().find(r => r.groupId === groupId);
    if (!room || room.status === 'left') throw Error('Room unavailable');
    room.account = this.account; room.replyMode = 'cbot'; this.write(room);
  }
  replyMode(groupId: string) {
    return this.list().find(r => r.groupId === groupId && r.status !== 'left')?.replyMode;
  }
  mentionsEnabled(groupId: string) {
    return !!this.replyMode(groupId);
  }
  reserveReply(groupId: string, eventId: string) {
    const room = this.list().find(r => r.groupId === groupId);
    if (!room || !this.mentionsEnabled(groupId) || !eventId || eventId.length > 128 || room.messages?.some(m => m.eventId === eventId && m.direction === 'out')) return false;
    room.messages ??= [];
    room.messages.push({ eventId, direction: 'out', text: '', status: 'pending', at: new Date(this.now()).toISOString() }); this.write(room); return true;
  }
  finishReply(groupId: string, eventId: string, text: string, status: 'accepted' | 'failed' | 'cancelled') {
    const room = this.list().find(r => r.groupId === groupId), message = room?.messages?.find(m => m.eventId === eventId && m.direction === 'out');
    if (!room || !message) throw Error('Reply reservation missing');
    Object.assign(message, { text: text.slice(0, 4000), status, at: new Date(this.now()).toISOString() }); this.write(room);
  }
  saveName(groupId: string, name: string) {
    const room = this.list().find(r => r.groupId === groupId);
    if (!room) throw Error('Unknown room');
    if (typeof name !== 'string' || !name.trim() || name.length > 1000 || /[\u0000-\u001f]/.test(name)) throw Error('Invalid room name');
    room.account = this.account; room.name = name.trim(); room.nameFetchedAt = new Date(this.now()).toISOString(); this.write(room);
  }
}

export class LineGroupService {
  private attempts = new Map<string, number>();
  private inFlight = new Map<string, Promise<void>>();
  constructor(readonly store: LineGroupStore, private token: string, private fetcher: typeof fetch = fetch, private now = () => Date.now()) {}
  async refreshName(groupId: string) {
    const room = this.store.list().find(r => r.groupId === groupId);
    if (!room || !this.token) throw Error('ยังไม่พบห้องหรือยังไม่ได้เชื่อมบัญชี LINE');
    if (room.status === 'left') throw Error('บอตออกจากห้องนี้แล้ว จึงไม่ดึงข้อมูลใหม่');
    const current = this.inFlight.get(groupId); if (current) return current;
    const task = this.fetchName(groupId); this.inFlight.set(groupId, task);
    try { await task; } finally { this.inFlight.delete(groupId); }
  }
  private async fetchName(groupId: string) {
    this.attempts.set(groupId, this.now());
    for (const [id, at] of this.attempts) if (this.now() - at > 5 * 60_000) this.attempts.delete(id);
    let response: Response;
    try { response = await this.fetcher('https://api.line.me/v2/bot/group/' + groupId + '/summary', {
      method: 'GET', headers: { Authorization: 'Bearer ' + this.token }, redirect: 'error', signal: AbortSignal.timeout(4000),
    }); } catch { throw Error('ติดต่อ LINE เพื่อดึงชื่อห้องไม่ได้'); }
    if (!response.ok) throw Error('ดึงชื่อห้องจาก LINE ไม่สำเร็จ บอตอาจไม่ได้อยู่ในห้องหรือบัญชีไม่มีสิทธิ์');
    let data: any;
    try { data = await response.json(); } catch { throw Error('ข้อมูลชื่อห้องจาก LINE ไม่สมบูรณ์'); }
    if (data?.groupId !== groupId || typeof data.groupName !== 'string' || !data.groupName.trim() || data.groupName.length > 1000
      || /[\u0000-\u001f]/.test(data.groupName)) throw Error('ข้อมูลห้องจาก LINE ไม่ตรงกับห้องที่เลือก');
    this.store.saveName(groupId, data.groupName);
  }
  async snapshot() {
    const due = this.store.list().filter(r => r.status !== 'left' && (!r.nameFetchedAt || this.now() - Date.parse(r.nameFetchedAt) > 86400000)
      && (!this.attempts.has(r.groupId) || this.now() - this.attempts.get(r.groupId)! > 5 * 60_000)).slice(0, 4);
    await Promise.allSettled(due.map(r => this.refreshName(r.groupId)));
    const rooms = this.store.list();
    return { rooms, replyEnabled: rooms.some(r => !!r.replyMode && r.status !== 'left'), pushEnabled: false, retentionDays: 90, maxMessagesPerRoom: 1000 };
  }
}

export function lineGroupsHandler(service: LineGroupService, token: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(data));
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
      || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) { send(403, { error: 'ไม่อนุญาตคำขอข้ามเว็บ' }); return; }
    try {
      if (req.method === 'GET') { send(200, await service.snapshot()); return; }
      if (req.method !== 'POST') { send(405, { error: 'ยังไม่รองรับคำสั่งนี้' }); return; }
      if (req.headers.origin !== 'http://' + req.headers.host || req.headers['x-customer-token'] !== token || req.headers['content-type'] !== 'application/json') { send(403, { error: 'กรุณาเปิดเว็บเดิมเพื่ออัปเดตชื่อห้อง' }); return; }
      let raw = ''; for await (const part of req) { raw += part; if (Buffer.byteLength(raw) > 2048) { send(413, { error: 'คำขอใหญ่เกินกำหนด' }); return; } }
      let input: any; try { input = JSON.parse(raw); } catch { send(400, { error: 'รูปแบบคำขอไม่ถูกต้อง' }); return; }
      if (input?.action !== 'refresh-name' || !groupPattern.test(input.groupId ?? '')) { send(400, { error: 'รองรับเฉพาะอัปเดตชื่อห้องที่รู้จักแล้ว' }); return; }
      if (!service.store.list().some(r => r.groupId === input.groupId)) { send(404, { error: 'ไม่พบห้องที่เลือก' }); return; }
      await service.refreshName(input.groupId); send(200, { ok: true });
    } catch { send(503, { error: 'อ่านข้อมูลหรือดึงชื่อห้องไม่ได้ กรุณาตรวจว่าบอตยังอยู่ในกลุ่ม แล้วลองใหม่' }); }
  };
}
