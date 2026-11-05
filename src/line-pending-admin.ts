import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PendingLineUsers } from './line-pending-users.js';
import { LineAccessError, type LineAccess } from './line-access.js';

export type PendingUserService = { store: PendingLineUsers; account: string; allowedUsers: Set<string>; access?: LineAccess };
export function pendingUsersHandler(service: PendingUserService, token = '') {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    }).end(JSON.stringify(data));
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
      || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) {
      reply(403, { error: 'อนุญาตเฉพาะเว็บบนเครื่องนี้' }); return;
    }
    try {
      if (req.method === 'GET') {
        const access = service.access?.snapshot();
        const users = service.store.list().filter(r => r.account === service.account && !service.allowedUsers.has(r.userId));
        reply(200, { users, retentionDays: 7, allowedUserCount: service.allowedUsers.size, readOnly: !service.access, revision: access?.revision ?? 0, grants: access?.grants ?? [] }); return;
      }
      if (req.method !== 'POST' || !service.access) { reply(405, { error: 'หน้านี้ยังไม่รองรับคำสั่งนี้' }); return; }
      if (!token || req.headers.origin !== 'http://' + req.headers.host || req.headers['x-customer-token'] !== token
        || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { reply(403, { error: 'คำขอไม่ผ่านการตรวจ กรุณาเปิดหน้าเว็บใหม่' }); return; }
      let raw = ''; for await (const part of req) { raw += part; if (Buffer.byteLength(raw) > 4096) { reply(413, { error: 'ข้อมูลเกินกำหนด' }); return; } }
      let input: any; try { input = JSON.parse(raw); } catch { reply(400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' }); return; }
      if (input?.action !== 'allow' || input.confirmed !== true) { reply(400, { error: 'กรุณาตรวจรหัสและยืนยันเพิ่มสิทธิ์ก่อน' }); return; }
      reply(200, service.access.allow(input.userId, input.revision, service.store));
    } catch (e) { reply(e instanceof LineAccessError ? e.status : 503, { error: e instanceof LineAccessError ? e.message : 'อ่านหรือบันทึกสิทธิ์ไม่ได้ กรุณาโหลดล่าสุดแล้วลองใหม่' }); }
  };
}

export const pendingUsersStyle = `
#pending-line-users{min-width:0;max-width:100%;overflow:hidden;border:1px solid #dce6ef;border-radius:12px;background:white;padding:16px 20px;margin:16px 0;color:#172b42}#pending-line-users summary{font-size:18px;font-weight:700;cursor:pointer}#pending-line-users .pending-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}#pending-line-users .pending-table{overflow:auto;width:100%;max-width:100%}#pending-line-users input{min-width:0}#pending-line-users code{white-space:nowrap}#pending-line-users .pending-time{white-space:nowrap}
`;
export const pendingUsersBody = `
<details id="pending-line-users"><summary>ผู้ทักใหม่ที่ยังไม่ได้รับอนุญาต<span id="pending-line-count"></span></summary><p class="muted">แชตส่วนตัวที่ทักเข้ามาใน 7 วันล่าสุดหลังเปิดตัวจับรหัส · ยังไม่ได้เปิดให้คุย · ไม่เก็บเนื้อหาข้อความ และยังไม่ได้ดึงชื่อ LINE</p><div class="pending-toolbar"><button id="pending-line-reload" type="button">โหลดผู้ทักใหม่</button><label for="pending-line-search">ค้นหารหัสผู้ส่ง</label><input id="pending-line-search" type="search" placeholder="รหัสขึ้นต้น U" style="max-width:400px"></div><p id="pending-line-status" role="status" aria-live="polite">กางรายการเพื่อโหลด</p><div id="pending-line-rows" class="pending-table"></div><details><summary>ประวัติเพิ่มสิทธิ์ผ่านหน้านี้</summary><div id="pending-line-history"></div></details><p class="muted">การดูหรือคัดลอกรหัสไม่เพิ่มสิทธิ์ กดเพิ่มสิทธิ์แล้วต้องตรวจรหัสและยืนยันอีกครั้ง · สิทธิ์คุยกับบอตไม่ใช่ความยินยอมรับข่าวสาร หากยังไม่พบ ให้คนนั้นส่งข้อความหา OA อีกครั้งแล้วกดโหลดผู้ทักใหม่ · เว็บนี้ยังไม่มีระบบเข้าสู่ระบบ ใช้บนเครื่องนี้เท่านั้น</p></details>`;
export const pendingUsersScript = String.raw`
(()=>{
 const el=id=>document.getElementById('pending-line-'+id),panel=document.getElementById('pending-line-users');let users=[],pendingCount=null,busy=false,loaded=false,canAdd=false,revision=0,listPage=1,listMeta=null;
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
 const date=v=>new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 function render(){const history=el('history');if(!history.childElementCount)history.append(CBOT_PAGES.remote('grants',{},(g,target)=>target.append(node('p',g.userId+' · '+date(g.at)+' · '+g.actor)),'ประวัติอนุมัติ'));const root=el('rows');root.replaceChildren();CBOT_PAGES.mount(root,listMeta,n=>{listPage=n;void load()},'ผู้ทักใหม่');const q=el('search').value.trim().toLowerCase(),rows=users.filter(u=>u.userId.toLowerCase().includes(q));
  if(!rows.length){root.append(node('p',q&&pendingCount>0?'ไม่พบรหัสที่ตรงกับคำค้น':loaded?'ยังไม่มีผู้ทักใหม่ที่รออนุญาต':'ยังไม่ได้โหลดข้อมูล'));return}
  const table=node('table'),head=node('tr');for(const title of ['LINE user ID','ทักครั้งแรก','ทักล่าสุด','สถานะ','']){const h=node('th',title);h.scope='col';head.append(h)}const thead=node('thead');thead.append(head);table.append(thead);const body=node('tbody');
  for(const u of rows){const row=node('tr'),id=node('td');id.append(node('code',u.userId));const first=node('td',date(u.firstSeenAt)),last=node('td',date(u.lastSeenAt));first.className=last.className='pending-time';const actions=node('td'),copy=node('button','คัดลอกรหัส');copy.type='button';copy.disabled=busy;copy.onclick=async()=>{try{await navigator.clipboard.writeText(u.userId);el('status').textContent='คัดลอกรหัสแล้ว · ยังไม่ได้เพิ่มสิทธิ์'}catch{el('status').textContent='คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกเอง'}};actions.append(copy);if(canAdd){const allow=node('button','เพิ่มสิทธิ์ให้คุยกับบอต');allow.type='button';allow.disabled=busy;allow.onclick=()=>authorize(u);actions.append(allow)}row.append(id,first,last,node('td','ยังไม่ได้รับอนุญาต'),actions);body.append(row)}table.append(body);root.append(table)
 }
 async function load(){if(busy)return;busy=true;el('reload').disabled=true;el('status').textContent='กำลังโหลดผู้ทักใหม่…';try{const d=await CBOT_PAGES.read('pending',{page:listPage,q:el('search').value});listMeta=d.pagination;listPage=listMeta.page;users=d.users;pendingCount=d.pendingCount;el('count').textContent=' · '+pendingCount+' คน';revision=d.revision;canAdd=!d.readOnly;loaded=true;el('status').textContent='รออนุญาต '+(listMeta?.total??users.length)+' คน · ผู้ที่อนุญาตอยู่แล้ว '+d.allowedUserCount+' คน · อัปเดต '+date(new Date().toISOString())}catch(e){el('status').textContent=e.message||'โหลดรายการไม่ได้ กรุณาลองใหม่'}finally{busy=false;el('reload').disabled=false;if(panel.open)render()}}
 async function authorize(u){if(busy||!canAdd)return;if(!confirm('เพิ่มสิทธิ์ให้ LINE user ID นี้คุยกับบอต?\n\n'+u.userId+'\nทักล่าสุด: '+date(u.lastSeenAt)+'\n\nมีผลทันทีเฉพาะรหัสนี้ ไม่เปิดให้ทุกคน และไม่เปลี่ยนสถานะรับข่าวสาร'))return;
 busy=true;el('reload').disabled=true;render();try{const r=await fetch('/api/line-pending-users',{method:'POST',headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},body:JSON.stringify({action:'allow',userId:u.userId,revision,confirmed:true})}),d=await r.json();if(!r.ok)throw Error(d.error||'เพิ่มสิทธิ์ไม่ได้');busy=false;el('history').replaceChildren();await load();el('status').textContent='เพิ่มสิทธิ์แล้ว ให้ผู้ใช้ส่งข้อความใหม่ได้เลย · ไม่ต้องรีสตาร์ต'}catch(e){el('status').textContent=e.message||'เพิ่มสิทธิ์ไม่ได้ กรุณาโหลดล่าสุดแล้วลองใหม่'}finally{busy=false;el('reload').disabled=false;render()}
 }
 panel.addEventListener('toggle',()=>{if(panel.open)void load()});el('reload').onclick=load;el('search').oninput=CBOT_PAGES.debounce(()=>{listPage=1;void load()});
 const customersPanel=document.getElementById('customers-panel');
 const visible=()=>!panel.hidden&&!customersPanel.hidden;
 let wasVisible=visible();
 const observer=new MutationObserver(()=>{
  const isVisible=visible();
  if(isVisible&&!wasVisible)void load();
  wasVisible=isVisible;
 });
 observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
 observer.observe(customersPanel,{attributes:true,attributeFilter:['hidden']});
 if(wasVisible)void load();
 setInterval(()=>{if(visible()&&(!panel.open||!panel.contains(document.activeElement)))void load()},10000);
})();`;
