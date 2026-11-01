// Multi-page browser QA fixture; no .env, Google, model calls or LINE transport.
import { createServer } from 'node:http';
import { join } from 'node:path';
import { paginationFixture } from './pagination-fixture-data.mjs';
import { StaffAuth } from '../dist/staff-auth.js';
import { adminHandler } from '../dist/admin.js';
import { ResponseSettingsStore } from '../dist/response-settings.js';
import { ResponseSettingsService } from '../dist/response-settings-service.js';
const f=paginationFixture(),role=process.argv[2]||'admin';
if(!['admin','content','staff'].includes(role))throw Error('Invalid role');
const owner=f.staff.identity('fixture-owner');
if(role!=='admin')f.staff.mutate(owner,{action:'invite',revision:f.staff.snapshot().revision,email:role+'@example.test',role,enabled:true,extras:[]});
const responseStore=new ResponseSettingsStore(join(f.root,'response-settings'));
const responseSettings=new ResponseSettingsService(responseStore,async()=>[],async()=>{throw Error('No model transport in fixture')});
let handler=(_req,res)=>res.writeHead(503).end();
const server=createServer((req,res)=>handler(req,res));
server.listen(0,'127.0.0.1',()=>{
 const base='http://127.0.0.1:'+server.address().port;
 const auth=new StaffAuth(f.staff,{clientId:'fixture',clientSecret:'fixture',redirectUri:base+'/auth/google/callback'},{
  authorizationUrl:(state,nonce)=>base+'/auth/google/callback?state='+state+'&code='+nonce,
  exchange:async code=>({subject:role==='admin'?'fixture-owner':'fixture-'+role,email:role==='admin'?'owner@example.test':role+'@example.test',emailVerified:true,nonce:code}),
 });
 handler=adminHandler(f.monitor,f.requests,f.customers,undefined,{...f.conversations,dryRun:false},f.news,f.knowledge,responseSettings,f.rooms,f.pending,undefined,auth);
 console.log('TEMP PAGINATION '+role+' '+base);
});
let stopping=false;function stop(){if(stopping)return;stopping=true;server.closeAllConnections();server.close(()=>{f.clean();process.exit(0)})}process.on('SIGINT',stop);process.on('SIGTERM',stop);
