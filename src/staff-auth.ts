import { adminFavicon } from './admin-brand.js';
import { IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { createHmac, randomBytes } from 'node:crypto';
import { GoogleStaffLogin, googleIdentityClient, type GoogleLoginConfig, type GoogleIdentityClient, GoogleLoginError } from './google-login.js';
import { StaffStore, StaffError } from './staff-store.js';
import { hasPermission, type Permission, type StaffPrincipal } from './staff-policy.js';
import { runAsStaff } from './staff-context.js';
import { pageQuery } from './pagination.js';
export type AdminRequestHandler = (req: IncomingMessage, res: ServerResponse) => unknown;
const cookie = (req: IncomingMessage, key: string) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(key + '='))?.slice(key.length + 1) || '';
const send = (res: ServerResponse, status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(data));
const loginPage = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>เข้าสู่ระบบ · AI-Powered LINE Support System</title>${adminFavicon}<style>body{font:17px system-ui;background:#eef4f8;color:#163249;margin:0;padding:12vh 6%}main{max-width:480px;margin:auto;padding:32px;background:white;border:1px solid #dce6ef;border-radius:16px}a{display:inline-block;background:#176e65;color:white;padding:12px 20px;border-radius:8px;text-decoration:none}</style><main><h1>AI-Powered LINE Support System</h1><h2>เข้าสู่ระบบเจ้าหน้าที่</h2><p>ใช้บัญชี Google ที่ผู้ดูแลระบบอนุมัติไว้ บัญชีลูกค้า LINE ไม่ใช่บัญชีเจ้าหน้าที่</p><a href="/auth/google/start">เข้าสู่ระบบด้วย Google</a></main></html>`;
export function routePermission(path: string, method: string, action?: unknown): Permission | undefined {
  if(path.startsWith('/api/browse/')){
    if(method!=='GET')return;
    const aliases:Record<string,string>={customers:'/api/customers',conversations:'/api/conversations',requests:'/api/requests',news:'/api/news','news-deliveries':'/api/news','news-recipients':'/api/news','news-history':'/api/news',rooms:'/api/line-groups','room-profiles':'/api/line-groups',pending:'/api/line-pending-users',grants:'/api/line-pending-users',staff:'/api/staff','staff-history':'/api/staff',membership:'/api/customers',options:'/api/customers'};
    const resource=path.slice('/api/browse/'.length);
    if(['knowledge','knowledge-changes','knowledge-history','knowledge-versions','knowledge-version'].includes(resource))return 'knowledge.draft';
    const alias=aliases[resource];return alias?routePermission(alias,'GET'):undefined;
  }
  if (path === '/api/staff') return 'staff.manage';
  if (path === '/api/bot-profile') return method === 'POST' ? 'bot.manage' : undefined;
  if (path === '/api/bot-line') return 'line.connection.manage';
  if (path === '/api/response-settings') return 'ai.manage';
  if (path === '/api/system-status' || path === '/api/system-status/check') return 'system.inspect';
  if (path === '/api/line-pending-users') return 'line.approve';
  if (path === '/api/knowledge') return method === 'GET' || ['save','retire','remove','review','try'].includes(String(action)) ? 'knowledge.draft'
    : ['publish','restore'].includes(String(action)) ? 'knowledge.publish' : undefined;
  if (path === '/api/news' || /^\/api\/news\/image\/[a-f0-9]{64}$/.test(path)) {
    if (method === 'GET') return 'news.draft';
    if (['confirm', 'cancel'].includes(String(action))) return 'news.send';
    if (['create', 'save', 'duplicate', 'review', 'image.upload'].includes(String(action))) return 'news.draft';
    return;
  }
  if (path === '/api/conversations') return method === 'GET' ? 'work.read' : ['take','release','send'].includes(String(action)) ? 'conversation.takeover' : undefined;
  if (['/api/overview','/api/monitor'].includes(path)) return method === 'GET' ? 'work.read' : undefined;
  if (path === '/api/line-groups' && method === 'POST' && ['set-reply-mode', 'save-profile'].includes(String(action))) return 'room.manage';
  if (path === '/api/line-groups' && method === 'POST' && action === 'send-staff') return 'conversation.takeover';
  if (['/api/customers','/api/requests','/api/line-groups'].includes(path)) return method === 'GET' ? 'work.read' : 'work.write';
}
export class StaffAuth {
  readonly login: GoogleStaffLogin;
  private signing = randomBytes(32);
  private origin: string;
  constructor(readonly store: StaffStore, config: GoogleLoginConfig, client: GoogleIdentityClient = googleIdentityClient(config)) {
    this.origin = new URL(config.redirectUri).origin;
    this.login = new GoogleStaffLogin(client, (subject, email) => store.identity(subject, email));
  }
  csrf(session: string) { return createHmac('sha256', this.signing).update(session).digest('base64url'); }
  wrap(next: AdminRequestHandler, page: (principal: StaffPrincipal, csrf: string) => string): AdminRequestHandler {
    return (req, res) => { void this.handle(req, res, next, page).catch(() => { if (!res.headersSent) send(res, 503, { error: 'ระบบบัญชีไม่พร้อม กรุณาลองใหม่' }); else res.end(); }); };
  }
  private async handle(req: IncomingMessage, res: ServerResponse, next: AdminRequestHandler, page: (principal: StaffPrincipal, csrf: string) => string) {
    const host = new URL(this.origin).host;
    const secure = this.origin.startsWith('https://');
    if ((!secure && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) || req.headers.host !== host) return send(res, 403, { error: 'Host ของเว็บหลังบ้านไม่ถูกต้อง' });
    let url: URL; try { url = new URL(req.url || '/', this.origin); } catch { return send(res, 400, { error: 'URL ไม่ถูกต้อง' }); }
    if (url.origin !== this.origin) return send(res, 403, { error: 'Origin ไม่ถูกต้อง' });
    const path = url.pathname;
    const session = cookie(req, 'cbot_staff_session');
    const setCookie = (key: string, value: string, maxAge: number) => `${key}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
    if (path === '/auth/google/callback' && req.method === 'GET') {
      try {
        const result = await this.login.finish(cookie(req, 'cbot_staff_flow'), url.searchParams.get('state') || '', url.searchParams.get('code') || '');
        res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Set-Cookie': [setCookie('cbot_staff_session', result.session, 8 * 3600), setCookie('cbot_staff_flow','',0)] }).end(); return;
      } catch (e) { res.setHeader('Set-Cookie', setCookie('cbot_staff_flow','',0)); return send(res, e instanceof GoogleLoginError ? e.status : 503, { error: e instanceof GoogleLoginError ? e.message : 'ยืนยันบัญชีไม่สำเร็จ กรุณาเปิดหน้าแรกและลองใหม่' }); }
    }
    // Google -> callback -> home is still a cross-site navigation in browser
    // Fetch Metadata. Allow only the read-only top-level home document, never
    // API requests, frames, subresources, or state-changing requests.
    const homeNavigation = path === '/' && !url.search && req.method === 'GET'
      && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
    if (req.headers.origin && req.headers.origin !== this.origin || !homeNavigation && req.headers['sec-fetch-site'] && !['same-origin','none'].includes(String(req.headers['sec-fetch-site']))) return send(res, 403, { error: 'คำขอข้ามเว็บไซต์ถูกปฏิเสธ' });
    if (path === '/auth/google/start' && req.method === 'GET') {
      const flow = this.login.begin();
      res.writeHead(303, { Location: flow.url, 'Cache-Control': 'no-store', 'Set-Cookie': setCookie('cbot_staff_flow',flow.browser,300) }).end(); return;
    }
    let principal = this.login.current(session);
    if (!principal) {
      if (path === '/' && req.method === 'GET' && !url.search) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' }).end(loginPage); return; }
      return send(res, 401, { error: 'กรุณาเข้าสู่ระบบเจ้าหน้าที่' });
    }
    const csrf = this.csrf(session);
    if (req.method !== 'GET' && req.method !== 'HEAD' && (req.method !== 'POST' || req.headers.origin !== this.origin || req.headers['x-staff-token'] !== csrf)) return send(res, 403, { error: 'คำขอไม่ผ่านการตรวจ session กรุณาเปิดหน้าใหม่' });
    if (path === '/auth/logout' && req.method === 'POST') { this.login.logout(session); res.setHeader('Set-Cookie', setCookie('cbot_staff_session','',0)); return send(res, 200, { ok: true }); }
    if (path === '/auth/me' && req.method === 'GET' && !url.search) return send(res,200,{ principal, csrf });
    if (path === '/' && req.method === 'GET' && !url.search) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' }).end(page(principal, csrf)); return; }
    if (url.search && (!path.startsWith('/api/browse/')||req.method!=='GET') || !['GET','POST'].includes(req.method || '')) return send(res, 404, { error: 'ไม่พบเส้นทาง' });
    if(path.startsWith('/api/browse/')){try{pageQuery(req.url||'');}catch{return send(res,400,{error:'ตัวกรองหรือเลขหน้าไม่ถูกต้อง'});}}
    let input: any, replay = req;
    if (req.method === 'POST') {
      if (path !== '/api/system-status/check' && req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(res,415,{error:'ต้องส่ง JSON'});
      let bytes = 0; const chunks: Buffer[] = [];
      for await (const part of req) { const c = Buffer.from(part); bytes += c.length; if (bytes > (path === '/api/news' ? 1220000 : 32768)) return send(res,413,{error:'ข้อมูลเกินกำหนด'}); chunks.push(c); }
      const body = Buffer.concat(chunks);
      try { input = body.length ? JSON.parse(body.toString('utf8')) : {}; } catch { return send(res,400,{error:'JSON ไม่ถูกต้อง'}); }
      // A second IncomingMessage would destroy the shared HTTP socket when its
      // async iterator closes. Replay only the buffered stream, preserving metadata.
      replay = Object.assign(Readable.from([body]), { method: req.method, url: req.url, headers: req.headers,
        httpVersion: req.httpVersion, socket: req.socket }) as unknown as IncomingMessage;
    }
    // Recheck after reading an upload: a different admin may have revoked the
    // account while the request body was in flight.
    principal = this.login.current(session);
    if (!principal) return send(res,401,{error:'session หมดอายุหรือบัญชีถูกปิด กรุณาเข้าสู่ระบบใหม่'});
    const permission = routePermission(path, req.method || '', input?.action);
    const allowed = permission && (hasPermission(principal, permission) || req.method === 'GET' && (path.startsWith('/api/news')||/^\/api\/browse\/news(?:$|-)/.test(path)) && hasPermission(principal,'news.send'));
    if (!allowed) return send(res,403,{error:'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้'});
    if (path === '/api/staff') {
      try { if (req.method === 'POST') {this.store.mutate(principal,input);return send(res,200,{ok:true,revision:this.store.snapshot().revision});} return send(res,200,this.store.snapshot()); }
      catch(e) { return send(res,e instanceof StaffError ? e.status : 503,{error:e instanceof StaffError ? e.message : 'จัดการบัญชีไม่สำเร็จ'}); }
    }
    if (req.method === 'POST') {
      this.store.audit(principal.subject, 'request:' + String(input?.action || 'check'), path);
      res.once('finish', () => { try { this.store.audit(principal.subject, 'result:' + res.statusCode, path); } catch {} });
    }
    return runAsStaff(principal, () => next(replay,res));
  }
}
