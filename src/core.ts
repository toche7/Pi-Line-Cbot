import { randomUUID } from 'node:crypto';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { createDemo, orderTool } from './agent.js';
import { publicAnswer } from './knowledge.js';
import { runConversation } from './conversation.js';
import { DemoFailure } from './diagnostics.js';

export type Output = { text: (value: string) => void; status: (value: string) => void };
export type Identity = { channel: 'terminal' | 'line'; scope: string; user: string };
export type ChatClient = { send: (prompt: string, output: Output) => Promise<void>; abort: () => Promise<void> };
type Entry = { session: Promise<AgentSession>; tail: Promise<void>; pending: number; turns: number; touched: number };

export class CustomerCore {
  private entries = new Map<string, Entry>();
  private closed = false;
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
            if (current.turns >= 20) throw new DemoFailure('ครบขีดจำกัด 20 ข้อความใน session กรุณารอ session หมดอายุ');
            current.turns++;
            const session = await current.session;
            const tokenTotal = session.messages.reduce((n, m) => n + (m.role === 'assistant' ? m.usage.totalTokens : 0), 0);
            if (tokenTotal >= 20000) throw new DemoFailure('Session token budget reached.');
            const orderId = prompt.match(/\bDEMO-[0-9]+\b/i)?.[0].toUpperCase();
            let answer: string | undefined;
            if (orderId) {
              const result = await orderTool.execute('core-mock', { orderId });
              answer = `${result.details.found ? `ออเดอร์จำลอง ${orderId}: shipped / DEMO-TRACK-001` : 'ไม่พบออเดอร์จำลองนี้'}\nเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลผู้เรียน CBTU`;
            } else answer = publicAnswer(prompt);
            if (answer !== undefined) {
              // Store host-grounded turns through Pi's supported history API for later conversational context.
              await session.sendCustomMessage({ customType: 'grounded-turn', content: `ข้อความผู้ใช้: ${prompt}\nคำตอบที่ระบบตรวจจากแหล่งสาธารณะ: ${answer}`, display: false });
              output.status(orderId ? '[ข้อมูลสมมติสำหรับทดสอบ]' : '[ตอบจากข้อมูลสาธารณะที่กำหนด]');
              output.text(answer + '\n');
            } else {
              await runConversation(session, prompt, this.timeoutMs, output);
            }
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
