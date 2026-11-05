import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { SystemStatusService, systemStatusHandler, publicOrigin, type SystemStatusOptions } from './system-status.js';
import type { ResponseSettingsService } from './response-settings-service.js';
import { recordModelConnection } from './model-connection.js';
import { adminPage } from './admin.js';

function fixture(extra: Partial<SystemStatusOptions> = {}) {
  let now=Date.now(),calls:{url:string;options:RequestInit|undefined}[]=[];
  let fail='',active=true,endpoint='https://fixture.example.test/webhook/line';
  const options: SystemStatusOptions={startedAt:now-120000,webhookPort:3000,adminPort:3001,listeners:()=>({webhook:true,admin:true}),token:'fixture-secret-token',secretConfigured:true,channelConfigured:true,dryRun:false,publicBase:'https://fixture.example.test',
    settings:{connectionInfo:async()=>({provider:'fixture-status-provider',model:'fixture-status-model',configured:true,healthy:true})} as ResponseSettingsService,
    stores:[{name:'fixture data',check:()=>true}],worker:()=>({running:true,suspended:false,busy:false}),...extra};
  const fetcher=(async(url: string|URL|Request,options?: RequestInit)=>{
    const value=String(url);calls.push({url:value,options});if(value.includes(fail)&&fail)throw Error('raw secret error fixture-secret-token');
    const data=value.endsWith('/v2/bot/info')?{displayName:'Fixture OA'}:value.endsWith('/webhook/endpoint')?{active,endpoint}:value.endsWith('/api/tunnels')?{tunnels:[{config:{addr:'http://127.0.0.1:3000'},public_url:'https://fixture.example.test'}]}:{ok:true};
    return new Response(JSON.stringify(data),{status:200});
  }) as typeof fetch;
  const service=new SystemStatusService(options,fetcher,()=>now),card=(d:Awaited<ReturnType<typeof service.snapshot>>,id:string)=>d.cards.find(c=>c.id===id)!;
  return {service,options,calls,card,advance:(ms:number)=>now+=ms,setFail:(value:string)=>fail=value,setActive:(value:boolean)=>active=value,setEndpoint:(value:string)=>endpoint=value};
}
test('status GET reads internal state only, never calls LINE/public/model and never exposes keys',async()=>{
 const f=fixture(),d=await f.service.snapshot();assert.equal(f.calls.length,0);assert.equal(f.card(d,'server').state,'ok');assert.equal(f.card(d,'line').state,'unknown');assert.equal(f.card(d,'external').checkedAt,null);assert.equal(f.card(d,'ai').state,'unknown');assert.equal(f.card(d,'data').state,'ok');assert.doesNotMatch(JSON.stringify(d),/fixture-secret-token|Authorization|Bearer/);
});
test('explicit external check reads only fixed LINE endpoints and configured public health; cache and stale states',async()=>{
 const f=fixture();let d=await f.service.checkExternal();assert.equal(f.card(d,'line').state,'ok');assert.equal(f.card(d,'external').state,'ok');assert.equal(f.calls.length,3);
 for(const c of f.calls){assert.equal(c.options?.method,'GET');assert.equal(c.options?.redirect,'error');const auth=(c.options?.headers as Record<string,string>).Authorization;if(c.url.startsWith('https://api.line.me/'))assert.equal(auth,'Bearer fixture-secret-token');else assert.equal(auth,undefined)}
 await Promise.all([f.service.checkExternal(),f.service.checkExternal()]);assert.equal(f.calls.length,3);f.advance(360000);d=await f.service.snapshot();assert.equal(f.card(d,'line').state,'unknown');assert.match(f.card(d,'external').summary,/ผลตรวจเก่า/);assert.equal(f.calls.length,3);
});
test('external checks distinguish failed API, closed webhook, mismatch and inaccessible HTTPS without raw errors',async()=>{
 const f=fixture();f.setActive(false);let d=await f.service.checkExternal();assert.equal(f.card(d,'line').state,'ok');assert.equal(f.card(d,'external').state,'warning');assert.match(f.card(d,'external').summary,/ปิดอยู่/);
 f.advance(30001);f.setActive(true);f.setEndpoint('https://another.example.test/webhook/line');d=await f.service.checkExternal();assert.match(f.card(d,'external').summary,/ไม่ตรง/);
 f.advance(30001);f.setFail('/health');d=await f.service.checkExternal();assert.equal(f.card(d,'external').state,'error');
 f.advance(30001);f.setFail('api.line.me');d=await f.service.checkExternal();assert.equal(f.card(d,'line').state,'error');assert.equal(f.card(d,'external').state,'unknown');assert.doesNotMatch(JSON.stringify(d),/raw secret|fixture-secret-token/);
});
test('missing tunnel is unknown, fixed configured HTTPS works without ngrok and untrusted origins are not probed',async()=>{
 const f=fixture({publicBase:''});f.setFail('/api/tunnels');let d=await f.service.checkExternal();assert.equal(f.card(d,'external').state,'unknown');assert.ok(f.calls.every(c=>!c.url.endsWith('/health')));
 for(const value of ['http://example.com','https://127.0.0.1','https://localhost','https://host.local','https://user:pass@example.com','https://example.com/path','https://example.com/?token=secret','https://[::1]','https://example.com:8443'])assert.equal(publicOrigin(value),null,value);
 const g=fixture({publicBase:'https://127.0.0.1'});await g.service.checkExternal();assert.ok(g.calls.every(c=>!c.url.includes('127.0.0.1')));
 const production=fixture();await production.service.checkExternal();assert.ok(production.calls.every(c=>!c.url.includes(':4040')));
});
test('concurrent explicit checks share one probe; dry-run and source failures remain visible',async()=>{
 const f=fixture({dryRun:true,stores:[{name:'broken',check:()=>{throw Error('private')}}],worker:()=>({running:false,suspended:true,busy:false})});
 const [a,b]=await Promise.all([f.service.checkExternal(),f.service.checkExternal()]);assert.equal(f.calls.length,3);assert.equal(f.card(a,'line').state,'warning');assert.equal(f.card(b,'data').state,'warning');assert.match(f.card(b,'data').details.join(),/พักเพราะข้อผิดพลาด/);
});
test('AI uses evidence for active provider/model only; old or absent results do not claim connectivity',async()=>{
 const f=fixture();recordModelConnection('other-provider','other-model',12,null);assert.equal(f.card(await f.service.snapshot(),'ai').state,'unknown');
 recordModelConnection('fixture-status-provider','fixture-status-model',20,'model_rate_limit');let d=await f.service.snapshot();assert.equal(f.card(d,'ai').state,'warning');assert.match(f.card(d,'ai').summary,/429/);
 recordModelConnection('fixture-status-provider','fixture-status-model',15,null);d=await f.service.snapshot();assert.equal(f.card(d,'ai').state,'ok');f.advance(360000);assert.equal(f.card(await f.service.snapshot(),'ai').state,'unknown');assert.equal(f.calls.length,0);
});
test('status API protects external check with same-origin/CSRF and rejects write methods without side effects',async()=>{
 const f=fixture(),handler=systemStatusHandler(f.service,'csrf-fixture');
 async function call(url='/api/system-status',method='GET',headers:Record<string,string>={host:'127.0.0.1:3001'}){let status=0,body='';await handler({url,method,headers} as IncomingMessage,{writeHead(s:number){status=s;return this},end(s:string){body=s}} as unknown as ServerResponse);return {status,body}}
 assert.equal((await call()).status,200);assert.equal((await call('/api/system-status','POST')).status,405);assert.equal((await call('/api/system-status/check','GET')).status,405);assert.equal((await call('/api/system-status/check','POST')).status,403);assert.equal(f.calls.length,0);
 assert.equal((await call('/api/system-status/check','POST',{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-customer-token':'csrf-fixture','sec-fetch-site':'cross-site'})).status,403);assert.equal(f.calls.length,0);
 assert.equal((await call('/api/system-status/check','POST',{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-customer-token':'csrf-fixture'})).status,200);assert.equal(f.calls.length,3);
 const html=adminPage();assert.match(html, /id="settings-panel-system"[^>]*><div id="settings-system"><section id="overview-system"/);assert.match(html, /href="#settings-system"/);new Function(html.match(/<script>([\s\S]*?)<\/script>/)![1]);
});

test('model evidence is recorded only by actual conversation attempts and excludes prompts/raw errors',async()=>{
 const {runConversation}=await import('./conversation.js');const {modelConnection}=await import('./model-connection.js');
 const messages:any[]=[];let failed=false;
 const session={model:{provider:'fixture-attempt',id:'fixture-model'},messages,subscribe:()=>()=>{},abort:async()=>{},prompt:async()=>{messages.push({role:'assistant',stopReason:failed?'error':'stop',errorMessage:failed?'HTTP 429 private-key-do-not-show':'',content:[{type:'text',text:'private response'}]})}};
 const output={text:()=>{},status:()=>{}};await runConversation(session as any,'private prompt',1000,output);assert.equal(modelConnection('fixture-attempt','fixture-model')?.category,null);
 failed=true;await assert.rejects(runConversation(session as any,'private prompt',1000,output));const result=modelConnection('fixture-attempt','fixture-model');assert.equal(result?.category,'model_rate_limit');assert.doesNotMatch(JSON.stringify(result),/private|429|key/);
});

test('memory health validates read-only and preserves expired/corrupt files',async()=>{
 const {MemoryStore,emptyMemory}=await import('./memory.js');const {mkdtempSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const root=mkdtempSync(join(tmpdir(),'status-memory-')),store=new MemoryStore(root);
 try{const file=join(root,'a'.repeat(64)+'.json'),old=JSON.stringify(emptyMemory(Date.now()-91*86400000));writeFileSync(file,old);assert.equal(store.readHealth(),true);assert.equal(readFileSync(file,'utf8'),old);writeFileSync(file,'broken');assert.equal(store.readHealth(),false);assert.equal(readFileSync(file,'utf8'),'broken')}finally{store.close();rmSync(root,{recursive:true,force:true})}
});


test('failed status checks distinguish expired page permission, unavailable checker and timeout from LINE failure',async()=>{
 const {statusCheckFailure}=await import('./system-status-admin.js');
 assert.match(statusCheckFailure(403,false),/403.*รีเฟรช/);assert.match(statusCheckFailure(503,false),/503/);assert.match(statusCheckFailure(0,true),/เกินเวลารอ/);assert.match(statusCheckFailure(0,false),/ยังสรุปไม่ได้/);
 new Function(adminPage().match(/<script>([\s\S]*?)<\/script>/)![1]);
});

test('overview automatically checks absent/stale evidence, but leaves fresh external evidence alone',async()=>{
 const {needsExternalCheck}=await import('./system-status-admin.js');const now=Date.now();
 assert.equal(needsExternalCheck(null,now),true);assert.equal(needsExternalCheck('invalid',now),true);
 assert.equal(needsExternalCheck(new Date(now-60000).toISOString(),now),false);
 assert.equal(needsExternalCheck(new Date(now-5*60000).toISOString(),now),false);
 assert.equal(needsExternalCheck(new Date(now-5*60000-1).toISOString(),now),true);
});
test('read-only diagnostic recovers rotated page token once after server restart; never reloads or probes arbitrary destinations',async()=>{
 const {fetchStatusData}=await import('./system-status-admin.js');const calls:{url:string;token:string|undefined}[]=[];
 const fetcher=(async(url:any,options:any)=>{const token=options.headers?.['X-Customer-Token'];calls.push({url,token});if(url==='/')return new Response('const CUSTOMER_CSRF_TOKEN="new-page-token";');if(token==='old-page-token')return new Response('{}',{status:403});return new Response(JSON.stringify({externalCheckedAt:'fixture'}))}) as typeof fetch;
 const result=await fetchStatusData(true,'old-page-token',fetcher);assert.equal(result.token,'new-page-token');assert.equal(result.data.externalCheckedAt,'fixture');assert.deepEqual(calls.map(c=>c.url),['/api/system-status/check','/','/api/system-status/check']);assert.equal(calls[2].token,'new-page-token');
 let attempts=0;await assert.rejects(fetchStatusData(true,'bad',async()=>{attempts++;return new Response('{}',{status:403})}),error=>(error as any).status===403);assert.equal(attempts,2);
});
