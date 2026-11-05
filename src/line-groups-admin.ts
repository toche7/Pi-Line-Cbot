export const lineGroupsStyle = `
#line-rooms{padding:16px 3%}#line-rooms summary{cursor:pointer;font-weight:700;font-size:20px;color:#087e91;padding:12px 0}#line-rooms .rooms-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:16px}#line-rooms .rooms-list{max-height:65vh;overflow:auto}#line-rooms .rooms-toolbar{display:flex;gap:12px;flex-wrap:wrap}#line-rooms .rooms-toolbar button{width:auto}#line-rooms .rooms-identifier{overflow-wrap:anywhere;color:#63758a;font-size:13px}#line-rooms section{border:1px solid #dce6ef}#line-rooms .rooms-banner{background:#e8f5f4;padding:12px;border-radius:10px;line-height:1.7}#line-rooms #line-rooms-messages{max-height:55vh;overflow:auto}@media(max-width:700px){#line-rooms .rooms-layout{grid-template-columns:1fr}#line-rooms .rooms-list{max-height:200px}}
`;
export const lineGroupsBody = `
<details id="line-rooms"><summary>ห้อง LINE · แยกจากหมวดลูกค้า</summary><p class="rooms-banner">ห้องแชต LINE ที่ระบบรับเหตุการณ์เข้ามาแล้ว · อ่านข้อความใหม่หลังเปิดเก็บเท่านั้น · แต่ละห้องแสดงโหมดตอบไว้ด้านล่าง · สมาชิกในห้องไม่ถูกเพิ่มเป็นลูกค้าหรือผู้ยินยอมรับข่าวอัตโนมัติ</p><div class="rooms-toolbar"><button id="line-rooms-reload" type="button">โหลดห้องล่าสุด</button></div><p id="line-rooms-state" role="status" aria-live="polite">เปิดรายการเพื่อโหลดห้อง LINE</p><div class="rooms-layout"><section><h2>ห้อง LINE</h2><input id="line-rooms-search" type="search" aria-label="ค้นหาห้อง LINE" placeholder="ค้นหาชื่อห้อง / รหัสห้อง"><div id="line-rooms-list" class="rooms-list"></div></section><section><h2 id="line-rooms-heading">เลือกห้อง LINE</h2><p id="line-rooms-meta" class="rooms-identifier"></p><p id="line-rooms-server" class="rooms-banner"></p><p id="line-rooms-mode"></p><div id="line-rooms-mode-editor" hidden><label for="line-rooms-mode-select">เลือกโหมดตอบ (ยังไม่มีผลจนกดบันทึก)</label><select id="line-rooms-mode-select"><option value="off">อ่านอย่างเดียว</option><option value="mention">ตอบเมื่อแท็กบัญชีบอตจริง</option><option value="cbot">ตอบเมื่อพิมพ์ชื่อบอตหรือแท็กบัญชีบอตจริง</option></select><button id="line-rooms-mode-save" type="button">บันทึกโหมดตอบห้องนี้</button><p id="line-rooms-mode-draft" role="status"></p></div><div class="rooms-toolbar"><a id="line-rooms-profile" hidden>ดูโปรไฟล์ห้อง</a></div><div id="line-rooms-messages"></div><form id="line-rooms-compose" hidden><label for="line-rooms-text">ข้อความจากเจ้าหน้าที่</label><textarea id="line-rooms-text" maxlength="3900" required></textarea><button id="line-rooms-send" type="submit">ตรวจและยืนยันส่งเข้าห้อง</button></form><p class="muted">ข้อความเฉพาะที่เก็บหลังเปิดรับห้องกลุ่ม · สูงสุด 90 วัน / 1,000 ข้อความต่อห้อง</p></section></div></details>`;
export const lineGroupsScript = String.raw`
(()=>{
 const el=id=>document.getElementById('line-rooms'+(id?'-'+id:''));let state=null,selected='',busy=false,listPage=1,cacheKey='',messageCache=[],messageMeta=null;const modeDrafts=new Map(), drafts=new Map(), attempts=new Map();
 const date=at=>at?new Date(at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่ทราบ';
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
 window.addEventListener('bot-name-change',render);
 function render(){
  if(!state)return;const botName=document.getElementById('admin-bot-name')?.textContent||'ซีบอต';const list=el('list');list.replaceChildren();const q=el('search').value.trim().toLowerCase();
  for(const room of state.rooms.filter(r=>[r.name||'',r.groupId].join(' ').toLowerCase().includes(q))){const b=node('button',room.name||'ห้อง LINE · ยังไม่มีชื่อ');b.type='button';b.setAttribute('aria-pressed',String(room.groupId===selected));b.onclick=()=>{if(busy)return;if(selected===room.groupId)void refresh();else location.hash='monitor-rooms/'+room.groupId};b.append(node('small',(room.status==='left'?'บอตออกจากห้องแล้ว':'พบเหตุการณ์ล่าสุด')+' · '+date(room.seenAt)));list.append(b)}
  if(!list.childElementCount)list.append(node('p',state.rooms.length?'ไม่พบห้องที่ตรงกับคำค้น':'ยังไม่มีห้องที่ระบบรับเหตุการณ์ กรุณาเพิ่มบอตและส่งข้อความในห้อง'));
  CBOT_PAGES.mount(list,state.pagination,n=>{listPage=n;void refresh()},'ห้อง LINE');const room=state.selectedRoom?.groupId===selected?state.selectedRoom:state.rooms.find(r=>r.groupId===selected);el('heading').textContent=room?(room.name||'ห้อง LINE · ยังไม่มีชื่อ'):'เลือกห้อง LINE';el('meta').textContent=room?room.groupId+(room.nameFetchedAt?' · ชื่อจาก LINE อัปเดต '+date(room.nameFetchedAt):' · ยังดึงชื่อจาก LINE ไม่สำเร็จ'):'';
  el('mode').textContent=room?(room.status==='left'?'ได้รับเหตุการณ์ว่าบอตออกจากห้องแล้ว':room.replyMode==='cbot'?'ตอบเมื่อพิมพ์ '+botName+' ขึ้นต้น (เว้นวรรคได้ตามสะดวก) หรือพิมพ์ @ แล้วแตะเลือกบัญชีบอต · แยกบริบทจากแชตส่วนตัว':room.replyMode==='mention'?'ตอบเฉพาะเมื่อแท็กบัญชีบอตจริง · แยกบริบทจากแชตส่วนตัว':'โหมดอ่านอย่างเดียว · บอตไม่ตอบในกลุ่ม'):'';
  el('server').textContent=state.server?'เซิร์ฟเวอร์: '+state.server.name+' · สภาพแวดล้อม: '+state.server.environment:'เซิร์ฟเวอร์: ไม่ระบุ';
  el('mode-editor').hidden=!state.canManageMode||!room;
  if(room){let draft=modeDrafts.get(room.groupId);if(!draft){draft={mode:room.replyMode||'off',revision:room.modeRevision||'initial'};modeDrafts.set(room.groupId,draft)}el('mode-select').value=draft.mode;el('mode-select').disabled=busy||room.status==='left';el('mode-save').disabled=busy||room.status==='left';el('mode-draft').textContent=draft.revision!==(room.modeRevision||'initial')?'โหมดถูกเปลี่ยนจากหน้าต่างอื่น กดโหลดห้องล่าสุดก่อนเลือกใหม่':draft.mode!==(room.replyMode||'off')?'มีค่าที่เลือกไว้ ยังไม่ได้บันทึก':'ตรงกับโหมดที่บันทึกแล้ว';}
  el('profile').hidden=!room;
  if(room)el('profile').href='#customers-room-profiles/'+room.groupId;
  el('compose').hidden=!room||!state.canSend;
  const draftText=drafts.get(selected)||'';
  if(el('text').value!==draftText)el('text').value=draftText;
  el('send').disabled=busy;
  el('messages').replaceChildren();
  if(room){for(const m of room.messages||[]){const card=node('article');card.className=m.direction==='out'?(m.actor?'out human':'out'):'in';card.append(node('small',(m.direction==='out'?(m.actor?(m.actorEmail||'เจ้าหน้าที่')+' · ':botName+' · ')+({accepted:'LINE ยอมรับแล้ว',pending:'จองการตอบไว้ · ยังไม่ยืนยันผล',failed:'ส่งไม่สำเร็จหรือไม่ยืนยันผล · ไม่ส่งซ้ำ',cancelled:'ยกเลิกการตอบ'}[m.status]||m.status):m.userId?'ผู้ส่ง: '+m.userId:'LINE ไม่ได้ระบุรหัสผู้ส่ง')+' · '+date(m.at)),node('div',m.text||'ยังไม่มีข้อความตอบที่ยืนยันผล'));el('messages').append(card)}if(!room.messages?.length)el('messages').append(node('p','ยังไม่มีข้อความที่เก็บหลังเปิดรับห้องนี้ · ไม่ดึงประวัติเก่าจาก LINE'))}
 }
 async function refresh(before=''){if(busy)return;busy=true;el('reload').disabled=true;const target=selected,box=el('messages'),top=box.scrollTop,height=box.scrollHeight;try{const d=await CBOT_PAGES.read('rooms',{page:listPage,q:el('search').value,selected:target,before});if(selected!==target){busy=false;return refresh()}listPage=d.pagination.page;if(cacheKey!==target){cacheKey=target;messageCache=[];messageMeta=null}const fresh=d.selectedRoom?.messages||[];messageCache=[...new Map([...messageCache,...fresh].map(m=>[m.eventId+':'+m.direction,m])).values()].sort((a,b)=>a.at.localeCompare(b.at));if(before||!messageMeta)messageMeta=d.messagesPage;if(d.selectedRoom)d.selectedRoom.messages=messageCache;state=d;busy=false;render();CBOT_PAGES.older(box,messageMeta,()=>void refresh(messageMeta.before));box.scrollTop=before?top+box.scrollHeight-height:top;el('state').textContent='จำนวนห้อง · '+d.pagination.total;}catch(e){if(!CBOT_PAGES.isAbort(e))el('state').textContent=e.message||'โหลดรายการไม่ได้'}finally{busy=false;el('reload').disabled=false}}
 function selectLinkedRoom(){
   const [view,id]=location.hash.slice(1).split('/');
   if(view!=='monitor-rooms'||!/^C[0-9a-f]{32}$/i.test(id||'')||selected===id)return;
   selected=id;
   void refresh();
 }
 window.addEventListener('hashchange',selectLinkedRoom);
 selectLinkedRoom();
 if(el('').open)void refresh();el('').addEventListener('toggle',()=>{if(el('').open)void refresh()});el('reload').onclick=()=>{if(busy)return;modeDrafts.clear();void refresh()};el('search').oninput=CBOT_PAGES.debounce(()=>{listPage=1;void refresh()});
 el('mode-select').onchange=()=>{const draft=modeDrafts.get(selected);if(draft){draft.mode=el('mode-select').value;render()}};
 el('mode-save').onclick=async()=>{if(busy||!selected)return;const room=state.selectedRoom?.groupId===selected?state.selectedRoom:state.rooms.find(r=>r.groupId===selected),draft=modeDrafts.get(selected);if(!room||!draft||!state.canManageMode)return;
  if(!confirm('บันทึกโหมด “'+el('mode-select').selectedOptions[0].textContent+'” สำหรับ '+(room.name||room.groupId)+' บน '+state.server.name+' ('+state.server.environment+') ใช่ไหม?'))return;
  busy=true;render();try{const r=await fetch('/api/line-groups',{method:'POST',headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},body:JSON.stringify({action:'set-reply-mode',groupId:selected,mode:draft.mode,revision:draft.revision})}),d=await r.json();if(!r.ok)throw Error(d.error||'บันทึกโหมดไม่ได้');modeDrafts.delete(room.groupId);busy=false;await refresh();el('state').textContent='บันทึกโหมดแล้ว · มีผลกับข้อความใหม่ของห้องนี้';}catch(e){el('state').textContent=e.message}finally{busy=false;render()}};
 el('text').oninput=()=>drafts.set(selected,el('text').value);
 el('compose').onsubmit=async event=>{
   event.preventDefault();
   const room=state?.selectedRoom, text=drafts.get(selected)||'';
   if(busy||!state?.canSend||!room||room.groupId!==selected||!text.trim())return;
   const preview=text.startsWith('Staff:')?text:'Staff: '+text;
   if(!confirm('ส่งข้อความผ่านบอตไปยัง '+(room.name||room.groupId)+'? สมาชิกทุกคนในห้องจะเห็น\n\n'+preview))return;
   let attempt=attempts.get(room.groupId);
   if(!attempt||attempt.text!==text){attempt={text,id:crypto.randomUUID()};attempts.set(room.groupId,attempt)}
   busy=true;el('send').disabled=true;el('text').disabled=true;
   let notice;
   try{
     const response=await fetch('/api/line-groups',{method:'POST',headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},body:JSON.stringify({action:'send-staff',groupId:room.groupId,id:attempt.id,text,confirmed:true})});
     const result=await response.json();
     if(!response.ok)throw Error(result.error||'ส่งข้อความไม่ได้');
     drafts.delete(room.groupId);attempts.delete(room.groupId);
     notice=result.status==='accepted'?'LINE รับคำขอส่งแล้ว':'ยังยืนยันผลส่งไม่ได้ กรุณาตรวจในห้อง LINE ก่อนส่งใหม่';
   }catch(e){notice=e.message+' · ตรวจในห้อง LINE ก่อนส่งใหม่'}
   finally{busy=false;el('send').disabled=false;el('text').disabled=false}
   await refresh();
   el('state').textContent=notice;
 };
 setInterval(()=>{if(el('').open&&!document.getElementById('monitor-panel').hidden&&!document.getElementById('monitor-rooms-content').hidden&&!el('').contains(document.activeElement))void refresh()},10000);
})();`;
