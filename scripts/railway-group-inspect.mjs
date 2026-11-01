// Inspect cloud group metadata without printing chat contents or member IDs.
import { spawnSync } from 'node:child_process';
const [project, service, environment] = process.argv.slice(2);
if (!project || !service || !environment || process.argv.length !== 5) throw Error('Usage: node scripts/railway-group-inspect.mjs PROJECT SERVICE ENV');
const code = `import{readdirSync,readFileSync}from'node:fs';import{createHash}from'node:crypto';const root='/data/runtime/line-groups';const rooms=readdirSync(root).filter(n=>/^C[0-9a-f]{32}\\.json$/i.test(n)).map(n=>{const r=JSON.parse(readFileSync(root+'/'+n,'utf8')),messages=r.messages||[],incoming=messages.filter(m=>m.direction!=='out'),outgoing=messages.filter(m=>m.direction==='out');return{key:createHash('sha256').update(r.groupId).digest('hex').slice(0,12),name:r.name||'',status:r.status,channelMatches:r.account===process.env.LINE_CHANNEL_ID,replyMode:r.replyMode||'disabled',incomingCount:incoming.length,cbotCalls:incoming.filter(m=>/^CBOT/i.test(m.text.trim())).length,lastIncomingAt:incoming.at(-1)?.at,outgoingCount:outgoing.length,lastReplyStatus:outgoing.at(-1)?.status}});console.log(JSON.stringify({rooms},null,2));`;
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const result = spawnSync('railway', ['ssh', '--project', project, '--service', service, '--environment', environment, 'node --input-type=module -e ' + quote(code)], { encoding: 'utf8', timeout: 45000 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.status !== 0) { console.error('Cloud group inspection failed'); process.exit(1); }
