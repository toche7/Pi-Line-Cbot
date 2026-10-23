import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { Output } from './core.js';
import { runConversation } from './conversation.js';
import { renderDialogue } from './knowledge.js';
import { DemoFailure } from './diagnostics.js';

export async function runDialogue(session: AgentSession, prompt: string, timeoutMs: number, output: Output): Promise<string> {
  const started = Date.now();
  const activeTools = session.getActiveToolNames();
  const onPayload = session.agent.onPayload;
  session.agent.onPayload = async (payload, model) => {
    const previous = await onPayload?.(payload, model);
    const base = previous ?? payload;
    if (model.provider === 'groq' && base && typeof base === 'object') {
      return { ...base, response_format: { type: 'json_object' }, reasoning_format: 'hidden', temperature: 0.2 };
    }
    return previous;
  };
  session.setActiveToolsByName([]); // Host owns retrieval; dialogue cannot enter tool loops.
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = timeoutMs - (Date.now() - started);
      if (remaining <= 0) throw new DemoFailure(`Model request timed out after ${timeoutMs} ms.`);
      let raw = '';
      const question = attempt === 0 ? prompt : `Format repair only. Answer the original user message below using ONLY one JSON object with intent (chat/identity/knowledge/unknown/clarify), topic, reply. Keep reply under 350 characters. Original message: ${prompt}`;
      try {
        await runConversation(session, question, remaining, {
          text: value => { raw += value; },
          status: value => { if (!value.startsWith('[completed')) output.status(value); },
        });
      } catch (error) {
        if (!(error instanceof DemoFailure) || !/output token budget|no answer text|JSON generation failed/.test(error.message)) throw error;
        if (attempt === 1) throw error;
        output.status('[คำตอบถูกตัด ว่าง หรือจัดรูปแบบไม่ได้ กำลังขอคำตอบสั้นใหม่หนึ่งครั้ง]');
        continue;
      }
      try {
        const reply = renderDialogue(raw, prompt);
        output.status(`[ตอบแล้วใน ${Date.now() - started} ms]`);
        return reply;
      } catch {
        if (attempt === 1) throw new DemoFailure('โมเดลยังส่งรูปแบบคำตอบไม่ถูกต้องหลังซ่อมหนึ่งครั้ง ลองใหม่หรือ /reset ได้');
        output.status('[รูปแบบคำตอบไม่ถูกต้อง กำลังขอจัดรูปแบบใหม่หนึ่งครั้ง]');
      }
    }
    throw new DemoFailure('โมเดลยังไม่สามารถสร้างคำตอบได้');
  } finally { session.setActiveToolsByName(activeTools); session.agent.onPayload = onPayload; }
}
