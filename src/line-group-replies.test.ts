import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import { LineGroupStore } from './line-groups.js';
import { LineGroupReplies, groupMentionPrompt, groupCallWordPrompt } from './line-group-replies.js';
import { LineAdapter } from './line.js';
import { CustomerCore, type Identity } from './core.js';
import { MemoryStore } from './memory.js';
const groupId='C'+'a'.repeat(32), otherGroup='C'+'b'.repeat(32), userId='U'+'c'.repeat(32), otherUser='U'+'d'.repeat(32), botId='U'+'e'.repeat(32);
function event(id='e1', question='สมัครสมาชิกอย่างไร') { return { type:'message', mode:'active', webhookEventId:id, timestamp:Date.now(), replyToken:'fixture-reply-'+id,
  source:{type:'group',groupId,userId},message:{type:'text',text:'@bot '+question,mention:{mentionees:[{type:'user',isSelf:true,userId:botId,index:0,length:4}]}} }; }
function setup() {
 const dir=mkdtempSync(join(tmpdir(),'group-reply-')),store=new LineGroupStore(join(dir,'rooms'),'oa');
 store.observe({groupId,type:'join',at:new Date().toISOString()});
 store.observe({groupId:otherGroup,type:'join',at:new Date().toISOString()});
 store.enableMentions(groupId);
 return {dir,store,clean:()=>rmSync(dir,{recursive:true,force:true})};
}
test('native self mention is required; name text, other users, all, forged target, malformed offsets and missing sender remain silent',()=>{
 assert.equal(groupMentionPrompt(event(),botId),'สมัครสมาชิกอย่างไร');
 for(const change of [
  (e:any)=>delete e.message.mention,
  (e:any)=>e.message.mention.mentionees[0].type='all',
  (e:any)=>e.message.mention.mentionees[0].isSelf=false,
  (e:any)=>e.message.mention.mentionees[0].userId=otherUser,
  (e:any)=>e.message.mention.mentionees[0].index=1000,
  (e:any)=>e.message.mention.mentionees[0].length=-1,
  (e:any)=>e.mode='standby',
  (e:any)=>delete e.source.userId,
  (e:any)=>e.source.type='user',
 ]){const e=event();change(e);assert.equal(groupMentionPrompt(e,botId),undefined)}
 assert.equal(groupMentionPrompt(event(),undefined),undefined);
 assert.equal(groupMentionPrompt(event('empty',''),botId),'');
});
test('CBOT prefix accepts case-insensitive deliberate calls only, without LINE native mention metadata',async()=>{
 const f=setup();f.store.enableCallWord(groupId);const questions:string[]=[],sent:string[]=[];
 const replies=new LineGroupReplies(f.store,{client:()=>({send:async(p,out)=>{questions.push(p);out.text('คำตอบทดสอบ')},abort:async()=>{}})},'oa',false,async(_t,text)=>{sent.push(text)});
 try{
  for(const [i,text] of ['CBOT สมัครเรียนยังไง','cbot ราคาเท่าไร','  Cbot: สวัสดี','CBOT','CBOTสมัครเรียนยังไง','cbotany','พูดถึง CBOT เฉย ๆ','@CBOT คำถาม','ซีบอต คำถาม'].entries()){
   const e=event('call-'+i);e.message.text=text;delete(e.message as any).mention;
   replies.accept(e,undefined);
  }
  await replies.drain();assert.deepEqual(questions,['สมัครเรียนยังไง','ราคาเท่าไร','สวัสดี','สมัครเรียนยังไง','any']);assert.equal(sent.length,6);
  const bad=event();bad.mode='standby';bad.message.text='CBOT test';assert.equal(groupCallWordPrompt(bad),undefined);
  assert.equal(f.store.replyMode(otherGroup),undefined);
  const restart=new LineGroupStore(join(f.dir,'rooms'),'oa');assert.equal(restart.replyMode(groupId),'cbot');
 }finally{replies.close();f.clean()}
});
test('CBOT rooms accept native self mentions as a second trigger and reject plain @names, all, other users and disabled rooms',async()=>{
 const f=setup();f.store.enableCallWord(groupId);const questions:string[]=[],tokens:string[]=[];
 const service=new LineGroupReplies(f.store,{client:()=>({send:async(p,out)=>{questions.push(p);out.text('fixture response')},abort:async()=>{}})},'oa',false,async(token)=>{tokens.push(token)});
 try{
  const word=event('word');word.message.text='cBoTสมัครสมาชิกอย่างไร';delete(word.message as any).mention;
  const native=event('native','ราคาเท่าไร');
  const bare=event('bare','');
  const middle=event('middle');middle.message.text='ช่วยหน่อย @bot เวลาเรียน';middle.message.mention.mentionees[0].index=10;
  const plain=event('plain');delete(plain.message as any).mention;
  const all=event('all');all.message.mention.mentionees[0].type='all';
  const other=event('other');other.message.mention.mentionees[0].isSelf=false;other.message.mention.mentionees[0].userId=otherUser;
  const wrongDestination=event('wrong-destination');
  const disabled=event('disabled');disabled.source.groupId=otherGroup;
  for(const e of [word,native,bare,middle,plain,all,other,disabled])service.accept(e,botId);
  service.accept(wrongDestination,otherUser);
  service.accept(native,botId); // Same native event must never reply twice.
  await service.drain();
  assert.deepEqual(questions,['สมัครสมาชิกอย่างไร','ราคาเท่าไร','ช่วยหน่อย  เวลาเรียน']);
  assert.equal(tokens.length,4);assert.equal(tokens.filter(t=>t==='fixture-reply-native').length,1);
  assert.equal(f.store.list().find(r=>r.groupId===otherGroup)?.messages?.length,0);
 }finally{service.close();f.clean()}
});
test('only enabled rooms reply to native tags; signed adapter keeps direct monitor/control separate and reply redelivery is durable',async()=>{
 const f=setup();const calls:{identity:Identity;prompt:string}[]=[],sent:string[]=[];
 const core={client:(identity:Identity)=>({send:async(prompt:string,out:any)=>{calls.push({identity,prompt});out.text('คำตอบจากกลุ่ม fixture')},abort:async()=>{}})};
 const groupReplies=new LineGroupReplies(f.store,core,'oa',false,async token=>{sent.push(token)});
 const adapter=new LineAdapter({secret:'fixture',account:'oa',allowedUsers:new Set([userId]),dryRun:false,core:{client:()=>{throw Error('direct core must not run')}},
  reply:async()=>{throw Error('direct reply must not run')},observe:()=>{throw Error('direct history must not receive group')},groupReplies,observeGroup:e=>f.store.observe(e)});
 try{
  const known=event();const unknown=event('other-room');unknown.source.groupId=otherGroup;const quiet=event('quiet');delete (quiet.message as any).mention;
  const raw=Buffer.from(JSON.stringify({destination:botId,events:[known,unknown,quiet]})),sig=createHmac('sha256','fixture').update(raw).digest('base64');
  assert.equal(adapter.accept(raw,'bad'),401);assert.equal(sent.length,0);
  assert.equal(adapter.accept(raw,sig),200);await adapter.drain();adapter.accept(raw,sig);await adapter.drain();
  assert.equal(sent.length,1);assert.equal(calls.length,1);assert.equal(calls[0].prompt,'สมัครสมาชิกอย่างไร');
  assert.deepEqual(calls[0].identity,{channel:'line',scope:'oa:group:'+groupId,user:userId});
  const output=f.store.list().find(r=>r.groupId===groupId)!.messages!.filter(m=>m.direction==='out');assert.equal(output.length,1);assert.equal(output[0].status,'accepted');
  const restarted=new LineGroupReplies(new LineGroupStore(join(f.dir,'rooms'),'oa'),core,'oa',false,async()=>{sent.push('must not replay')});
  restarted.accept(known,botId);await restarted.drain();assert.equal(sent.length,1);
  assert.doesNotMatch(readFileSync(join(f.dir,'rooms',groupId+'.json'),'utf8'),/fixture-reply/);
 }finally{adapter.close();f.clean()}
});
test('different senders and rooms receive isolated identities; quiet messages do not reach group core',async()=>{
 const f=setup();f.store.enableMentions(otherGroup);const identities:Identity[]=[];
 const replies=new LineGroupReplies(f.store,{client:identity=>({send:async(_p,out)=>{identities.push(identity);out.text('ok')},abort:async()=>{}})},'oa',false,async()=>{});
 try{const one=event('one'),two=event('two'),three=event('three');two.source.userId=otherUser;three.source.groupId=otherGroup;
  for(const e of [one,two,three])replies.accept(e,botId);await replies.drain();assert.equal(identities.length,3);
  assert.notEqual(JSON.stringify(identities[0]),JSON.stringify(identities[1]));assert.notEqual(JSON.stringify(identities[0]),JSON.stringify(identities[2]));
 }finally{replies.close();f.clean()}
});
test('dry run, closed service, left room and failed/ambiguous transport never produce automatic repeated messages',async()=>{
 const f=setup();let calls=0,sends=0;const core={client:()=>({send:async(_p:string,out:any)=>{calls++;out.text('fixture')},abort:async()=>{}})};
 try{const dry=new LineGroupReplies(f.store,core,'oa',true,async()=>{sends++});dry.accept(event('dry'),botId);await dry.drain();assert.equal(calls+sends,0);
  const failed=new LineGroupReplies(f.store,core,'oa',false,async()=>{sends++;throw Error('transport private error')});failed.accept(event('failed'),botId);await failed.drain();failed.accept(event('failed'),botId);await failed.drain();assert.equal(sends,1);
  assert.equal(f.store.list().find(r=>r.groupId===groupId)?.messages?.find(m=>m.direction==='out')?.status,'failed');
  f.store.observe({groupId,type:'leave',at:new Date().toISOString()});failed.accept(event('left'),botId);await failed.drain();assert.equal(sends,1);
  failed.close();failed.accept(event('closed'),botId);await failed.drain();assert.equal(sends,1);
 }finally{f.clean()}
});
test('group slash commands and bare tags reply locally without touching core or private memory commands',async()=>{
 const f=setup();let calls=0;const texts:string[]=[];
 const service=new LineGroupReplies(f.store,{client:()=>{calls++;throw Error('must not access core')}},'oa',false,async(_t,text)=>{texts.push(text)});
 try{service.accept(event('empty',''),botId);service.accept(event('memory','/memory'),botId);await service.drain();assert.equal(calls,0);assert.equal(texts.length,2);assert.match(texts[1],/แชตส่วนตัว/)}finally{service.close();f.clean()}
});
test('real core group identity uses dedicated persistent memory and cannot load private or other group/sender facts',async()=>{
 const f=setup(),privateStore=new MemoryStore(join(f.dir,'private-memory')),groupStore=new MemoryStore(join(f.dir,'group-memory'));
 const privateCore=new CustomerCore(undefined,1000,undefined,undefined,privateStore),groupCore=new CustomerCore(undefined,1000,undefined,undefined,groupStore);
 const out={text:(_s:string)=>{},status:(_s:string)=>{}};
 try{
  // Host memory extraction for explicit name does not call a provider.
  const privateIdentity={channel:'line' as const,scope:'oa:direct',user:userId};
  const groupIdentity={channel:'line' as const,scope:'oa:group:'+groupId,user:userId};
  const otherIdentity={...groupIdentity,user:otherUser};
  await privateCore.client(privateIdentity).send('ฉันชื่อ ข้อมูลส่วนตัวเท่านั้น',out);
  await groupCore.client(groupIdentity).send('ฉันชื่อ ชื่อที่บอกในกลุ่ม',out);
  assert.doesNotMatch(await groupCore.client(groupIdentity).memory!(),/ข้อมูลส่วนตัวเท่านั้น/);
  assert.doesNotMatch(await groupCore.client(otherIdentity).memory!(),/ชื่อที่บอกในกลุ่ม/);
  assert.doesNotMatch(await groupCore.client({...groupIdentity,scope:'oa:group:'+otherGroup}).memory!(),/ชื่อที่บอกในกลุ่ม/);
  assert.doesNotMatch(await privateCore.client(privateIdentity).memory!(),/ชื่อที่บอกในกลุ่ม/);
  assert.ok(readdirSync(join(f.dir,'group-memory')).length>0);
 }finally{await privateCore.dispose();await groupCore.dispose();privateStore.close();groupStore.close();f.clean()}
});

test('changing mode off then on while generating cancels the old reply, without sending to LINE',async()=>{
 const f=setup();let begin!:()=>void,release!:()=>void,sent=0;
 const started=new Promise<void>(r=>begin=r),waiting=new Promise<void>(r=>release=r);
 const replies=new LineGroupReplies(f.store,{client:()=>({send:async(_p,out)=>{begin();await waiting;out.text('old answer')},abort:async()=>{}})},'oa',false,async()=>{sent++});
 try{
  replies.accept(event('changing'),botId);await started;
  f.store.setReplyMode(groupId,'off',f.store.modeRevision(groupId));f.store.enableMentions(groupId);release();await replies.drain();
  assert.equal(sent,0);assert.equal(f.store.list().find(r=>r.groupId===groupId)?.messages?.find(m=>m.eventId==='changing'&&m.direction==='out')?.status,'cancelled');
 }finally{release?.();replies.close();await replies.drain();f.clean()}
});
