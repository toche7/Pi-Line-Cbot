export const paginationStyle=`#customers-panel .table-wrap{max-height:65vh;overflow:auto}#customers-panel thead th{position:sticky;top:0;background:var(--surface,#fff);z-index:1}#requests-rows,#news-list,#staff-list{max-height:65vh;overflow:auto}.list-pagination{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0}.list-pagination button{width:auto!important;display:inline-block!important;margin:0!important;padding:8px 12px!important}.list-pagination span{font-size:13px;overflow-wrap:anywhere}.list-pagination button:disabled{opacity:.5}.list-load-error{color:#a62b35}.list-search{margin:8px 0;width:100%}.paged-picker-rows{max-height:250px;overflow:auto}.paged-picker-rows label{display:flex!important;align-items:center;gap:8px;margin:8px 0!important}.paged-picker-rows input[type=checkbox]{width:auto!important}`;
export const paginationScript=String.raw`
const CBOT_PAGES=(()=>{
 const requests=new Map(),localPages=new Map();let pickerId=0;
 function debounce(fn,delay=250){let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay)}}
 async function read(resource,params={},channel=resource){
  requests.get(channel)?.abort();const controller=new AbortController();requests.set(channel,controller);
  const query=new URLSearchParams();for(const[k,v]of Object.entries({page:1,size:25,...params}))if(v!==''&&v!==undefined&&v!==null)query.set(k,String(v));
  try{const r=await fetch('/api/browse/'+resource+'?'+query,{signal:controller.signal}),d=await r.json();if(!r.ok)throw Error(d.error||'โหลดรายการไม่ได้');
  if(requests.get(channel)!==controller)throw new DOMException('superseded','AbortError');return d;}finally{if(requests.get(channel)===controller)requests.delete(channel)}
 }
 function pager(meta,onPage,label='รายการ'){
  const bar=document.createElement('div');bar.className='list-pagination';bar.setAttribute('aria-label','แบ่งหน้า '+label);
  const prev=document.createElement('button'),next=document.createElement('button'),text=document.createElement('span');prev.type=next.type='button';prev.textContent='ก่อนหน้า';next.textContent='ถัดไป';
  prev.disabled=!meta?.hasPrevious;next.disabled=!meta?.hasNext;text.setAttribute('role','status');text.textContent=meta?'แสดง '+meta.from+'–'+meta.to+' จาก '+meta.total+' · หน้า '+meta.page+' / '+meta.pages:'ยังไม่มีข้อมูล';prev.onclick=()=>onPage(meta.page-1);next.onclick=()=>onPage(meta.page+1);bar.append(prev,text,next);return bar;
 }
 function mount(root,meta,onPage,label){const id=root.id+'-pagination';document.getElementById(id)?.remove();const bar=pager(meta,onPage,label);bar.id=id;root.after(bar)}
 function local(items,key,draw,root,size=25){
  const pages=Math.max(1,Math.ceil(items.length/size)),page=Math.min(localPages.get(key)||1,pages);localPages.set(key,page);root.replaceChildren();
  for(const item of items.slice((page-1)*size,page*size))draw(item,root);
  if(items.length>size){const meta={page,pages,total:items.length,from:items.length?(page-1)*size+1:0,to:Math.min(page*size,items.length),hasPrevious:page>1,hasNext:page<pages};root.append(pager(meta,n=>{localPages.set(key,n);local(items,key,draw,root,size)},'รายการย่อย'))}
 }
 function older(root,meta,onOlder,label='ข้อความ'){document.getElementById(root.id+'-older')?.remove();if(!meta?.hasOlder)return;const b=document.createElement('button');b.type='button';b.id=root.id+'-older';b.textContent='โหลด'+label+'เก่าก่อนหน้านี้';b.onclick=onOlder;root.before(b)}
 function isAbort(error){return error?.name==='AbortError'}
 function picker(kind,initial=[],options={}){
  const chosen=new Set(initial),id='paged-picker-'+(++pickerId),root=document.createElement('div'),search=document.createElement('input'),rows=document.createElement('div'),status=document.createElement('p');
  search.type='search';search.maxLength=250;search.className='list-search';search.placeholder=options.label||'ค้นหา';search.setAttribute('aria-label',options.label||'ค้นหาตัวเลือก');status.setAttribute('role','status');rows.className='paged-picker-rows';const controls=document.createElement('div');root.append(search,status,rows,controls);let page=1,ready=false;const channel=id;
  async function load(){ready=false;status.textContent='กำลังโหลดตัวเลือก…';try{const d=await read('options',{kind,page,q:search.value},channel);if(!root.isConnected)return;page=d.pagination.page;rows.replaceChildren();for(const item of d.items){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(item.id);check.disabled=!!options.disabled;check.onchange=()=>{if(check.checked)chosen.add(item.id);else chosen.delete(item.id);status.textContent='เลือกไว้ '+chosen.size+' รายการ';options.onChange?.()};label.append(check,document.createTextNode(' '+item.name+(item.consent?' · '+({subscribed:'รับข่าว',unknown:'ยังไม่ทราบ',unsubscribed:'ไม่รับข่าว'}[item.consent]||item.consent):'')));rows.append(label)}controls.replaceChildren(pager(d.pagination,n=>{page=n;void load()},options.label||kind));status.textContent='เลือกไว้ '+chosen.size+' รายการ · แสดง '+d.pagination.total+' ตัวเลือกตามการค้นหา';ready=true;}catch(e){if(!isAbort(e)){status.textContent=e.message||'โหลดตัวเลือกไม่ได้';const retry=document.createElement('button');retry.type='button';retry.textContent='ลองโหลดตัวเลือกอีกครั้ง';retry.onclick=()=>void load();rows.replaceChildren(retry)}}}
  const schedule=debounce(()=>{page=1;void load()});search.oninput=e=>{e.stopPropagation();schedule()};setTimeout(load,0);
  return {element:root,values:()=>[...chosen],ready:()=>ready};
 }
 function remote(resource,params,draw,label='รายการ'){
  const root=document.createElement('div'),search=document.createElement('input'),rows=document.createElement('div'),status=document.createElement('p'),channel='remote-'+(++pickerId);let page=1;
  search.type='search';search.placeholder='ค้นหา'+label;search.setAttribute('aria-label','ค้นหา'+label);status.setAttribute('role','status');root.append(search,status,rows);
  async function load(){try{const d=await read(resource,{...params,page,q:search.value},channel);if(!root.isConnected)return;page=d.pagination.page;rows.replaceChildren();for(const item of d.items)draw(item,rows);rows.append(pager(d.pagination,n=>{page=n;void load()},label));status.textContent=d.items.length?'':'ไม่พบ'+label;}catch(e){if(!isAbort(e)){status.textContent=e.message||'โหลดรายการไม่ได้';const retry=document.createElement('button');retry.type='button';retry.textContent='ลองใหม่';retry.onclick=()=>void load();rows.replaceChildren(retry)}}}
  const schedule=debounce(()=>{page=1;void load()});search.oninput=e=>{e.stopPropagation();schedule()};setTimeout(load,0);return root;
 }
 return{read,pager,mount,local,older,debounce,isAbort,picker,remote};
})();
`;
