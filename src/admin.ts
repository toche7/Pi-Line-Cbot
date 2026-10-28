import type { IncomingMessage, ServerResponse } from 'node:http';
import { monitorHandler, monitorPage, type ConversationMonitor } from './monitor.js';
import { requestsAdminHandler, requestsPage } from './requests-admin.js';
import type { CourseRequestStore } from './course-requests.js';

// Reuse the existing panels and their same-origin APIs without frames or extra ports.
export function adminPage() {
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
  return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ซีบอต · ศูนย์ดูแล</title>
<style>${monitor.style}\n${requestStyle}
[hidden]{display:none!important}.admin-tabs{display:flex;gap:8px;padding:16px 5%;background:white;border-bottom:1px solid #dde5ed}.admin-tabs button{width:auto;margin:0;font:inherit;padding:12px 20px}.admin-tabs button[aria-selected=true]{background:#e5f4f2;border-color:#168779;color:#116c5e;font-weight:700}.admin-tabs button:focus-visible{outline:3px solid #168779;outline-offset:2px}#requests-panel main{display:block}#requests-panel article{white-space:normal}#requests-panel h2{margin:0 0 12px}
</style><header><h1>ซีบอต · ศูนย์ดูแล</h1><p>ติดตามบทสนทนาและคำขอกลางในหน้าเดียว · อัปเดตทุก 5 วินาที</p></header>
<nav class="admin-tabs" role="tablist" aria-label="ส่วนงาน"><button id="tab-monitor" type="button" role="tab" aria-selected="true" aria-controls="monitor-panel">ติดตามบทสนทนา</button><button id="tab-requests" type="button" role="tab" aria-selected="false" aria-controls="requests-panel" tabindex="-1">คำขอกลาง</button></nav>
<div id="monitor-panel" role="tabpanel" aria-labelledby="tab-monitor">${monitor.body}</div><div id="requests-panel" role="tabpanel" aria-labelledby="tab-requests" hidden>${requestBody}</div>
<script>(()=>{${monitor.script}})();(()=>{${requestScript}})();(()=>{const tabs=['monitor','requests'];function select(name){for(const t of tabs){const active=t===name,b=document.getElementById('tab-'+t);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.getElementById(t+'-panel').hidden=!active}}function fromHash(){select(location.hash==='#requests'?'requests':'monitor')}for(const t of tabs){const b=document.getElementById('tab-'+t);b.onclick=()=>{location.hash=t;select(t)};b.onkeydown=e=>{let target;if(e.key==='ArrowLeft'||e.key==='ArrowRight')target=tabs.find(v=>v!==t);if(e.key==='Home')target=tabs[0];if(e.key==='End')target=tabs[1];if(target){e.preventDefault();location.hash=target;select(target);document.getElementById('tab-'+target).focus()}}}window.addEventListener('hashchange',fromHash);fromHash()})();</script></html>`;
}

export function adminHandler(monitor: ConversationMonitor, requests: CourseRequestStore) {
  const monitorRoutes = monitorHandler(monitor, adminPage());
  const requestRoutes = requestsAdminHandler(requests);
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/api/requests') return requestRoutes(req, res);
    return monitorRoutes(req, res);
  };
}
