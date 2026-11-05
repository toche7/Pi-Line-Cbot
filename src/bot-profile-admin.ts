import { maxBotNameLength } from './bot-profile.js';

export const botProfileBody = `<section class="staff-card"><h2>ข้อมูลบอต</h2>
<form id="bot-profile-form"><label>ชื่อบอต <input id="bot-profile-name" required maxlength="${maxBotNameLength}" aria-describedby="bot-profile-name-guide"></label>
<p id="bot-profile-name-guide">ใช้ภาษาใดก็ได้ สูงสุด ${maxBotNameLength} ตัวอักษรในบรรทัดเดียว แนะนำชื่อสั้น พิมพ์ง่าย และเลี่ยงคำทั่วไป เช่น “คอร์ส” เพราะข้อความที่ขึ้นต้นด้วยชื่อนี้จะเรียกบอตในห้องที่เปิดโหมดพิมพ์เรียก</p>
<p>เช่น ตั้งชื่อ “น้องคอร์ส” แล้วพิมพ์ “น้องคอร์สเปิดสมัครวันไหน” หรือ “น้องคอร์ส เปิดสมัครวันไหน”</p>
<p>ใช้ชื่อนี้ทั่วเว็บหลังบ้าน ชื่อบัญชีในแอป LINE ตั้งจาก LINE Official Account Manager</p>
<button type="submit">บันทึกชื่อบอต</button></form><p id="bot-profile-status" role="status"></p></section>`;

export const botLineBody = `<section class="staff-card"><h2>ช่องทาง LINE</h2>
<p id="bot-line-status" role="status"></p><p id="bot-line-account" hidden></p><p id="bot-line-checked"></p>
<button id="bot-line-check" type="button">ตรวจการเชื่อมต่อ LINE</button>
<p><a id="bot-line-chat" target="_blank" rel="noopener noreferrer" hidden>เปิดแชตใน LINE</a></p>
<p><a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer">เปิด LINE Official Account Manager</a></p>
<p>การเชื่อมบัญชีใช้การตั้งค่าของเซิร์ฟเวอร์ เมื่อเชื่อมแล้วกดตรวจเพื่อดูว่าบอตใช้บัญชีใด</p></section>`;

export const botProfileScript = String.raw`(()=>{
const get=id=>document.getElementById(id);
async function request(path, body) {
  const response=await fetch(path, body===undefined ? {} : {
    method:'POST', headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'ทำรายการไม่สำเร็จ');
  return data;
}
const title=get('admin-bot-name'), form=get('bot-profile-form');
if(form){
  const input=get('bot-profile-name'), status=get('bot-profile-status'), button=form.querySelector('button');
  input.value=title.textContent;
  form.onsubmit=async event=>{
    event.preventDefault(); button.disabled=true; input.readOnly=true;
    try{
      const {name}=await request('/api/bot-profile',{name:input.value});
      title.textContent=name; document.title='ALS · '+name; input.value=name;
      window.dispatchEvent(new Event('bot-name-change'));
      status.textContent='บันทึกชื่อบอตแล้ว';
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false; input.readOnly=false;}
  };
}
const check=get('bot-line-check');
if(!check)return;
let checking=false;
async function load(probe){
  if(checking)return;
  checking=true; check.disabled=true;
  const message=get('bot-line-status'), account=get('bot-line-account'), chat=get('bot-line-chat'), checked=get('bot-line-checked');
  if(probe)message.textContent='กำลังตรวจการเชื่อมต่อ…';
  try{
    const result=await request('/api/bot-line',probe?{}:undefined);
    message.textContent=result.status.summary;
    account.hidden=!result.account; chat.hidden=!result.account;
    if(result.account){
      account.textContent=result.account.displayName+' ('+result.account.basicId+')';
      chat.href='https://line.me/R/oaMessage/'+encodeURIComponent(result.account.basicId);
    }else{chat.removeAttribute('href');}
    checked.textContent=result.status.checkedAt?'ตรวจล่าสุด '+new Date(result.status.checkedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' (เวลาไทย)':'';
  }catch(error){message.textContent=error.message; account.hidden=true; chat.hidden=true; checked.textContent='';}
  finally{checking=false; check.disabled=false;}
}
check.onclick=()=>load(true);
function visible(){
  if(!get('bot-management-panel').hidden && !check.closest('[hidden]'))void load(false);
}
window.addEventListener('hashchange',()=>setTimeout(visible,0));
get('tab-knowledge').addEventListener('click',()=>setTimeout(visible,0));
setTimeout(visible,0);
})();`;
