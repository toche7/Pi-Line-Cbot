export const roomProfilesBody = `
<section id="room-profile-panel" hidden>
  <h2>โปรไฟล์ห้อง LINE</h2>
  <label for="room-profile-search">ค้นหาชื่อห้อง รหัสห้อง หรือแท็ก</label>
  <input id="room-profile-search" type="search" maxlength="250">
  <button id="room-profile-reload" type="button">โหลดโปรไฟล์ล่าสุด</button>
  <p id="room-profile-status" role="status"></p>
  <div id="room-profile-list"></div>
  <div id="room-profile-detail" hidden>
    <h3 id="room-profile-name"></h3>
    <a id="room-profile-chat">เปิดบทสนทนา</a>
    <p id="room-profile-updated"></p>
    <button id="room-profile-refresh-name" type="button">อัปเดตชื่อห้องจาก LINE</button>
    <form id="room-profile-form">
      <label for="room-profile-purpose">จุดประสงค์ของห้อง</label>
      <input id="room-profile-purpose" maxlength="300">
      <label for="room-profile-note">โน้ตภายในทีม</label>
      <textarea id="room-profile-note" maxlength="2000"></textarea>
      <label for="room-profile-tags">แท็ก (คั่นด้วยจุลภาค)</label>
      <input id="room-profile-tags" maxlength="1020">
      <label><input id="room-profile-news" type="checkbox"> อนุญาตให้ส่งข่าวเข้าห้อง</label>
      <p id="room-profile-news-audit"></p>
      <button id="room-profile-save" type="submit">บันทึกโปรไฟล์ห้อง</button>
    </form>
  </div>
</section>`;

export const roomProfilesStyle = `
#room-profile-panel{margin:16px 3%}#room-profile-panel input:not([type=checkbox]),#room-profile-panel textarea{display:block;width:100%;max-width:680px;margin:4px 0 12px}#room-profile-panel button{width:auto}#room-profile-list{display:flex;flex-wrap:wrap;gap:8px}#room-profile-list button[aria-pressed=true]{background:#d9f7f2;color:#116c5e}#room-profile-form{margin-top:12px}#room-profile-form label{display:block}
`;

export const roomProfilesScript = String.raw`
(()=>{
  const el=id=>document.getElementById('room-profile-'+id);
  let page=1, selected='', room=null, busy=false, loaded='', editable=false;
  const fields=['purpose','note','tags','news'];
  function showRoom(value,canEdit){
    room=value;
    editable=canEdit;
    el('detail').hidden=!room;
    if(!room)return;
    const p=room.profile;
    el('name').textContent=room.name||room.groupId;
    el('chat').href='#monitor-rooms/'+room.groupId;
    el('refresh-name').hidden=room.status==='left';
    el('updated').textContent=p?'บันทึกล่าสุด '+new Date(p.updatedAt).toLocaleString('th-TH')+' · '+(room.updatedByEmail||p.updatedBy):'ยังไม่มีโปรไฟล์ที่บันทึก';
    el('purpose').value=p?.purpose||'';
    el('note').value=p?.note||'';
    el('tags').value=(p?.tags||[]).join(', ');
    el('news').checked=p?.newsAllowed===true;
    el('news-audit').textContent=p?'สิทธิ์รับข่าวเปลี่ยนล่าสุด '+new Date(p.newsChangedAt).toLocaleString('th-TH')+' · '+(room.newsChangedByEmail||p.newsChangedBy):'';
    for(const id of fields)el(id).disabled=!editable;
    el('save').hidden=!editable;
  }
  async function load(saved=false){
    const target=selected;
    try{
      const result=await CBOT_PAGES.read('room-profiles',{page,q:el('search').value,selected:target});
      if(selected!==target||el('panel').hidden)return;
      page=result.pagination.page;
      el('list').replaceChildren();
      for(const item of result.rooms){
        const button=document.createElement('button');
        button.type='button';
        button.textContent=item.name||item.groupId;
        button.setAttribute('aria-pressed',String(item.groupId===selected));
        button.onclick=()=>{if(!busy)location.hash='customers-room-profiles/'+item.groupId};
        el('list').append(button);
      }
      CBOT_PAGES.mount(el('list'),result.pagination,n=>{if(!busy){page=n;void load()}},'ห้อง LINE');
      showRoom(result.selectedRoom,result.canEdit);
      el('status').textContent=saved&&result.selectedRoom?'บันทึกโปรไฟล์ห้องแล้ว':target&&!result.selectedRoom?'ไม่พบห้องที่เลือก':'จำนวนห้อง · '+result.pagination.total;
    }catch(e){if(!CBOT_PAGES.isAbort(e))el('status').textContent=e.message}
  }
  function fromHash(){
    const [view,id]=location.hash.slice(1).split('/');
    el('panel').hidden=view!=='customers-room-profiles';
    if(el('panel').hidden){loaded='';return}
    if(loaded===location.hash)return;
    loaded=location.hash;
    selected=/^C[0-9a-f]{32}$/i.test(id||'')?id:'';
    showRoom(null,false);
    void load();
  }
  el('refresh-name').onclick=async()=>{
    if(!room||busy)return;
    busy=true;el('refresh-name').disabled=true;
    try{
      const response=await fetch('/api/line-groups',{method:'POST',headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},body:JSON.stringify({action:'refresh-name',groupId:room.groupId})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'อัปเดตชื่อไม่ได้');
      await load();
    }catch(e){el('status').textContent=e.message}
    finally{busy=false;el('refresh-name').disabled=false}
  };
  el('reload').onclick=()=>{if(!busy)void load()};
  el('search').oninput=CBOT_PAGES.debounce(()=>{if(!busy){page=1;void load()}});
  el('form').onsubmit=async event=>{
    event.preventDefault();
    if(!editable||!room||busy)return;
    const target=room.groupId;
    const profile={purpose:el('purpose').value,note:el('note').value,tags:el('tags').value.split(',').map(t=>t.trim()).filter(Boolean),newsAllowed:el('news').checked};
    busy=true;el('save').disabled=true;
    try{
      const response=await fetch('/api/line-groups',{method:'POST',headers:{'Content-Type':'application/json','X-Customer-Token':CUSTOMER_CSRF_TOKEN},body:JSON.stringify({action:'save-profile',groupId:target,revision:room.profile?.revision||'initial',profile})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'บันทึกโปรไฟล์ไม่ได้');
      if(room?.groupId===target)await load(true);
    }catch(e){el('status').textContent=e.message}
    finally{busy=false;el('save').disabled=false}
  };
  window.addEventListener('hashchange',fromHash);
  fromHash();
})();`;
