import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ResponseSettingsService } from './response-settings-service.js';
import { modelConnection } from './model-connection.js';

const displayTime = (at: number | string) => new Date(at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) + ' (เวลาไทย)';
type State = 'ok' | 'warning' | 'error' | 'unknown';
export type ConnectionCard = { id: string; title: string; state: State; summary: string; details: string[]; checkedAt: string | null };
type ExternalResult = { line: ConnectionCard; external: ConnectionCard; at: number };
export type SystemStatusOptions = {
  startedAt: number; webhookPort: number; adminPort: number; listeners: () => { webhook: boolean; admin: boolean };
  token: string; channelConfigured: boolean; secretConfigured: boolean; dryRun: boolean; publicBase: string;
  settings?: ResponseSettingsService; stores: { name: string; check: () => boolean }[];
  worker: () => { running: boolean; suspended: boolean; busy: boolean };
};
// Only an origin from server config or the fixed local tunnel API is accepted.
// Never accept a probe destination from an HTTP request or forward LINE auth to it.
export function publicOrigin(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' || (u.port && u.port !== '443')
      || !u.hostname.includes('.') || /^(?:\d+\.){3}\d+$/.test(u.hostname) || u.hostname.includes(':') || /(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname)) return null;
    return u.origin;
  } catch { return null; }
}
export class SystemStatusService {
  private external: ExternalResult | null = null;
  private checking?: Promise<void>;
  private lastCheck = -Infinity;
  constructor(private options: SystemStatusOptions, private fetcher: typeof fetch = fetch, private now = () => Date.now()) {}
  private card(id: string, title: string, state: State, summary: string, details: string[], checkedAt: string | null = new Date(this.now()).toISOString()): ConnectionCard {
    return { id, title, state, summary, details, checkedAt };
  }
  async snapshot() {
    const o = this.options, at = this.now(), listening = o.listeners();
    const cards = [this.card('server', 'Server', listening.admin && listening.webhook ? 'ok' : 'error', listening.admin && listening.webhook ? 'ทั้งสองพอร์ตเปิดรับการเชื่อมต่อ' : 'มีพอร์ตที่ยังไม่เปิดรับ', [
      'เว็บหลังบ้าน ' + o.adminPort + ': ' + (listening.admin ? 'เปิดรับ' : 'ไม่เปิดรับ'), 'Webhook ' + o.webhookPort + ': ' + (listening.webhook ? 'เปิดรับ' : 'ไม่เปิดรับ'),
      'เริ่มโปรเซส ' + displayTime(o.startedAt), 'ทำงานมา ' + Math.max(0, Math.floor((at-o.startedAt)/60000)) + ' นาที', 'ตรวจจาก listener ในโปรเซสเดียวกัน; การโหลดสถานะนี้สำเร็จยืนยันเฉพาะเส้นทางเว็บหลังบ้าน', 'หากติดต่อไม่ได้ อาจเกิดจาก server หรือเครือข่าย ต้องมีระบบเฝ้าภายนอกเพื่อแยกสาเหตุ'
    ])];
    if (this.external) {
      for (const c of [this.external.line, this.external.external]) cards.push({ ...c, ...(at-this.external.at > 5*60000 ? { state: 'unknown' as const, summary: 'ผลตรวจเก่าเกิน 5 นาที · กดตรวจการเชื่อมต่อ', details: [c.summary, ...c.details] } : {}) });
    } else {
      cards.push(this.card('line', 'LINE', o.token && o.channelConfigured && o.secretConfigured ? 'unknown' : 'error', o.token && o.channelConfigured && o.secretConfigured ? 'ตั้งค่าแล้ว · ยังไม่ได้ตรวจ API' : 'ค่าการเชื่อมต่อยังไม่ครบ', [o.dryRun ? 'โหมด dry run: ไม่ตอบ LINE จริง' : 'โหมดตอบจริงตามสิทธิ์เดิม', 'มี credentials ไม่ยืนยันว่าใช้งานได้ กดตรวจการเชื่อมต่อเพื่อตรวจ API'], null));
      cards.push(this.card('external', 'การเชื่อมต่อภายนอก / Webhook', 'unknown', 'ยังไม่ได้ตรวจการเชื่อมต่อ', ['รองรับ HTTPS ของ server จริงหรือ tunnel ระหว่างทดลอง', 'ตรวจเมื่อกดปุ่มเท่านั้น ไม่เปลี่ยน URL หรือเปิด tunnel'], null));
    }
    try {
      if (!o.settings) throw Error();
      const m = await o.settings.connectionInfo(), last = modelConnection(m.provider,m.model), fresh = last && at-Date.parse(last.at) <= 5*60000;
      const categories: Record<string,string> = { model_rate_limit: 'ถูกจำกัดโควตา (429)', model_auth: 'การยืนยันสิทธิ์ไม่สำเร็จ', model_network: 'การเชื่อมต่อโมเดลไม่สำเร็จ', model_timeout: 'หมดเวลารอ', model_format: 'รูปแบบคำตอบไม่สมบูรณ์' };
      cards.push(this.card('ai','AI',!m.healthy || !m.configured ? 'warning' : fresh ? last.category ? 'warning' : 'ok' : 'unknown',!m.healthy ? 'ตั้งค่ามีข้อผิดพลาด · ใช้ last-good' : !m.configured ? 'ยังไม่พบ credentials ของโมเดลนี้' : fresh ? last.category ? 'คำขอล่าสุด: '+(categories[last.category] || 'ไม่สำเร็จ') : 'คำขอโมเดลล่าสุดสำเร็จ' : last ? 'ผลเรียกล่าสุดเกิน 5 นาที' : 'ตั้งค่าแล้ว · ยังไม่มีผลเรียกหลังเริ่มโปรเซส',[
        m.provider+' / '+m.model, 'Credentials: '+(m.configured?'พบการตั้งค่า':'ยังไม่พบ'),
        ...(last?['ผลเรียกล่าสุด '+displayTime(last.at)+' · '+last.elapsedMs+' ms',last.category ? categories[last.category] || 'คำขอไม่สำเร็จ' : 'ได้รับข้อความตอบจากโมเดล ไม่ใช่การตรวจคุณภาพคำตอบ']:[]),
        'หน้านี้ไม่เรียกโมเดลหรือใช้โควตา ทดลองได้ในจัดการบอต ผลเก็บเฉพาะโปรเซสนี้และอาจมาจากการลองโมเดล'
      ],last?.at??null));
    } catch { cards.push(this.card('ai','AI','unknown','อ่านการตั้งค่าโมเดลไม่ได้',['ยังไม่ได้ทดสอบการเชื่อมต่อโมเดล'],null)); }
    const stores = o.stores.map(s => { try { return { name: s.name, ok: s.check() }; } catch { return { name: s.name, ok: false }; } });
    let worker: ReturnType<SystemStatusOptions['worker']> | null = null;
    try { worker=o.worker(); } catch { /* report below */ }
    cards.push(this.card('data','ข้อมูลและงานส่งข่าว',stores.some(s=>!s.ok) || !worker?.running ? 'warning' : 'ok', stores.some(s=>!s.ok) ? 'มีแหล่งข้อมูลอ่านไม่ได้หรือมีข้อผิดพลาด' : !worker?.running ? 'อ่านข้อมูลได้ · worker ไม่พร้อม' : 'อ่านข้อมูลได้ · worker ทำงาน',[
      ...stores.map(s=>s.name+': '+(s.ok?'อ่านได้':'ตรวจไม่ผ่าน')),
      'Worker: '+(!worker?'ไม่ทราบสถานะ':worker.suspended?'พักเพราะข้อผิดพลาด':worker.running?worker.busy?'ทำงาน · มีรอบกำลังประมวลผล':'ทำงาน':'หยุดอยู่'),
      'ตรวจอ่านเท่านั้น ไม่ทดลองเขียนหรือลบข้อมูล ไม่ยืนยันว่าการเขียนครั้งถัดไปจะสำเร็จ'
    ]));
    return { generatedAt: new Date(at).toISOString(), cards, checking: !!this.checking, externalCheckedAt: this.external ? new Date(this.external.at).toISOString() : null };
  }
  async checkExternal() {
    if (this.checking) await this.checking;
    else if (this.now()-this.lastCheck >= 30000) {
      this.lastCheck=this.now();
      this.checking=this.probe().finally(()=>{this.checking=undefined});
      await this.checking;
    }
    return this.snapshot();
  }
  private async json(url: string, token = ''): Promise<any> {
    const r = await this.fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(4000),headers:token?{Authorization:'Bearer '+token}:{}});
    if(!r.ok) throw Error();
    // Bounded trusted metadata responses; never return raw responses to the browser.
    const body = await r.text(); if(body.length>100000) throw Error(); return JSON.parse(body);
  }
  private async probe() {
    const o=this.options;
    const linePromise = o.token ? Promise.allSettled([this.json('https://api.line.me/v2/bot/info',o.token),this.json('https://api.line.me/v2/bot/channel/webhook/endpoint',o.token)]) : Promise.resolve(null);
    let base=publicOrigin(o.publicBase), source=o.publicBase?'HTTPS ที่ตั้งค่าไว้':'tunnel ที่เปิดอยู่';
    if(!o.publicBase) {
      try { const d=await this.json('http://127.0.0.1:4040/api/tunnels');const tunnels=Array.isArray(d.tunnels)?d.tunnels.filter((t:any)=>['http://127.0.0.1:'+o.webhookPort,'http://localhost:'+o.webhookPort,'localhost:'+o.webhookPort,'127.0.0.1:'+o.webhookPort,String(o.webhookPort)].includes(t.config?.addr)&&publicOrigin(t.public_url)):[];if(tunnels.length===1)base=publicOrigin(tunnels[0].public_url); } catch { /* no tunnel evidence */ }
    }
    let reachable=false;
    if(base) { try { reachable=(await this.json(base+'/health')).ok===true; } catch { /* unknown reason: TLS/network/server */ } }
    const results=await linePromise, bot=results?.[0], webhook=results?.[1], endpoint=webhook?.status==='fulfilled'?webhook.value:null;
    const botOk=bot?.status==='fulfilled'&&typeof bot.value.displayName==='string';
    const validEndpoint=endpoint&&typeof endpoint.endpoint==='string'&&typeof endpoint.active==='boolean';
    const endpointMatches=!!base&&validEndpoint&&endpoint.endpoint===base+'/webhook/line';
    const line=this.card('line','LINE',!botOk?'error':!o.channelConfigured||!o.secretConfigured||o.dryRun?'warning':'ok',botOk?'LINE API ตอบกลับ'+(o.dryRun?' · dry run':''):'ตรวจ LINE API ไม่สำเร็จ',[
      ...(botOk?['OA: '+bot.value.displayName.slice(0,100)]:['ตรวจ credentials หรือเครือข่ายจากเครื่องนี้']),
      o.dryRun?'โหมด dry run: ไม่ตอบ LINE จริง':'โหมดตอบจริงตามสิทธิ์เดิม', 'ค่าบัญชีและ secret: '+(o.channelConfigured&&o.secretConfigured?'ตั้งไว้แล้ว (ไม่ได้ตรวจความตรงกับ OA)':'ยังไม่ครบ'),
      'ตรวจข้อมูล OA ด้วย GET ไม่ส่งข้อความ ไม่ทดสอบการส่งจริง'
    ]);
    const external=this.card('external','การเชื่อมต่อภายนอก / Webhook',!base?'unknown':!reachable?'error':!validEndpoint?'unknown':!endpoint.active||!endpointMatches?'warning':'ok',!base?'ยังไม่พบ HTTPS ที่ตรวจได้':!reachable?'เรียก health ภายนอกไม่สำเร็จ':!validEndpoint?'HTTPS ตอบกลับ · ยังตรวจค่า LINE webhook ไม่ได้':!endpoint.active?'HTTPS ตอบกลับ · LINE webhook ปิดอยู่':!endpointMatches?'HTTPS ตอบกลับ · URL ของ LINE ไม่ตรง':'HTTPS ตอบกลับ · LINE webhook เปิดและ URL ตรง',[
      'ที่มา: '+source,...(base?[base]:[]),
      'Public health: '+(base?reachable?'ตอบ ok=true':'ตรวจไม่ผ่าน':'ยังไม่ได้ตรวจ'),
      'LINE webhook: '+(!validEndpoint?'อ่านค่าไม่ได้':(endpoint.active?'เปิด':'ปิด')+' · '+(base?endpointMatches?'URL ตรง':'URL ไม่ตรง':'ยังเทียบ URL ไม่ได้')),
      'ตรวจจากเครื่อง server นี้ ไม่ใช่หลักฐานว่า LINE ส่ง event ถึงจริง ไม่เปลี่ยน webhook หรือเริ่ม ngrok'
    ]);
    this.external={line,external,at:this.now()};
  }
}
export function systemStatusHandler(service: SystemStatusService | undefined, token: string) {
  return async (req: IncomingMessage,res: ServerResponse) => {
    const reply=(status:number,data:unknown)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}).end(JSON.stringify(data));
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??'')||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)||(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(String(req.headers['sec-fetch-site'])))){reply(403,{error:'อนุญาตเฉพาะเว็บบนเครื่องนี้'});return}
    const check=req.url==='/api/system-status/check';
    if(req.method!==(check?'POST':'GET')){reply(405,{error:'ไม่รองรับวิธีนี้'});return}
    if(check&&(!token||req.headers.origin!=='http://'+req.headers.host||req.headers['x-customer-token']!==token)){reply(403,{error:'กรุณาเปิดเว็บใหม่ก่อนตรวจการเชื่อมต่อ'});return}
    if(!service){reply(503,{error:'ยังไม่ได้เชื่อมตัวตรวจสถานะระบบ'});return}
    try{reply(200,check?await service.checkExternal():await service.snapshot())}catch{reply(503,{error:'อ่านสถานะระบบไม่ได้ กรุณาลองใหม่'})}
  };
}
