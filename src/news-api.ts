import type { IncomingMessage, ServerResponse } from 'node:http';
import { NewsError, type NewsService } from './news.js';
export function newsHandler(service: NewsService, token: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }).end(JSON.stringify(data));
    const remote = req.socket.remoteAddress;
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote || '') || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(String(req.headers['sec-fetch-site'])))) return reply(403, { error: 'อนุญาตเฉพาะเว็บบนเครื่องนี้' });
    try {
      if (req.method === 'GET') {
        const image=/^\/api\/news\/image\/([a-f0-9]{64})$/.exec(req.url||'');
        if(image){const data=service.imageData(image[1]);res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data);return;}
        if(req.url&&req.url!=='/api/news')return reply(404,{error:'ไม่พบรายการ'});
        return reply(200, service.snapshot());
      }
      if (req.method !== 'POST') return reply(405, { error: 'ไม่รองรับวิธีนี้' });
      if (req.headers.origin !== 'http://' + req.headers.host || !token || req.headers['x-news-token'] !== token || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return reply(403, { error: 'คำขอไม่ผ่านการตรวจ กรุณาเปิดเว็บใหม่' });
      let size = 0; const chunks: Buffer[] = [];
      for await (const part of req) { const chunk = Buffer.from(part); size += chunk.length; if (size > 1220000) return reply(413, { error: 'ข้อมูลรูปเกินกำหนด' }); chunks.push(chunk); }
      let input: unknown; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(size>32768?413:400, { error: size>32768?'ข้อมูลเกินกำหนด':'JSON ไม่ถูกต้อง' }); }
      if((input as any)?.action==='image.upload')return reply(200,service.uploadImage((input as any).base64));
      if(size>32768)return reply(413,{error:'ข้อมูลเกิน 32 KiB'});
      const result=service.mutate(input);return reply(200,req.headers['x-paged-reply']==='1'?{id:result.id,revision:result.revision}:result);
    } catch (e) { return reply(e instanceof NewsError ? e.status : 503, { error: e instanceof NewsError ? e.message : 'อ่านหรือบันทึกไม่ได้ กรุณาลองใหม่' }); }
  };
}
