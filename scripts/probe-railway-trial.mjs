// Read-only LINE checks and one tiny AI request. Never print tokens, identities,
// prompts, raw provider responses, OAuth secrets, or the variable snapshot.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';

const [project, service, environment] = process.argv.slice(2);
if (!project || !service || !environment || process.argv.length !== 5) throw Error('Usage: node scripts/probe-railway-trial.mjs PROJECT_ID SERVICE_ID ENVIRONMENT_ID');
const result = spawnSync('railway', ['variable', 'list', '--project', project, '--service', service, '--environment', environment, '--json'], { encoding: 'utf8', timeout: 30000 });
if (result.status !== 0) { console.error('Cannot read cloud variables. No values printed.'); process.exit(1); }
const env = JSON.parse(result.stdout);
const report = {};
if (existsSync('.env')) {
  const local = parseEnv(readFileSync('.env', 'utf8'));
  report.separateLineChannelFromLocal = !!env.LINE_CHANNEL_ID && !!local.LINE_CHANNEL_ID && env.LINE_CHANNEL_ID !== local.LINE_CHANNEL_ID;
}
async function json(url, token, body) {
  try {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20000) });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch { return { status: 'network_error', data: {} }; }
}
if (typeof env.LINE_CHANNEL_ACCESS_TOKEN === 'string' && env.LINE_CHANNEL_ACCESS_TOKEN) {
  const bot = await json('https://api.line.me/v2/bot/info', env.LINE_CHANNEL_ACCESS_TOKEN);
  report.lineTokenHttpStatus = bot.status;
  const webhook = await json('https://api.line.me/v2/bot/channel/webhook/endpoint', env.LINE_CHANNEL_ACCESS_TOKEN);
  report.lineWebhookReadHttpStatus = webhook.status;
  if (webhook.status === 200) {
    report.lineWebhookActive = webhook.data.active === true;
    report.lineWebhookMatchesCloud = webhook.data.endpoint === env.PUBLIC_BASE_URL + '/webhook/line';
  }
} else report.lineProbe = 'token_unavailable_or_sealed';
if ((!env.PI_PROVIDER || env.PI_PROVIDER === 'groq') && typeof env.GROQ_API_KEY === 'string' && env.GROQ_API_KEY) {
  const models = await json('https://api.groq.com/openai/v1/models', env.GROQ_API_KEY);
  report.aiModelsHttpStatus = models.status;
  const model = env.PI_MODEL || 'qwen/qwen3.8-27b';
  report.selectedModelListed = Array.isArray(models.data.data) && models.data.data.some(m => m.id === model);
  if (report.selectedModelListed) {
    const completion = await json('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, { model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 64, temperature: 0 });
    report.aiCompletionHttpStatus = completion.status;
    report.aiCompletionReturned = completion.status === 200 && typeof completion.data.choices?.[0]?.message?.content === 'string' && !!completion.data.choices[0].message.content.trim();
  }
} else report.aiProbe = 'provider_credential_unavailable_or_manual_check_needed';
console.log(JSON.stringify(report, null, 2));
