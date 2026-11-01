// Opt-in paid inference, synthetic conversations, no real LINE transport.
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--live')) { console.error('Use npm run eval:chat:next -- --live'); process.exit(1); }
if (!args.includes('--live')) {
  console.log('No inference made. Add --live to compare old/new routing on 8 synthetic messages in direct/group simulations (maximum 14 provider calls).');
  process.exit(0);
}
const project = fileURLToPath(new URL('..', import.meta.url)), previousCwd = process.cwd();
const { createTerminalLineSimulation } = await import(join(project, 'dist/terminal-line-simulation.js'));
const { createDemo } = await import(join(project, 'dist/agent.js'));
const { ResponseSettingsStore, configureResponseSettings } = await import(join(project, 'dist/response-settings.js'));
const { KnowledgeStore, configureKnowledge } = await import(join(project, 'dist/knowledge-store.js'));
const root = mkdtempSync(join(tmpdir(), 'cbot-grounded-eval-'));
const records = [], requestCap = 14;
let calls = 0, simulation, stopped = false, providerFailure = false, model;
const unknown = { prompt: 'What is the exact number of people in my kitchen right now?', check: text => !/https?:|CBTU|FAQ/.test(text), languageCheck: text => /^[A-Za-z]/.test(text) };
const signup = { prompt: 'Could you walk me through signing up for a course?', check: text => /https:\/\/cbtumu.net\/faq\//.test(text), languageCheck: text => /^[A-Za-z]/.test(text) };
const reaction = { prompt: 'เยอะเลยนะ', check: text => !!text.trim() && !/https?:/.test(text), languageCheck: text => /[ก-๙]/.test(text) && !/[\u3400-\u9fff\u3040-\u30ff]/.test(text) };
try {
  for (const [dir, names] of [['bot-settings', ['settings.json', 'last-good.json']], ['knowledge', ['knowledge.json', 'last-good.json']]]) {
    mkdirSync(join(root, dir));
    for (const name of names) { const source = join(project, 'runtime', dir, name); if (existsSync(source)) copyFileSync(source, join(root, dir, name)); }
  }
  process.chdir(root);
  const settings = new ResponseSettingsStore(join(root, 'bot-settings')); configureResponseSettings(settings);
  configureKnowledge(new KnowledgeStore(join(root, 'knowledge')));
  model = { provider: settings.binding().config.provider, model: settings.binding().config.model };
  for (const channel of ['line-direct', 'line-group']) for (const next of [false, true]) {
    const state = join(root, channel + (next ? '-next' : '-before')); mkdirSync(state);
    const plans = [];
    simulation = createTerminalLineSimulation({ root: state, mode: channel,
      timeoutMs: settings.binding().config.limits.lineTimeoutMs, experimentalGrounding: next,
      factory: async (manager, bound) => {
        const { session, modelRuntime } = await createDemo({ sessionManager: manager, settings: bound, conversationMode: next ? 'grounded' : undefined });
        const original = modelRuntime.streamSimple.bind(modelRuntime);
        modelRuntime.streamSimple = (...input) => { if (calls >= requestCap) throw Error('Evaluation request cap reached'); calls++; return original(...input); };
        session.subscribe(event => {
          if (event.type !== 'message_end' || event.message.role !== 'assistant') return;
          const message = event.message; let plan;
          try { plan = JSON.parse(message.content.filter(p => p.type === 'text').map(p => p.text).join('')); } catch { /* format failure remains visible in reply */ }
          plans.push({ intent: plan?.intent, stopReason: message.stopReason });
          if (message.stopReason === 'error') providerFailure = true;
        });
        return session;
      } });
    for (const scenario of next ? [unknown, signup, reaction] : [unknown]) {
      let answer = ''; const started = Date.now(), before = calls;
      await simulation.client.send(scenario.prompt, { text: text => { answer += text; }, status() {} });
      records.push({ channel, version: next ? 'next' : 'before', prompt: scenario.prompt, answer: answer.trim(),
        calls: calls - before, elapsedMs: Date.now() - started, automatedCheck: scenario.check(answer.trim()), languageAdvisory: scenario.languageCheck(answer.trim()) });
      if (providerFailure) throw Error('Provider failure: evaluation stopped');
    }
    records.at(-1).plans = plans;
    await simulation.dispose(); simulation = undefined;
  }
} catch { stopped = true; }
finally {
  await simulation?.dispose(); configureResponseSettings(); configureKnowledge(); process.chdir(previousCwd); rmSync(root, { recursive: true, force: true });
  const experimental = records.filter(record => record.version === 'next');
  const passed = !stopped && experimental.length === 6 && experimental.every(record => record.automatedCheck);
  console.log(JSON.stringify({ status: stopped ? 'stopped' : 'completed', ...model, calls, requestCap, passed, languageBlocking: false,
    scope: 'CLI adapter simulation only. Automated blocking checks cover links/source presence; language is advisory only, not semantic truth or subjective naturalness. No LINE send.', records }, null, 2));
  if (!passed) process.exitCode = 1;
}
