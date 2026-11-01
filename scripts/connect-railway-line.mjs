// Only connects the explicitly separate cloud channel. Tests use empty events;
// this script never calls LINE's reply/push/broadcast endpoints.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHmac } from 'node:crypto';
const [action, project, service, environment] = process.argv.slice(2);
if (!['check', 'connect'].includes(action) || !project || !service || !environment || process.argv.length !== 6) throw Error('Usage: node scripts/connect-railway-line.mjs check|connect PROJECT_ID SERVICE_ID ENVIRONMENT_ID');
const result = spawnSync('railway', ['variable', 'list', '--project', project, '--service', service, '--environment', environment, '--json'], { encoding: 'utf8', timeout: 30000 });
if (result.status !== 0) throw Error('Cannot read cloud variables');
const env = JSON.parse(result.stdout), local = parseEnv(readFileSync('.env', 'utf8'));
if (!env.LINE_CHANNEL_ID || !local.LINE_CHANNEL_ID || env.LINE_CHANNEL_ID === local.LINE_CHANNEL_ID) throw Error('Cloud must use a verified separate LINE channel');
const base = 'https://cbot-trial-production.up.railway.app', endpoint = base + '/webhook/line';
if (env.PUBLIC_BASE_URL !== base || !env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN || (action === 'connect' && env.LINE_DRY_RUN !== 'true')) throw Error('Cloud config/dry-run guard failed');
const get = (url, options = {}) => fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
const health = await get(base + '/healthz');
if (health.status !== 200 || (await health.json()).ok !== true) throw Error('Normal cloud application not healthy');
const report = { separateLineChannel: true, healthReady: true };
report.unauthenticatedApiRejected = (await get(base + '/api/customers')).status === 401;
report.crossOriginApiRejected = (await get(base + '/api/customers', { headers: { Origin: 'https://invalid.example' } })).status === 403;
const body = JSON.stringify({ events: [] });
report.signedEmptyWebhookAccepted = (await get(endpoint, { method: 'POST', headers: { 'X-Line-Signature': createHmac('sha256', env.LINE_CHANNEL_SECRET).update(body).digest('base64') }, body })).status === 200;
report.unsignedWebhookRejected = (await get(endpoint, { method: 'POST', body })).status === 401;
const login = await get(base + '/auth/google/start');
const cookie = login.headers.get('set-cookie') || '';
const location = new URL(login.headers.get('location') || '/', base);
report.googleStartSecure = login.status === 303 && location.origin === 'https://accounts.google.com' && location.searchParams.get('redirect_uri') === base + '/auth/google/callback' && cookie.includes('; Secure') && cookie.includes('HttpOnly');
if (Object.values(report).some(value => value !== true)) { console.log(JSON.stringify(report)); throw Error('Cloud security checks failed; webhook unchanged'); }
const line = async (path, method = 'GET', value) => {
  const r = await get('https://api.line.me/v2/bot/channel/webhook/' + path, { method, headers: { Authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN, ...(value ? { 'Content-Type': 'application/json' } : {}) }, ...(value ? { body: JSON.stringify(value) } : {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error('LINE webhook API returned HTTP ' + r.status);
  return data;
};
const verified = await line('test', 'POST', { endpoint });
report.linePlatformVerificationPassed = verified.success === true;
if (!report.linePlatformVerificationPassed) { console.log(JSON.stringify(report)); throw Error('LINE platform verification failed; webhook unchanged'); }
if (action === 'connect') await line('endpoint', 'PUT', { endpoint });
const current = await line('endpoint');
report.endpointMatchesCloud = current.endpoint === endpoint;
report.webhookActive = current.active === true;
report.endpointUpdated = action === 'connect';
console.log(JSON.stringify(report, null, 2));
