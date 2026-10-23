import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { runConversation } from './conversation.js';

test('SDK runs allowed tool, rejects unregistered tool, and preserves conversation', async () => {
  const { session, modelRuntime } = await createDemo();
  await modelRuntime.setRuntimeApiKey('groq', 'offline-test-placeholder');
  let request = 0;
  let responseMode: 'text' | 'empty' | 'thinking' = 'text';
  // Replace only the model transport. Session, validation, tool dispatch and history are real SDK code.
  modelRuntime.streamSimple = (model, context) => {
    assert.match(JSON.stringify(context.messages), /lookup_demo_order/);
    const content: AssistantMessage['content'] = request++ === 0
      ? [
          { type: 'toolCall', id: 'allowed', name: 'lookup_demo_order', arguments: { orderId: 'DEMO-1001' } },
          { type: 'toolCall', id: 'denied', name: 'bash', arguments: { command: 'echo forbidden' } },
        ]
      : responseMode === 'empty' ? []
      : responseMode === 'thinking' ? [{ type: 'thinking', thinking: 'private simulated reasoning' }]
      : [{ type: 'text', text: 'ออเดอร์จำลองจัดส่งแล้ว' }];
    const message: AssistantMessage = {
      role: 'assistant', content, api: model.api, provider: model.provider, model: model.id,
      stopReason: request === 1 ? 'toolUse' : 'stop', timestamp: Date.now(),
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const stream = createAssistantMessageEventStream();
    const finish = () => stream.push({ type: 'done', reason: message.stopReason === 'toolUse' ? 'toolUse' : 'stop', message });
    if (request > 2) setTimeout(finish, 25);
    else finish();
    return stream;
  };
  try {
    assert.deepEqual(session.getActiveToolNames(), ['lookup_demo_order']);
    await session.prompt('ตรวจ DEMO-1001');
    const results = session.messages.filter(m => m.role === 'toolResult');
    assert.equal(results.length, 2);
    assert.equal(results.find(m => m.toolCallId === 'allowed')?.isError, false);
    assert.match(JSON.stringify(results.find(m => m.toolCallId === 'allowed')?.content), /DEMO-TRACK-001/);
    assert.equal(results.find(m => m.toolCallId === 'denied')?.isError, true);
    assert.equal(session.getLastAssistantText(), 'ออเดอร์จำลองจัดส่งแล้ว');
    const text: string[] = [];
    const status: string[] = [];
    const output = { text: (s: string) => { text.push(s); }, status: (s: string) => { status.push(s); } };
    await runConversation(session, 'ขอบคุณ', 1000, output, 5);
    assert.equal(session.messages.filter(m => m.role === 'user').length, 2);
    assert.match(text.join(''), /ออเดอร์จำลองจัดส่งแล้ว/); // final message fallback without text_delta
    assert.match(status[0], /กำลังส่งข้อความ/);
    assert.ok(status.some(s => s.includes('วินาที'))); // status while transport is delayed
    responseMode = 'empty';
    await assert.rejects(runConversation(session, 'empty response', 1000, output), /no answer text/);
    responseMode = 'thinking';
    await assert.rejects(runConversation(session, 'reasoning only', 1000, output), /no answer text/);
    assert.doesNotMatch(text.join('') + status.join(''), /private simulated reasoning/);
  } finally { session.dispose(); }
});
