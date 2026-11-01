import { SystemStatusService } from '../dist/system-status.js';
import { ResponseSettingsStore } from '../dist/response-settings.js';
import { ResponseSettingsService } from '../dist/response-settings-service.js';
// Disposable local QA only. No .env, model, LINE transport, or real runtime stores.
// npm run build && node scripts/overview-ui-fixture.mjs [full|empty|partial|offline|expired]
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { adminHandler } from '../dist/admin.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { CourseRequestStore } from '../dist/course-requests.js';
import { CustomerStore, customerId } from '../dist/customers.js';
import { RequestWorkStore } from '../dist/request-work.js';
import { ConversationControl, conversationKey } from '../dist/conversation-control.js';
import { PendingLineUsers } from '../dist/line-pending-users.js';
import { NewsService, NewsStore } from '../dist/news.js';
const mode=process.argv[2]||'full';
if(!['full','empty','partial','offline','expired'].includes(mode))throw Error('Use full, empty, partial, offline or expired');
const root=mkdtempSync(join(tmpdir(),'overview-ui-')),now=Date.now();
const monitor=new ConversationMonitor(join(root,'monitor')),requests=new CourseRequestStore(join(root,'requests')),customers=new CustomerStore(join(root,'customers'));
const work=new RequestWorkStore(join(root,'request-work'),requests),control=new ConversationControl(join(root,'control')),pending=new PendingLineUsers(join(root,'pending'));
const account='fixture-oa',allowedUsers=new Set(['U'+'a'.repeat(32)]),news=new NewsService(new NewsStore(join(root,'news')),customers,account);
if(mode!=='empty'){
 for(let i=0;i<3;i++){
  const user='U'+String.fromCharCode(97+i).repeat(32),owner={channel:'line',scope:account+':direct',user};
  monitor.record({id:randomUUID(),userId:user,account,direction:'in',text:'ข้อความทดสอบสมมติเท่านั้น',status:'received',at:new Date(now-i*60000).toISOString()});
  const r={version:1,id:randomUUID(),kind:'contact',createdAt:new Date(now-600000).toISOString(),owner,course:null,message:'ฝากเรื่องสมมติ',status:'pending_team',delivery:{channel:null,status:'not_selected'},sourceSha256:'a'.repeat(64)};requests.save(r);
  let s=customers.snapshot({events:[],requests:[r]});const c=s.customers.find(c=>c.id===customerId(owner));customers.mutate({revision:s.revision,id:c.id,action:'profile.update',data:{profile:{...c.profile,nickname:['ผู้ทดสอบ ก','ผู้ทดสอบ ข','ชื่อสมมติยาวเพื่อทดสอบการตัดบรรทัดบนหน้าจอมือถือ'][i]},source:'ทีมตั้งชื่อเรียก',reference:'fixture'}});
  if(i===0)control.requestHuman(conversationKey(account,user),false);
  if(i===1)work.mutate({requestId:r.id,customerId:c.id,operationId:randomUUID(),revision:0,action:'claim',value:''});
 }
 pending.record(account,'U'+'d'.repeat(32));
 news.mutate({action:'create',title:'ข่าวร่างสมมติที่ยังไม่ส่ง',text:'fixture only',customerIds:[],groupIds:[]});
}
if(mode==='partial')writeFileSync(join(root,'news','news.json'),'fixture corrupt source');
const settings=new ResponseSettingsStore(join(root,'settings'));
const responseSettings=new ResponseSettingsService(settings,async()=>{const c=settings.binding().config;return [{provider:c.provider,id:c.model,name:'Fixture model',configured:true,text:true,maxTokens:4096,api:'fixture'}]});
const systemStatus=new SystemStatusService({startedAt:now,webhookPort:3000,adminPort:3001,listeners:()=>({webhook:true,admin:true}),token:'fixture-only',channelConfigured:true,secretConfigured:true,dryRun:true,publicBase:'https://fixture.example.test',settings:responseSettings,stores:[{name:'ข่าว fixture',check:()=>{news.store.list();return true;}}],worker:()=>({running:true,suspended:false,busy:false})},async url=>new Response(JSON.stringify(String(url).endsWith('/info')?{displayName:'Fixture OA'}:String(url).endsWith('/endpoint')?{active:mode!=='partial',endpoint:'https://fixture.example.test/webhook/line'}:{ok:true}),{status:200}));
const handler=adminHandler(monitor,requests,customers,undefined,{control,account,allowedUsers,dryRun:true,push:async()=>{throw Error('No transport in fixture')}},news,undefined,undefined,undefined,{store:pending,account,allowedUsers},systemStatus);
const server=createServer((req,res)=>{if(mode==='expired'&&req.url==='/api/system-status/check'){res.writeHead(403,{'Content-Type':'application/json'}).end('{}');return}if(mode==='offline'&&['/api/overview','/api/system-status','/api/system-status/check'].includes(req.url)){res.writeHead(503,{'Content-Type':'application/json'}).end('{"error":"fixture offline"}');return}handler(req,res)});
const fixturePort=Number(process.argv[3]||0);if(!Number.isInteger(fixturePort)||fixturePort<0||fixturePort>65535||[3000,3001].includes(fixturePort))throw Error('Use a disposable test port, not 3000/3001');
server.listen(fixturePort,'127.0.0.1',()=>console.log('TEMP '+mode+' http://127.0.0.1:'+server.address().port+'/#overview'));
let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.closeAllConnections();server.close(()=>{rmSync(root,{recursive:true,force:true});process.exit(0)})};process.on('SIGINT',stop);process.on('SIGTERM',stop);
