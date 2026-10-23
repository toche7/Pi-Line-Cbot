import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { runDialogue } from './dialogue.js';

test('dialogue repairs malformed or truncated output once, hides plans, and restores tools/hooks', async () => {
  for (const failure of ['malformed', 'truncated', 'provider-json', 'provider-json-repeated'] as const) {
    const { session, modelRuntime } = await createDemo();
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    let requests = 0;
    const tools = session.getActiveToolNames();
    const hook = session.agent.onPayload;
    const status: string[] = [];
    modelRuntime.streamSimple = (model) => {
      assert.deepEqual(session.getActiveToolNames(), []);
      requests++;
      const rejectedJson = failure.startsWith('provider-json') && (requests === 1 || failure === 'provider-json-repeated');
      const message: AssistantMessage = {
        role: 'assistant', content: [{ type: 'text', text: requests === 1 ? '{broken' : '{"intent":"chat","reply":"กำลังคุยกับคุณครับ"}' }],
        provider: model.provider, model: model.id, api: model.api,
        stopReason: rejectedJson ? 'error' : requests === 1 && failure === 'truncated' ? 'length' : 'stop',
        errorMessage: rejectedJson ? 'Failed to generate JSON. private-generation-fixture' : undefined, timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream();
      if (rejectedJson) stream.push({ type: 'error', reason: 'error', error: message });
      else stream.push({ type: 'done', reason: message.stopReason === 'length' ? 'length' : 'stop', message });
      return stream;
    };
    try {
      const result = runDialogue(session, 'ทำอะไรอยู่', 1000, {
        text: () => { assert.fail('raw plan must not be exposed'); }, status: s => { status.push(s); },
      });
      if (failure === 'provider-json-repeated') await assert.rejects(result, /^Error: Model JSON generation failed\.$/);
      else assert.equal(await result, 'กำลังคุยกับคุณครับ');
      assert.equal(requests, 2);
      assert.ok(status.some(s => s.includes('หนึ่งครั้ง')));
      assert.deepEqual(session.getActiveToolNames(), tools);
      assert.equal(session.agent.onPayload, hook);
    } finally { session.dispose(); }
  }
});

test('format repair shares original deadline and cancels the second request on timeout', async () => {
  const { session, modelRuntime } = await createDemo();
  await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
  let aborted = false;
  let calls = 0;
  modelRuntime.streamSimple = (model, _context, options) => {
    calls++;
    const stream = createAssistantMessageEventStream();
    const message: AssistantMessage = {
      role: 'assistant', content: [{ type: 'text', text: '{broken' }],
      provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const timer = setTimeout(() => stream.push({ type: 'done', reason: 'stop', message }), calls === 1 ? 30 : 500);
    options?.signal?.addEventListener('abort', () => {
      aborted = true; clearTimeout(timer);
      stream.push({ type: 'error', reason: 'aborted', error: { ...message, stopReason: 'aborted' } });
    }, { once: true });
    return stream;
  };
  try {
    const started = Date.now();
    await assert.rejects(runDialogue(session, 'ทำอะไรอยู่', 120, { text: () => {}, status: () => {} }), /timed out/);
    assert.equal(calls, 2);
    assert.equal(aborted, true);
    assert.ok(Date.now() - started < 400);
  } finally { session.dispose(); }
});
