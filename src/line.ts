import { humanIntent, humanRequestReply } from './human-request.js';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CustomerCore } from './core.js';
import { failureCategory, lineFailureReply, neutralFailureReply } from './diagnostics.js';
import type { MonitorEvent } from './monitor.js';
import { conversationKey, type ConversationControl } from './conversation-control.js';
import { LineConversations } from './line-memory.js';

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
  versionText?: string;
  secret: string; account: string; allowedUsers: Set<string>; dryRun: boolean;
  reply: (token: string, text: string) => Promise<void>;
  control?: ConversationControl;
  core: Pick<CustomerCore, 'client'> & Partial<Pick<CustomerCore, 'faqWithoutModel' | 'neutralFallback'>>;
  log?: (record: object) => void;
  observe?: (event: MonitorEvent) => void;
  observePendingUser?: (account: string, userId: string) => void;
  observeGroupId?: (groupId: string) => void;
  observeGroup?: (event: import('./line-groups.js').GroupObservation) => void;
  groupReplies?: import('./line-group-replies.js').LineGroupReplies;
};

export class LineAdapter {
  private seen = new Map<string, number>();
  private tasks = new Set<Promise<void>>();
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  private conversations: LineConversations;
  constructor(private options: LineOptions) { this.conversations = new LineConversations(options.core, undefined, identity => options.control?.cancelHumanRequest(conversationKey(options.account, identity.user))); }
  async drain() { await Promise.allSettled([...this.tasks]); await this.options.groupReplies?.drain(); }
  close() { this.closed = true; this.conversations.close(); this.options.groupReplies?.close(); }

  // Called only with the untouched bytes collected by the HTTP adapter.
  accept(raw: Buffer, signature: string | undefined): number {
    if (this.closed) return 503;
    if (!validSignature(raw, signature, this.options.secret)) return 401;
    let body: any;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return 400; }
    if (!body || !Array.isArray(body.events) || body.events.length > 20) return 400;
    for (const event of body.events) {
      if (event?.type === 'message' && event.mode !== 'standby' && event.source?.type === 'user'
        && typeof event.source.userId === 'string' && /^U[0-9a-f]{32}$/i.test(event.source.userId)
        && !this.options.allowedUsers.has(event.source.userId)) {
        try { this.options.observePendingUser?.(this.options.account, event.source.userId); }
        catch { this.options.log?.({ channel: 'line', outcome: 'pending_user_metadata_failed' }); }
      }
    }
    // Group events never enter the direct-chat path. A dedicated opt-in service
    // can respond to verified native mentions in explicitly enabled rooms only.
    for (const event of body.events) {
      if (event?.source?.type === 'group' && /^C[0-9a-f]{32}$/i.test(event.source.groupId ?? '')) {
        try { this.options.observeGroupId?.(event.source.groupId); } catch { /* Discovery must not disrupt direct chats. */ }
        if (event.mode !== 'standby' && ['message', 'join', 'leave'].includes(event.type)) {
          try { this.options.observeGroup?.({ groupId: event.source.groupId, type: event.type,
            eventId: typeof event.webhookEventId === 'string' ? event.webhookEventId : undefined,
            userId: typeof event.source.userId === 'string' ? event.source.userId : undefined,
            ...(event.type === 'message' && event.message?.type === 'text' && typeof event.message.text === 'string' ? { text: event.message.text } : {}),
            at: typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) && Number.isFinite(new Date(event.timestamp).getTime())
              ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
          }); } catch { /* Room storage must not interrupt direct-message routing. */ }
        }
        if (this.options.groupReplies) {
          try { if (!this.options.groupReplies.accept(event, body.destination)) return 503; }
          catch { this.options.log?.({ channel: 'line-group', outcome: 'group_reply_storage_failed' }); return 503; }
        }
      }
    }
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
      const key = conversationKey(this.options.account, event.source.userId);
      const identity = { channel: 'line' as const, scope: `${this.options.account}:direct`, user: event.source.userId };
      let routing: { text?: string; allowWaiting: boolean; requestId?: string; skip?: boolean } | undefined;
      const control = this.options.control;
      if (control && !control.mode(key).human) {
        const prompt = event.message.text.trim();
        if (prompt !== '/confirm-forget') this.conversations.cancelPendingForget(identity);
        const intent = humanIntent(prompt);
        try {
          if (intent?.kind === 'request') {
            const result = control.requestHuman(key, intent.stopBot);
            routing = { allowWaiting: true, requestId: result.waiting?.id, skip: !result.changed,
              text: humanRequestReply(!!result.waiting?.stopBot) };
          } else if (intent?.kind === 'cancel') {
            const cancelled = control.cancelHumanRequest(key);
            routing = { allowWaiting: true, text: cancelled ? 'ยกเลิกคำขอรอเจ้าหน้าที่แล้วครับ ซีบอตคุยต่อได้' : 'ไม่มีคำขอรอเจ้าหน้าที่ครับ ซีบอตคุยต่อได้' };
          } else if (intent?.kind === 'info') {
            routing = { allowWaiting: true, text: control.mode(key).waiting
              ? 'คำขอของคุณยังรอเจ้าหน้าที่ครับ ยังไม่มีผู้รับช่วงและยังยืนยันเวลาตอบไม่ได้'
              : 'เจ้าหน้าที่รับช่วงคุยในแชต LINE นี้ได้ครับ หากต้องการ พิมพ์ ขอคุยกับเจ้าหน้าที่ ยังยืนยันเวลาตอบไม่ได้ครับ' };
          } else if (/^\/(?:help|version|memory|reset|forget|confirm-forget|cancel)$/.test(prompt)) routing = { allowWaiting: true };
        } catch { this.options.log?.({ channel: 'line', outcome: 'handover_request_storage_failed' }); return 503; }
      }
      this.seen.set(event.webhookEventId, Date.now() + 24 * 60 * 60_000);
      let ticket = control?.ticket(key);
      const authorized = () => !ticket || control!.valid(key, ticket, routing?.allowWaiting, routing?.requestId);
      const receivedAt = Date.now();
      const observe = (direction: 'in' | 'out', text: string, status: string) => {
        try { this.options.observe?.({ id: event.webhookEventId, userId: event.source.userId,
          account: this.options.account, direction, text, status, at: new Date().toISOString() }); }
        catch { /* Monitoring must not interrupt replies. */ }
      };
      observe('in', event.message.text, 'received');
      const task = this.tail.then(async () => {
        if (this.closed) return;
        if (control && event.message.text.trim() !== '/confirm-forget') this.conversations.cancelPendingForget(identity);
        if (!authorized()) { observe('out', '', 'bot_paused'); return; }
        if (routing?.skip) { observe('out', '', 'handover_request_duplicate'); return; }
        const requestId = randomUUID();
        const record = (outcome: string, category?: string) => this.options.log?.({ requestId, channel: 'line', outcome, ...(category ? { category } : {}) });
        if (Date.now() - receivedAt > 20000) { record('queue_expired'); observe('out', '', 'queue_expired'); return; }
        let text = routing?.text ?? '';
        let fallback = false;
        try {
          if (event.message.text.trim() === '/version') text = this.options.versionText || 'ยังไม่มีข้อมูลเวอร์ชันของเซิร์ฟเวอร์นี้ครับ';
          else if (!routing?.text) await this.conversations.send(identity, event.message.text, { text: value => { text += value; }, status: () => {} });
          // Successful /reset and /confirm-forget also clear the waiting request.
          if (routing?.allowWaiting && !routing.requestId && /^\/(?:reset|confirm-forget)$/.test(event.message.text.trim())
            && ticket && control && control.mode(key).epoch === ticket.epoch + 1 && !control.mode(key).waiting && !control.mode(key).human) ticket = control.ticket(key);
        } catch (error) {
          fallback = true;
          record('core_failed', failureCategory(error));
          text = this.options.core.neutralFallback ? neutralFailureReply(error) : lineFailureReply(error, this.options.core.faqWithoutModel ?? true);
        }
        if (!text.trim()) text = this.options.core.neutralFallback ? 'ยังไม่มีข้อมูลเรื่องนี้ครับ' : 'ยังไม่พบคำตอบที่ยืนยันได้ กรุณาดู https://cbtumu.net/faq/';
        if (this.closed) return;
        if (Date.now() - receivedAt > 50000) { record('reply_expired'); observe('out', text, 'reply_expired'); return; }
        if (this.options.dryRun) { record('dry_run_no_send'); observe('out', text, 'dry_run_no_send'); return; }
        if (ticket && !this.options.control!.beginBotSend(key, ticket, routing?.allowWaiting, routing?.requestId)) { observe('out', '', 'bot_paused'); return; }
        try { await this.options.reply(event.replyToken, text); record(fallback ? 'replied_fallback' : 'replied'); observe('out', text, fallback ? 'replied_fallback' : 'replied'); }
        catch { record('reply_failed_no_retry'); observe('out', text, 'reply_failed_no_retry'); }
        finally { this.options.control?.endSend(key); }
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
