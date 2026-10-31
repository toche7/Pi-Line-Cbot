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
  mode?: 'rules-first' | 'model-first';
  input?: Readable;
  output?: Writable;
  status?: Writable;
} = {}) {
  const project = process.cwd(), root = mkdtempSync(join(tmpdir(), 'cbot-natural-'));
  const output = options.output ?? process.stdout, status = options.status ?? process.stderr;
  const mode = options.mode ?? 'model-first';
  let memory: MemoryStore | undefined, core: CustomerCore | undefined;
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
    const { session, modelRuntime, provider, modelId } = await createDemo({ settings: binding });
    let configured: boolean;
    try { configured = modelRuntime.hasConfiguredAuth(provider); }
    finally { session.dispose(); }
    output.write(`แชตทดลอง · ${mode} · ${provider}/${modelId}\n`);
    output.write('ความจำและคำขออยู่ใน temp และถูกลบเมื่อออก ไม่มี LINE transport ไม่บันทึกเข้าระบบจริง\n');
    if (options.checkOnly) {
      output.write(`Credentials configured: ${configured} (ยังไม่ยืนยันสิทธิ์หรือโควตา)\nไม่เรียกโมเดลในคำสั่ง check\n`);
      return;
    }
    if (!configured) throw new DemoFailure('ยังไม่มี credentials ของโมเดลที่เลือก ตั้งในเครื่องก่อนลอง ไม่ส่ง key ผ่านแชต');
    output.write(`ข้อความทั่วไป${mode === 'model-first' ? 'รวม FAQ และคำทักทาย' : ''}อาจเรียกโมเดลจริงและใช้โควตา ตาม limits เดิมสูงสุด ${binding.config.limits.modelCalls} calls/รอบ · ${binding.config.limits.maxTokens} output tokens/call\n`);
    memory = new MemoryStore(join(root, 'memory'));
    const requests = new CourseRequests(new CourseRequestStore(join(root, 'requests')));
    core = new CustomerCore(undefined, binding.config.limits.terminalTimeoutMs, undefined, undefined, memory,
      undefined, requests, () => binding, undefined, mode);
    chatStarted = true;
    await runChat(core.client({ channel: 'terminal', scope: 'natural-experiment', user: 'tester' }),
      binding.config.limits.terminalTimeoutMs, options.input ?? process.stdin, output, status, { temporary: true });
  } finally {
    try { await core?.dispose(); }
    finally {
      memory?.close();
      configureResponseSettings(); configureKnowledge();
      process.chdir(project);
      rmSync(root, { recursive: true, force: true });
      if (chatStarted) output.write('ลบความจำและคำขอทดลองของรอบนี้แล้ว การเปิดครั้งถัดไปเริ่มใหม่\n');
    }
  }
}
