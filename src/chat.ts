import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { runConversation } from './conversation.js';
import { DemoFailure } from './diagnostics.js';

export async function runChat(
  session: AgentSession, timeoutMs: number,
  input: Readable = process.stdin, output: Writable = process.stdout,
  status: Writable = process.stderr,
) {
  const terminal = Boolean((input as NodeJS.ReadStream).isTTY && (output as NodeJS.WriteStream).isTTY);
  const rl = createInterface({ input, output, terminal, prompt: 'คุณ > ' });
  let interrupted = false;
  let busy = false;
  const interrupt = () => {
    if (interrupted) return;
    interrupted = true;
    status.write('\n[ออกจากแชต กำลังยกเลิกงานที่ค้าง…]\n');
    rl.close();
    if (busy) void session.abort();
  };
  rl.on('SIGINT', interrupt);
  process.on('SIGINT', interrupt);
  output.write('แชตพร้อมแล้ว จำบทสนทนาในโปรเซสนี้ | /exit หรือ /quit เพื่อออก | Ctrl-C เพื่อยกเลิกและออก | Ctrl-D/EOF เพื่อจบ\n');
  if (terminal) rl.prompt();
  try {
    for await (const line of rl) {
      if (interrupted) break;
      const prompt = line.trim();
      if (prompt === '/exit' || prompt === '/quit') break;
      if (prompt) {
        if (!terminal) output.write(`คุณ > ${prompt}\n`);
        output.write('ผู้ช่วย > ');
        busy = true;
        try {
          await runConversation(session, prompt, timeoutMs, {
            text: value => { output.write(value); },
            status: value => { status.write(`${value}\n`); },
          });
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
    output.write('\nจบแชตแล้ว (ประวัติในหน่วยความจำสิ้นสุดพร้อมโปรเซส)\n');
  }
}
