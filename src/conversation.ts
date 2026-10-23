import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { DemoFailure, describeFailure } from './diagnostics.js';

export async function runConversation(
  session: AgentSession, prompt: string, timeoutMs: number,
  output: { text: (value: string) => void; status: (value: string) => void },
  progressMs = 5000,
) {
  const started = Date.now();
  let timedOut = false;
  let streamedFinalText = '';
  let phase = 'รอคำตอบจากโมเดล';
  let modelTurns = 0;
  let toolCalls = 0;
  let budgetExceeded = false;
  output.status('[กำลังส่งข้อความและรอคำตอบ…]');
  const unsubscribe = session.subscribe(event => {
    if ((event.type === 'message_start' && event.message.role === 'assistant' && ++modelTurns > 4)
      || (event.type === 'tool_execution_start' && ++toolCalls > 4)) {
      budgetExceeded = true;
      void session.abort();
    }
    if (event.type === 'message_start' && event.message.role === 'assistant') streamedFinalText = '';
    if (event.type === 'message_update') {
      const update = event.assistantMessageEvent;
      if (update.type === 'text_delta') {
        streamedFinalText += update.delta;
        phase = 'กำลังรับคำตอบ';
        output.text(update.delta);
      } else if (update.type === 'thinking_delta') phase = 'โมเดลกำลังประมวลผล';
    }
    if (event.type === 'tool_execution_start') {
      phase = 'กำลังใช้ tool';
      // Tool names come from our own allowlist; no tool inputs or credentials are logged.
      output.status('[tool] กำลังค้นข้อมูลที่อนุญาต');
    }
    if (event.type === 'tool_execution_end') phase = 'รอโมเดลสรุปผลจาก tool';
  });
  const progress = setInterval(() => {
    output.status(`[${phase}… ${Math.floor((Date.now() - started) / 1000)} วินาที]`);
  }, progressMs);
  const timer = setTimeout(() => { timedOut = true; void session.abort(); }, timeoutMs);
  try {
    await session.prompt(prompt);
    if (budgetExceeded) throw new DemoFailure('Model/tool call budget reached.');
    const last = [...session.messages].reverse().find(message => message.role === 'assistant');
    if (!last || last.stopReason === 'error' || last.stopReason === 'aborted') {
      throw new DemoFailure(describeFailure(last?.errorMessage || '', timedOut, timeoutMs));
    }
    if (last.stopReason === 'length') throw new DemoFailure('Model response exceeded output token budget.');
    const finalText = last.content.filter(part => part.type === 'text').map(part => part.text).join('');
    if (!finalText.trim()) {
      throw new DemoFailure('Model returned no answer text (empty or reasoning-only response). Please try again.');
    }
    // A provider may finish with text but omit text_delta events. Use the finalized message.
    if (!streamedFinalText) output.text(finalText);
    output.text('\n');
    output.status(`[completed in ${Date.now() - started} ms]`);
  } finally {
    clearTimeout(timer);
    clearInterval(progress);
    unsubscribe();
  }
}
