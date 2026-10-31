import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { PendingLineUsers } from './line-pending-users.js';
import { LineAccess } from './line-access.js';
import { pendingUsersHandler } from './line-pending-admin.js';
import { LineAdapter } from './line.js';
import { localActor } from './customers.js';
const known='U'+'a'.repeat(32),guest='U'+'b'.repeat(32),second='U'+'c'.repeat(32),foreign='U'+'d'.repeat(32);
function fixture(){const root=mkdtempSync(join(tmpdir(),'line-access-'));let now=Date.now();const pending=new PendingLineUsers(join(root,'pending'),()=>now),allowed=new Set([known]),access=new LineAccess(join(root,'access'),'oa',allowed,()=>now);
 pending.record('oa',guest);pending.record('oa',second);pending.record('foreign-oa',foreign);return{root,pending,allowed,access,advance:(ms:number)=>{now+=ms},clean:()=>rmSync(root,{recursive:true,force:true})}}
test('owner admission changes running adapter immediately, persists across restart and preserves baseline users without replaying old messages',async()=>{
 const f=fixture();let calls=0,sends=0;const adapter=new LineAdapter({secret:'fixture',account:'oa',allowedUsers:f.allowed,dryRun:false,
  core:{client:()=>({send:async(_p,out)=>{calls++;out.text('fixture response')},abort:async()=>{}})},reply:async()=>{sends++}});
 const receive=(id:string)=>{const raw=Buffer.from(JSON.stringify({events:[{type:'message',webhookEventId:id,replyToken:'test-token',source:{type:'user',userId:guest},message:{type:'text',text:'fixture'}}]}));return adapter.accept(raw,createHmac('sha256','fixture').update(raw).digest('base64'))};
 try{receive('before');await adapter.drain();assert.equal(calls+sends,0);
  const result=f.access.allow(guest,0,f.pending);assert.equal(result.alreadyAllowed,false);assert.equal(calls+sends,0);assert.equal(f.allowed.has(guest),true);assert.equal(f.allowed.has(known),true);
  receive('after');await adapter.drain();assert.equal(calls,1);assert.equal(sends,1);
  f.access.allow(guest,0,f.pending);assert.equal(f.access.snapshot().grants.length,1);
  const restored=new Set([known]);const restart=new LineAccess(join(f.root,'access'),'oa',restored);assert.equal(restored.has(guest),true);assert.equal(restored.has(known),true);assert.equal(restart.snapshot().grants[0].actor,localActor);
  const otherSet=new Set([known]);new LineAccess(join(f.root,'access'),'other-oa',otherSet);assert.equal(otherSet.has(guest),false);
  const file=readdirSync(join(f.root,'access')).find(n=>n.endsWith('.json'))!;assert.equal(statSync(join(f.root,'access',file)).mode&0o777,0o600);
 }finally{adapter.close();f.clean()}
});
test('unknown/expired/foreign users and stale revisions cannot grant access; unreadable files and lock preserve current rights',()=>{
 const f=fixture();try{
  assert.throws(()=>f.access.allow(foreign,0,f.pending),/ไม่พบ/);assert.throws(()=>f.access.allow('invalid',0,f.pending),/ไม่ถูกต้อง/);assert.equal(f.allowed.size,1);
  f.access.allow(guest,0,f.pending);assert.throws(()=>f.access.allow(second,0,f.pending),(e:any)=>e.status===409);assert.equal(f.allowed.has(second),false);
  const file=join(f.root,'access',readdirSync(join(f.root,'access')).find(n=>n.endsWith('.json'))!),before=readFileSync(file,'utf8');
  const lock=openSync(file+'.lock','wx');try{assert.throws(()=>f.access.allow(second,1,f.pending),/กำลังบันทึก/)}finally{closeSync(lock);unlinkSync(file+'.lock')}
  assert.equal(readFileSync(file,'utf8'),before);f.advance(8*86400000);assert.throws(()=>f.access.allow(second,1,f.pending),/ไม่พบ/);assert.equal(f.allowed.has(second),false);
  writeFileSync(file,'broken');assert.throws(()=>f.access.allow(second,1,f.pending),/อ่านข้อมูลสิทธิ์/);assert.equal(readFileSync(file,'utf8'),'broken');assert.equal(f.allowed.has(second),false);
 }finally{f.clean()}
});
test('admission HTTP requires same origin, CSRF, exact confirmation and current revision; GET cannot grant and forged actor is ignored',async()=>{
 const f=fixture(),server=createServer(pendingUsersHandler({store:f.pending,account:'oa',allowedUsers:f.allowed,access:f.access},'csrf'));
 try{await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const headers={Origin:url,'Content-Type':'application/json','X-Customer-Token':'csrf'},input={action:'allow',userId:guest,revision:0,confirmed:true,actor:'forged-admin'};
  const post=(data:unknown,h:Record<string,string>=headers)=>fetch(url,{method:'POST',headers:h,body:typeof data==='string'?data:JSON.stringify(data)});
  const snapshot=await(await fetch(url)).json();assert.equal(snapshot.readOnly,false);assert.equal(f.allowed.has(guest),false);
  assert.equal((await post(input,{'Content-Type':'application/json'})).status,403);assert.equal((await post(input,{...headers,Origin:'https://foreign.invalid'})).status,403);
  assert.equal((await post(input,{...headers,'X-Customer-Token':'wrong'})).status,403);assert.equal((await post(input,{...headers,'Content-Type':'text/plain'})).status,403);
  assert.equal((await post({...input,confirmed:false})).status,400);assert.equal((await post({...input,userId:foreign})).status,404);
  assert.equal((await post('{broken')).status,400);assert.equal((await post('x'.repeat(4200))).status,413);assert.equal(f.allowed.size,1);
  assert.equal((await post(input)).status,200);assert.equal((await post(input)).status,200);assert.equal(f.allowed.size,2);
  const data=await(await fetch(url)).json();assert.equal(data.grants.length,1);assert.equal(data.grants[0].actor,localActor);assert.ok(!data.users.some((u:any)=>u.userId===guest));
  assert.equal((await post({...input,userId:second})).status,409);assert.equal((await post({...input,userId:second,revision:data.revision})).status,200);
  assert.equal((await fetch(url,{method:'DELETE',headers})).status,405);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));f.clean()}
});
