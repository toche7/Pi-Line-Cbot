import { CustomerError, type Customer, type CustomerStore } from './customers.js';

// Read-only profile requests use the server token and exact configured OA only.
// This client never sends messages or changes the customer's local profile/consent.
export class LineProfiles {
  private inFlight = new Map<string, Promise<void>>();
  private lastAttempt = new Map<string, number>();
  constructor(private store: CustomerStore, private account: string, private token: string,
    private fetcher: typeof fetch = fetch, private now = () => Date.now()) {}
  canRefresh(c: Customer) {
    return !!this.token && c.identity.channel === 'line' && c.identity.scope === this.account + ':direct' && /^U[0-9a-f]{32}$/i.test(c.identity.user);
  }
  async refresh(c: Customer) {
    if (!this.canRefresh(c)) throw new CustomerError(400, 'ดึงชื่อได้เฉพาะลูกค้า LINE ของบัญชีที่เชื่อมอยู่');
    const current = this.inFlight.get(c.id);
    if (current) return current;
    const task = this.fetchProfile(c);
    this.inFlight.set(c.id, task);
    try { await task; } finally { this.inFlight.delete(c.id); }
  }
  private async fetchProfile(c: Customer) {
    this.lastAttempt.set(c.id, this.now());
    // Keep the failure cooldown bounded even for a large registry.
    for (const [id, at] of this.lastAttempt) if (this.now() - at >= 5 * 60_000) this.lastAttempt.delete(id);
    let response: Response;
    try {
      response = await this.fetcher('https://api.line.me/v2/bot/profile/' + encodeURIComponent(c.identity.user), {
        method: 'GET', headers: { Authorization: 'Bearer ' + this.token }, signal: AbortSignal.timeout(4000), redirect: 'error',
      });
    } catch { throw new CustomerError(502, 'ติดต่อ LINE เพื่อดึงชื่อไม่ได้ กรุณาลองใหม่ภายหลัง'); }
    // Never expose LINE response bodies, tokens or private profile data in errors.
    if (response.status === 404 || response.status === 403) throw new CustomerError(502, 'LINE ยังไม่อนุญาตให้ดึงโปรไฟล์รายนี้ หรือผู้ใช้อาจบล็อกบัญชีอยู่');
    if (response.status === 429) throw new CustomerError(502, 'LINE จำกัดการเรียกข้อมูลชั่วคราว กรุณาลองใหม่ภายหลัง');
    if (!response.ok) throw new CustomerError(502, 'ดึงชื่อจาก LINE ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อบัญชี');
    let data: any;
    try { data = await response.json(); } catch { throw new CustomerError(502, 'LINE ส่งข้อมูลโปรไฟล์ไม่สมบูรณ์'); }
    if (data?.userId !== c.identity.user || typeof data.displayName !== 'string' || !data.displayName.trim() || data.displayName.length > 1000
      || /[\u0000-\u001f]/.test(data.displayName)) throw new CustomerError(502, 'ข้อมูลชื่อจาก LINE ไม่ตรงกับลูกค้ารายนี้หรือไม่สมบูรณ์');
    this.store.saveLineProfile(c.id, data.displayName);
  }
  async refreshDue(customers: Customer[]) {
    const due = customers.filter(c => this.canRefresh(c)
      && (!c.lineProfile || this.now() - Date.parse(c.lineProfile.fetchedAt) >= 24 * 60 * 60_000)
      && (!this.lastAttempt.has(c.id) || this.now() - this.lastAttempt.get(c.id)! >= 5 * 60_000)).slice(0, 4);
    // Failures must never prevent the registry from loading. At most four profiles
    // per snapshot, deduplicated across simultaneous requests; no reply-path calls.
    await Promise.allSettled(due.map(c => this.refresh(c)));
  }
}
