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

// Reuse the existing panels and their same-origin APIs without frames or extra ports.
export function adminPage(token = '') {
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
  return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ซีบอต · ศูนย์ดูแล</title>
<style>${monitor.style}\n${requestStyle}
[hidden]{display:none!important}.admin-tabs{display:flex;gap:8px;padding:16px 5%;background:#142e47;border-bottom:1px solid #dde5ed;overflow:auto}.admin-tabs button{width:auto;margin:0;font:inherit;padding:12px 20px;white-space:nowrap}.admin-tabs button[aria-selected=true]{background:#d9f7f2;border-color:#168779;color:#116c5e;font-weight:700}.admin-tabs button:focus-visible{outline:3px solid #168779;outline-offset:2px}.admin-tabs button:disabled{opacity:.5;cursor:default}#requests-panel main{display:block}#requests-panel article{white-space:normal}#requests-panel h2{margin:0 0 12px}${customerStyle}${conversationStyle}${lineGroupsStyle}${newsStyle}${knowledgeStyle}${botManagementStyle}
.admin-navigation{display:flex;align-items:stretch;gap:8px;padding:16px 5%;background:#142e47;border-bottom:1px solid #dde5ed;overflow-x:auto}.admin-navigation .admin-tabs{padding:0;flex-shrink:0;overflow:visible;border:0;background:transparent}.admin-navigation .admin-km-nav{display:flex;flex:0 0 auto;padding:0;background:transparent}.admin-navigation .admin-km-nav button{padding:12px 20px;white-space:nowrap}.admin-navigation .admin-km-nav button:focus-visible{outline:3px solid #168779;outline-offset:2px}
</style><header><h1>ซีบอต · ศูนย์ดูแล</h1><p>เว็บดูแลบนเครื่องนี้ · บทสนทนา คำขอ และทะเบียนลูกค้า</p></header>
<div class="admin-navigation"><nav class="admin-tabs" role="tablist" aria-label="ส่วนงาน"><button type="button" role="tab" aria-selected="false" disabled title="ยังไม่พัฒนา">ภาพรวม</button><button id="tab-monitor" type="button" role="tab" aria-selected="true" aria-controls="monitor-panel">บทสนทนา</button><button id="tab-customers" type="button" role="tab" aria-selected="false" aria-controls="customers-panel" tabindex="-1">ลูกค้าและกลุ่ม</button><button id="tab-requests" type="button" role="tab" aria-selected="false" aria-controls="requests-panel" tabindex="-1">งานรอดูแล</button><button id="tab-news" type="button" role="tab" aria-selected="false" aria-controls="news-panel" tabindex="-1">ส่งข่าว</button></nav><nav class="admin-km-nav" aria-label="จัดการข้อมูลบอต"><button id="tab-knowledge" type="button" aria-selected="false" aria-controls="bot-management-panel">จัดการบอต</button></nav></div>
<div id="monitor-panel" role="tabpanel" aria-labelledby="tab-monitor">${lineGroupsBody}${conversationBody}</div><div id="customers-panel" role="tabpanel" aria-labelledby="tab-customers" hidden>${customerBody}</div><div id="requests-panel" role="tabpanel" aria-labelledby="tab-requests" hidden>${requestBody}</div><div id="news-panel" role="tabpanel" aria-labelledby="tab-news" hidden>${newsBody}</div>
${botManagementBody(knowledgeBody)}
<script>(()=>{${requestScript}})();const CUSTOMER_CSRF_TOKEN=${JSON.stringify(token)};${navigableCustomerScript}\n${conversationScript}\n${lineGroupsScript}\n${newsScript}\n${knowledgeScript}\n${botSettingsScript()}\n${adminNavigationScript}</script></html>`;
}

export function adminHandler(monitor: ConversationMonitor, requests: CourseRequestStore, customers?: CustomerStore, profiles?: LineProfiles, conversations?: ConversationService, news?: NewsService, knowledge?: KnowledgeStore, responseSettings?: ResponseSettingsService, lineGroups?: LineGroupService) {
  const token = randomBytes(32).toString('hex');
  const monitorRoutes = monitorHandler(monitor, adminPage(token));
  const requestRoutes = requestsAdminHandler(requests, token);
  const customerRoutes = customers ? customersHandler(customers, monitor, requests, token, profiles) : undefined;
  const conversationRoutes = customers ? conversationsHandler(customers, monitor, requests, token, conversations) : undefined;
  const responseSettingsRoutes = responseSettings ? responseSettingsHandler(responseSettings, token) : undefined;
  const knowledgeRoutes = knowledge ? knowledgeHandler(knowledge, token) : undefined;
  const roomRoutes = lineGroups ? lineGroupsHandler(lineGroups, token) : undefined;
  const newsRoutes = news ? newsHandler(news, token) : undefined;
  return (req: IncomingMessage, res: ServerResponse) => {
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
}
