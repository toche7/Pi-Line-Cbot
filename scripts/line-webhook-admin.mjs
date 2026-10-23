// Run with node --env-file=.env scripts/line-webhook-admin.mjs <prepare|switch|verify|rollback>
// Never prints credentials, old webhook URLs, user IDs, or raw API errors.
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const action = process.argv[2];
const statePath = 'runtime/line-webhook-rollback.json';
const headers = { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` };
async function api(path, method = 'GET', body) {
  const r = await fetch(`https://api.line.me${path}`, {
    method, headers: { ...headers, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`LINE API HTTP ${r.status}`);
  return r.json();
}
async function identity() {
  const bot = await api('/v2/bot/info');
  const r = await fetch('https://api.line.me/v2/oauth/verify', {
    method: 'POST', body: new URLSearchParams({ access_token: process.env.LINE_CHANNEL_ACCESS_TOKEN }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('Token verification failed');
  const token = await r.json();
  if (String(token.client_id) !== process.env.LINE_CHANNEL_ID || bot.displayName !== 'DemoB1') throw new Error('OA identity mismatch');
  console.log('Verified OA DemoB1; token channel matches configuration');
}
function endpoint(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw new Error('Unsafe public endpoint');
  return u;
}
async function publicCheck(base) {
  const raw = '{"events":[]}';
  const signature = createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(raw).digest('base64');
  for (const [name, path, options, expected] of [
    ['Public health', '/health', {}, 200],
    ['Unsigned webhook', '/webhook/line', { method: 'POST', body: raw }, 401],
    ['Valid signed empty webhook', '/webhook/line', { method: 'POST', body: raw, headers: { 'x-line-signature': signature, 'Content-Type': 'application/json' } }, 200],
  ]) {
    const r = await fetch(base + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    console.log(`${name}: HTTP ${r.status}`);
    if (r.status !== expected) throw new Error('Public routing check failed');
  }
}
async function verify(url) {
  const result = await api('/v2/bot/channel/webhook/test', 'POST', { endpoint: url });
  console.log(`LINE webhook verification: ${result.success === true ? 'PASS' : 'FAIL'}`);
  if (result.success !== true) throw new Error('LINE webhook verification failed');
}
async function updateEnv(values) {
  let content = await readFile('.env', 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : content.trimEnd() + `\n${key}=${value}\n`;
  }
  await writeFile('.env', content, { mode: 0o600 });
}
try {
  if (!['prepare', 'switch', 'verify', 'rollback'].includes(action)) throw new Error('Choose prepare, switch, verify, or rollback');
  await identity();
  if (action === 'prepare') {
    if (process.env.LINE_DRY_RUN === 'false') throw new Error('Prepare requires dry run');
    const r = await fetch('http://127.0.0.1:4040/api/tunnels');
    const tunnels = (await r.json()).tunnels;
    const tunnel = tunnels.find(t => t.config.addr === 'http://127.0.0.1:3000' && t.public_url.startsWith('https://'));
    if (!tunnel) throw new Error('Expected tunnel not found');
    const base = endpoint(tunnel.public_url).origin;
    await publicCheck(base);
    await verify(base + '/webhook/line');
    const previous = await api('/v2/bot/channel/webhook/endpoint');
    await mkdir('runtime', { recursive: true, mode: 0o700 });
    await writeFile(statePath, JSON.stringify({ channelId: process.env.LINE_CHANNEL_ID, previous, target: base + '/webhook/line', createdAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' });
    await updateEnv({ PUBLIC_BASE_URL: base, LINE_DRY_RUN: 'true' });
    console.log('Rollback saved privately; dry-run URL configured:', base + '/webhook/line');
  } else {
    const saved = JSON.parse(await readFile(statePath, 'utf8'));
    if (saved.channelId !== process.env.LINE_CHANNEL_ID) throw new Error('Rollback identity mismatch');
    if (action === 'rollback') {
      const current = await api('/v2/bot/channel/webhook/endpoint');
      if (current.endpoint !== saved.target) throw new Error('Webhook changed elsewhere; refusing rollback');
      await api('/v2/bot/channel/webhook/endpoint', 'PUT', { endpoint: saved.previous.endpoint });
      const restored = await api('/v2/bot/channel/webhook/endpoint');
      if (restored.endpoint !== saved.previous.endpoint) throw new Error('Rollback readback failed');
      await updateEnv({ LINE_DRY_RUN: 'true' });
      console.log('Previous webhook restored; active:', restored.active, '; restart local server to apply dry run');
    } else {
      const target = endpoint(saved.target);
      await publicCheck(target.origin);
      await verify(target.href);
      if (action === 'switch') {
        const current = await api('/v2/bot/channel/webhook/endpoint');
        if (current.endpoint !== saved.previous.endpoint && current.endpoint !== saved.target) throw new Error('Webhook changed elsewhere; refusing switch');
        await api('/v2/bot/channel/webhook/endpoint', 'PUT', { endpoint: saved.target });
      }
      const current = await api('/v2/bot/channel/webhook/endpoint');
      if (current.endpoint !== saved.target || current.active !== true) throw new Error('Target not registered and enabled');
      await verify(saved.target);
      console.log('Registered webhook matches target; enabled: true');
    }
  }
} catch (error) {
  // Only our own fixed messages are safe to expose; fetch errors can include URLs.
  const safe = ['LINE API HTTP ', 'OA identity mismatch', 'Token verification failed', 'Public routing check failed', 'LINE webhook verification failed', 'Prepare requires dry run', 'Expected tunnel not found', 'Rollback identity mismatch', 'Webhook changed elsewhere;', 'Rollback readback failed', 'Target not registered and enabled', 'Unsafe public endpoint', 'Choose prepare,'];
  console.error(safe.some(p => error.message?.startsWith(p)) ? error.message : 'Operation failed; private state preserved, no raw error logged');
  process.exitCode = 1;
}
