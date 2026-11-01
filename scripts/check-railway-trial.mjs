// Read Railway variables without printing their values (including sealed ones).
import { spawnSync } from 'node:child_process';

const [project, service, environment, mode] = process.argv.slice(2);
if (!project || !service || !environment || ![5, 6].includes(process.argv.length) || mode && mode !== '--live') throw Error('Usage: node scripts/check-railway-trial.mjs PROJECT_ID SERVICE_ID ENVIRONMENT_ID [--live]');
const result = spawnSync('railway', ['variable', 'list', '--project', project, '--service', service, '--environment', environment, '--json'], { encoding: 'utf8', timeout: 30000 });
if (result.status !== 0) { console.error('Cannot read Railway variables; check login/network. No variable values printed.'); process.exit(1); }
const variables = JSON.parse(result.stdout);
if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw Error('Unexpected Railway variable response');
// null values are sealed variables: their presence is evidence of configuration,
// but their actual validity must still be verified by the deployed application.
const present = key => Object.hasOwn(variables, key) && (variables[key] === null || typeof variables[key] === 'string' && !!variables[key].trim());
const required = ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_ALLOWED_USER_IDS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ADMIN_BOOTSTRAP_EMAIL'];
const groq = !variables.PI_PROVIDER || variables.PI_PROVIDER === 'groq';
if (groq) required.push('GROQ_API_KEY');
const missing = required.filter(key => !present(key));
const origin = 'https://cbot-trial-production.up.railway.app';
const expected = { DEPLOYMENT_MODE: 'cloud', DATA_ROOT: '/data', PORT: '8080', LINE_DRY_RUN: mode === '--live' ? 'false' : 'true', PUBLIC_BASE_URL: origin, GOOGLE_REDIRECT_URI: origin + '/auth/google/callback' };
const mismatchedSettings = Object.entries(expected).filter(([key, value]) => variables[key] !== value).map(([key]) => key);
console.log(JSON.stringify({ missing, mismatchedSettings, customProviderCredentialNeedsManualCheck: !groq, configurationMode: mode === '--live' ? 'live' : 'dry-run', configurationReady: !missing.length && !mismatchedSettings.length }, null, 2));
