import type { IncomingMessage, ServerResponse } from 'node:http';
import { NewsError, type NewsService } from './news.js';
export function newsHandler(service: NewsService, token: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }).end(JSON.stringify(data));
    const remote = req.socket.remoteAddress;
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote || '') || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(String(req.headers['sec-fetch-site'])))) return reply(403, { error: 'อนุญาตเฉพาะเว็บบนเครื่องนี้' });
    try {
      if (req.method === 'GET') return reply(200, service.snapshot());
      if (req.method !== 'POST') return reply(405, { error: 'ไม่รองรับวิธีนี้' });
      if (req.headers.origin !== 'http://' + req.headers.host || !token || req.headers['x-news-token'] !== token || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return reply(403, { error: 'คำขอไม่ผ่านการตรวจ กรุณาเปิดเว็บใหม่' });
      let size = 0; const chunks: Buffer[] = [];
      for await (const part of req) { const chunk = Buffer.from(part); size += chunk.length; if (size > 32768) return reply(413, { error: 'ข้อมูลเกิน 32 KiB' }); chunks.push(chunk); }
      let input: unknown; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { error: 'JSON ไม่ถูกต้อง' }); }
      return reply(200, service.mutate(input));
    } catch (e) { return reply(e instanceof NewsError ? e.status : 503, { error: e instanceof NewsError ? e.message : 'อ่านหรือบันทึกไม่ได้ กรุณาลองใหม่' }); }
  };
}
