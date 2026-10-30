// Start/reuse the local tunnel, then synchronize the configured LINE account.
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const endpointPath = '/v2/bot/channel/webhook/endpoint';
const upstream = 'http://127.0.0.1:3000';
const fail = message => { throw new Error(message); };
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!r.ok) fail(`HTTP ${r.status}`);
  return r.json();
}
async function tunnels() {
  try { return (await request('http://127.0.0.1:4040/api/tunnels')).tunnels; }
  catch { return null; }
}
export function selectTunnel(list) {
  const matches = list.filter(t => t.config?.addr === upstream && t.public_url?.startsWith('https://'));
  if (matches.length !== 1) fail('ต้องมี HTTPS tunnel ไปพอร์ต 3000 เพียงรายการเดียว');
  const url = new URL(matches[0].public_url);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('Tunnel URL ไม่ถูกต้อง');
  return url.origin;
}
export function updateEnv(content, base) {
  const lines = content.split('\n');
  let found = false;
  const result = lines.map(line => {
    if (!/^\s*(?:export\s+)?PUBLIC_BASE_URL\s*=/.test(line)) return line;
    if (found) return ''; // Remove duplicate assignments so the saved value is unambiguous.
    found = true;
    return `PUBLIC_BASE_URL=${base}`;
  }).join('\n');
  return found ? result : result.trimEnd() + `\nPUBLIC_BASE_URL=${base}\n`;
}
export async function synchronize(base, { env = process.env, api, check, saveBackup, saveEnv, log = console.log } = {}) {
  for (const key of ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN']) {
    if (!env[key]) fail(`ขาด ${key} ใน .env`);
  }
  api ??= (path, method = 'GET', body) => request('https://api.line.me' + path, {
    method, headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': path === '/v2/oauth/verify' ? 'application/x-www-form-urlencoded' : 'application/json' },
    ...(path === '/v2/oauth/verify' ? { body: new URLSearchParams({ access_token: env.LINE_CHANNEL_ACCESS_TOKEN }) } : body ? { body: JSON.stringify(body) } : {}),
  });
  const bot = await api('/v2/bot/info');
  const token = await api('/v2/oauth/verify', 'POST', undefined);
  if (bot.displayName !== 'DemoB1' || String(token.client_id) !== env.LINE_CHANNEL_ID) fail('OA หรือ channel ไม่ตรงกับ DemoB1');
  await check(base);
  const target = base + '/webhook/line';
  if ((await api('/v2/bot/channel/webhook/test', 'POST', { endpoint: target })).success !== true) fail('LINE Verify ไม่ผ่าน');
  const previous = await api(endpointPath);
  if (!previous.active) fail('กรุณาเปิด Use webhook ใน LINE Developers Console ก่อน');
  if (previous.endpoint !== target) {
    await saveBackup({ channelId: env.LINE_CHANNEL_ID, previous, target, createdAt: new Date().toISOString() });
    const latest = await api(endpointPath);
    if (latest.endpoint !== previous.endpoint || latest.active !== previous.active) fail('Webhook ถูกเปลี่ยนระหว่างทำงาน กรุณารันใหม่');
    await api(endpointPath, 'PUT', { endpoint: target });
  }
  const current = await api(endpointPath);
  if (current.endpoint !== target || current.active !== true) fail('อ่านค่ากลับแล้ว webhook ไม่ตรงหรือไม่ได้เปิดใช้งาน');
  await saveEnv(base);
  log('LINE Verify ผ่าน; webhook เปิดใช้งาน; บันทึก PUBLIC_BASE_URL แล้ว');
  log(target);
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('npm run ngrok         เปิดหรือใช้ tunnel เดิม แล้วอัปเดต LINE webhook\nnpm run ngrok:sync    ใช้ tunnel ที่เปิดอยู่ แล้วอัปเดต LINE webhook\nCtrl+C หยุดเฉพาะ tunnel ที่คำสั่งนี้เปิด; Server ต้องเปิดแยก');
    return;
  }
  let child;
  let interrupted = false;
  const stop = () => { interrupted = true; child?.kill('SIGTERM'); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await request(upstream + '/health').catch(() => fail('Server พอร์ต 3000 ยังไม่พร้อม เปิด npm run server ก่อน'));
    let list = await tunnels();
    if (list === null) {
      if (process.argv.includes('--sync')) fail('ngrok ยังไม่เปิด ให้รัน npm run ngrok');
      child = spawn('ngrok', ['http', upstream, '--inspect=false', '--log', 'stdout', '--log-format', 'json', '--log-level', 'warn'], { stdio: ['ignore', 'ignore', 'ignore'] });
      let exited = false;
      child.on('error', () => { exited = true; });
      child.on('exit', () => { exited = true; });
      const deadline = Date.now() + 20000;
      while (list === null && !exited && !interrupted && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 500));
        list = await tunnels();
      }
      if (interrupted) return;
      if (list === null || exited) fail('เปิด ngrok ไม่สำเร็จ ตรวจการติดตั้งและ ngrok authtoken');
    }
    const base = selectTunnel(list);
    const env = process.env;
    const api = (path, method = 'GET', body) => request('https://api.line.me' + path, {
      method,
      headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': path === '/v2/oauth/verify' ? 'application/x-www-form-urlencoded' : 'application/json' },
      ...(path === '/v2/oauth/verify' ? { body: new URLSearchParams({ access_token: env.LINE_CHANNEL_ACCESS_TOKEN }) } : body ? { body: JSON.stringify(body) } : {}),
    });
    const check = async origin => {
      const raw = '{"events":[]}';
      for (const [path, options, expected] of [
        ['/health', {}, 200],
        ['/webhook/line', { method: 'POST', body: raw }, 401],
        ['/webhook/line', { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', 'x-line-signature': createHmac('sha256', env.LINE_CHANNEL_SECRET).update(raw).digest('base64') } }, 200],
      ]) {
        const r = await fetch(origin + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (r.status !== expected) fail('ตรวจ public health/signature ไม่ผ่าน');
        await r.body?.cancel();
      }
    };
    // Check that the local config can be read before changing the remote endpoint.
    await readFile('.env', 'utf8');
    await synchronize(base, { api, check,
      saveBackup: async state => {
        await mkdir('runtime', { recursive: true, mode: 0o700 });
        const path = `runtime/line-webhook-backup-${Date.now()}-${randomUUID()}.json`;
        await writeFile(path, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
        console.log('เก็บ webhook เดิมไว้ที่ ' + path);
      },
      saveEnv: async value => {
        const content = await readFile('.env', 'utf8');
        const temp = `.env.ngrok-${randomUUID()}`;
        await writeFile(temp, updateEnv(content, value), { mode: 0o600, flag: 'wx' });
        await rename(temp, '.env');
      },
    });
    if (child) {
      console.log('ngrok ทำงานอยู่ เปิดหน้าต่างนี้ค้างไว้; Ctrl+C เพื่อหยุด');
      if (child.exitCode !== null || child.signalCode !== null) fail('ngrok หยุดทำงานแล้ว');
      await new Promise(resolve => child.once('exit', resolve));
      if (!interrupted) fail('ngrok หยุดทำงาน กรุณารัน npm run ngrok ใหม่');
    } else console.log('ใช้ ngrok ที่เปิดอยู่แล้ว; คำสั่งนี้ไม่ได้เป็นเจ้าของ tunnel');
  } finally {
    child?.kill('SIGTERM');
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Do not print raw fetch errors, URLs in errors, credentials, or API response bodies.
    console.error('จัดการ ngrok/LINE ไม่สำเร็จ:', /^[ก-๙]/.test(error.message) ? error.message : 'ตรวจเครือข่าย สิทธิ์ไฟล์ และ LINE credentials แล้วลองใหม่');
    process.exitCode = 1;
  });
}
