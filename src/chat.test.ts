import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Readable, Writable } from 'node:stream';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { runChat } from './chat.js';

test('chat processes queued turns in one session and exits on /exit or EOF', async () => {
  const { session, modelRuntime } = await createDemo();
  await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
  let requests = 0;
  modelRuntime.streamSimple = (model, context) => {
    requests++;
    if (requests === 2) assert.match(JSON.stringify(context.messages), /remember-73/);
    const message: AssistantMessage = {
      role: 'assistant', content: [{ type: 'text', text: 'remember-73' }],
      provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const stream = createAssistantMessageEventStream();
    stream.push({ type: 'done', reason: 'stop', message });
    return stream;
  };
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
  const initialSignalListeners = process.listenerCount('SIGINT');
  try {
    await runChat(session, 1000, Readable.from(['remember-73\nwhat did I say?\n/exit\nignored\n']), sink, sink);
    assert.equal(requests, 2);
    assert.equal(session.messages.filter(m => m.role === 'user').length, 2);
    assert.match(output, /จบแชตแล้ว/);
    assert.doesNotMatch(output, /ignored/);
    assert.equal(process.listenerCount('SIGINT'), initialSignalListeners);
    await runChat(session, 1000, Readable.from(['EOF turn\n']), sink, sink);
    assert.equal(requests, 3);
    await runChat(session, 1000, Readable.from(['/quit\nignored\n']), sink, sink);
    assert.equal(requests, 3);
  } finally { session.dispose(); }
});

test('Ctrl-C aborts an active SDK request and closes chat cleanly', async () => {
  const { session, modelRuntime } = await createDemo();
  await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
  let aborted = false;
  modelRuntime.streamSimple = (model, _context, options) => {
    const stream = createAssistantMessageEventStream();
    options?.signal?.addEventListener('abort', () => {
      aborted = true;
      const message: AssistantMessage = {
        role: 'assistant', content: [], provider: model.provider, model: model.id, api: model.api,
        stopReason: 'aborted', timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      stream.push({ type: 'error', reason: 'aborted', error: message });
    }, { once: true });
    queueMicrotask(() => process.emit('SIGINT'));
    return stream;
  };
  const input = new PassThrough();
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
  try {
    const chat = runChat(session, 1000, input, sink, sink);
    input.write('slow request\n');
    await chat;
    assert.equal(aborted, true);
    assert.match(output, /ออกจากแชต/);
    assert.match(output, /จบแชตแล้ว/);
    assert.doesNotMatch(output, /failed/);
  } finally { input.destroy(); session.dispose(); }
});
