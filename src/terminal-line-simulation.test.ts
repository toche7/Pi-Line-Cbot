import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import { createDemo } from './agent.js';
import { createTerminalLineSimulation } from './terminal-line-simulation.js';
import { runChat } from './chat.js';
import { runNaturalChat } from './natural-chat.js';

function fixture(mode: 'line-direct' | 'line-group', plans: object[]) {
  const root = mkdtempSync(join(tmpdir(), 'line-simulation-test-')), contexts: string[] = [];
  const simulation = createTerminalLineSimulation({ root, mode, timeoutMs: 1000, experimentalGrounding: false, factory: async manager => {
    const { session, modelRuntime } = await createDemo({ sessionManager: manager });
    await modelRuntime.setRuntimeApiKey('groq', 'offline-placeholder');
    modelRuntime.streamSimple = (model, context) => {
      contexts.push(JSON.stringify(context.messages)); const plan = plans.shift(); assert.ok(plan, 'unexpected model call');
      const message: AssistantMessage = { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(plan) }],
        provider: model.provider, model: model.id, api: model.api, stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream(); stream.push({ type: 'done', reason: 'stop', message }); return stream;
    }; return session;
  } });
  return { ...simulation, root, contexts, async send(prompt: string) {
    let answer = ''; await simulation.client.send(prompt, { text: s => answer += s, status: s => answer += s }); return answer;
  }, async close() { await simulation.dispose(); rmSync(root, { recursive: true, force: true }); } };
}

test('direct simulation runs real LINE commands, temporary requests, waiting/cancel and semantic capabilities', async () => {
  const f = fixture('line-direct', [{ intent: 'knowledge', topic: 'host:capabilities' }]);
  try {
    const help = await f.send('/help'); assert.match(help, /LINE OA/); assert.match(help, /\/book/); assert.doesNotMatch(help, /\/exit/);
    await f.send('ฉันชื่อ Direct-Fixture'); assert.match(await f.send('/memory'), /Direct-Fixture/);
    assert.match(await f.send('/book Excel'), /confirm-request/);
    assert.match(await f.send('/cancel-request'), /ยกเลิก/);
    assert.match(await f.send('ขอคุยกับเจ้าหน้าที่'), /รอ|คำขอ/);
    assert.match(await f.send('ยกเลิกรอเจ้าหน้าที่'), /ยกเลิก/);
    const summary = await f.send('ช่วยอะไรได้บ้าง'); assert.match(summary, /รับคำขอจอง/); assert.match(summary, /เจ้าหน้าที่/);
    assert.doesNotMatch(summary, /ส่วนบริการต่อไปนี้/);
    assert.equal(f.contexts.length, 1);
    await f.send('/forget'); assert.match(await f.send('/confirm-forget'), /ลืม|ลบ/);
    assert.doesNotMatch(await f.send('/memory'), /Direct-Fixture/);
  } finally { await f.close(); }
});

test('group simulation adds CBOT trigger, blocks private slash commands and shares no direct memory', async () => {
  const direct = fixture('line-direct', []);
  const group = fixture('line-group', [{ intent: 'knowledge', topic: 'host:capabilities' }, { intent: 'memory', action: 'recall' }]);
  try {
    await direct.send('ฉันชื่อ Direct-Private');
    const summary = await group.send('ทำไรได้บ้าง');
    assert.match(summary, /ส่วนบริการต่อไปนี้ ให้ทัก LINE ส่วนตัว/); assert.match(summary, /คำขอจอง/);
    assert.match(await group.send('/help'), /กรุณาใช้แชตส่วนตัว/);
    assert.match(await group.send('/book Excel'), /กรุณาใช้แชตส่วนตัว/);
    assert.match(await group.send('/memory'), /กรุณาใช้แชตส่วนตัว/);
    assert.match(await group.send('CBOT จำอะไรได้บ้าง'), /ยังไม่มีข้อมูล/);
    assert.doesNotMatch(group.contexts.join(''), /Direct-Private/);
    assert.equal(group.contexts.length, 2);
  } finally { await direct.close(); await group.close(); }
});

test('Terminal forwards simulated slash commands to channel adapters but keeps local exit', async () => {
  const f = fixture('line-group', []); let transcript = '';
  const output = new Writable({ write(chunk, _encoding, done) { transcript += chunk.toString(); done(); } });
  try {
    await runChat(f.client, 1000, Readable.from(['/help\n/memory\n/exit\n']), output, output, { temporary: true, forwardCommands: true });
    assert.equal((transcript.match(/กรุณาใช้แชตส่วนตัว/g) ?? []).length, 2);
    assert.doesNotMatch(transcript, /คำสั่งซีบอตใน Terminal/); assert.equal(f.contexts.length, 0);
  } finally { await f.close(); }
});

test('simulation CLI checks both channels without inference and rejects conflicting modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'line-simulation-cli-'));
  const entry = resolve('dist/natural-main.js');
  try {
    for (const flags of [['--line-direct'], ['--line-group'], ['--line-direct', '--grounded'], ['--line-group', '--grounded']]) {
      const mode = flags[0];
      const result = spawnSync(process.execPath, [entry, ...flags, '--check'], { cwd: root, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, new RegExp(mode.slice(2)));
      assert.match(result.stdout, /grounded/);
      assert.match(result.stdout, /ไม่เรียกโมเดล/); assert.match(result.stdout, /ไม่มี LINE transport/);
      assert.deepEqual(readdirSync(root), []);
    }
    for (const args of [['--line-direct', '--line-group'], ['--line-group', '--rules-first'], ['--grounded', '--rules-first']]) {
      const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 1); assert.deepEqual(readdirSync(root), []);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('natural simulation rejects legacy mode before creating a temporary workspace', async () => {
  await assert.rejects(runNaturalChat({ channel: 'line-group', mode: 'rules-first' }), /model-first/);
});
