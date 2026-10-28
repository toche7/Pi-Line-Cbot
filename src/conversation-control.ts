import { mkdirSync, chmodSync, readFileSync, writeFileSync, renameSync, fsyncSync, openSync, closeSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { localActor, CustomerError } from './customers.js';

export type HumanWaiting = { id: string; requestedAt: string; reason: string; stopBot: boolean };
type Mode = { human: boolean; epoch: number; at: string; actor: string; startedAt?: string; waiting?: HumanWaiting };
type Delivery = { id: string; key: string; text: string; at: string; status: 'pending' | 'accepted' | 'unknown'; actor: string };
type State = { version: 1; modes: Record<string, Mode>; deliveries: Delivery[] };
export const conversationKey = (account: string, user: string) => JSON.stringify([account, user]);
const fail = (message: string, status = 409): never => { throw new CustomerError(status, message); };
// Single server process: state is committed before changing bot authority or calling LINE.
export class ConversationControl {
  private state: State = { version: 1, modes: {}, deliveries: [] };
  private sending = new Set<string>();
  private fault = false;
  private file: string;
  constructor(root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('Unsafe conversation directory');
    chmodSync(root, 0o700);
    this.file = join(root, 'control.json');
    try {
      if (lstatSync(this.file).isSymbolicLink() || lstatSync(this.file).size > 20_000_000) throw new Error();
      const s = JSON.parse(readFileSync(this.file, 'utf8'));
      if (s.version !== 1 || !s.modes || Array.isArray(s.modes) || !Array.isArray(s.deliveries)
        || Object.keys(s.modes).length > 10000 || s.deliveries.length > 10000) throw new Error();
      for (const [key, m] of Object.entries(s.modes) as [string, Mode][]) {
        const parts = JSON.parse(key);
        if (!Array.isArray(parts) || parts.length !== 2 || parts.some(p => typeof p !== 'string') || typeof m.human !== 'boolean'
          || (m.waiting !== undefined && (!m.waiting || typeof m.waiting.id !== 'string' || !/^[0-9a-f-]{36}$/.test(m.waiting.id)
            || !Number.isFinite(Date.parse(m.waiting.requestedAt)) || typeof m.waiting.reason !== 'string' || m.waiting.reason.length > 200 || typeof m.waiting.stopBot !== 'boolean' || m.human))
          || (m.startedAt !== undefined && !Number.isFinite(Date.parse(m.startedAt)))
          || !Number.isSafeInteger(m.epoch) || m.epoch < 0 || m.actor !== localActor || !Number.isFinite(Date.parse(m.at))) throw new Error();
      }
      const ids = new Set();
      for (const d of s.deliveries as Delivery[]) {
        if (!/^[0-9a-f-]{36}$/.test(d.id) || ids.has(d.id) || !s.modes[d.key] || typeof d.text !== 'string' || d.text.length > 4500
          || !['pending','accepted','unknown'].includes(d.status) || d.actor !== localActor || !Number.isFinite(Date.parse(d.at))) throw new Error();
        ids.add(d.id);
        if (d.status === 'pending') d.status = 'unknown';
      }
      this.state = s;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Conversation control unreadable; bot must remain offline'); }
  }
  private commit(next: State) {
    if (this.fault) fail('บันทึกสถานะไม่ได้ ระบบพักการส่งไว้', 503);
    const json = JSON.stringify(next);
    if (Buffer.byteLength(json) > 20_000_000) fail('พื้นที่สถานะบทสนทนาเต็ม', 413);
    try {
      const fd = openSync(this.file + '.tmp', 'w', 0o600);
      try { writeFileSync(fd, json); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(this.file + '.tmp', this.file); this.state = next;
    } catch { this.fault = true; fail('บันทึกสถานะไม่ได้ ระบบพักการส่งไว้', 503); }
  }
  mode(key: string): Mode { return this.state.modes[key] ?? { human: false, epoch: 0, at: '', actor: localActor }; }
  ticket(key: string) { return { epoch: this.mode(key).epoch, allowed: !this.fault && !this.mode(key).human && !this.mode(key).waiting?.stopBot }; }
  valid(key: string, ticket: { epoch: number; allowed: boolean }, allowWaiting = false, requestId?: string) {
    const mode = this.mode(key);
    return !this.fault && !mode.human && ticket.epoch === mode.epoch && (allowWaiting || (ticket.allowed && !mode.waiting?.stopBot))
      && (!requestId || mode.waiting?.id === requestId);
  }
  requestHuman(key: string, stopBot: boolean) {
    const mode = this.mode(key);
    if (mode.human) return { waiting: undefined, changed: false };
    if (mode.waiting && (!stopBot || mode.waiting.stopBot)) return { waiting: mode.waiting, changed: false };
    if (!this.state.modes[key] && Object.keys(this.state.modes).length >= 10000) fail('จำนวนบทสนทนาเต็ม', 413);
    const next = structuredClone(this.state), at = new Date().toISOString();
    const waiting: HumanWaiting = { id: mode.waiting?.id ?? randomUUID(), requestedAt: mode.waiting?.requestedAt ?? at,
      reason: stopBot ? 'ลูกค้าขอหยุดบอตและรอเจ้าหน้าที่' : 'ลูกค้าขอคุยกับเจ้าหน้าที่', stopBot };
    // Pause immediately on intake, invalidating already queued/generating bot turns.
    next.modes[key] = { ...mode, at, waiting, epoch: mode.epoch + (stopBot ? 1 : 0) };
    this.commit(next); return { waiting, changed: true };
  }
  cancelHumanRequest(key: string) {
    const mode = this.mode(key);
    if (!mode.waiting || mode.human) return false;
    const next = structuredClone(this.state);
    const { waiting, ...remaining } = mode;
    next.modes[key] = { ...remaining, at: new Date().toISOString(), epoch: mode.epoch + 1 };
    this.commit(next); return true;
  }
  change(key: string, human: boolean, epoch: number) {
    if (this.sending.has(key)) fail('กำลังส่งข้อความ กรุณารอให้ส่งจบก่อน');
    if (epoch !== this.mode(key).epoch) fail('สถานะเปลี่ยนแล้ว กรุณาโหลดล่าสุด');
    if (!this.state.modes[key] && Object.keys(this.state.modes).length >= 10000) fail('จำนวนบทสนทนาเต็ม', 413);
    const next = structuredClone(this.state);
    const at = new Date().toISOString();
    next.modes[key] = { human, epoch: epoch + 1, at, actor: localActor,
      ...(human ? { startedAt: this.mode(key).human ? this.mode(key).startedAt ?? this.mode(key).at : this.mode(key).waiting?.requestedAt ?? at } : {}) };
    this.commit(next); return this.mode(key);
  }
  async release(key: string, epoch: number, syncContext: () => Promise<void>) {
    if (this.fault) fail('บันทึกสถานะไม่ได้ ระบบพักการส่งไว้', 503);
    if (this.sending.has(key)) fail('กำลังส่งหรือคืนบทสนทนา กรุณารอให้จบก่อน');
    if (!this.mode(key).human || this.mode(key).epoch !== epoch) fail('สถานะเปลี่ยนแล้ว กรุณาโหลดล่าสุด');
    this.sending.add(key);
    try {
      await syncContext();
      this.sending.delete(key);
      return this.change(key, false, epoch);
    } finally { this.sending.delete(key); }
  }
  beginBotSend(key: string, ticket: { epoch: number; allowed: boolean }, allowWaiting = false, requestId?: string) {
    if (!this.valid(key, ticket, allowWaiting, requestId) || this.sending.has(key)) return false;
    this.sending.add(key); return true;
  }
  endSend(key: string) { this.sending.delete(key); }
  snapshot() { return { ...structuredClone(this.state), storageError: this.fault }; }
  async send(key: string, epoch: number, id: string, text: string, transport: (id: string, text: string) => Promise<void>) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      || typeof text !== 'string' || !text.trim() || text.length > 4500 || /[\u0000-\u0008\u000b-\u001f]/.test(text)) fail('ข้อความหรือรหัสการส่งไม่ถูกต้อง', 400);
    const existing = this.state.deliveries.find(d => d.id === id);
    if (existing) {
      if (existing.key !== key || existing.text !== text) fail('รหัสการส่งถูกใช้กับข้อความอื่นแล้ว');
      return existing; // Never retry an uncertain send, including after restart.
    }
    if (this.fault || !this.mode(key).human || this.mode(key).epoch !== epoch) fail('ต้องรับช่วงคุยและโหลดสถานะล่าสุดก่อนส่ง');
    if (this.sending.has(key)) fail('กำลังส่งข้อความก่อนหน้า');
    if (this.state.deliveries.length >= 10000) fail('ประวัติการส่งเจ้าหน้าที่เต็ม กรุณาจัดการข้อมูลก่อน', 413);
    const d: Delivery = { id, key, text, at: new Date().toISOString(), status: 'pending', actor: localActor };
    const next = structuredClone(this.state); next.deliveries.push(d); this.commit(next);
    this.sending.add(key);
    try { await transport(id, text); d.status = 'accepted'; } catch { d.status = 'unknown'; }
    finally { this.sending.delete(key); }
    const finished = structuredClone(this.state); finished.deliveries[finished.deliveries.findIndex(row => row.id === id)] = d; this.commit(finished);
    return d;
  }
}

export function linePush(token: string, fetcher: typeof fetch = fetch) {
  return async (user: string, id: string, text: string) => {
    const r = await fetcher('https://api.line.me/v2/bot/message/push', { method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Line-Retry-Key': id },
      body: JSON.stringify({ to: user, messages: [{ type: 'text', text }] }) });
    if (!r.ok && !(r.status === 409 && r.headers.get('x-line-accepted-request-id'))) throw new Error('LINE did not confirm acceptance');
  };
}
