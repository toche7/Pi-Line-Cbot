import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CustomerCore } from './core.js';

export function validSignature(raw: Buffer, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(signature, 'base64');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function lineReply(accessToken: string, fetcher: typeof fetch = fetch) {
  return async (replyToken: string, text: string) => {
    const response = await fetcher('https://api.line.me/v2/bot/message/reply', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4500) }] }),
    });
    // Do not read or log provider error bodies or authorization headers.
    if (!response.ok) throw new Error('LINE reply failed');
  };
}

type LineOptions = {
  secret: string; account: string; allowedUsers: Set<string>; dryRun: boolean;
  reply: (token: string, text: string) => Promise<void>;
  core: Pick<CustomerCore, 'client'>;
  log?: (record: object) => void;
};

export class LineAdapter {
  private seen = new Map<string, number>();
  private tasks = new Set<Promise<void>>();
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(private options: LineOptions) {}
  async drain() { await Promise.allSettled([...this.tasks]); }
  close() { this.closed = true; }

  // Called only with the untouched bytes collected by the HTTP adapter.
  accept(raw: Buffer, signature: string | undefined): number {
    if (this.closed) return 503;
    if (!validSignature(raw, signature, this.options.secret)) return 401;
    let body: any;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return 400; }
    if (!body || !Array.isArray(body.events) || body.events.length > 20) return 400;
    const eligible = body.events.filter((event: any) =>
      event?.type === 'message' && event.mode !== 'standby' && event.message?.type === 'text'
      && typeof event.message.text === 'string' && typeof event.webhookEventId === 'string'
      && event.webhookEventId.length <= 128 && typeof event.replyToken === 'string'
      && event.source?.type === 'user' && typeof event.source.userId === 'string'
      && this.options.allowedUsers.has(event.source.userId));
    for (const [key, expires] of this.seen) if (expires <= Date.now()) this.seen.delete(key);
    const fresh = eligible.filter((event: any) => !this.seen.has(event.webhookEventId));
    if (this.tasks.size + fresh.length > 32 || this.seen.size + fresh.length > 10000) return 503;
    for (const event of fresh) {
      if (this.seen.has(event.webhookEventId)) continue;
      this.seen.set(event.webhookEventId, Date.now() + 24 * 60 * 60_000);
      const receivedAt = Date.now();
      const task = this.tail.then(async () => {
        if (this.closed) return;
        const requestId = randomUUID();
        const record = (outcome: string) => this.options.log?.({ requestId, channel: 'line', outcome });
        if (Date.now() - receivedAt > 20000) { record('queue_expired'); return; }
        let text = '';
        try {
          const client = this.options.core.client({ channel: 'line', scope: `${this.options.account}:direct`, user: event.source.userId });
          await client.send(event.message.text, { text: value => { text += value; }, status: () => {} });
        } catch { text = 'ขณะนี้ซีบอตยังตอบไม่ได้ กรุณาลองใหม่ภายหลัง หรือติดต่อเจ้าหน้าที่ผ่าน https://cbtumu.net/faq/'; }
        if (!text.trim()) text = 'ยังไม่พบคำตอบที่ยืนยันได้ กรุณาดู https://cbtumu.net/faq/';
        if (this.closed) return;
        if (Date.now() - receivedAt > 50000) { record('reply_expired'); return; }
        if (this.options.dryRun) { record('dry_run_no_send'); return; }
        try { await this.options.reply(event.replyToken, text); record('replied'); }
        catch { record('reply_failed_no_retry'); }
      });
      this.tail = task.catch(() => {});
      this.tasks.add(task);
      void task.finally(() => this.tasks.delete(task)).catch(() => {});
    }
    return 200;
  }
}

export function webhookHandler(adapter: LineAdapter) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.url === '/health' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}'); return;
    }
    if (request.url !== '/webhook/line' || request.method !== 'POST') { response.writeHead(404).end(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 256 * 1024) { response.writeHead(413).end(); return; }
        chunks.push(bytes);
      }
      const signature = request.headers['x-line-signature'];
      const code = adapter.accept(Buffer.concat(chunks), typeof signature === 'string' ? signature : undefined);
      response.writeHead(code).end(); // ACK before model work; only verified events reach the queue.
    } catch { if (!response.headersSent) response.writeHead(400).end(); }
  };
}
