// A temporary web process with no app/store/worker imports. This provides an
// offline data window while Railway's file-transfer agent remains available.
// All selectors are required; no linked-project defaults are accepted.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const [action, project, service, environment, input] = process.argv.slice(2);
if (!['enter', 'exit'].includes(action) || !project || !service || !environment || !input || process.argv.length !== 7) throw Error('Usage: node scripts/railway-trial-maintenance.mjs enter|exit PROJECT_ID SERVICE_ID ENVIRONMENT_ID PREPARED_SOURCE_ROOT');
let source = resolve(input);
const allowed = new Set(['Dockerfile', '.dockerignore', 'railway.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'src']);
function regularTree(path) { const stat = lstatSync(path); if (stat.isSymbolicLink()) throw Error('Prepared source must not contain symlinks'); if (stat.isDirectory()) for (const name of readdirSync(path)) regularTree(join(path, name)); }
if (readdirSync(source).some(name => !allowed.has(name))) throw Error('Use an allowlisted prepared source root, never the full repo');
regularTree(source);
const code = 'require("node:http").createServer((q,s)=>{s.writeHead(q.url==="/healthz"?200:503,{"Content-Type":"text/plain","Cache-Control":"no-store"});s.end("Maintenance")}).listen(Number(process.env.PORT),"0.0.0.0")';
// Railway treats null as "leave unchanged" for this field. Always select an
// explicit command and read it back before uploading the matching image.
const startCommand = action === 'enter' ? "node -e '" + code + "'" : 'node dist/server.js';
if (action === 'enter') {
  const prepared = mkdtempSync(join(tmpdir(), 'cbot-maintenance-source-'));
  for (const name of readdirSync(source)) cpSync(join(source, name), join(prepared, name), { recursive: true });
  const file = join(prepared, 'Dockerfile');
  const dockerfile = readFileSync(file, 'utf8');
  if (!dockerfile.includes('CMD ["node", "dist/server.js"]')) throw Error('Unexpected production Docker CMD');
  writeFileSync(file, dockerfile.replace('CMD ["node", "dist/server.js"]', 'CMD ' + JSON.stringify(['node', '-e', code])));
  source = prepared;
}
const query = 'mutation($service:String!,$environment:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$service,environmentId:$environment,input:$input)}';
const configured = spawnSync('railway', ['api', query, '--variables', JSON.stringify({ service, environment, input: { startCommand } }), '--compact'], { encoding: 'utf8', timeout: 30000 });
if (configured.status !== 0 || JSON.parse(configured.stdout).data?.serviceInstanceUpdate !== true) throw Error('Cannot configure maintenance start command; verify service settings before retry');
console.log(JSON.stringify({ action, startCommandUpdated: true }));
const readQuery = 'query($service:String!,$environment:String!){serviceInstance(serviceId:$service,environmentId:$environment){startCommand}}';
let confirmed = false;
for (let i = 0; i < 8; i++) {
  const checked = spawnSync('railway', ['api', readQuery, '--variables', JSON.stringify({ service, environment }), '--compact'], { encoding: 'utf8', timeout: 30000 });
  if (checked.status === 0 && JSON.parse(checked.stdout).data?.serviceInstance?.startCommand === startCommand) { confirmed = true; break; }
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!confirmed) throw Error('Start command read-back did not match; no source uploaded');
console.log(JSON.stringify({ startCommandReadBackConfirmed: true }));
const deployed = spawnSync('railway', ['up', source, '--path-as-root', '--project', project, '--service', service, '--environment', environment, '--detach', '--json'], { encoding: 'utf8', timeout: 45000 });
if (deployed.status !== 0) throw Error('Start command updated but redeploy failed; inspect deployment status and restore the normal command if needed');
console.log(deployed.stdout.trim());
