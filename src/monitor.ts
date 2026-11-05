import { mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type MonitorEvent = { id: string; userId: string; account: string; direction: 'in' | 'out'; text: string; status: string; at: string };
export class ConversationMonitor {
  private events: MonitorEvent[] = [];
  private file: string;
  private storageError = false;
  constructor(directory: string, private retentionDays = 90) {
    mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
    this.file = resolve(directory, 'monitor.json');
    try { this.events = JSON.parse(readFileSync(this.file, 'utf8')); if (!Array.isArray(this.events)) throw new Error(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Monitor store unreadable'); }
    this.prune();
    this.persist();
  }
  private persist() {
    try {
      writeFileSync(this.file + '.tmp', JSON.stringify(this.events), { mode: 0o600 });
      renameSync(this.file + '.tmp', this.file); this.storageError = false;
    } catch { this.storageError = true; }
  }
  private prune() {
    const cutoff = Date.now() - this.retentionDays * 86400000;
    this.events = this.events.filter(e => Date.parse(e.at) > cutoff).slice(-10000);
  }
  record(event: MonitorEvent) {
    this.events.push({ ...event, text: event.text.slice(0, 10000) }); this.prune();
    this.persist();
  }
  // Read without retention writes for the overview aggregation.
  readSnapshot(now = Date.now()) {
    return { events: this.events.filter(e => Date.parse(e.at) > now - this.retentionDays * 86400000).slice(-10000), storageError: this.storageError, retentionDays: this.retentionDays };
  }
  snapshot() {
    const previous = this.events.length;
    this.prune();
    if (previous !== this.events.length) this.persist();
    return { events: this.events, storageError: this.storageError, retentionDays: this.retentionDays, pushEnabled: false };
  }
}

export function monitorHandler(monitor: ConversationMonitor, html: string | (() => string) = monitorPage) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'" };
    // The monitor has its own loopback listener. Reject DNS rebinding and cross-origin requests.
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      res.writeHead(403, headers).end(); return;
    }
    if (req.method !== 'GET') { res.writeHead(405, headers).end(); return; }
    if (req.url === '/api/monitor') { res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify(monitor.snapshot())); return; }
    if (req.url !== '/') { res.writeHead(404, headers).end(); return; }
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }).end(typeof html === 'function' ? html() : html);
  };
}
export const monitorPage = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ซีบอต · ติดตามบทสนทนา</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#172b42;font:16px system-ui}header{background:#142e47;color:white;padding:24px 5%}h1{margin:0 0 8px;font-size:26px}p{margin:8px 0;color:#63758a}header p{color:#c4d5e4}.summary{display:flex;gap:18px;padding:22px 5%;flex-wrap:wrap}.card{background:white;padding:18px 24px;border-radius:12px;min-width:180px}.card strong{display:block;font-size:28px}main{display:grid;grid-template-columns:320px 1fr;gap:20px;padding:0 5% 32px}section{background:white;border-radius:12px;padding:20px}input{width:100%;padding:12px;border:1px solid #ccd6df;border-radius:8px}button{display:block;text-align:left;width:100%;padding:14px;margin-top:8px;border:1px solid #dde5ed;background:#fff;border-radius:8px;cursor:pointer;overflow-wrap:anywhere}button[aria-pressed=true]{background:#e5f4f2;border-color:#168779}article{margin:14px 0;padding:14px;background:#f1f5f9;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere}article.out{background:#e6f4f1;margin-left:25px}small{display:block;color:#586d82;margin-bottom:8px}#state{padding:0 5% 16px}#messages{max-height:65vh;overflow:auto}h2{font-size:19px;margin-top:0}@media(max-width:700px){main{grid-template-columns:1fr}.summary{gap:8px}.card{min-width:140px}}</style>
<header><h1>ซีบอต · ติดตามบทสนทนา</h1><p>LINE / ผู้ทดสอบที่อยู่ใน allowlist · รีเฟรชทุก 5 วินาที</p></header>
<div class="summary"><div class="card">ผู้ติดต่อ<strong id="contacts">0</strong></div><div class="card">ข้อความรับเข้า<strong id="inbound">0</strong></div><div class="card">ส่งสำเร็จ<strong id="sent">0</strong></div><div class="card">Push message<strong style="font-size:18px">ยังไม่เปิดใช้งาน</strong></div></div>
<div id="state" role="status"></div><main><section><h2>ผู้ติดต่อ</h2><input id="search" aria-label="ค้นหา LINE user ID" placeholder="ค้นหา LINE user ID"><p>แสดง LINE user ID ยังไม่ได้ดึงชื่อโปรไฟล์</p><div id="users"></div></section><section><h2 id="heading">เลือกผู้ติดต่อเพื่อดูบทสนทนา</h2><p>เริ่มเก็บหลังเปิดระบบ · เก็บสูงสุด 90 วัน / 10,000 รายการ · ไม่รวมประวัติก่อนเปิดระบบ</p><div id="messages"></div></section></main>
<script>let data=[],selected='';const el=id=>document.getElementById(id);function render(){const groups=new Map();for(const e of data){const key=JSON.stringify([e.account,e.userId]);groups.set(key,e)}el('contacts').textContent=groups.size;el('inbound').textContent=data.filter(e=>e.direction==='in').length;el('sent').textContent=data.filter(e=>e.status==='replied'||e.status==='replied_fallback').length;el('users').replaceChildren();for(const [key,e] of [...groups].reverse()){if(!e.userId.toLowerCase().includes(el('search').value.toLowerCase()))continue;const b=document.createElement('button');b.textContent=e.userId+' · '+new Date(e.at).toLocaleString('th-TH');b.setAttribute('aria-pressed',String(selected===key));b.onclick=()=>{selected=key;render()};el('users').append(b)}if(!groups.size)el('users').textContent='ยังไม่มีข้อความใหม่';el('messages').replaceChildren();if(selected){const who=groups.get(selected);el('heading').textContent=who?'บทสนทนา · '+who.userId:'ไม่พบประวัติในช่วงที่เก็บ';for(const e of data.filter(e=>JSON.stringify([e.account,e.userId])===selected)){const a=document.createElement('article');a.className=e.direction;const s=document.createElement('small');s.textContent=(e.direction==='in'?'ผู้ติดต่อ':'ซีบอต')+' · '+new Date(e.at).toLocaleString('th-TH')+' · '+e.status;a.append(s,document.createTextNode(e.text));el('messages').append(a)}}}async function refresh(){try{const r=await fetch('/api/monitor');if(!r.ok)throw Error();const d=await r.json();data=d.events;render();el('state').textContent=d.storageError?'บันทึกลงดิสก์ไม่สำเร็จ ข้อมูลล่าสุดอาจหายเมื่อรีสตาร์ต':'เชื่อมต่อแล้ว · อัปเดต '+new Date().toLocaleTimeString('th-TH')}catch{el('state').textContent='เชื่อมต่อไม่ได้ กำลังลองใหม่'}}el('search').oninput=render;refresh();setInterval(refresh,5000);</script></html>`;
