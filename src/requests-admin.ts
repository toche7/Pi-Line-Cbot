import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CourseRequestStore } from './course-requests.js';

export function requestsAdminHandler(store: CourseRequestStore) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" };
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      res.writeHead(403, headers).end(); return;
    }
    if (req.method !== 'GET') { res.writeHead(405, headers).end(); return; }
    if (req.url === '/api/requests') {
      try { res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ requests: store.list(), deliveryEnabled: false })); }
      catch { res.writeHead(503, { ...headers, 'Content-Type': 'application/json' }).end('{"error":"อ่านคำขอไม่ได้ชั่วคราว"}'); }
      return;
    }
    if (req.url !== '/') { res.writeHead(404, headers).end(); return; }
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }).end(requestsPage);
  };
}
export const requestsPage = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ซีบอต · คำขอกลาง</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#172b42;font:16px system-ui}header{padding:28px max(5%,20px);background:#142e47;color:white}h1{margin:0 0 8px;font-size:28px}header p{color:#c4d5e4}main{max-width:1000px;padding:24px;margin:auto}#count{font-size:24px;font-weight:700}input{width:100%;padding:14px;border:1px solid #ccd6df;border-radius:10px;margin:16px 0}article{background:white;border-radius:14px;margin:16px 0;padding:24px;overflow-wrap:anywhere}h2{font-size:20px;margin:0 0 12px}.tag{display:inline-block;border-radius:20px;background:#e6f4f1;padding:6px 12px;color:#116c5e}p{line-height:1.6}.note{white-space:pre-wrap;background:#f3f6fa;padding:14px;border-radius:8px}small{display:block;color:#586d82;line-height:1.7}.status{margin-top:12px;color:#586d82}a{color:#146f8e}</style>
<header><h1>ซีบอต · คำขอกลาง</h1><p>คำขอจองและเรื่องที่ผู้ใช้ยืนยันแล้ว · รอทีมงานดำเนินการ</p></header>
<main><div id="count">กำลังโหลด</div><p>ยังไม่ส่งอีเมลหรือ LINE และยังไม่ใช่การยืนยันที่นั่งหรือรอบเรียน</p><input id="search" aria-label="ค้นหาคำขอ" placeholder="ค้นหาเลขอ้างอิง หลักสูตร หรือเรื่องที่ฝาก"><div id="rows"></div><div id="status" class="status" role="status"></div><p>เก็บคำขอไม่เกิน90วัน · หน้านี้ใช้ดูรายการในเครื่องนี้ · ช่องทางส่งต่อจะกำหนดภายหลัง</p></main>
<script>const el=id=>document.getElementById(id);let rows=[];function render(){el('count').textContent=rows.length+' คำขอรอดำเนินการ';el('rows').replaceChildren();const q=el('search').value.toLowerCase();for(const r of rows){if(![r.id,r.course?.name,r.message].join(' ').toLowerCase().includes(q))continue;const a=document.createElement('article'),tag=document.createElement('span'),h=document.createElement('h2'),note=document.createElement('p'),meta=document.createElement('small'),state=document.createElement('p');tag.className='tag';tag.textContent=r.kind==='booking'?'ขอจองหลักสูตร':'ฝากเรื่อง';h.textContent=r.course?.name||'ขอให้ทีมงานติดต่อกลับ';note.className='note';note.textContent=r.message;meta.textContent='เลขอ้างอิง: '+r.id+' · '+new Date(r.createdAt).toLocaleString('th-TH')+'\\nต้นทาง: '+r.owner.channel+' · '+r.owner.scope+' · '+r.owner.user;meta.style.whiteSpace='pre-wrap';state.textContent='รอทีมงานดำเนินการ · ช่องทางส่งต่อ: ยังไม่เลือก';a.append(tag,h,note,meta,state);if(r.course){const link=document.createElement('a');link.href=r.course.url;link.textContent='ดูหลักสูตรต้นทาง';link.target='_blank';link.rel='noreferrer';a.append(link);if(r.course.flags.length){const warning=document.createElement('p');warning.textContent='ข้อมูลหลักสูตรมีข้อควรตรวจเพิ่มเติม: '+r.course.flags.join(', ');a.append(warning)}}el('rows').append(a)}if(!rows.length)el('rows').textContent='ยังไม่มีคำขอที่ยืนยันแล้ว'}async function refresh(){try{const r=await fetch('/api/requests');if(!r.ok)throw Error();const d=await r.json();rows=d.requests;render();el('status').textContent='อัปเดต '+new Date().toLocaleTimeString('th-TH')}catch{el('status').textContent='อ่านข้อมูลไม่ได้ กำลังลองใหม่'}}el('search').oninput=render;refresh();setInterval(refresh,5000);</script></html>`;
