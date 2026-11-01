import { currentStaffActor, staffIdentity, validStoredActor } from './staff-context.js';
import { mkdirSync, chmodSync, lstatSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { NewsMediaStore, NewsImage } from './news-media.js';
import type { LineGroupStore } from './line-groups.js';
import { localActor, type CustomerStore } from './customers.js';

export class NewsError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const fail = (s: string, status = 400): never => { throw new NewsError(status, s); };
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
type Selection = { customerIds: string[]; groupIds: string[]; lineRoomIds?: string[] };
type Recipient = { kind?: 'room'; id: string; name: string; user: string; consentStamp: string };
export type Delivery = Recipient & { key: string; status: 'pending'|'inflight'|'accepted'|'failed'|'ambiguous'|'cancelled'; attempts: number; nextAt: number; result?: string; requestId?: string };
export type Campaign = { id: string; revision: number; title: string; text: string; image?: NewsImage; selection: Selection; createdAt: number; updatedAt: number; actor: string; status: 'draft'|'reviewed'|'queued'|'complete'|'cancelled'; authorization?: { digest: string; at: number; expiresAt: number }; review?: { digest: string; recipients: Recipient[]; excluded: number; at: number }; deliveries: Delivery[]; deadline?: number; history: { at: number; event: string; actor: string }[] };
type State = { schema: 1; revision: number; campaigns: Campaign[] };
export type PushResult = { status: number; requestId?: string; acceptedRequestId?: string };
export type NewsTransport = (user: string, text: string, key: string, signal: AbortSignal, image?: NewsImage) => Promise<PushResult>;
const reviewHash = (c: Pick<Campaign,'text'|'selection'|'image'>, r: unknown) => hash(c.image ? [c.text,c.selection,r,c.image] : [c.text,c.selection,r]);
const textValue = (v: unknown, max: number, required = false): string => {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) return fail('ข้อความไม่ถูกต้องหรือยาวเกินกำหนด');
  if (required && !v.trim()) return fail('กรุณากรอกข้อความ'); return v.trim();
};
const ids = (v: unknown) => { if (!Array.isArray(v) || v.length > 1000) return fail('จำนวนผู้รับหรือกลุ่มเกินกำหนด'); return [...new Set(v.map(x => textValue(x, 100, true)))]; };

export class NewsStore {
  private file: string;
  constructor(readonly root: string, private now = () => Date.now()) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) fail('ที่เก็บข่าวไม่ปลอดภัย', 503);
    chmodSync(root, 0o700); this.file = join(root, 'news.json'); this.read();
  }
  private read(): State {
    try {
      const stat = lstatSync(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20_000_000) throw Error();
      const s = JSON.parse(readFileSync(this.file, 'utf8')) as State;
      if (s.schema !== 1 || !Number.isSafeInteger(s.revision) || !Array.isArray(s.campaigns) || s.campaigns.length > 200) throw Error();
      const campaignIds = new Set<string>(), keys = new Set<string>();
      for (const c of s.campaigns) {
        if (!c.id || !Number.isSafeInteger(c.revision) || !Array.isArray(c.deliveries) || c.deliveries.length > 1000 || !Array.isArray(c.history)) throw Error();
        textValue(c.title, 120, true); textValue(c.text, 5000); ids(c.selection.customerIds); ids(c.selection.groupIds); if (c.selection.lineRoomIds) ids(c.selection.lineRoomIds);
        if (c.image && (!/^[a-f0-9]{64}$/.test(c.image.id)||!/^[a-f0-9]{64}$/.test(c.image.sha256)||!Number.isSafeInteger(c.image.bytes)||c.image.bytes<1||c.image.bytes>900000||typeof c.image.url!=='string'||c.image.url.length>2000||!c.image.url.startsWith('https://'))) throw Error();
        if (campaignIds.has(c.id) || !['draft','reviewed','queued','complete','cancelled'].includes(c.status) || !Number.isFinite(c.createdAt) || !Number.isFinite(c.updatedAt)) throw Error();
        campaignIds.add(c.id);
        const validRecipient = (r: Recipient) => { if (r.kind !== undefined && r.kind !== 'room') throw Error(); textValue(r.id, 100, true); if (r.kind === 'room' && (r.id !== 'room:' + r.user || !/^C[0-9a-f]{32}$/i.test(r.user))) throw Error(); textValue(r.name, 1000, true); textValue(r.user, 200, true); if (!/^[a-f0-9]{64}$/.test(r.consentStamp)) throw Error(); };
        if (c.review) {
          if (!Array.isArray(c.review.recipients) || c.review.recipients.length > 1000 || !Number.isFinite(c.review.at) || !Number.isSafeInteger(c.review.excluded) || c.review.excluded < 0) throw Error();
          c.review.recipients.forEach(validRecipient);
          if (c.review.digest !== reviewHash(c, { recipients: c.review.recipients, excluded: c.review.excluded })) throw Error();
        }
        if (['reviewed','queued','complete'].includes(c.status) && !c.review) throw Error();
        if (c.authorization && (c.authorization.digest !== c.review?.digest || !Number.isFinite(c.authorization.at) || !Number.isFinite(c.authorization.expiresAt) || c.authorization.expiresAt - c.authorization.at !== 1800000)) throw Error();
        const recipients = new Set<string>();
        for (const d of c.deliveries) {
          validRecipient(d);
          if (!/^[a-f0-9-]{36}$/.test(d.key) || keys.has(d.key) || recipients.has(d.id) || !['pending','inflight','accepted','failed','ambiguous','cancelled'].includes(d.status) || !Number.isSafeInteger(d.attempts) || d.attempts < 0 || d.attempts > 3 || !Number.isFinite(d.nextAt)) throw Error();
          keys.add(d.key); recipients.add(d.id);
          if (!c.review?.recipients.some(r => r.id === d.id && r.user === d.user && r.consentStamp === d.consentStamp)) throw Error();
        }
        if (c.deliveries.length && (!Number.isFinite(c.deadline) || !c.review)) throw Error();
      } return s;
    } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { schema: 1, revision: 0, campaigns: [] }; return fail('อ่านที่เก็บข่าวไม่ได้ ไม่เขียนทับข้อมูลเดิม', 503); }
  }
  transaction<T>(run: (s: State) => T): T {
    let lock: number; const lockPath = join(this.root, '.write-lock');
    try { lock = openSync(lockPath, 'wx', 0o600); } catch { return fail('ข่าวกำลังถูกบันทึก กรุณาลองใหม่', 409); }
    let tmp: string | undefined;
    try {
      const s = this.read(), value = run(s); s.revision++;
      // Keep unresolved work; expire only terminal campaigns after 90 days.
      s.campaigns = s.campaigns.filter(c => !['complete','cancelled'].includes(c.status) || c.updatedAt > this.now() - 90 * 86400000);
      const json = JSON.stringify(s); if (Buffer.byteLength(json) > 20_000_000) fail('ที่เก็บข่าวเต็ม', 413);
      tmp = join(this.root, '.' + randomUUID() + '.tmp'); const fd = openSync(tmp, 'wx', 0o600);
      try { writeFileSync(fd, json); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(tmp, this.file); tmp = undefined;
      const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      return structuredClone(value);
    } finally { if (tmp) { try { unlinkSync(tmp); } catch {} } closeSync(lock); unlinkSync(lockPath); }
  }
  list() { return this.read().campaigns; }
}

export class NewsService {
  constructor(readonly store: NewsStore, private customers: CustomerStore, readonly account: string, private transport?: NewsTransport, private now = () => Date.now(), private gated = false, private rooms?: LineGroupStore, readonly media?: NewsMediaStore) {}
  private authorized(c: Campaign) { return !!c.authorization && c.authorization.digest === c.review?.digest && c.authorization.expiresAt > this.now(); }
  get enabled() { return !!this.transport && (!this.gated || this.store.list().some(c => ['reviewed','queued'].includes(c.status) && this.authorized(c))); }
  // Trusted host integration only: owner authorization must name this exact reviewed campaign.
  authorizeCampaign(id: string, digest: string) {
    this.store.transaction(s => {
      const c = s.campaigns.find(c => c.id === id);
      if (!c || c.status !== 'reviewed' || !c.review || c.review.digest !== digest || !c.review.recipients.length) fail('ข่าวหรือผู้รับเปลี่ยนแล้ว กรุณาตรวจใหม่', 409);
      this.verifyImage(c!);
      if (c!.review!.digest !== reviewHash(c!, this.recipients(c!.selection)) || this.now() - c!.review!.at > 600000) fail('ข้อความหรือผู้รับเปลี่ยน หรือผลตรวจหมดอายุแล้ว กรุณาตรวจใหม่', 409);
      c!.authorization = { digest, at: this.now(), expiresAt: this.now() + 30 * 60000 };
      c!.history.push({ at: this.now(), event: 'owner-authorized', actor: currentStaffActor(localActor) });
    });
  }
  private verifyImage(c: Campaign) { if(c.image){try {if(!this.media)throw Error();this.media.verify(c.image);}catch{fail('รูปไม่พร้อมหรือเปลี่ยนแล้ว กรุณาแนบและตรวจใหม่',409)}} }
  uploadImage(data: unknown) { try {if(!this.media)throw Error('ยังไม่เปิดอัปโหลดรูป');return this.media.upload(data);}catch(e){return fail(e instanceof Error?e.message:'อัปโหลดไม่ได้');} }
  imageData(id: string, publicOnly = false) {
    if(!this.media) fail('ไม่พบรูป',404);
    const c=this.store.list().find(c=>c.image?.id===id&&(!publicOnly||c.deliveries.some(d=>d.attempts>0)||c.status==='queued'));
    if(!c?.image) fail('ไม่พบรูป',404);
    try{return this.media!.verify(c!.image!);}catch{return fail('ไม่พบรูป',404)}
  }
  private recipients(selection: Selection) {
    const s = this.customers.snapshot({ events: [], requests: [] });
    const wanted = s.customers.filter(c => selection.customerIds.includes(c.id) || c.groupIds.some(g => selection.groupIds.includes(g)));
    if (selection.customerIds.some(id => !s.customers.some(c => c.id === id)) || selection.groupIds.some(id => !s.groups.some(g => g.id === id))) fail('ผู้รับหรือกลุ่มเปลี่ยนแล้ว กรุณาเลือกใหม่', 409);
    const recipients: Recipient[] = wanted.filter(c => c.identity.channel === 'line' && c.identity.scope === this.account + ':direct' && c.consent === 'subscribed' && !!c.consentHistory.at(-1)?.evidence.trim())
      .map(c => ({ id: c.id, name: c.profile.nickname || c.displayName || c.id, user: c.identity.user, consentStamp: hash(c.consentHistory.at(-1)) })).sort((a,b) => a.id.localeCompare(b.id));
    const personCount = recipients.length;
    const roomIds = selection.lineRoomIds ?? [];
    const knownRooms = this.rooms?.list() ?? [];
    if (roomIds.some(id => !knownRooms.some(r => r.groupId === id && r.account === this.account && !r.leftAt && ['joined','observed'].includes(r.status ?? '')))) fail('ห้อง LINE เปลี่ยนหรือบอตออกแล้ว กรุณาตรวจรายชื่อใหม่', 409);
    for (const id of roomIds) {
      const room = knownRooms.find(r => r.groupId === id)!;
      recipients.push({ kind: 'room', id: 'room:' + id, name: room.name || 'ห้อง LINE ' + id, user: id, consentStamp: hash([this.account, id, room.firstSeenAt ?? null, room.name ?? null]) });
    }
    recipients.sort((a,b) => a.id.localeCompare(b.id));
    if (recipients.length > 1000) fail('ปลายทางรวมมากเกิน 1,000 รายการ');
    return { recipients, excluded: wanted.length - personCount };
  }
  snapshot() {
    const s = this.customers.snapshot({ events: [], requests: [] });
    return { selfServiceConfirmation: !this.gated, imageUploadEnabled: this.media?.ready ?? false, enabled: this.enabled, actor: currentStaffActor(localActor), customers: s.customers.map(c => ({ id: c.id, name: c.profile.nickname || c.displayName || c.id, consent: c.consent, groupIds: c.groupIds })), lineRooms: (this.rooms?.list() ?? []).filter(r => r.account === this.account && !r.leftAt && ['joined','observed'].includes(r.status ?? '')).map(r => ({ id: r.groupId, name: r.name || 'ห้อง LINE ' + r.groupId })), groups: s.groups.map(g => ({ id: g.id, name: g.name })), campaigns: this.store.list().map(c => ({ ...c, canConfirm: this.enabled && c.status === 'reviewed' && (!this.gated || this.authorized(c)) && !!c.review && this.now() - c.review.at <= 600000 })) };
  }
  mutate(input: any) {
    if (!input || typeof input !== 'object') fail('ข้อมูลไม่ถูกต้อง');
    return this.store.transaction(s => {
      let c = s.campaigns.find(c => c.id === input.id);
      if (input.action === 'create') {
        if (s.campaigns.length >= 200) fail('จำนวนข่าวเต็ม 200 รายการ');
        c = { id: randomUUID(), revision: 0, title: '', text: '', selection: { customerIds: [], groupIds: [] }, createdAt: this.now(), updatedAt: this.now(), actor: currentStaffActor(localActor), status: 'draft', deliveries: [], history: [] }; s.campaigns.push(c);
      } else {
        if (!c) return fail('ไม่พบข่าว', 404);
        if (c.revision !== input.revision) fail('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดล่าสุด ข้อความที่กรอกยังอยู่', 409);
      }
      if(input.action==='duplicate'){
        if(s.campaigns.length>=200)fail('จำนวนข่าวเต็ม 200 รายการ');
        const source=c!;const copy:Campaign={id:randomUUID(),revision:1,title:(source.title.slice(0,110)+' (สำเนา)'),text:source.text,selection:{customerIds:[],groupIds:[],lineRoomIds:[]},...(source.image?{image:structuredClone(source.image)}:{}),createdAt:this.now(),updatedAt:this.now(),actor:currentStaffActor(localActor),status:'draft',deliveries:[],history:[{at:this.now(),event:'duplicate',actor:currentStaffActor(localActor)}]};s.campaigns.push(copy);return copy;
      }
      const campaign = c!;
      if (input.action === 'create' || input.action === 'save') {
        if (!['draft','reviewed'].includes(campaign.status)) fail('แก้ไขข่าวที่เข้าคิวแล้วไม่ได้', 409);
        campaign.title = textValue(input.title, 120, true); campaign.text = textValue(input.text, 5000);
        campaign.selection = { customerIds: ids(input.customerIds), groupIds: ids(input.groupIds), ...(input.lineRoomIds !== undefined ? { lineRoomIds: ids(input.lineRoomIds) } : {}) };
        if(input.image===null)delete campaign.image;else if(input.image!==undefined){if(!input.image||typeof input.image!=='object')fail('รูปไม่ถูกต้อง');campaign.image={id:input.image.id,sha256:input.image.sha256,bytes:input.image.bytes,url:input.image.url};this.verifyImage(campaign);}
        campaign.status = 'draft'; delete campaign.review; delete campaign.authorization;
      } else if (input.action === 'review') {
        if (!['draft','reviewed'].includes(campaign.status)) fail('ตรวจข่าวนี้ใหม่ไม่ได้', 409);
        this.verifyImage(campaign);textValue(campaign.text, 5000, true); const r = this.recipients(campaign.selection);
        const digest = reviewHash(campaign, r);
        if (campaign.authorization?.digest !== digest) delete campaign.authorization;
        campaign.review = { ...r, at: this.now(), digest }; campaign.status = 'reviewed';
      } else if (input.action === 'confirm') {
        if (!this.enabled || (this.gated && !this.authorized(campaign))) fail('การส่งจริงปิดอยู่ ต้องได้รับอนุญาตเฉพาะข่าวนี้จากเจ้าของก่อน', 403);
        if (campaign.status !== 'reviewed' || !campaign.review || input.digest !== campaign.review.digest) fail('กรุณาตรวจตัวอย่างใหม่', 409);
        this.verifyImage(campaign);const r = this.recipients(campaign.selection);
        if (campaign.review!.digest !== reviewHash(campaign, r) || this.now() - campaign.review!.at > 600000) fail('ข้อความ ผู้รับ หรือสถานะรับข่าวเปลี่ยนแล้ว กรุณาตรวจและยืนยันใหม่', 409);
        if (!r.recipients.length) fail('ไม่มีผู้รับที่ยินยอมรับข่าว');
        campaign.deliveries = r.recipients.map(r => ({ ...r, key: randomUUID(), status: 'pending', attempts: 0, nextAt: this.now() }));
        campaign.deadline = this.now() + 900000; campaign.status = 'queued';
        if(!this.gated){campaign.authorization={digest:campaign.review!.digest,at:this.now(),expiresAt:this.now()+1800000};campaign.history.push({at:this.now(),event:'web-confirmed',actor:currentStaffActor(localActor)});}
      } else if (input.action === 'cancel') {
        if (['complete','cancelled'].includes(campaign.status)) fail('ข่าวสิ้นสุดแล้ว', 409);
        for (const d of campaign.deliveries) if (d.status === 'pending') { d.status = 'cancelled'; d.result = 'ยกเลิกก่อนส่ง'; }
        campaign.status = 'cancelled'; delete campaign.authorization;
      } else fail('ไม่รองรับคำสั่งนี้');
      campaign.revision++; campaign.updatedAt = this.now(); campaign.history.push({ at: this.now(), event: input.action, actor: currentStaffActor(localActor) }); return campaign;
    });
  }
  // Run once on process startup, before scheduling workers. Inflight can already be accepted;
  // never generate a replacement key or resend automatically after a crash.
  recover() {
    this.store.transaction(s => { for (const c of s.campaigns) for (const d of c.deliveries) if (d.status === 'inflight') { d.status = 'ambiguous'; d.result = 'โปรเซสหยุดระหว่างส่ง ไม่ส่งซ้ำอัตโนมัติ'; } this.finish(s); });
  }
  private finish(s: State) { for (const c of s.campaigns) if (c.status === 'queued' && c.deliveries.every(d => !['pending','inflight'].includes(d.status))) { c.status = 'complete'; c.updatedAt = this.now(); c.revision++; c.history.push({ at: this.now(), event: 'complete', actor: currentStaffActor(localActor) }); } }
  async tick() {
    if (!this.transport) return;
    const job = this.store.transaction(s => {
      // Globally serialize network requests across workers, with <= 1 request/second.
      if (s.campaigns.some(c => c.deliveries.some(d => d.status === 'inflight'))) return null;
      for (const c of s.campaigns) {
        if (c.status !== 'queued') continue;
        if (!this.authorized(c)) { for (const d of c.deliveries) if (d.status === 'pending') { d.status = 'cancelled'; d.result = 'สิทธิ์ส่งหมดอายุ'; } continue; }
        let rosterValid = false;
        try { this.verifyImage(c);rosterValid = c.review?.digest === reviewHash(c, this.recipients(c.selection)); } catch { /* Fail closed on deleted/changed groups or registry failure. */ }
        if (!rosterValid) {
          for (const d of c.deliveries) if (d.status === 'pending') { d.status = 'cancelled'; d.result = 'ผู้รับหรือสถานะรับข่าวเปลี่ยนหลังตรวจ ต้องตรวจและยืนยันข่าวใหม่'; }
          c.revision++; c.updatedAt = this.now(); c.history.push({ at: this.now(), event: 'review-invalidated', actor: currentStaffActor(localActor) }); continue;
        }
        for (const d of c.deliveries) {
          if (d.status !== 'pending') continue;
          if (this.now() >= c.deadline!) { d.status = 'failed'; d.result = 'หมดเวลาส่ง 15 นาที'; continue; }
          if (d.nextAt > this.now()) continue;
          const current = this.recipients(d.kind === 'room' ? { customerIds: [], groupIds: [], lineRoomIds: [d.user] } : { customerIds: [d.id], groupIds: [] }).recipients[0];
          if (!current || current.consentStamp !== d.consentStamp) { d.status = 'cancelled'; d.result = 'สถานะรับข่าวเปลี่ยน'; continue; }
          d.status = 'inflight'; d.attempts++; c.revision++;
          return { id: c.id, text: c.text, image:c.image, deadline: c.deadline!, delivery: { ...d } };
        }
      } this.finish(s); return null;
    });
    if (!job) return;
    let result: PushResult | undefined;
    try { result = await this.transport(job.delivery.user, job.text, job.delivery.key, AbortSignal.timeout(Math.max(1, Math.min(8000, job.deadline - this.now()))),job.image); } catch {}
    this.store.transaction(s => {
      const c = s.campaigns.find(c => c.id === job.id)!, d = c.deliveries.find(d => d.key === job.delivery.key)!;
      if (result && ((result.status >= 200 && result.status < 300) || (result.status === 409 && result.acceptedRequestId))) { d.status = 'accepted'; d.result = 'LINE API รับคำขอแล้ว ไม่ยืนยันการอ่านหรือการส่งถึง'; d.requestId = result.acceptedRequestId || result.requestId; }
      else if (result?.status === 429 && d.attempts < 3 && c.status === 'queued' && this.now() + 30000 < c.deadline!) { d.status = 'pending'; d.nextAt = this.now() + 30000 * 2 ** (d.attempts - 1); d.result = 'จำกัดอัตรา รอลองด้วย key เดิม'; }
      else if (!result || result.status >= 500 || result.status === 409) { d.status = 'ambiguous'; d.result = 'ผลกำกวม ไม่ส่งซ้ำอัตโนมัติ'; }
      else { d.status = 'failed'; d.result = 'LINE ปฏิเสธคำขอ HTTP ' + result.status; }
      c.revision++; c.updatedAt = this.now(); c.history.push({ at: this.now(), event: 'delivery:' + d.status, actor: currentStaffActor(localActor) });
      for (const campaign of s.campaigns) for (const next of campaign.deliveries) if (next.status === 'pending') next.nextAt = Math.max(next.nextAt, this.now() + 1000);
      this.finish(s);
    });
  }
}

// No credentials read here. Host must explicitly supply an authorized transport.
export function newsLineTransport(token: string, fetcher: typeof fetch = fetch): NewsTransport {
  return async (user, text, key, signal, image) => {
    const r = await fetcher('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Line-Retry-Key': key }, body: JSON.stringify({ to: user, messages: [...(image?[{type:'image',originalContentUrl:image.url,previewImageUrl:image.url}]:[]),{ type: 'text', text }] }), signal });
    return { status: r.status, requestId: r.headers.get('x-line-request-id') || undefined, acceptedRequestId: r.headers.get('x-line-accepted-request-id') || undefined };
  };
}
