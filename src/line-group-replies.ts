import type { CustomerCore } from './core.js';
import type { LineGroupStore } from './line-groups.js';
import { lineFailureReply, neutralFailureReply } from './diagnostics.js';

export function groupCallWordPrompt(event: any): string | undefined {
  if (event?.type !== 'message' || event.mode === 'standby' || event.source?.type !== 'group'
    || !/^C[0-9a-f]{32}$/i.test(event.source.groupId ?? '') || !/^U[0-9a-f]{32}$/i.test(event.source.userId ?? '')
    || event.message?.type !== 'text' || typeof event.message.text !== 'string'
    || typeof event.replyToken !== 'string' || !event.replyToken || typeof event.webhookEventId !== 'string'
    || !event.webhookEventId || event.webhookEventId.length > 128) return;
  // A deliberate leading call word, not a substring or a forged LINE mention.
  const text = event.message.text.trim();
  if (!/^CBOT/i.test(text)) return;
  return text.slice(4).replace(/^[\s:：,]+/, '').trim();
}

// LINE-provided mention metadata is authoritative; typing a display name or
// mentioning all/another person never activates the bot.
export function groupMentionPrompt(event: any, destination: unknown): string | undefined {
  if (event?.type !== 'message' || event.mode === 'standby' || event.source?.type !== 'group'
    || !/^C[0-9a-f]{32}$/i.test(event.source.groupId ?? '') || !/^U[0-9a-f]{32}$/i.test(event.source.userId ?? '')
    || typeof destination !== 'string' || !/^U[0-9a-f]{32}$/i.test(destination)
    || event.message?.type !== 'text' || typeof event.message.text !== 'string'
    || typeof event.replyToken !== 'string' || !event.replyToken || typeof event.webhookEventId !== 'string'
    || !event.webhookEventId || event.webhookEventId.length > 128) return;
  const mentions = event.message.mention?.mentionees;
  if (!Array.isArray(mentions) || mentions.length > 100) return;
  const own = mentions.filter(m => m?.type === 'user' && m.isSelf === true && m.userId === destination);
  if (!own.length || own.some(m => !Number.isInteger(m.index) || !Number.isInteger(m.length) || m.index < 0 || m.length <= 0
    || m.index + m.length > event.message.text.length || event.message.text[m.index] !== '@')) return;
  let prompt = event.message.text;
  let boundary = prompt.length;
  for (const m of own.sort((a, b) => b.index - a.index)) {
    if (m.index + m.length > boundary) return;
    prompt = prompt.slice(0, m.index) + prompt.slice(m.index + m.length); boundary = m.index;
  }
  return prompt.trim();
}

export class LineGroupReplies {
  private tasks = new Set<Promise<void>>();
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(private store: LineGroupStore, private core: Pick<CustomerCore, 'client'> & Partial<Pick<CustomerCore, 'faqWithoutModel' | 'neutralFallback'>>, private account: string,
    private dryRun: boolean, private reply: (replyToken: string, text: string) => Promise<void>, private log: (record: object) => void = () => {}) {}
  accept(event: any, destination: unknown): boolean {
    const mode = event?.source?.groupId ? this.store.replyMode(event.source.groupId) : undefined;
    // Existing CBOT rooms accept either trigger. Prefer the real mention so its
    // display-name token is removed, and resolve one prompt for one reply only.
    const mentionedPrompt = groupMentionPrompt(event, destination);
    const prompt = mentionedPrompt ?? (mode === 'cbot' ? groupCallWordPrompt(event) : undefined);
    if (prompt === undefined || this.closed || this.dryRun || !this.store.mentionsEnabled(event.source.groupId)) return true;
    if (this.tasks.size >= 16) return false;
    if (!this.store.reserveReply(event.source.groupId, event.webhookEventId)) return true;
    const revision = this.store.modeRevision(event.source.groupId);
    const receivedAt = Date.now(), { groupId, userId } = event.source;
    const finish = (text: string, status: 'accepted' | 'failed' | 'cancelled') => this.store.finishReply(groupId, event.webhookEventId, text, status);
    const task = this.tail.then(async () => {
      if (this.closed || Date.now() - receivedAt > 20000 || !this.store.mentionsEnabled(groupId) || this.store.modeRevision(groupId) !== revision) { finish('', 'cancelled'); return; }
      let text = '';
      if (!prompt) text = mode === 'cbot' ? 'เรียกซีบอตแล้วครับ พิมพ์ CBOT หรือแท็กบัญชีบอต แล้วตามด้วยคำถามได้เลยครับ' : 'เรียกซีบอตแล้วครับ พิมพ์คำถามต่อท้ายแท็กได้เลยครับ';
      else if (prompt.startsWith('/')) text = 'คำสั่งจัดการความจำและคำขอ กรุณาใช้แชตส่วนตัวกับซีบอตครับ ในกลุ่มให้แท็กพร้อมคำถามได้เลย';
      else {
        try {
          // Per-room AND per-sender identity; dedicated core/store cannot see
          // direct messages, other members' turns, notes or private requests.
          await this.core.client({ channel: 'line', scope: this.account + ':group:' + groupId, user: userId }).send(prompt, {
            text: value => { text += value; }, status: () => {},
          });
        } catch (error) { text = this.core.neutralFallback ? neutralFailureReply(error) : lineFailureReply(error, this.core.faqWithoutModel ?? true); }
      }
      if (!text.trim()) text = this.core.neutralFallback ? 'ยังไม่มีข้อมูลเรื่องนี้ครับ' : 'ยังไม่พบคำตอบที่ยืนยันได้ครับ กรุณาดู https://cbtumu.net/faq/';
      if (this.closed || Date.now() - receivedAt > 50000 || !this.store.mentionsEnabled(groupId) || this.store.modeRevision(groupId) !== revision) { finish('', 'cancelled'); return; }
      try { await this.reply(event.replyToken, text); finish(text, 'accepted'); this.log({ channel: 'line-group', outcome: 'reply_accepted' }); }
      catch { finish(text, 'failed'); this.log({ channel: 'line-group', outcome: 'reply_failed_no_retry' }); }
    });
    this.tail = task.catch(() => { this.log({ channel: 'line-group', outcome: 'group_storage_or_processing_failed' }); });
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task)).catch(() => {});
    return true;
  }
  close() { this.closed = true; }
  async drain() { await Promise.allSettled([...this.tasks]); }
}
