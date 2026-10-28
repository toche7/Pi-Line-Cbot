import { staffMessage } from './staff-message.js';
import { handoverTranscript, type HandoverTranscript } from './handover-context.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CustomerError, type CustomerStore } from './customers.js';
import type { ConversationMonitor } from './monitor.js';
import type { CourseRequestStore } from './course-requests.js';
import { conversationKey, type ConversationControl } from './conversation-control.js';
export type ConversationService = { control: ConversationControl; account: string; allowedUsers: Set<string>; dryRun: boolean;
  resume?: (user: string, source: () => HandoverTranscript) => Promise<void>;
  push: (user: string, id: string, text: string) => Promise<void> };
export function conversationsHandler(customers: CustomerStore, monitor: ConversationMonitor, requests: CourseRequestStore, token: string, service?: ConversationService) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const respond = (status: number, body: object) => res.writeHead(status, headers).end(JSON.stringify(body));
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(String(req.headers['sec-fetch-site'])))) { respond(403, { error: 'ไม่อนุญาตคำขอข้ามเว็บ' }); return; }
    try {
      if (!['GET','POST'].includes(req.method || '')) { respond(405, { error: 'ไม่รองรับวิธีนี้' }); return; }
      if (req.method === 'POST' && (req.headers.origin !== `http://${req.headers.host}` || req.headers['x-customer-token'] !== token || req.headers['content-type'] !== 'application/json')) {
        respond(403, { error: 'สิทธิ์บนเครื่องหรือ token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่' }); return;
      }
      const events = monitor.snapshot().events, jobs = requests.list(undefined, true);
      const registry = customers.snapshot({ events, requests: jobs });
      if (req.method === 'GET') {
        respond(200, { ...registry, events, requests: jobs, control: service?.control.snapshot() ?? null,
          sendEnabled: !!service && !service.dryRun, account: service?.account ?? '', allowedUsers: service ? [...service.allowedUsers] : [] }); return;
      }
      if (!service) throw new CustomerError(503, 'ยังไม่ได้เชื่อมระบบรับช่วงคุย');
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 24000) throw new CustomerError(413, 'คำขอใหญ่เกินกำหนด'); }
      let input: any; try { input = JSON.parse(raw); } catch { throw new CustomerError(400, 'รูปแบบ JSON ไม่ถูกต้อง'); }
      const c = registry.customers.find(c => c.id === input?.customerId);
      if (!c || c.identity.channel !== 'line' || c.identity.scope !== service.account + ':direct' || !service.allowedUsers.has(c.identity.user)) throw new CustomerError(403, 'อนุญาตเฉพาะลูกค้า LINE ใน OA และ allowlist นี้');
      const key = conversationKey(service.account, c.identity.user);
      if (!Number.isSafeInteger(input.epoch)) throw new CustomerError(400, 'สถานะไม่ถูกต้อง');
      if (input.action === 'take' || input.action === 'release') {
        const mode = input.action === 'take' ? service.control.change(key, true, input.epoch)
          : await service.control.release(key, input.epoch, async () => {
            if (!service.resume) throw new CustomerError(503, 'ยังไม่ได้เชื่อมบริบทก่อนคืนให้บอต ยังคงผู้ดูแลรับช่วงไว้');
            await service.resume(c.identity.user, () => {
              const mode = service.control.mode(key);
              return handoverTranscript(service.account, c.identity.user, mode.epoch, mode.startedAt ?? mode.at,
                monitor.snapshot().events, service.control.snapshot().deliveries);
            });
          });
        respond(200, { mode }); return;
      }
      if (input.action !== 'send' || input.confirmed !== true) throw new CustomerError(400, 'กรุณาตรวจข้อความและยืนยันก่อนส่ง');
      if (service.dryRun) throw new CustomerError(403, 'ระบบอยู่ใน dry run จึงไม่ส่ง LINE');
      // Conservative eligibility: direct inbound message in the last seven days.
      if (!events.some(e => e.account === service.account && e.userId === c.identity.user && e.direction === 'in'
        && Date.now() - Date.parse(e.at) >= 0 && Date.now() - Date.parse(e.at) < 7 * 86400000)) throw new CustomerError(403, 'ไม่มีข้อความรับเข้าภายใน 7 วัน จึงยังไม่ส่งรายคน');
      const delivery = await service.control.send(key, input.epoch, input.id, staffMessage(input.text), (id, text) => service.push(c.identity.user, id, text));
      respond(200, { delivery });
    } catch (e) { respond(e instanceof CustomerError ? e.status : 503, { error: e instanceof CustomerError ? e.message : 'โหลดหรือบันทึกบทสนทนาไม่ได้ กรุณาตรวจข้อมูล' }); }
  };
}
