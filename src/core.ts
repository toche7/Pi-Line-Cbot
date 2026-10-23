import { randomUUID } from 'node:crypto';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { createDemo, orderTool } from './agent.js';
import { publicAnswer, isTopicFollowup, renderKnowledge, topicForAnswer } from './knowledge.js';
import { runDialogue } from './dialogue.js';
import { DemoFailure, rateLimitWaitMs } from './diagnostics.js';

export type Output = { text: (value: string) => void; status: (value: string) => void };
export type Identity = { channel: 'terminal' | 'line'; scope: string; user: string };
export type ChatClient = { send: (prompt: string, output: Output) => Promise<void>; abort: () => Promise<void>; reset?: () => Promise<void> };
type Entry = { session: Promise<AgentSession>; tail: Promise<void>; pending: number; turns: number; touched: number; lastTopic?: string };

export class CustomerCore {
  private entries = new Map<string, Entry>();
  private closed = false;
  private modelCooldownUntil = 0;
  constructor(
    private factory: () => Promise<AgentSession> = async () => (await createDemo()).session,
    private timeoutMs = 30000,
    private log: (record: object) => void = () => {},
    private now = () => Date.now(),
  ) {}

  client(identity: Identity): ChatClient {
    // Identity is supplied by the adapter, never extracted from a customer's message.
    const key = JSON.stringify([identity.channel, identity.scope, identity.user]);
    return {
      send: async (prompt, output) => {
        if (this.closed) throw new DemoFailure('Chat service closed.');
        if (!prompt.trim() || prompt.length > 2000) throw new DemoFailure('ข้อความต้องยาว 1–2000 ตัวอักษร');
        this.expire();
        let entry = this.entries.get(key);
        if (!entry) {
          if (this.entries.size >= 100) throw new DemoFailure('ขณะนี้มีผู้ใช้งานเต็ม กรุณาลองภายหลัง');
          const session = this.factory();
          entry = { session, tail: Promise.resolve(), pending: 0, turns: 0, touched: this.now() };
          this.entries.set(key, entry);
          void session.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
        }
        if (entry.pending >= 3) throw new DemoFailure('กำลังตอบข้อความก่อนหน้า กรุณารอสักครู่');
        const current = entry;
        current.pending++;
        const job = current.tail.then(async () => {
          if (this.closed) throw new DemoFailure('Chat service closed.');
          const started = this.now();
          const requestId = randomUUID();
          let outcome = 'ok';
          try {
            if (current.turns >= 20) throw new DemoFailure('ครบขีดจำกัด 20 ข้อความใน session ใช้ /reset หรือเปิดแชตใหม่เพื่อเริ่มอีกครั้ง (ประวัติเดิมจะหาย)');
            const session = await current.session;
            const tokenTotal = session.messages.reduce((n, m) => n + (m.role === 'assistant' ? m.usage.totalTokens : 0), 0);
            if (tokenTotal >= 100000) throw new DemoFailure('Session token budget reached. ใช้ /reset หรือเปิดแชตใหม่ (ประวัติเดิมจะหาย)');
            const orderId = prompt.match(/\bDEMO-[0-9]+\b/i)?.[0].toUpperCase();
            let answer: string | undefined;
            if (orderId) {
              const result = await orderTool.execute('core-mock', { orderId });
              answer = `${result.details.found ? `ออเดอร์จำลอง ${orderId}: shipped / DEMO-TRACK-001` : 'ไม่พบออเดอร์จำลองนี้'}\nเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลผู้เรียน CBTU`;
            } else answer = publicAnswer(prompt);
            if (answer === undefined && current.lastTopic && isTopicFollowup(prompt)) answer = renderKnowledge(current.lastTopic);
            if (answer !== undefined) {
              // Store host-grounded turns through Pi's supported history API for later conversational context.
              await session.sendCustomMessage({ customType: 'grounded-turn', content: `ข้อความผู้ใช้: ${prompt}\nคำตอบที่ระบบตรวจจากแหล่งสาธารณะ: ${answer}`, display: false });
              output.status(orderId ? '[ข้อมูลสมมติสำหรับทดสอบ]' : '[ตอบจากข้อมูลสาธารณะที่กำหนด]');
              output.text(answer + '\n');
              current.lastTopic = topicForAnswer(answer);
            } else {
              if (this.now() < this.modelCooldownUntil) {
                throw new DemoFailure(`โมเดลถูกจำกัดการใช้งาน (429) รออีก ${Math.ceil((this.modelCooldownUntil - this.now()) / 1000)} วินาทีแล้วลองใหม่ ระหว่างนี้ FAQ ยังใช้ได้`);
              }
              let reply: string;
              try {
                reply = await runDialogue(session, prompt, this.timeoutMs, output);
              } catch (error) {
                if (error instanceof DemoFailure && /429/.test(error.message)) {
                  const last = [...session.messages].reverse().find(m => m.role === 'assistant');
                  const wait = rateLimitWaitMs(last?.errorMessage || '');
                  this.modelCooldownUntil = this.now() + wait;
                  throw new DemoFailure(`โมเดลถูกจำกัดการใช้งาน (429) รอประมาณ ${Math.ceil(wait / 1000)} วินาทีแล้วลองใหม่ ระหว่างนี้ FAQ ยังใช้ได้`);
                }
                throw error;
              }
              output.text(reply + '\n');
              current.lastTopic = topicForAnswer(reply);
            }
            current.turns++;
          } catch (error) { outcome = 'error'; throw error; }
          finally {
            current.touched = this.now();
            this.log({ requestId, channel: identity.channel, outcome, elapsedMs: this.now() - started });
          }
        });
        current.tail = job.catch(() => {});
        try { await job; } finally { current.pending--; }
      },
      abort: async () => { const entry = this.entries.get(key); if (entry) await (await entry.session).abort(); },
      reset: async () => {
        const entry = this.entries.get(key);
        if (!entry) return;
        if (entry.pending) throw new DemoFailure('กรุณารอข้อความก่อนหน้าจบก่อน /reset');
        this.entries.delete(key);
        (await entry.session).dispose();
      },
    };
  }

  private expire() {
    for (const [key, entry] of this.entries) {
      if (!entry.pending && this.now() - entry.touched >= 30 * 60_000) {
        this.entries.delete(key);
        void entry.session.then(s => s.dispose()).catch(() => {});
      }
    }
  }
  async dispose() {
    this.closed = true;
    await Promise.allSettled([...this.entries.values()].map(async entry => {
      const session = await entry.session;
      await session.abort();
      await entry.tail;
      session.dispose();
    }));
    this.entries.clear();
  }
}
