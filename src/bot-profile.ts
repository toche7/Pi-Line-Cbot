import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SystemStatusService } from './system-status.js';

export const defaultBotName = 'ซีบอต';
export const maxBotNameLength = 30;

export class BotProfile {
  constructor(private readonly path: string) {}

  name() {
    try {
      const data = JSON.parse(readFileSync(this.path, 'utf8'));
      return validName(data?.name) ? data.name : defaultBotName;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return defaultBotName;
      throw error;
    }
  }

  save(name: string) {
    const temporary = this.path + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temporary, JSON.stringify({ name }), { mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.path);
    } finally {
      try { unlinkSync(temporary); } catch {}
    }
  }
}

function validName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 80
    && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name);
}

export function botProfileHandler(profile: BotProfile | undefined, status: SystemStatusService | undefined, csrf: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (code: number, data: unknown) => res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    }).end(JSON.stringify(data));
    const origin = 'http://' + req.headers.host;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')
      || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')
      || (req.headers.origin && req.headers.origin !== origin)
      || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) {
      return send(403, { error: 'คำขอไม่ผ่านการตรวจเว็บหลังบ้าน' });
    }
    const line = req.url === '/api/bot-line';
    if ((!line || req.method !== 'GET') && req.method !== 'POST') return send(405, { error: 'ไม่รองรับวิธีนี้' });
    if (req.method === 'POST' && (req.headers.origin !== origin || req.headers['x-customer-token'] !== csrf)) {
      return send(403, { error: 'กรุณาเปิดเว็บใหม่ก่อนทำรายการ' });
    }
    try {
      if (line) {
        if (!status) return send(503, { error: 'บริการตรวจสถานะ LINE ยังไม่พร้อม' });
        const snapshot = req.method === 'POST' ? await status.checkExternal() : await status.snapshot();
        return send(200, { account: snapshot.lineAccount, status: snapshot.cards.find(card => card.id === 'line') });
      }
      if (!profile) return send(503, { error: 'บริการตั้งชื่อบอตยังไม่พร้อม' });
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(415, { error: 'ต้องส่ง JSON' });
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const part of req) {
        const chunk = Buffer.from(part);
        bytes += chunk.length;
        if (bytes > 4096) return send(413, { error: 'ข้อมูลเกินกำหนด' });
        chunks.push(chunk);
      }
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return send(400, { error: 'JSON ไม่ถูกต้อง' }); }
      const name = (data as { name?: unknown } | null)?.name;
      if (!validName(name) || name.trim().length > maxBotNameLength) {
        return send(400, { error: `กรอกชื่อบอต 1–${maxBotNameLength} ตัวอักษรในบรรทัดเดียว` });
      }
      profile.save(name.trim());
      return send(200, { name: profile.name() });
    } catch {
      return send(503, { error: 'ทำรายการไม่สำเร็จ กรุณาลองใหม่' });
    }
  };
}
