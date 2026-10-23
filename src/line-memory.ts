import type { ChatClient, CustomerCore, Identity, Output } from './core.js';
import { DemoFailure } from './diagnostics.js';
import type { Memory } from './memory.js';

type Entry = { client: ChatClient; touched: number; forgetToken?: string };
const shorten = (text: string, limit: number) => text.length > limit ? text.slice(0, limit) + '… (ย่อ)' : text;

// Keep the full bounded record on disk; the LINE view is a concise snapshot.
function memoryView(raw: string): string {
  const m = JSON.parse(raw) as Memory;
  return [
    'ความจำเฉพาะคุณใน LINE OA นี้ (แยกจาก Terminal)',
    `โปรไฟล์: ${JSON.stringify(m.profile)}`,
    `ขอจำระยะยาว: ${JSON.stringify(m.longTerm)}`,
    `สรุป: ${shorten(JSON.stringify(m.summary.notes), 400)}`,
    `หัวข้อ: ${shorten(JSON.stringify(m.summary.topics), 250)}`,
    `เรื่องค้าง: ${shorten(JSON.stringify(m.summary.pending), 400)}`,
    `หัวข้อล่าสุด: ${m.lastTopic ?? 'ไม่มี'}`,
    `ข้อความที่เก็บล่าสุด ${m.recent.length} คู่; ย่อบริบทแล้ว ${m.compactions} ครั้ง`,
    `ตัวอย่างล่าสุด (ย่อ): ${shorten(JSON.stringify(m.recent.slice(-2)), 700)}`,
    'ไม่ใช้งานเกิน 90 วันจะลบเมื่อตรวจ; /reset ล้างบทสนทนาแต่คงโปรไฟล์/ข้อมูลระยะยาว; /forget ลบทั้งหมดโดยต้องยืนยัน',
  ].join('\n');
}

// Tokens live only in this adapter instance, keyed by trusted channel/OA/user.
// Restart discards pending confirmations; dedupe remains the adapter's responsibility.
export class LineConversations {
  private entries = new Map<string, Entry>();
  constructor(private core: Pick<CustomerCore, 'client'>, private now = () => Date.now()) {}
  close() { for (const entry of this.entries.values()) entry.client.cancelForget?.(); this.entries.clear(); }

  async send(identity: Identity, prompt: string, output: Output) {
    for (const [key, entry] of this.entries) {
      if (this.now() - entry.touched >= 30 * 60_000) { entry.client.cancelForget?.(); this.entries.delete(key); }
    }
    const key = JSON.stringify([identity.channel, identity.scope, identity.user]);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 100) throw new DemoFailure('ขณะนี้มีผู้ใช้งานเต็ม กรุณาลองภายหลัง');
      entry = { client: this.core.client(identity), touched: this.now() };
      this.entries.set(key, entry);
    }
    entry.touched = this.now();
    const client = entry.client;
    const command = prompt.trim();
    if (command === '/forget' && client.requestForget) {
      entry.forgetToken = await client.requestForget();
      output.text('จะลบข้อความ สรุป เรื่องค้าง โปรไฟล์ และข้อมูลระยะยาวของคุณเฉพาะ LINE OA นี้จากเครื่อง พิมพ์ /confirm-forget ภายใน 60 วินาทีเพื่อยืนยัน หรือ /cancel เพื่อยกเลิก ข้อมูล Terminal และคนอื่นไม่ถูกเปลี่ยน');
      return;
    }
    if (command === '/confirm-forget') {
      const token = entry.forgetToken;
      entry.forgetToken = undefined;
      if (!token || !client.forget) { output.text('ต้องใช้ /forget และอ่านคำอธิบายก่อนยืนยัน'); return; }
      try {
        await client.forget(token);
        output.text('ลืมทั้งหมดแล้ว ลบ persistent memory ของคุณเฉพาะ LINE OA นี้แล้ว ข้อมูล Terminal และคนอื่นไม่ถูกเปลี่ยน');
      } catch (error) {
        output.text(error instanceof DemoFailure && /ยืนยัน/.test(error.message)
          ? 'การยืนยันหมดอายุหรือไม่ถูกต้อง กรุณาเริ่ม /forget ใหม่ ข้อมูลยังไม่ถูกลบ'
          : 'ไม่สามารถลบ memory ได้ ข้อมูลอาจยังอยู่ กรุณาลองใหม่');
      }
      return;
    }
    entry.forgetToken = undefined;
    client.cancelForget?.(); // Every other message cancels a pending challenge.
    if (command === '/cancel') { output.text('ยกเลิกการลืมทั้งหมด ข้อมูลยังอยู่'); return; }
    if (command === '/memory' && client.memory) { output.text(memoryView(await client.memory())); return; }
    if (command === '/reset' && client.reset) {
      await client.reset();
      output.text('เริ่มบทสนทนาใหม่ ล้างข้อความ สรุป หัวข้อล่าสุด และเรื่องค้างแล้ว คงโปรไฟล์และข้อมูลที่ขอจำระยะยาวไว้ เฉพาะ LINE OA นี้');
      return;
    }
    await client.send(prompt, output);
  }
}
