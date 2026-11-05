// Verify deployed code against the local build without changing rooms or
// creating an authenticated browser session. No customer data is printed.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [project, service, environment] = process.argv.slice(2);
if (!project || !service || !environment || process.argv.length !== 5) throw Error('Usage: node scripts/verify-railway-room-ui.mjs PROJECT SERVICE ENV');
const files = ['admin.js', 'line-groups.js', 'line-groups-admin.js', 'server.js', 'line-group-replies.js', 'browse.js', 'bot-admin.js'];
const code = `import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{adminPage}from'/app/dist/admin.js';const files=${JSON.stringify(files)},hashes=Object.fromEntries(files.map(n=>[n,createHash('sha256').update(readFileSync('/app/dist/'+n)).digest('hex')]));const identity={name:process.env.SERVER_NAME||process.env.RAILWAY_SERVICE_NAME||'CBot',environment:'cloud'+(process.env.RAILWAY_ENVIRONMENT_NAME?' · '+process.env.RAILWAY_ENVIRONMENT_NAME:'')};const html=adminPage('verification-only',{principal:{subject:'fixture',email:'fixture@example.invalid',role:'admin',enabled:true,extras:[]},csrf:'verification-only'},identity);console.log(JSON.stringify({hashes,server:identity,roomModeEditor:html.includes('id="line-rooms-mode-select"')&&html.includes('id="line-rooms-mode-save"'),serverBadge:html.includes('id="server-identity"'),roomsUnderConversations:html.includes('id="monitor-rooms-content"'),live:process.env.LINE_DRY_RUN==='false'}));`;
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const result = spawnSync('railway', ['ssh', '--project', project, '--service', service, '--environment', environment, 'node --input-type=module -e ' + quote(code)], { encoding: 'utf8', timeout: 45000 });
if (result.status !== 0) throw Error('Cannot verify deployed UI');
const line = result.stdout.trim().split(/\r?\n/).findLast(line => line.startsWith('{'));
if (!line) throw Error('Deployment verification response missing');
const remote = JSON.parse(line);
const codeMatchesLocalBuild = Object.fromEntries(files.map(name => [name, remote.hashes[name] === createHash('sha256').update(readFileSync(new URL('../dist/' + name, import.meta.url))).digest('hex')]));
const { hashes, ...display } = remote;
console.log(JSON.stringify({ ...display, codeMatchesLocalBuild }, null, 2));
if (!remote.roomModeEditor || !remote.serverBadge || !remote.roomsUnderConversations || !remote.live || Object.values(codeMatchesLocalBuild).some(value => !value)) process.exitCode = 1;
