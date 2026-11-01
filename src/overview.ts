import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConversationMonitor } from './monitor.js';
import type { CustomerStore } from './customers.js';
import type { RequestWorkStore } from './request-work.js';
import type { ConversationService } from './conversations-api.js';
import type { PendingUserService } from './line-pending-admin.js';
import type { NewsService } from './news.js';
import { customerId } from './customers.js';

export type OverviewSources = { monitor: ConversationMonitor; work: RequestWorkStore; customers?: CustomerStore; conversations?: ConversationService; pending?: PendingUserService; news?: NewsService };
export function overviewSnapshot(s: OverviewSources, now = Date.now()) {
  const errors: string[] = [];
  function read<T>(label: string, fn: (() => T) | undefined): T | null {
    if (!fn) { errors.push(label + ': ยังไม่ได้เชื่อมข้อมูล'); return null; }
    try { return fn(); } catch { errors.push(label + ': อ่านข้อมูลไม่ได้ กรุณาลองโหลดใหม่'); return null; }
  }
  const day = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const start = Date.parse(day + 'T00:00:00+07:00');
  const monitor = read('บทสนทนา', () => s.monitor.readSnapshot(now));
  if (monitor?.storageError) errors.push('บทสนทนา: บันทึกลงดิสก์ไม่สำเร็จ ข้อมูลอาจไม่ครบหลังรีสตาร์ต');
  const registry = read('ทะเบียนลูกค้า', s.customers && (() => s.customers!.snapshot({ events: [], requests: [] }, false)));
  const work = read('งานรอดูแล', () => s.work.readSnapshot(now));
  const control = read('รอเจ้าหน้าที่', s.conversations && (() => s.conversations!.control.snapshot()));
  if (control?.storageError) errors.push('รอเจ้าหน้าที่: ที่เก็บสถานะมีข้อผิดพลาด');
  const pending = read('ผู้ทักใหม่', s.pending && (() => s.pending!.store.list().filter(r => r.account === s.pending!.account && !s.pending!.allowedUsers.has(r.userId))));
  const campaigns = read('ส่งข่าว', s.news && (() => s.news!.store.list()));
  const customerNames = new Map(registry?.customers.map(c => [c.id, c]));
  const name = (id: string) => {
    const c = customerNames.get(id);
    return c ? c.profile.nickname || c.profile.fullName || c.displayName || 'ผู้ติดต่อที่ยังไม่มีชื่อ' : 'ผู้ติดต่อที่ยังไม่มีชื่อ';
  };
  const inbound = monitor?.events.filter(e => e.direction === 'in' && Date.parse(e.at) <= now) ?? [];
  const today = inbound.filter(e => Date.parse(e.at) >= start);
  const key = (e: typeof inbound[number]) => JSON.stringify([e.account, e.userId]);
  const latest = new Map<string, typeof inbound[number]>();
  for (const e of inbound) if (!latest.has(key(e)) || Date.parse(latest.get(key(e))!.at) < Date.parse(e.at)) latest.set(key(e), e);
  const contacts = [...latest.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8).map(e => {
    const id = customerId({ channel: 'line', scope: e.account + ':direct', user: e.userId });
    const mode = control?.modes[key(e)];
    return { name: name(id), account: e.account, userId: e.userId, at: e.at, todayMessages: today.filter(t => key(t) === key(e)).length,
      status: !control || control.storageError ? 'unknown' : mode?.human ? 'human' : mode?.waiting ? 'waiting' : 'bot' };
  });
  const latestNews = campaigns?.filter(c => c.deliveries.length > 0).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const news = latestNews ? { title: latestNews.title, at: new Date(latestNews.updatedAt).toISOString(), status: latestNews.status,
    total: latestNews.deliveries.length, counts: Object.fromEntries(['pending', 'inflight', 'accepted', 'failed', 'ambiguous', 'cancelled'].map(status => [status, latestNews.deliveries.filter(d => d.status === status).length])) } : null;
  const activities: { at: string; label: string; tab: string }[] = [];
  for (const c of contacts) activities.push({ at: c.at, label: c.name + ' · รับข้อความเข้า', tab: 'monitor' });
  for (const r of work ?? []) {
    activities.push({ at: r.createdAt, label: 'รับ' + (r.kind === 'booking' ? 'คำขอจอง' : 'ฝากเรื่อง') + ' · ' + name(r.customerId), tab: 'requests' });
    for (const e of r.work.timeline.slice(-10)) activities.push({ at: e.at, label: ({ claim: 'รับงาน', assign: 'มอบหมายงาน', status: 'เปลี่ยนสถานะงาน', note: 'เพิ่มบันทึกภายในงาน' }[e.action] || 'ปรับปรุงงาน') + ' · ' + name(r.customerId), tab: 'requests' });
  }
  for (const c of campaigns ?? []) activities.push({ at: new Date(c.updatedAt).toISOString(), label: 'ปรับปรุงข่าว · ' + c.title, tab: 'news' });
  return { generatedAt: new Date(now).toISOString(), timeZone: 'Asia/Bangkok', day, periodStart: new Date(start).toISOString(), errors,
    retentionDays: monitor?.retentionDays ?? null, registryCount: registry?.customers.length ?? null,
    today: monitor ? { people: new Set(today.map(key)).size, messages: today.length } : null,
    work: work ? { new: work.filter(r => r.work.status === 'new').length, inProgress: work.filter(r => r.work.status === 'in_progress').length } : null,
    waiting: control && !control.storageError ? Object.values(control.modes).filter(m => !!m.waiting).length : null,
    pending: pending?.length ?? null, contacts: monitor ? contacts : null, news, newsAvailable: campaigns !== null,
    activities: activities.filter(e => Date.parse(e.at) <= now).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 10) };
}
export function overviewHandler(sources: OverviewSources) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }).end(JSON.stringify(data));
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
      || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) { reply(403, { error: 'อนุญาตเฉพาะเว็บบนเครื่องนี้' }); return; }
    if (req.method !== 'GET') { reply(405, { error: 'ภาพรวมรองรับการอ่านเท่านั้น' }); return; }
    try { reply(200, overviewSnapshot(sources)); } catch { reply(503, { error: 'โหลดภาพรวมไม่ได้ กรุณาลองใหม่' }); }
  };
}
