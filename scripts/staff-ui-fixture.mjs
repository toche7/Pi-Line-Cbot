// Disposable UI fixture. No .env, real Google, LINE, models or customer runtime.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StaffStore } from '../dist/staff-store.js';
import { StaffAuth } from '../dist/staff-auth.js';
import { adminHandler } from '../dist/admin.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { CourseRequestStore } from '../dist/course-requests.js';
import { CustomerStore } from '../dist/customers.js';
import { KnowledgeStore } from '../dist/knowledge-store.js';
import { ResponseSettingsStore } from '../dist/response-settings.js';
import { ResponseSettingsService } from '../dist/response-settings-service.js';
import { SystemStatusService } from '../dist/system-status.js';
import { NewsService, NewsStore } from '../dist/news.js';
const role = process.argv[2] || 'admin';
if (!['admin','content','staff'].includes(role)) throw Error('Invalid fixture role');
const root = mkdtempSync(join(tmpdir(),'staff-ui-'));
const staff = new StaffStore(join(root,'staff'),'owner@example.test'), owner=staff.identity('fixture-owner','owner@example.test');
if(role!=='admin')staff.mutate(owner,{action:'invite',revision:staff.snapshot().revision,email:role+'@example.test',role,enabled:true,extras:[]});
const monitor=new ConversationMonitor(join(root,'monitor')),requests=new CourseRequestStore(join(root,'requests')),customers=new CustomerStore(join(root,'customers'));
const knowledge=new KnowledgeStore(join(root,'knowledge')),settings=new ResponseSettingsStore(join(root,'settings'));
const responseSettings=new ResponseSettingsService(settings,async()=>[{provider:'fixture',id:'fixture',name:'Fixture only',configured:false,text:true,maxTokens:4096,api:'fixture'}],async()=>{throw Error('No model transport in fixture')});
const news=new NewsService(new NewsStore(join(root,'news')),customers,'fixture-oa');
const system=new SystemStatusService({startedAt:Date.now(),webhookPort:3000,adminPort:3001,listeners:()=>({webhook:true,admin:true}),token:'fixture-only',channelConfigured:true,secretConfigured:true,dryRun:true,publicBase:'https://fixture.example.test',settings:responseSettings,stores:[],worker:()=>({running:false,suspended:false,busy:false})},async()=>new Response('{}',{status:503}));
let handler=(_req,res)=>res.writeHead(503).end();
const server=createServer((req,res)=>handler(req,res));
server.listen(0,'127.0.0.1',()=>{
 const base='http://127.0.0.1:'+server.address().port;
 const auth=new StaffAuth(staff,{clientId:'fixture',clientSecret:'fixture',redirectUri:base+'/auth/google/callback'},{
  authorizationUrl:(state,nonce)=>base+'/auth/google/callback?state='+state+'&code='+nonce,
  exchange:async code=>({subject:role==='admin'?'fixture-owner':'fixture-'+role,email:role==='admin'?'owner@example.test':role+'@example.test',nonce:code,emailVerified:true}),
 });
 handler=adminHandler(monitor,requests,customers,undefined,undefined,news,knowledge,responseSettings,undefined,undefined,system,auth);
 console.log('TEMP '+role+' '+base);
});
let stopped=false;function stop(){if(stopped)return;stopped=true;server.closeAllConnections();server.close(()=>{rmSync(root,{recursive:true,force:true});process.exit(0)})}process.on('SIGINT',stop);process.on('SIGTERM',stop);
