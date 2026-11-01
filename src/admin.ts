import { currentBuildInfo } from './program-version.js';
import { systemStatusHandler, type SystemStatusService } from './system-status.js';
import { systemStatusScript, systemStatusBody } from './system-status-admin.js';
import { hasPermission, visibleSettings, type StaffPrincipal } from './staff-policy.js';
import { staffStyle, staffAccountBody, staffBrowserScript, settingsWorkspace } from './staff-admin.js';
import { responseSettingsBody } from './response-settings-admin.js';
import type { StaffAuth } from './staff-auth.js';
import { browseHandler } from './browse.js';
import { legacyAdminRequest } from './cloud-routing.js';
import { paginationStyle, paginationScript } from './pagination-browser.js';
import { overviewHandler } from './overview.js';
import { overviewBody, overviewStyle, overviewScript } from './overview-admin.js';
import { RequestWorkStore } from './request-work.js';
import { join } from 'node:path';
import { responseSettingsHandler } from './response-settings-api.js';
import type { ResponseSettingsService } from './response-settings-service.js';
import { botManagementBody, botManagementStyle, botSettingsScript, adminNavigationScript } from './bot-admin.js';
import { knowledgeStyle, knowledgeBody, knowledgeScript } from './knowledge-admin.js';
import { knowledgeHandler } from './knowledge-api.js';
import type { KnowledgeStore } from './knowledge-store.js';
import { newsStyle, newsBody, newsScript } from './news-admin.js';
import { newsHandler } from './news-api.js';
import type { NewsService } from './news.js';
import { conversationStyle, conversationBody, conversationScript } from './conversations-admin.js';
import { conversationsHandler, type ConversationService } from './conversations-api.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { monitorHandler, monitorPage, type ConversationMonitor } from './monitor.js';
import { requestsAdminHandler, requestsPage } from './requests-admin.js';
import type { CourseRequestStore } from './course-requests.js';
import { randomBytes } from 'node:crypto';
import type { CustomerStore } from './customers.js';
import type { LineProfiles } from './line-profile.js';
import { customerStyle, customerBody, customerScript, customersHandler } from './customers-admin.js';
import { lineGroupsHandler, type LineGroupService } from './line-groups.js';
import { lineGroupsStyle, lineGroupsBody, lineGroupsScript } from './line-groups-admin.js';
import { pendingUsersHandler, pendingUsersStyle, pendingUsersBody, pendingUsersScript, type PendingUserService } from './line-pending-admin.js';

// Reuse the existing panels and their same-origin APIs without frames or extra ports.
export function adminPage(token = '', staff?: { principal: StaffPrincipal; csrf: string }, serverIdentity?: {name:string;environment:string}) {
  const escapeServer = (text:string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const build = currentBuildInfo();
  const buildLabel = build ? build.code.slice(0,12) : 'ไม่ระบุ';
  const versionDetails = '<section id="program-version-details"><h3>เวอร์ชันโปรแกรมที่กำลังรัน</h3><p>รุ่นโค้ด: '+escapeServer(build?.code || 'ไม่ระบุ (ยังไม่มีข้อมูล build)')+'</p>'+(build ? '<p>สร้างเมื่อ: '+escapeServer(new Date(build.builtAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))+' (เวลาไทย)</p>' : '')+'</section>';
  const serverBadge = serverIdentity ? '<p id="server-identity">เซิร์ฟเวอร์: '+escapeServer(serverIdentity.name)+' · สภาพแวดล้อม: '+escapeServer(serverIdentity.environment)+' · รุ่นโค้ด: '+buildLabel+'</p>' : '<p id="server-identity">รุ่นโค้ด: '+buildLabel+'</p>';
  const can = (permission: Parameters<typeof hasPermission>[1]) => !staff || hasPermission(staff.principal, permission);
  const showNews = can('news.draft') || can('news.send');
  const showSettings = !staff || visibleSettings(staff.principal).length > 0;
  const showSystem = can('system.inspect');
  const showPending = can('line.approve');
  const roleNewsScript = !staff ? newsScript : newsScript.replace("n.onclick=fn;return n", "n.onclick=fn;" + (!can('news.send') ? "if(/^ยืนยันส่ง|^ยกเลิก/.test(text))n.hidden=true;" : "") + (!can('news.draft') ? "if(/ทำสำเนา|บันทึก|ตรวจ|อัปโหลด|ลบรูป|แนบรูป/.test(text))n.hidden=true;" : "") + "return n").replace("const editable=['draft','reviewed'].includes(c.status)", "const editable=" + String(can('news.draft')) + "&&['draft','reviewed'].includes(c.status)");
  const management = staff ? settingsWorkspace(staff.principal, responseSettingsBody, knowledgeBody, systemStatusBody + versionDetails) : botManagementBody(knowledgeBody);
  const statusScript = !showSystem ? '' : staff ? systemStatusScript.replace("document.getElementById('overview-panel').hidden", "document.getElementById('bot-management-panel').hidden||document.getElementById('settings-system').hidden") : systemStatusScript;
  const parts = (html: string) => ({
    style: html.match(/<style>([\s\S]*?)<\/style>/)![1],
    body: html.split('</style>')[1].split('<script>')[0].replace(/<header>[\s\S]*?<\/header>/, ''),
    script: html.match(/<script>([\s\S]*?)<\/script>/)![1],
  });
  const monitor = parts(monitorPage), requests = parts(requestsPage);
  const requestStyle = requests.style.replace(/([^{}]+)\{/g, (_match, selectors: string) =>
    selectors.split(',').map(s => '#requests-panel ' + s.trim()).join(',') + '{');
  const requestBody = requests.body.replace(/id="([^"]+)"/g, 'id="requests-$1"');
  const requestScript = requests.script.replace('document.getElementById(id)', "document.getElementById('requests-'+id)");
  // Add navigation inside the existing customer closure without changing its owned module.
  const navigableCustomerScript = customerScript.replace('refresh();setInterval(', String.raw`window.addEventListener('admin-open-customer',async e=>{selected=e.detail.id;view='profile';try{await fetchState();render()}catch(error){$('state').textContent=error.message}});refresh();setInterval(`);
  const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CBot · Care Center</title>
<style>${paginationStyle}${monitor.style}\n${requestStyle}
[hidden]{display:none!important}.admin-tabs{display:flex;gap:8px;padding:16px 5%;background:#142e47;border-bottom:1px solid #dde5ed;overflow:auto}.admin-tabs button{width:auto;margin:0;font:inherit;padding:12px 20px;white-space:nowrap}.admin-tabs button[aria-selected=true]{background:#d9f7f2;border-color:#168779;color:#116c5e;font-weight:700}.admin-tabs button:focus-visible{outline:3px solid #168779;outline-offset:2px}.admin-tabs button:disabled{opacity:.5;cursor:default}#requests-panel main{display:block}#requests-panel article{white-space:normal}#requests-panel h2{margin:0 0 12px}${customerStyle}${pendingUsersStyle}${conversationStyle}${lineGroupsStyle}${newsStyle}${knowledgeStyle}${botManagementStyle}${overviewStyle}${staffStyle}${staff && !can("knowledge.publish") ? "#km-confirm-area,[data-knowledge-restore]{display:none!important}" : ""}
.admin-navigation{display:flex;align-items:stretch;gap:8px;padding:16px 5%;background:#142e47;border-bottom:1px solid #dde5ed;overflow-x:auto}.admin-navigation .admin-tabs{padding:0;flex-shrink:0;overflow:visible;border:0;background:transparent}.admin-navigation .admin-km-nav{display:flex;flex:0 0 auto;padding:0;background:transparent}.admin-navigation .admin-km-nav button{padding:12px 20px;white-space:nowrap}.admin-navigation .admin-km-nav button:focus-visible{outline:3px solid #168779;outline-offset:2px}
</style><header><h1>CBot · Care Center</h1>${serverBadge}</header>${staff ? staffAccountBody(staff.principal) : ""}
<div class="admin-navigation"><nav class="admin-tabs" role="tablist" aria-label="ส่วนงาน"><button id="tab-overview" type="button" role="tab" aria-selected="false" aria-controls="overview-panel" tabindex="-1">ภาพรวม</button><button id="tab-monitor" type="button" role="tab" aria-selected="true" aria-controls="monitor-panel">บทสนทนา</button><button id="tab-customers" type="button" role="tab" aria-selected="false" aria-controls="customers-panel" tabindex="-1">ลูกค้าและกลุ่ม</button><button id="tab-requests" type="button" role="tab" aria-selected="false" aria-controls="requests-panel" tabindex="-1">งานรอดูแล</button><button id="tab-news" ${showNews ? "" : "hidden"} type="button" role="tab" aria-selected="false" aria-controls="news-panel" tabindex="-1">ส่งข่าว</button></nav><nav class="admin-km-nav" aria-label="จัดการข้อมูลบอต"><button id="tab-knowledge" ${showSettings ? "" : "hidden"} type="button" aria-selected="false" aria-controls="bot-management-panel">${staff ? "ตั้งค่า" : "จัดการบอต"}</button></nav></div>
<div id="overview-panel" role="tabpanel" aria-labelledby="tab-overview" hidden>${staff ? overviewBody.replace(systemStatusBody, showSystem ? '<p><a href="#settings-system">ดูสถานะระบบและการเชื่อมต่อ →</a></p>' : "") : overviewBody}</div><div id="monitor-panel" role="tabpanel" aria-labelledby="tab-monitor">${conversationBody}</div><div id="customers-panel" role="tabpanel" aria-labelledby="tab-customers" hidden>${customerBody}<div id="customers-rooms-content" hidden>${lineGroupsBody}</div>${showPending ? pendingUsersBody : ""}</div><div id="requests-panel" role="tabpanel" aria-labelledby="tab-requests" hidden>${requestBody}</div><div id="news-panel" role="tabpanel" aria-labelledby="tab-news" hidden>${showNews ? (staff && !can("news.draft") ? newsBody.replace('id="news-new"', 'id="news-new" hidden') : newsBody) : ""}</div>
${management}
<script>${paginationScript}${staff ? staffBrowserScript(staff.principal,staff.csrf) : ""}(()=>{${requestScript}})();const CUSTOMER_CSRF_TOKEN=${JSON.stringify(token)};${navigableCustomerScript}\n${showPending ? pendingUsersScript : ""}\n${conversationScript}\n${lineGroupsScript}\n${showNews ? roleNewsScript : ""}\n${can("knowledge.draft") ? knowledgeScript : ""}\n${can("ai.manage") ? botSettingsScript() : ""}\n${adminNavigationScript}\n${overviewScript}\n${statusScript}</script></html>`;
  return staff ? html.replaceAll("ยังไม่มีระบบเข้าสู่ระบบ", "ใช้บัญชี Google ที่ยืนยันแล้ว").replaceAll("ยังไม่มี login", "ยืนยันบัญชีแล้ว").replaceAll("ผู้ใช้บนเครื่องนี้", "บัญชีเจ้าหน้าที่").replaceAll("ยังไม่มีการแยกสิทธิ์ทีม", "แยกสิทธิ์ตามบทบาท") : html;
}

export function adminHandler(monitor: ConversationMonitor, requests: CourseRequestStore, customers?: CustomerStore, profiles?: LineProfiles, conversations?: ConversationService, news?: NewsService, knowledge?: KnowledgeStore, responseSettings?: ResponseSettingsService, lineGroups?: LineGroupService, pendingUsers?: PendingUserService, systemStatus?: SystemStatusService, staffAuth?: StaffAuth) {
  const token = randomBytes(32).toString('hex');
  const statusRoutes = systemStatusHandler(systemStatus, token);
  const monitorRoutes = monitorHandler(monitor, adminPage(token, undefined, lineGroups?.serverIdentity));
  const work = new RequestWorkStore(join(requests.root, '..', 'request-work'), requests);
  const requestRoutes = requestsAdminHandler(requests, token, work);
  const overviewRoutes = overviewHandler({ monitor, work, customers, conversations, news, pending: pendingUsers });
  const customerRoutes = customers ? customersHandler(customers, monitor, requests, token, profiles) : undefined;
  const conversationRoutes = customers ? conversationsHandler(customers, monitor, requests, token, conversations) : undefined;
  const responseSettingsRoutes = responseSettings ? responseSettingsHandler(responseSettings, token) : undefined;
  const knowledgeRoutes = knowledge ? knowledgeHandler(knowledge, token) : undefined;
  const roomRoutes = lineGroups ? lineGroupsHandler(lineGroups, token) : undefined;
  const pendingRoutes = pendingUsers ? pendingUsersHandler(pendingUsers, token) : undefined;
  const newsRoutes = news ? newsHandler(news, token) : undefined;
  const browseRoutes = browseHandler({ profiles,monitor,customers,requests,work,conversations,news,rooms:lineGroups,pending:pendingUsers,staff:staffAuth?.store,knowledge });
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    if (req.url?.startsWith('/api/browse/')) return browseRoutes(req,res);
    if (req.url === '/api/system-status' || req.url === '/api/system-status/check') { void statusRoutes(req, res); return; }
    if (req.url === '/api/overview') return overviewRoutes(req, res);
    if (req.url === '/api/line-pending-users') {
      if (pendingRoutes) { void pendingRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: 'ยังไม่ได้เชื่อมรายการผู้ทักใหม่' })); return;
    }
    if (req.url === '/api/line-groups') {
      if (roomRoutes) { void roomRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({error:'ยังไม่ได้เชื่อมห้อง LINE'})); return;
    }
    if (req.url === '/api/response-settings') {
      if (responseSettingsRoutes) { void responseSettingsRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({error:'ยังไม่ได้เชื่อมบริการตั้งค่าการตอบ'})); return;
    }
    if (req.url === '/api/knowledge') {
      if (knowledgeRoutes) { void knowledgeRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({error:'ยังไม่ได้เชื่อมโมดูลความรู้'})); return;
    }
    if (req.url === '/api/news' || req.url?.startsWith('/api/news/image/')) {
      if (newsRoutes) { void newsRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"error":"ยังไม่ได้เชื่อมโมดูลส่งข่าว"}'); return;
    }
    if (req.url === '/api/conversations' && conversationRoutes) { void conversationRoutes(req, res); return; }
    if (req.url === '/api/customers') {
      if (customerRoutes) { void customerRoutes(req, res); return; }
      res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"ยังไม่ได้เปิดทะเบียนลูกค้า"}'); return;
    }
    if (req.url === '/api/requests') return requestRoutes(req, res);
    return monitorRoutes(req, res);
  };
  return staffAuth ? staffAuth.wrap((req, res) => handler(legacyAdminRequest(req), res), (principal, csrf) => adminPage(token, { principal, csrf }, lineGroups?.serverIdentity)) : handler;
}
