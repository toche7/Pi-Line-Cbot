import { botProfileBody, botLineBody } from './bot-profile-admin.js';
import { hasPermission, visibleSettings, roleLabels, type StaffPrincipal } from './staff-policy.js';
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
export const staffStyle = `
.staff-account{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 5% 16px}.staff-account button{width:auto;margin:0}.settings-layout{padding:0 5% 30px}.settings-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.settings-nav button{margin:0;width:auto;padding:8px 14px}.settings-nav button[aria-selected=true]{background:#d9f7f2;color:#116c5e}.settings-content{min-width:0}.settings-content #bot-settings-panel,.settings-content #knowledge-panel{padding:0}.staff-card{padding:18px;background:white;border:1px solid #dce6ef;border-radius:12px;margin-bottom:16px;overflow-wrap:anywhere}.staff-card label{display:block;margin:12px 0}.staff-card input:not([type=checkbox]),.staff-card select{width:100%;box-sizing:border-box;padding:10px;font:inherit}.staff-card button{width:auto;margin:8px 8px 0 0}.staff-card input[type=checkbox]{width:auto}.staff-card .staff-row{padding:12px 0;border-bottom:1px solid #dce6ef}.staff-history{max-height:320px;overflow:auto}
`;
export function staffAccountBody(p: StaffPrincipal) {
  return `<div class="staff-account"><span>${escapeHtml(p.email)} · ${roleLabels[p.role]}</span><button id="staff-logout" type="button">ออกจากระบบ</button><span id="staff-account-status" role="status"></span></div>`;
}
const settingsGroups = [
  { id: 'system', label: 'สถานะระบบและการเชื่อมต่อ', items: ['system'] },
  { id: 'bot', label: 'จัดการบอต', items: ['profile', 'line', 'knowledge'] },
  { id: 'ai', label: 'ตั้งค่า AI', items: ['ai'] },
  { id: 'users', label: 'ผู้ใช้และสิทธิ์', items: ['users'] },
] as const;

export function settingsWorkspace(p: StaffPrincipal | undefined, ai: string, knowledge: string, system: string, setupEnabled: boolean) {
  const sections = p ? visibleSettings(p) : ['knowledge', 'ai', 'system', ...(setupEnabled ? ['profile', 'line'] : [])];
  const bodies = {
    profile: botProfileBody,
    line: botLineBody,
    knowledge: `<section id="knowledge-panel">${knowledge}</section>`,
    ai: `<section id="bot-settings-panel">${ai}</section>`,
    system,
    users: `<h2>ผู้ใช้และสิทธิ์</h2><p>บัญชีเจ้าหน้าที่แยกจากลูกค้า LINE · เพิ่มอีเมลแล้วให้เจ้าของบัญชีเข้าสู่ระบบด้วย Google ไม่มีการส่งอีเมลเชิญอัตโนมัติ</p><p id="staff-status" role="status"></p><button id="staff-reload" type="button">โหลดรายชื่อล่าสุด</button><div class="staff-card"><h3 id="staff-form-title">เพิ่มเจ้าหน้าที่</h3><form id="staff-form"><label>อีเมล Google<input id="staff-email" type="email" maxlength="200" required></label><label>บทบาท<select id="staff-role"><option value="staff">เจ้าหน้าที่</option><option value="content">ผู้จัดการ</option><option value="admin">ผู้ดูแลระบบ</option></select></label><label><input id="staff-enabled" type="checkbox" checked> เปิดใช้บัญชี</label><fieldset id="staff-extras"><legend>สิทธิ์เสริม</legend><label><input id="staff-extra-news" type="checkbox"> ส่งข่าวจริง</label><label><input id="staff-extra-line" type="checkbox"> อนุมัติลูกค้า LINE</label></fieldset><button type="submit">ตรวจและบันทึกสิทธิ์</button><button id="staff-clear" type="button">เพิ่มบัญชีใหม่</button></form></div><div id="staff-list" class="staff-card"></div><details class="staff-card"><summary>ประวัติการจัดการและใช้งาน API ล่าสุด</summary><div id="staff-history" class="staff-history"></div></details>` };
  const groups = settingsGroups.map(group => ({
    ...group, items: group.items.filter(item => sections.includes(item)),
  })).filter(group => group.items.length);
  const tabs = groups.map(({ id, label }, index) =>
    `<button id="settings-tab-${id}" type="button" role="tab" aria-controls="settings-panel-${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-settings-tab="${id}">${label}</button>`).join('');
  const panels = groups.map(({ id, items }, index) =>
    `<section id="settings-panel-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}" ${index === 0 ? '' : 'hidden'}>${items.map(item => `<div id="settings-${item}">${bodies[item]}</div>`).join('')}</section>`).join('');
  return `<section id="bot-management-panel" role="region" aria-labelledby="tab-knowledge" hidden>
<div class="bot-heading"><h2>ตั้งค่า</h2></div><div class="settings-layout">
<nav class="settings-nav" role="tablist" aria-label="ส่วนการตั้งค่า">${tabs}</nav><div class="settings-content">${panels}</div>
</div></section>`;
}

export const settingsNavigationScript = String.raw`(()=>{
const tabs=[...document.querySelectorAll('[data-settings-tab]')];
if(!tabs.length)return;
function select(){
  const hash=location.hash.slice(1);
  const destinations={
    'settings-system':'system','settings-users':'users',
    'settings-bot':'bot','settings-profile':'bot','settings-line':'bot','settings-knowledge':'bot',knowledge:'bot',
    'settings-ai':'ai','bot-settings':'ai',ai:'ai',
  };
  const section=destinations[hash];
  const selected=tabs.find(tab=>tab.dataset.settingsTab===section)||tabs[0];
  for(const tab of tabs){
    const active=tab===selected;
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
  }
}
for(const [index,tab] of tabs.entries()){
  tab.onclick=()=>{location.hash='settings-'+tab.dataset.settingsTab;select()};
  tab.onkeydown=event=>{
    const targets={ArrowLeft:(index+tabs.length-1)%tabs.length,ArrowRight:(index+1)%tabs.length,Home:0,End:tabs.length-1};
    if(!Object.hasOwn(targets,event.key))return;
    event.preventDefault();
    const next=tabs[targets[event.key]];
    next.click();next.focus();
  };
}
window.addEventListener('hashchange',select);select();
})();`;

export function staffBrowserScript(csrf: string) {
  return String.raw`(()=>{
const token=${json(csrf)};
const originalFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href),method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(url.origin===location.origin&&!['GET','HEAD'].includes(method)){const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));headers.set('X-Staff-Token',token);options={...options,headers}}return originalFetch(input,options)};
document.getElementById('staff-logout').onclick=async()=>{try{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw Error();location.href='/'}catch{document.getElementById('staff-account-status').textContent='ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'}};
if(!document.getElementById('settings-users'))return;
const el=id=>document.getElementById('staff-'+id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};let snapshot=null,editing=null,busy=false,listPage=1;const listSearch=node('input');listSearch.type='search';listSearch.placeholder='ค้นหาเจ้าหน้าที่';listSearch.setAttribute('aria-label','ค้นหาเจ้าหน้าที่');el('list').before(listSearch);listSearch.oninput=CBOT_PAGES.debounce(()=>{listPage=1;void load()});
const extraFields=[['extra-news','news.send'],['extra-line','line.approve']];
function syncExtras(){
  const visible=el('role').value==='staff';
  el('extras').hidden=!visible;
  el('extras').disabled=!visible;
}
function loadExtras(extras){
  for(const [field,permission] of extraFields)el(field).checked=extras.includes(permission);
  syncExtras();
}
el('role').onchange=syncExtras;
syncExtras();
function clear(){editing=null;el('email').value='';el('email').disabled=false;el('role').value='staff';el('enabled').checked=true;loadExtras([]);el('form-title').textContent='เพิ่มเจ้าหน้าที่'}
function render(){el('list').replaceChildren(node('h3','บัญชีเจ้าหน้าที่'));for(const a of snapshot.accounts){const row=node('div');row.className='staff-row';row.append(node('strong',a.email),node('p',${json(roleLabels)}[a.role]+' · '+(a.enabled?'เปิดใช้':'ปิดใช้')+' · '+(a.subject?'ผูกบัญชี Google แล้ว':'รอเข้าสู่ระบบครั้งแรก')));const b=node('button','แก้ไขสิทธิ์');b.type='button';b.onclick=()=>{editing=a.id;el('email').value=a.email;el('email').disabled=true;el('role').value=a.role;el('enabled').checked=a.enabled;loadExtras(a.extras);el('form-title').textContent='แก้สิทธิ์: '+a.email};row.append(b);el('list').append(row)}CBOT_PAGES.mount(el('list'),snapshot.pagination,n=>{listPage=n;void load()},'เจ้าหน้าที่');if(!el('history').childElementCount)el('history').append(CBOT_PAGES.remote('staff-history',{},(h,target)=>target.append(node('p',new Date(h.at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' · '+h.actor+' · '+h.event+' · '+h.target)),'ประวัติการจัดการ'))}
async function load(){if(busy)return;busy=true;try{const d=await CBOT_PAGES.read('staff',{page:listPage,q:listSearch.value});snapshot=d;listPage=d.pagination.page;render();el('status').textContent='โหลดข้อมูลล่าสุดแล้ว'}catch(e){el('status').textContent=e.message||'โหลดรายชื่อไม่ได้'}finally{busy=false}}
el('reload').onclick=load;el('clear').onclick=clear;el('form').onsubmit=async e=>{e.preventDefault();if(busy||!snapshot)return;const input={action:editing?'update':'invite',revision:snapshot.revision,...(editing?{id:editing}:{email:el('email').value.trim()}),role:el('role').value,enabled:el('enabled').checked};
if(input.role==='staff')input.extras=extraFields.filter(([field])=>el(field).checked).map(([,permission])=>permission);
if(!confirm('ยืนยันสิทธิ์ของ '+el('email').value+' เป็น '+el('role').selectedOptions[0].textContent+(input.enabled?' (เปิดใช้)':' (ปิดใช้)')+'?'))return;busy=true;try{const r=await fetch('/api/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),d=await r.json();if(!r.ok)throw Error(d.error);snapshot=await CBOT_PAGES.read('staff',{page:listPage,q:listSearch.value});clear();el('history').replaceChildren();render();el('status').textContent='บันทึกแล้ว'}catch(e){el('status').textContent=e.message||'บันทึกไม่ได้ กรุณาโหลดล่าสุด'}finally{busy=false}};
function visible(){if(!document.getElementById('settings-users').closest('[hidden]'))void load()}window.addEventListener('hashchange',()=>setTimeout(visible,0));setTimeout(visible,0);
})();`;
}
