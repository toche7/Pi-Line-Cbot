export function statusCheckFailure(status: number, timedOut: boolean) {
  if (status === 403) return 'คำขอตรวจไม่ผ่านสิทธิ์ของหน้าเว็บ (403) หากเพิ่งรีสตาร์ต server ให้รีเฟรชหน้าเว็บแล้วลองใหม่ · ไม่ได้แปลว่า LINE หลุด';
  if (status === 503) return 'ตัวตรวจสถานะยังไม่พร้อม (503) กรุณาลองใหม่ · ผลนี้ไม่ยืนยันว่า LINE รับ–ส่งไม่ได้';
  if (timedOut) return 'ตรวจสถานะเกินเวลารอ กรุณาลองใหม่ · ยังสรุปไม่ได้ว่า LINE ขัดข้อง';
  return 'ส่งคำขอตรวจสถานะไม่สำเร็จ กรุณาลองใหม่ · ยังสรุปไม่ได้ว่า LINE ขัดข้อง';
}
export function needsExternalCheck(checkedAt: string | null, now = Date.now()) {
  const at = checkedAt ? Date.parse(checkedAt) : NaN;
  return !Number.isFinite(at) || now - at > 5 * 60000;
}
// A server restart rotates the page token. Refresh it from this same origin
// once for this read-only diagnostic, without reloading or losing UI drafts.
export async function fetchStatusData(check: boolean, token: string, fetcher: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(check ? 15000 : 10000);
  const request = () => fetcher(check ? '/api/system-status/check' : '/api/system-status', {
    method: check ? 'POST' : 'GET', headers: check ? { 'X-Customer-Token': token } : {}, signal, cache: 'no-store', redirect: 'error',
  });
  let response = await request();
  if (check && response.status === 403) {
    const page = await fetcher('/', { signal, cache: 'no-store', redirect: 'error' });
    if (page.ok) {
      const found = (await page.text()).match(/const CUSTOMER_CSRF_TOKEN=("[^"]+");/);
      if (found) {
        const latest = JSON.parse(found[1]);
        if (typeof latest === 'string' && latest && latest !== token) { token = latest; response = await request(); }
      }
    }
  }
  if (!response.ok) throw Object.assign(new Error('Status request failed'), { status: response.status });
  return { data: await response.json(), token };
}
export const systemStatusStyle = `
#overview-system{margin-bottom:22px;border:1px solid #dce6ef}#overview-system .sys-toolbar{display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap}#overview-system button{width:auto;margin:0}#overview-system .sys-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}#overview-system details{min-width:0;overflow-wrap:anywhere;background:#f7fafc;border:1px solid #dce6ef;border-radius:10px;padding:12px}#overview-system summary{cursor:pointer;font-weight:600}#overview-system .sys-badge{display:block;width:fit-content;font-size:13px;padding:2px 8px;border-radius:14px;margin:8px 0;background:#e8edf2;color:#43576d}#overview-system .sys-ok{background:#dff4e9;color:#166340}#overview-system .sys-warning{background:#fff0cf;color:#7b4a09}#overview-system .sys-error{background:#ffe1df;color:#9a2a24}#overview-system .sys-short{display:block;font-weight:400;font-size:14px;margin:8px 0}#overview-system .sys-time{display:block;font-weight:400;font-size:12px;color:#586d82}#overview-system .sys-detail{font-size:14px;line-height:1.6}#overview-system .sys-detail p{color:#43576d}#overview-system summary:focus-visible{outline:3px solid #168779;outline-offset:3px}@media(max-width:1100px){#overview-system .sys-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){#overview-system .sys-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){#overview-system .sys-grid{grid-template-columns:1fr}}
`;
export const systemStatusBody = `<section id="overview-system" class="ov-box" aria-labelledby="system-heading"><div class="sys-toolbar"><div><h3 id="system-heading">สถานะระบบและการเชื่อมต่อ</h3><p class="ov-sub">กดแต่ละส่วนเพื่อดูรายละเอียด · เวลา Asia/Bangkok</p></div><button id="system-check" type="button">ตรวจ LINE / การเชื่อมต่อภายนอก</button></div><p id="system-state" role="status" aria-live="polite">กำลังโหลดสถานะระบบ…</p><p id="system-check-notice" class="ov-notice" role="status" hidden></p><div id="system-cards" class="sys-grid"></div><p class="ov-sub">สถานะภายในอัปเดตทุก 15 วินาทีเมื่อเปิดภาพรวม LINE/ภายนอกตรวจอัตโนมัติเมื่อยังไม่มีผลหรือผลเกิน 5 นาที และกดตรวจซ้ำได้ ใช้ผลร่วมกันอย่างน้อย 30 วินาที ไม่เรียกโมเดลหรือส่ง LINE</p></section>`;
export const systemStatusScript = String.raw`(()=>{
const checkFailure=${statusCheckFailure.toString()},needsCheck=${needsExternalCheck.toString()},fetchData=${fetchStatusData.toString()};
const el=id=>document.getElementById('system-'+id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n},date=v=>new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});let busy=false,last=null,currentToken=CUSTOMER_CSRF_TOKEN,nextAutoCheckAt=0;
function render(d){const opened=new Set([...el('cards').children].filter(n=>n.open).map(n=>n.dataset.card));el('cards').replaceChildren();for(const c of d.cards){const box=node('details');box.dataset.card=c.id;box.open=opened.has(c.id);const summary=node('summary',c.title),badge=node('span',({ok:'ปกติ',warning:'มีข้อจำกัด',error:'ขัดข้อง',unknown:'ยังยืนยันไม่ได้'})[c.state]||'ยังยืนยันไม่ได้','sys-badge sys-'+c.state);summary.append(badge,node('span',c.summary,'sys-short'),node('span',c.checkedAt?'หลักฐาน '+date(c.checkedAt):'ยังไม่มีผลตรวจ','sys-time'));box.append(summary);const details=node('div',undefined,'sys-detail');details.append(node('p',c.checkedAt?'หลักฐานล่าสุด '+date(c.checkedAt):'ยังไม่มีผลตรวจการเชื่อมต่อ'));for(const text of c.details)details.append(node('p',text));if(c.id==='ai'){const a=node('a','ไปจัดการบอต →');a.href='#bot';details.append(a)}if(c.id==='data'){const a=node('a','ดูงานส่งข่าว →');a.href='#news';details.append(a)}box.append(details);el('cards').append(box)}el('state').textContent='อ่านสถานะภายใน '+date(d.generatedAt)+(d.externalCheckedAt?' · ผลตรวจภายนอก '+date(d.externalCheckedAt):' · ยังไม่ได้ตรวจภายนอก');last=d}
function unavailable(){if(last)render({...last,cards:last.cards.map(c=>({...c,state:'unknown',summary:'ข้อมูลเก่า · ติดต่อ server เพื่อตรวจล่าสุดไม่ได้'}))});el('state').textContent='ติดต่อสถานะระบบไม่ได้ · อาจเกิดจาก server หรือเครือข่าย กรุณาลองโหลดใหม่';if(!last)el('cards').replaceChildren(node('p','ยังไม่มีผลตรวจระบบ ไม่สามารถยืนยันว่า server หยุดทำงานจากหน้าเว็บเพียงอย่างเดียว'))}
async function load(check=false){
 if(busy||document.getElementById('overview-panel').hidden||document.hidden)return;
 busy=true;let attemptedCheck=check;el('check').disabled=true;
 try{
  if(!check){
   const result=await fetchData(false,currentToken);currentToken=result.token;render(result.data);
   check=!result.data.checking&&Date.now()>=nextAutoCheckAt&&needsCheck(result.data.externalCheckedAt);
  }
  if(check){
   attemptedCheck=true;nextAutoCheckAt=Date.now()+60000;
   el('state').textContent='กำลังตรวจ LINE และ HTTPS · ไม่ส่งข้อความ…';
   const result=await fetchData(true,currentToken);currentToken=result.token;nextAutoCheckAt=0;render(result.data);
   el('check-notice').hidden=true;el('check-notice').textContent='';
  }
 }catch(error){
  if(attemptedCheck){el('check-notice').textContent=checkFailure(error.status||0,error.name==='TimeoutError'||error.name==='AbortError');el('check-notice').hidden=false;el('state').textContent='คำขอตรวจครั้งนี้ไม่สำเร็จ · การ์ดยังคงผลตรวจเดิมตามเวลาที่ระบุ'}else unavailable();
 }finally{busy=false;el('check').disabled=false}
}
el('check').onclick=()=>void load(true);document.getElementById('overview-refresh').addEventListener('click',()=>void load());window.addEventListener('hashchange',()=>void load());document.addEventListener('visibilitychange',()=>void load());setTimeout(()=>void load(),0);setInterval(()=>void load(),15000);
})();`;
