import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { PendingLineUsers } from './line-pending-users.js';
import { LineAdapter } from './line.js';

test('pending admission records only metadata for signed unknown direct senders, never replies or authorizes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pending-line-')),store=new PendingLineUsers(root);
 const known='U'+'a'.repeat(32),unknown='U'+'b'.repeat(32);let core=0,replies=0;
 const allowed=new Set([known]);
 const adapter=new LineAdapter({secret:'fixture',account:'oa',allowedUsers:allowed,dryRun:false,
  core:{client:()=>{core++;throw Error('must not run')}},reply:async()=>{replies++},observePendingUser:(a,u)=>store.record(a,u)});
 try{
  const raw=Buffer.from(JSON.stringify({events:[{type:'message',source:{type:'user',userId:unknown},message:{type:'text',text:'private message must not be stored'},replyToken:'private-token'},
   {type:'message',mode:'standby',source:{type:'user',userId:'U'+'c'.repeat(32)}},
   {type:'message',source:{type:'group',userId:'U'+'d'.repeat(32)}},
   {type:'message',source:{type:'user',userId:known},message:{type:'sticker'}},
   {type:'message',source:{type:'user',userId:'../../bad'}}]}));
  assert.equal(adapter.accept(raw,'invalid'),401);assert.deepEqual(store.list(),[]);
  const signature=createHmac('sha256','fixture').update(raw).digest('base64');
  adapter.accept(raw,signature);adapter.accept(raw,signature);await adapter.drain();
  assert.equal(core+replies,0);assert.equal(store.list().length,1);assert.equal(store.list()[0].userId,unknown);assert.equal(allowed.size,1);assert.equal(allowed.has(unknown),false);
  const content=readdirSync(root).map(n=>readFileSync(join(root,n),'utf8')).join('');assert.doesNotMatch(content,/private message|private-token/);
  assert.equal(statSync(join(root,readdirSync(root)[0])).mode&0o777,0o600);
 }finally{adapter.close();rmSync(root,{recursive:true,force:true})}
});
test('pending identities stay isolated per OA, persist latest observation and expire after seven days',()=>{
 const root=mkdtempSync(join(tmpdir(),'pending-line-'));let now=Date.now();const store=new PendingLineUsers(root,()=>now),id='U'+'a'.repeat(32);
 try{store.record('one',id);now+=1000;store.record('one',id);store.record('two',id);assert.equal(store.list().length,2);
  const first=store.list().find(r=>r.account==='one')!;assert.notEqual(first.firstSeenAt,first.lastSeenAt);
  assert.equal(new PendingLineUsers(root,()=>now).list().length,2);now+=8*86400000;assert.equal(store.list().length,0);
  store.record('one','U'+'b'.repeat(32));assert.equal(readdirSync(root).length,1);
 }finally{rmSync(root,{recursive:true,force:true})}
});
