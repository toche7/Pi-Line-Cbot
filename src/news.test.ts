import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CustomerStore } from './customers.js';
import { NewsStore, NewsService, newsLineTransport, type NewsTransport, type Campaign } from './news.js';

function fixture(transport?: NewsTransport) {
  const root = mkdtempSync(join(tmpdir(), 'cbtu-news-')); let now = 1700000000000;
  const customers = new CustomerStore(join(root,'customers'),()=>now);
  let cs = customers.snapshot({events:[],requests: ['A','B','C'].map(user=>({owner:{channel:'line',scope:'oa:direct',user}})) as any});
  const mutate = (id: string, action: string, data: unknown) => { customers.mutate({revision:cs.revision,id,action,data});cs=customers.snapshot({events:[],requests:[]}); };
  const a=cs.customers[0].id,b=cs.customers[1].id,c=cs.customers[2].id;
  mutate(a,'consent.update',{status:'subscribed',evidence:'fixture explicit opt in'});
  mutate(b,'consent.update',{status:'unsubscribed',evidence:'fixture opt out'});
  mutate('', 'group.create',{name:'ทดสอบ',description:''});const group=cs.groups[0].id;
  mutate(group,'group.members',{customerIds:[a,b,c]});
  const store=new NewsStore(join(root,'news'),()=>now),service=new NewsService(store,customers,'oa',transport,()=>now);
  const create=()=>service.mutate({action:'create',title:'ข่าว',text:'ข่าวถึงลูกค้า',customerIds:[a,a,b,c],groupIds:[group]});
  const review=(draft=create())=>service.mutate({action:'review',id:draft.id,revision:draft.revision});
  const queue=(campaign=review())=>{service.authorizeCampaign(campaign.id,campaign.review!.digest);return service.mutate({action:'confirm',id:campaign.id,revision:campaign.revision,digest:campaign.review!.digest});};
  return {root,customers,store,service,a,b,c,group,create,review,queue,mutate,advance:(ms:number)=>now+=ms,now:()=>now,clean:()=>rmSync(root,{recursive:true,force:true})};
}

test('news selects people/groups, dedupes and excludes unknown/opt-out; never copies notes',()=>{
 const f=fixture();try{f.mutate(f.a,'note.add',{text:'secret team note',kind:'observation',reference:''});const r=f.review();assert.equal(r.review!.recipients.length,1);assert.equal(r.review!.excluded,2);assert.equal(r.review!.recipients[0].id,f.a);assert.ok(!JSON.stringify(r).includes('secret team note'));assert.equal(f.service.snapshot().enabled,false);assert.throws(()=>f.queue(r),/ปิดอยู่/);}finally{f.clean()}
});
test('news exact review approval invalidates edits, changed consent and stale review',()=>{
 const f=fixture(async()=>({status:200}));try{let r=f.review();f.service.authorizeCampaign(r.id,r.review!.digest);let d=f.service.mutate({action:'save',id:r.id,revision:r.revision,title:r.title,text:'แก้ไขแล้ว',customerIds:[f.a],groupIds:[]});assert.throws(()=>f.service.mutate({action:'confirm',id:d.id,revision:d.revision,digest:r.review!.digest}));r=f.review(d);f.service.authorizeCampaign(r.id,r.review!.digest);f.mutate(f.a,'consent.update',{status:'unsubscribed',evidence:'withdraw'});assert.throws(()=>f.service.mutate({action:'confirm',id:r.id,revision:r.revision,digest:r.review!.digest}),/เปลี่ยน/);f.mutate(f.a,'consent.update',{status:'subscribed',evidence:'new consent'});r=f.review(r);f.advance(600001);assert.throws(()=>f.queue(r),/เปลี่ยน/);}finally{f.clean()}
});
test('news double confirmation, concurrent tick and restart do not duplicate accepted sends',async()=>{
 let calls=0;let release!:()=>void;const f=fixture(async()=>{calls++;await new Promise<void>(r=>release=r);return {status:200,requestId:'mock-request'};});try{const q=f.queue();assert.throws(()=>f.service.mutate({action:'confirm',id:q.id,revision:q.revision-1,digest:q.review!.digest}));const tick=f.service.tick();await f.service.tick();assert.equal(calls,1);release();await tick;const s=new NewsService(new NewsStore(join(f.root,'news'),f.now),f.customers,'oa',async()=>{calls++;return {status:200}});s.recover();await s.tick();assert.equal(calls,1);const c=f.store.list()[0];assert.equal(c.status,'complete');assert.equal(c.deliveries[0].status,'accepted');assert.equal(c.deliveries[0].requestId,'mock-request');}finally{f.clean()}
});
test('news crash recovery marks inflight ambiguous and never resends',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {status:200}});try{f.queue();f.store.transaction(s=>{s.campaigns[0].deliveries[0].status='inflight';});const s=new NewsService(f.store,f.customers,'oa',async()=>{calls++;return {status:200}});s.recover();await s.tick();assert.equal(calls,0);assert.equal(f.store.list()[0].deliveries[0].status,'ambiguous');}finally{f.clean()}
});
test('news rechecks consent immediately before dispatch and deadline expires safely',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {status:200}});try{f.queue();f.mutate(f.a,'consent.update',{status:'unknown',evidence:''});await f.service.tick();assert.equal(calls,0);assert.equal(f.store.list()[0].deliveries[0].status,'cancelled');f.mutate(f.a,'consent.update',{status:'subscribed',evidence:'new'});f.queue();f.advance(900001);await f.service.tick();assert.equal(calls,0);assert.equal(f.store.list()[1].deliveries[0].status,'failed');}finally{f.clean()}
});
test('news 429 backs off with stable retry key; 5xx and timeouts stay ambiguous',async()=>{
 const keys:string[]=[];const f=fixture(async(_u,_t,key)=>{keys.push(key);return {status:keys.length===1?429:200}});try{f.queue();await f.service.tick();await f.service.tick();assert.equal(keys.length,1);f.advance(30001);await f.service.tick();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);}finally{f.clean()}
 for(const result of [async()=>({status:503}),async()=>{throw Error('timeout')}]){let calls=0;const g=fixture(async()=>{calls++;return result()});try{g.queue();await g.service.tick();g.advance(60000);await g.service.tick();assert.equal(calls,1);assert.equal(g.store.list()[0].deliveries[0].status,'ambiguous');}finally{g.clean()}}
});
test('news 409 accepted requires provider accepted-request-id; other 4xx fails',async()=>{
 for(const [result,status] of [[{status:409,acceptedRequestId:'accepted'},'accepted'],[{status:409},'ambiguous'],[{status:400},'failed']] as const){const f=fixture(async()=>result);try{f.queue();await f.service.tick();assert.equal(f.store.list()[0].deliveries[0].status,status);}finally{f.clean()}}
});
test('news cancellation and partial failures persist counts',async()=>{
 let calls=0;const f=fixture(async()=>({status:++calls===1?400:200}));try{f.mutate(f.b,'consent.update',{status:'subscribed',evidence:'fixture opt in'});const q=f.queue();await f.service.tick();f.service.mutate({action:'cancel',id:q.id,revision:f.store.list()[0].revision});f.advance(2000);await f.service.tick();assert.equal(calls,1);const rows=f.store.list()[0].deliveries;assert.equal(rows.filter(r=>r.status==='failed').length,1);assert.equal(rows.filter(r=>r.status==='cancelled').length,1);assert.equal(new NewsStore(join(f.root,'news')).list()[0].status,'cancelled');}finally{f.clean()}
});
test('news lock/concurrency and unreadable storage fail without overwrite',()=>{
 const f=fixture();try{const c=f.create();assert.throws(()=>f.service.mutate({action:'save',id:c.id,revision:0,title:'x',text:'y',customerIds:[],groupIds:[]}));const lock=join(f.root,'news','.write-lock');const fd=openSync(lock,'wx');try{assert.throws(()=>f.create(),/กำลังถูกบันทึก/)}finally{closeSync(fd);unlinkSync(lock)}const file=join(f.root,'news','news.json');writeFileSync(file,'broken');assert.throws(()=>f.create(),/อ่านที่เก็บข่าวไม่ได้/);assert.equal(readFileSync(file,'utf8'),'broken');}finally{f.clean()}
});
test('news transport matches LINE push API with stable key and no reply token (mock fetch)',async()=>{
 let captured:any;const transport=newsLineTransport('fake-token',async(url,options)=>{captured={url,...options};return new Response('{}',{status:200,headers:{'x-line-request-id':'mock'}})});const r=await transport('Ufake','hello','00000000-0000-4000-8000-000000000000',AbortSignal.timeout(1000));assert.equal(r.status,200);assert.equal(captured.url,'https://api.line.me/v2/bot/message/push');assert.equal(captured.headers['X-Line-Retry-Key'],'00000000-0000-4000-8000-000000000000');assert.deepEqual(JSON.parse(captured.body),{to:'Ufake',messages:[{type:'text',text:'hello'}]});
});

test('news two independent processes cannot save the same campaign revision twice',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);
 const f=fixture();try{const c=f.create();const source=`import {NewsService,NewsStore} from './dist/news.js';import {CustomerStore} from './dist/customers.js';import {join} from 'node:path';const [root,id,revision]=process.argv.slice(1);const service=new NewsService(new NewsStore(join(root,'news')),new CustomerStore(join(root,'customers')),'oa');try{service.mutate({action:'save',id,revision:Number(revision),title:'concurrent writer',text:'fixture',customerIds:[],groupIds:[]});console.log('saved')}catch(e){console.log('conflict:'+e.status)}`;
 const results=await Promise.all([1,2].map(()=>exec(process.execPath,['--input-type=module','-e',source,f.root,c.id,String(c.revision)])));
 assert.equal(results.filter(r=>r.stdout.trim()==='saved').length,1);assert.equal(results.filter(r=>r.stdout.trim()==='conflict:409').length,1);assert.equal(f.store.list()[0].revision,c.revision+1);
 }finally{f.clean()}
});


test('news group membership changes after confirmation invalidate remaining recipients',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {status:200}});try{const draft=f.create();const groupOnly=f.service.mutate({action:'save',id:draft.id,revision:draft.revision,title:draft.title,text:draft.text,customerIds:[],groupIds:[f.group]});f.queue(f.review(groupOnly));f.mutate(f.group,'group.members',{customerIds:[f.b,f.c]});await f.service.tick();assert.equal(calls,0);assert.equal(f.store.list()[0].deliveries[0].status,'cancelled');assert.ok(f.store.list()[0].history.some(h=>h.event==='review-invalidated'));}finally{f.clean()}
});

test('news owner grant persists exact campaign across restart, expires, preserves identical re-review and revokes changed drafts',()=>{
 const f=fixture();try{let r=f.review();const mock:NewsTransport=async()=>({status:200});let service=new NewsService(f.store,f.customers,'oa',mock,f.now,true);assert.equal(service.enabled,false);service.authorizeCampaign(r.id,r.review!.digest);service=new NewsService(f.store,f.customers,'oa',mock,f.now,true);assert.equal(service.enabled,true);assert.equal(service.snapshot().campaigns[0].canConfirm,true);service.mutate({action:'review',id:r.id,revision:r.revision});assert.equal(service.enabled,true);r=f.store.list()[0];const changed=service.mutate({action:'save',id:r.id,revision:r.revision,title:r.title,text:'changed',customerIds:r.selection.customerIds,groupIds:r.selection.groupIds});assert.equal(service.enabled,false);r=f.review(changed);service.authorizeCampaign(r.id,r.review!.digest);f.advance(30*60000+1);assert.equal(service.enabled,false);assert.throws(()=>service.mutate({action:'confirm',id:r.id,revision:r.revision,digest:r.review!.digest}),/ปิดอยู่/);}finally{f.clean()}
});
test('news worker owns singleton recovery, dispatches only queued authorized work, and drains on close (mock)',async()=>{
 const {NewsWorker}=await import('./news-worker.js');let sends=0;const f=fixture(async()=>{sends++;return {status:200}});let worker:any;
 try{const r=f.review();worker=new NewsWorker(f.service);worker.start();const other=new NewsWorker(f.service);assert.throws(()=>other.start());assert.equal(sends,0);f.queue(r);worker.pump();worker.pump();await worker.close();assert.equal(sends,1);assert.equal(f.store.list()[0].deliveries[0].status,'accepted');const next=new NewsWorker(f.service);next.start();next.pump();await next.close();assert.equal(sends,1);}finally{if(worker)await worker.close();f.clean()}
});
