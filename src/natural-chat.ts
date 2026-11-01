import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { createDemo } from './agent.js';
import { runChat } from './chat.js';
import { CustomerCore } from './core.js';
import { CourseRequests, CourseRequestStore } from './course-requests.js';
import { DemoFailure } from './diagnostics.js';
import { KnowledgeStore, configureKnowledge } from './knowledge-store.js';
import { MemoryStore } from './memory.js';
import { ResponseSettingsStore, configureResponseSettings } from './response-settings.js';
import { createTerminalLineSimulation, type LineSimulationMode } from './terminal-line-simulation.js';

// Copy only these public knowledge/config files; never import customer memory, history or requests.
function copySnapshot(source: string, target: string, names: string[]) {
  mkdirSync(target, { recursive: true, mode: 0o700 });
  if (existsSync(source) && lstatSync(source).isSymbolicLink()) throw new DemoFailure('ไม่อ่าน snapshot จาก symlink');
  for (const name of names) {
    const file = join(source, name);
    if (!existsSync(file)) continue;
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new DemoFailure('snapshot ไม่ใช่ไฟล์ปกติ');
    copyFileSync(file, join(target, name));
  }
}

export async function runNaturalChat(options: {
  checkOnly?: boolean;
  mode?: 'rules-first' | 'model-first' | 'grounded';
  channel?: 'terminal' | LineSimulationMode;
  input?: Readable;
  output?: Writable;
  status?: Writable;
} = {}) {
  const project = process.cwd();
  const output = options.output ?? process.stdout, status = options.status ?? process.stderr;
  const mode = options.mode ?? 'grounded';
  const channel = options.channel ?? 'terminal';
  if (channel !== 'terminal' && mode === 'rules-first') throw new DemoFailure('โหมดจำลอง LINE ใช้ model-first ตาม runtime จริง');
  const root = mkdtempSync(join(tmpdir(), 'cbot-natural-'));
  let memory: MemoryStore | undefined, core: CustomerCore | undefined;
  let simulation: ReturnType<typeof createTerminalLineSimulation> | undefined;
  let chatStarted = false;
  try {
    copySnapshot(resolve(project, 'runtime/bot-settings'), join(root, 'bot-settings'), ['settings.json', 'last-good.json']);
    copySnapshot(resolve(project, 'runtime/knowledge'), join(root, 'knowledge'), ['knowledge.json', 'last-good.json']);
    // SDK cache/session paths are also isolated from the live server.
    process.chdir(root);
    const settings = new ResponseSettingsStore(join(root, 'bot-settings'));
    const knowledge = new KnowledgeStore(join(root, 'knowledge'));
    configureResponseSettings(settings);
    configureKnowledge(knowledge);
    const binding = settings.binding();
    const { session, modelRuntime, provider, modelId } = await createDemo({ settings: binding, conversationMode: mode === 'grounded' ? 'grounded' : undefined });
    let configured: boolean;
    try { configured = modelRuntime.hasConfiguredAuth(provider); }
    finally { session.dispose(); }
    output.write(`แชตทดลอง · ${mode} · ${provider}/${modelId}\n`);
    output.write(`ช่องทางจำลอง: ${channel}\n`);
    output.write('ความจำและคำขออยู่ใน temp และถูกลบเมื่อออก ไม่มี LINE transport ไม่บันทึกเข้าระบบจริง\n');
    if (options.checkOnly) {
      output.write(`Credentials configured: ${configured} (ยังไม่ยืนยันสิทธิ์หรือโควตา)\nไม่เรียกโมเดลในคำสั่ง check\n`);
      return;
    }
    if (!configured) throw new DemoFailure('ยังไม่มี credentials ของโมเดลที่เลือก ตั้งในเครื่องก่อนลอง ไม่ส่ง key ผ่านแชต');
    output.write(`ข้อความทั่วไป${mode !== 'rules-first' ? 'รวม FAQ และคำทักทาย' : ''}อาจเรียกโมเดลจริงและใช้โควตา ตาม limits เดิมสูงสุด ${binding.config.limits.modelCalls} calls/รอบ · ${binding.config.limits.maxTokens} output tokens/call\n`);
    if (channel !== 'terminal') {
      output.write('จำลองกติกา LINE ด้วย adapter จริง แต่รับคำตอบกลับ Terminal เท่านั้น /exit ออกจากโหมดทดลอง\n');
      if (channel === 'line-group') output.write('กลุ่มทดลอง: เติมคำเรียก CBOT ให้อัตโนมัติ คำสั่งส่วนตัวถูกกันตามกติกากลุ่ม\n');
      else output.write('สถานะรอเจ้าหน้าที่เป็นการจำลอง ไม่มีเจ้าหน้าที่จริงรับช่วงในโหมดนี้\n');
      simulation = createTerminalLineSimulation({ root, mode: channel, timeoutMs: binding.config.limits.lineTimeoutMs, experimentalGrounding: mode === 'grounded' });
      chatStarted = true;
      await runChat(simulation.client, binding.config.limits.lineTimeoutMs, options.input ?? process.stdin, output, status,
        { temporary: true, forwardCommands: true });
      return;
    }
    memory = new MemoryStore(join(root, 'memory'));
    const requests = new CourseRequests(new CourseRequestStore(join(root, 'requests')));
    core = new CustomerCore(undefined, binding.config.limits.terminalTimeoutMs, undefined, undefined, memory,
      undefined, requests, () => binding, undefined, mode);
    chatStarted = true;
    await runChat(core.client({ channel: 'terminal', scope: 'natural-experiment', user: 'tester' }),
      binding.config.limits.terminalTimeoutMs, options.input ?? process.stdin, output, status, { temporary: true });
  } finally {
    try { await simulation?.dispose(); await core?.dispose(); }
    finally {
      memory?.close();
      configureResponseSettings(); configureKnowledge();
      process.chdir(project);
      rmSync(root, { recursive: true, force: true });
      if (chatStarted) output.write('ลบความจำและคำขอทดลองของรอบนี้แล้ว การเปิดครั้งถัดไปเริ่มใหม่\n');
    }
  }
}
