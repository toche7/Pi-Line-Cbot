import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { ConversationControl, conversationKey, linePush } from './conversation-control.js';
import { LineAdapter } from './line.js';
import { CustomerStore, localActor } from './customers.js';
import { ConversationMonitor } from './monitor.js';
import { CourseRequestStore } from './course-requests.js';
import { adminHandler } from './admin.js';
const key = conversationKey('oa','alice');
const temporary = () => mkdtempSync(join(tmpdir(), 'conversation-test-'));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function accept(adapter: LineAdapter, id: string, user = 'alice') {
  const raw = Buffer.from(JSON.stringify({ events: [{ type:'message', webhookEventId:id, replyToken:'mock-token', source:{type:'user',userId:user}, message:{type:'text',text:'test'} }] }));
  assert.equal(adapter.accept(raw, createHmac('sha256','mock-secret').update(raw).digest('base64')), 200);
}
test('handover persists per OA/user, rejects stale state and invalidates old bot tickets even after release', () => {
  const root = temporary(); try {
    const c = new ConversationControl(root), ticket = c.ticket(key);
    c.change(key,true,0);
    assert.equal(c.valid(key,ticket),false);
    assert.equal(c.ticket(conversationKey('other','alice')).allowed,true);
    assert.equal(c.ticket(conversationKey('oa','bob')).allowed,true);
    assert.throws(()=>c.change(key,false,0),/สถานะเปลี่ยน/);
    const restarted = new ConversationControl(root);
    assert.equal(restarted.mode(key).human,true);
    assert.equal(restarted.mode(key).actor,localActor);
    restarted.change(key,false,1);
    assert.equal(restarted.valid(key,ticket),false);
    assert.equal(restarted.ticket(key).allowed,true);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
test('handover during generation suppresses active and queued bot replies; other customers continue and only fresh messages resume', async () => {
  const root = temporary(); const gate = deferred(), started = deferred(); try {
    const control = new ConversationControl(root), replies: string[] = [], generated: string[] = [], observations: any[] = [];
    const adapter = new LineAdapter({secret:'mock-secret',account:'oa',dryRun:false,allowedUsers:new Set(['alice','bob']),control,
      core:{client:i=>({send:async (_p,out)=>{generated.push(i.user);if(generated.length===1){started.resolve();await gate.promise}out.text('mock '+i.user)},abort:async()=>{}})},
      reply:async(_t,text)=>{replies.push(text)},observe:e=>observations.push(e)});
    accept(adapter,'active'); await started.promise;
    accept(adapter,'queued');control.change(key,true,0);accept(adapter,'human-inbox');accept(adapter,'other','bob');
    control.change(key,false,1);gate.resolve();await adapter.drain();
    assert.deepEqual(replies,['mock bob']);assert.deepEqual(generated,['alice','bob']);
    assert.equal(observations.filter(e=>e.status==='bot_paused').length,3);
    accept(adapter,'fresh');await adapter.drain();assert.deepEqual(replies,['mock bob','mock alice']);
    adapter.close();
  } finally { gate.resolve(); rmSync(root,{recursive:true,force:true}); }
});
test('handover cannot race a bot transport already sending', async () => {
  const root = temporary(), gate = deferred(), started = deferred();try {
    const control = new ConversationControl(root);
    const adapter = new LineAdapter({secret:'mock-secret',account:'oa',dryRun:false,allowedUsers:new Set(['alice']),control,
      core:{client:()=>({send:async(_p,out)=>out.text('mock'),abort:async()=>{}})},reply:async()=>{started.resolve();await gate.promise}});
    accept(adapter,'sending');await started.promise;assert.throws(()=>control.change(key,true,0),/กำลังส่ง/);
    gate.resolve();await adapter.drain();control.change(key,true,0);assert.equal(control.mode(key).human,true);adapter.close();
  } finally {gate.resolve();rmSync(root,{recursive:true,force:true});}
});
test('manual send reserves durable id before transport, suppresses concurrent/different/restarted duplicates and blocks release in flight', async () => {
  const root = temporary(), gate = deferred();try {
    const c = new ConversationControl(root);c.change(key,true,0);const id=randomUUID();let calls=0;
    const sending=c.send(key,1,id,'mock answer',async()=>{calls++;await gate.promise});
    assert.equal(JSON.parse(readFileSync(join(root,'control.json'),'utf8')).deliveries[0].status,'pending');
    assert.equal((await c.send(key,1,id,'mock answer',async()=>{calls++})).status,'pending');
    assert.throws(()=>c.change(key,false,1),/กำลังส่ง/);
    await assert.rejects(c.send(key,1,randomUUID(),'another',async()=>{}),/กำลังส่ง/);
    await assert.rejects(c.send(key,1,id,'changed',async()=>{}),/รหัสการส่ง/);
    const crashed=new ConversationControl(root);assert.equal(crashed.snapshot().deliveries[0].status,'unknown');
    assert.equal((await crashed.send(key,1,id,'mock answer',async()=>{calls++})).status,'unknown');
    gate.resolve();assert.equal((await sending).status,'accepted');
    const restarted=new ConversationControl(root);await restarted.send(key,1,id,'mock answer',async()=>{calls++});assert.equal(calls,1);
  } finally {gate.resolve();rmSync(root,{recursive:true,force:true});}
});
test('uncertain manual send is never auto retried; bot mode, malformed text/id and stale epochs reject', async () => {
  const root=temporary();try {
    const c=new ConversationControl(root), id=randomUUID();let calls=0;
    await assert.rejects(c.send(key,0,id,'hello',async()=>{}),/ต้องรับช่วง/);
    c.change(key,true,0);
    await assert.rejects(c.send(key,0,id,'hello',async()=>{}),/ต้องรับช่วง/);
    for(const text of ['', 'x'.repeat(4501),'bad\u0000'])await assert.rejects(c.send(key,1,id,text,async()=>{}),/ไม่ถูกต้อง/);
    await assert.rejects(c.send(key,1,'bad-id','hello',async()=>{}),/ไม่ถูกต้อง/);
    const transport=async()=>{calls++;throw Error('private provider detail')};
    assert.equal((await c.send(key,1,id,'hello',transport)).status,'unknown');
    await c.send(key,1,id,'hello',transport);assert.equal(calls,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('corrupt persistence fails startup; failed state writes suspend bot authority',()=>{
  const root=temporary();try{
    const c=new ConversationControl(root),ticket=c.ticket(key);
    rmSync(root,{recursive:true});assert.throws(()=>c.change(key,true,0),/บันทึกสถานะไม่ได้/);
    assert.equal(c.valid(key,ticket),false);assert.equal(c.ticket('other').allowed,false);
    // A corrupt file must never silently unpause all contacts.
    const other=temporary();try{writeFileSync(join(other,'control.json'),'{broken');assert.throws(()=>new ConversationControl(other),/unreadable/)}finally{rmSync(other,{recursive:true,force:true});}
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('manual LINE transport uses push with stable retry key, never old reply tokens; only API acceptance counts',async()=>{
  const id=randomUUID();let calls=0;
  await linePush('fixture',async(url,init)=>{calls++;assert.equal(url,'https://api.line.me/v2/bot/message/push');assert.equal((init!.headers as any)['X-Line-Retry-Key'],id);assert.deepEqual(JSON.parse(init!.body as string),{to:'alice',messages:[{type:'text',text:'hello'}]});return new Response('{}')})('alice',id,'hello');
  assert.equal(calls,1);
  await linePush('fixture',async()=>new Response('{}',{status:409,headers:{'x-line-accepted-request-id':'accepted'}}))('alice',id,'hello');
  await assert.rejects(linePush('fixture',async()=>new Response('{}',{status:409}))('alice',id,'hello'));
  await assert.rejects(linePush('fixture',async()=>new Response('{}',{status:429}))('alice',id,'hello'));
});
test('conversation HTTP gates host/origin/token, account/allowlist, confirmation, seven-day eligibility, dry run and idempotency',async()=>{
  const root=temporary(), monitor=new ConversationMonitor(join(root,'monitor')), requests=new CourseRequestStore(join(root,'requests')), customers=new CustomerStore(join(root,'customers'));
  const add=(userId:string,account='oa',at=new Date().toISOString())=>monitor.record({id:randomUUID(),account,userId,at,direction:'in',text:'fixture',status:'received'});
  add('alice');add('bob');add('foreign','other');add('old','oa',new Date(Date.now()-8*86400000).toISOString());
  let calls=0;const sentTexts:string[]=[];const service={control:new ConversationControl(join(root,'control')),account:'oa',allowedUsers:new Set(['alice','old']),dryRun:false,push:async(_user:string,_id:string,text:string)=>{calls++;sentTexts.push(text)}};
  const server=createServer(adminHandler(monitor,requests,customers,undefined,service));
  try{
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+(server.address() as any).port;
    const html=await (await fetch(url)).text(),token=html.match(/const CUSTOMER_CSRF_TOKEN="([a-f0-9]+)"/)![1];
    const get=()=>fetch(url+'/api/conversations');const data=await(await get()).json();const id=(u:string)=>data.customers.find((c:any)=>c.identity.user===u).id;
    const post=(input:any,headers:any={})=>fetch(url+'/api/conversations',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-Customer-Token':token,...headers},body:JSON.stringify(input)});
    const foreignStatus = await new Promise<number>(resolve => { const req=httpRequest(url+'/api/conversations',{headers:{Host:'foreign.invalid'}},res=>{res.resume();resolve(res.statusCode!)});req.end(); });
    assert.equal(foreignStatus,403);
    const take={action:'take',customerId:id('alice'),epoch:0};
    for(const headers of [{Origin:'https://foreign.invalid'},{'X-Customer-Token':'bad'},{'Content-Type':'text/plain'}])assert.equal((await post(take,headers)).status,403,JSON.stringify(headers));
    assert.equal((await post({...take,customerId:id('bob')})).status,403);assert.equal((await post({...take,customerId:id('foreign')})).status,403);
    assert.equal((await post(take)).status,200);assert.equal((await post(take)).status,409);
    const send={action:'send',customerId:id('alice'),epoch:1,id:randomUUID(),text:'fixture outbound'};
    assert.equal((await post(send)).status,400);
    assert.equal((await post({...send,confirmed:true})).status,200);assert.equal((await post({...send,confirmed:true})).status,200);assert.equal(calls,1);assert.deepEqual(sentTexts,['【Staff】 fixture outbound']);
    const prefixed={...send,id:randomUUID(),text:'【Staff】 already labelled',confirmed:true};assert.equal((await post(prefixed)).status,200);assert.equal(sentTexts.at(-1),'【Staff】 already labelled');
    const long={...send,id:randomUUID(),text:'x'.repeat(4500),confirmed:true};assert.equal((await post(long)).status,400);assert.equal(calls,2);
    assert.equal((await post({action:'take',customerId:id('old'),epoch:0})).status,200);
    assert.equal((await post({...send,customerId:id('old'),confirmed:true,id:randomUUID()})).status,403);
    service.dryRun=true;assert.equal((await post({...send,confirmed:true,id:randomUUID()})).status,403);assert.equal(calls,2);
    const latest=await(await get()).json();assert.equal(latest.events.length,4);assert.equal(latest.control.deliveries.length,2);assert.equal(latest.actor,localActor);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});
