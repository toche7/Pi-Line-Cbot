import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { runConversation } from './conversation.js';
import { DemoFailure } from './diagnostics.js';
import type { ChatClient } from './core.js';
import { commandHelp } from './command-help.js';

export async function runChat(
  session: AgentSession | ChatClient, timeoutMs: number,
  input: Readable = process.stdin, output: Writable = process.stdout,
  status: Writable = process.stderr,
  options: { temporary?: boolean } = {},
) {
  const terminal = Boolean((input as NodeJS.ReadStream).isTTY && (output as NodeJS.WriteStream).isTTY);
  const rl = createInterface({ input, output, terminal, prompt: 'คุณ > ' });
  let interrupted = false;
  let busy = false;
  let forgetToken: string | undefined;
  const interrupt = () => {
    if (interrupted) return;
    interrupted = true;
    status.write('\n[ออกจากแชต กำลังยกเลิกงานที่ค้าง…]\n');
    rl.close();
    if (busy) void session.abort();
  };
  rl.on('SIGINT', interrupt);
  process.on('SIGINT', interrupt);
  output.write('แชตพร้อมแล้ว | /help ดูคำสั่ง | /exit ออก\n');
  if (terminal) rl.prompt();
  try {
    for await (const line of rl) {
      if (interrupted) break;
      const prompt = line.trim();
      if (prompt === '/exit' || prompt === '/quit') break;
      if (prompt === '/forget' && 'requestForget' in session && session.requestForget) {
        forgetToken = await session.requestForget();
        if ('requestsEnabled' in session && session.requestsEnabled) output.write(options.temporary ? '[การยืนยันนี้จะลบคำขอทดลองใน temp ของรอบนี้ด้วย]\n' : '[การยืนยันนี้จะลบคำขอของคุณในระบบกลางด้วย]\n');
        output.write('[จะลบข้อความ สรุป เรื่องค้าง และโปรไฟล์ของคุณทั้งหมดจาก memory บนเครื่อง พิมพ์ /confirm-forget ภายใน 60 วินาทีเพื่อยืนยัน หรือ /cancel เพื่อยกเลิก]\n');
        if (terminal) rl.prompt();
        continue;
      }
      if (prompt === '/confirm-forget' || prompt === '/cancel') {
        try {
          if (prompt === '/confirm-forget') {
            if (!forgetToken || !('forget' in session) || !session.forget) throw new DemoFailure('ต้องใช้ /forget และอ่านคำอธิบายก่อนยืนยัน');
            await session.forget(forgetToken);
            output.write('[ลืมทั้งหมดแล้ว ลบ persistent memory ของคุณแล้ว คนอื่นไม่ถูกเปลี่ยน]\n');
          } else {
            if ('cancelForget' in session) session.cancelForget?.();
            output.write('[ยกเลิกการลืมทั้งหมด ข้อมูลยังอยู่]\n');
          }
        } catch (error) { status.write(`${error instanceof DemoFailure ? error.message : 'ไม่สามารถลบ memory ได้ ข้อมูลอาจยังอยู่'}\n`); }
        forgetToken = undefined;
        if (terminal) rl.prompt();
        continue;
      }
      const cancelledForget = !!forgetToken;
      forgetToken = undefined;
      if ('cancelForget' in session) session.cancelForget?.();
      if (prompt === '/help') {
        if (cancelledForget) output.write('[ยกเลิกคำขอ /forget ที่รอยืนยันแล้ว ข้อมูลยังอยู่]\n');
        const help = commandHelp('terminal', 'send' in session ? session : undefined);
        output.write((options.temporary ? help.replaceAll('ระบบกลาง', 'พื้นที่ทดลองชั่วคราว') : help) + '\n');
        if (terminal) rl.prompt();
        continue;
      }
      if (prompt === '/memory' && 'memory' in session && session.memory) {
        output.write(await session.memory() + '\n');
        if (terminal) rl.prompt();
        continue;
      }
      if (prompt === '/reset') {
        if ('reset' in session && session.reset) {
          await session.reset();
          output.write('[เริ่มบทสนทนาใหม่ ล้างข้อความ/สรุป/เรื่องค้างแล้ว คงโปรไฟล์และข้อมูลที่ขอจำระยะยาวไว้]\n');
        } else output.write('[โหมดนี้ไม่มี /reset กรุณาเปิดโปรแกรมใหม่]\n');
        if (terminal) rl.prompt();
        continue;
      }
      if (prompt) {
        if (!terminal) output.write(`คุณ > ${prompt}\n`);
        output.write('ผู้ช่วย > ');
        busy = true;
        try {
          const callbacks = {
            text: value => { output.write(value); },
            status: value => { status.write(`${value}\n`); },
          } satisfies import('./core.js').Output;
          if ('send' in session) await session.send(prompt, callbacks);
          else await runConversation(session, prompt, timeoutMs, callbacks);
        } catch (error) {
          if (!interrupted) status.write(`${error instanceof DemoFailure ? error.message : 'Chat turn failed. Check configuration or network.'}\n`);
        } finally { busy = false; }
      }
      if (interrupted) break;
      if (terminal) rl.prompt();
    }
  } finally {
    process.removeListener('SIGINT', interrupt);
    rl.removeListener('SIGINT', interrupt);
    rl.close();
    output.write(options.temporary ? '\nจบแชตทดลองแล้ว (ข้อมูลชั่วคราวจะถูกลบเมื่อปิดโปรแกรม)\n' : '\nจบแชตแล้ว (memory ที่บันทึกไว้ยังอยู่สำหรับครั้งถัดไป)\n');
  }
}
