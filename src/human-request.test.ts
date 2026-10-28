import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { humanIntent } from './human-request.js';
import { ConversationControl, conversationKey } from './conversation-control.js';
import { LineAdapter } from './line.js';
import { ConversationMonitor } from './monitor.js';
const key=conversationKey('oa','A');
function setup(send?: (prompt: string, out: {text:(s:string)=>void})=>Promise<void>){
 const root=mkdtempSync(join(tmpdir(),'human-waiting-')),control=new ConversationControl(join(root,'control')),monitor=new ConversationMonitor(join(root,'monitor'));
 const replies:string[]=[],calls:string[]=[];let forgot=0,resets=0;
 const client={send:async(prompt:string,out:{text:(s:string)=>void})=>{calls.push(prompt);if(send)await send(prompt,out);else out.text('BOT '+prompt)},abort:async()=>{},memory:async()=>JSON.stringify({profile:{},summary:{notes:[],topics:[],pending:[]},longTerm:[],recent:[],compactions:0}),reset:async()=>{resets++},requestForget:async()=> 'confirmation',forget:async(token:string)=>{assert.equal(token,'confirmation');forgot++},cancelForget:()=>{}};
 const make=(store=control)=>new LineAdapter({secret:'test-secret',account:'oa',dryRun:false,allowedUsers:new Set(['A','B']),control:store,core:{client:()=>client},observe:e=>monitor.record(e),reply:async(_token,text)=>{replies.push(text)}});
 let adapter=make();
 const receive=(text:string,user='A',id:string=randomUUID())=>{const raw=Buffer.from(JSON.stringify({events:[{type:'message',webhookEventId:id,replyToken:'mock-reply',source:{type:'user',userId:user},message:{type:'text',text}}]}));return{raw,code:adapter.accept(raw,createHmac('sha256','test-secret').update(raw).digest('base64'))}};
 return{root,control,monitor,replies,calls,client,make,get adapter(){return adapter},set adapter(a:LineAdapter){adapter=a},receive,get forgot(){return forgot},get resets(){return resets},async send(text:string,user='A',id?:string){assert.equal(receive(text,user,id).code,200);await adapter.drain()},async close(){adapter.close();await adapter.drain();rmSync(root,{recursive:true,force:true})}};
}
test('explicit Thai/English requests, stop, resume and capability questions are distinct; complaints/quotes/negation do not create requests',()=>{
 for(const s of ['ขอคุยกับเจ้าหน้าที่ครับ','อยากคุยกับคนจริง','ช่วยเรียกแอดมินให้หน่อย','ผมต้องการติดต่อเจ้าหน้าที่','ขอเจ้าหน้าที่หน่อยครับ','please connect me to a human','I want to talk to an agent'])assert.deepEqual(humanIntent(s),{kind:'request',stopBot:false},s);
 for(const s of ['ไม่คุยกับบอตแล้ว','ไม่อยากคุยกับบอท','หยุดบอตตอบ','บอตไม่ต้องตอบ','stop the bot','ขอคุยกับเจ้าหน้าที่ ไม่คุยกับบอตแล้ว'])assert.deepEqual(humanIntent(s),{kind:'request',stopBot:true},s);
 for(const s of ['คุยกับบอตต่อ','ให้บอตตอบต่อ','ยกเลิกคำขอคุยกับเจ้าหน้าที่','ไม่ต้องเรียกเจ้าหน้าที่','resume bot'])assert.deepEqual(humanIntent(s),{kind:'cancel'},s);
 for(const s of ['มีเจ้าหน้าที่ไหม','เจ้าหน้าที่อยู่ไหม','คุยกับเจ้าหน้าที่ได้ไหม','can i speak to a human'])assert.deepEqual(humanIntent(s),{kind:'info'},s);
 for(const s of ['ตอบไม่ได้เลย','ไม่ถูกใจ','ขอใบเสร็จ','เจ้าหน้าที่สอนหลักสูตรอะไร','ถ้าขอคุยกับเจ้าหน้าที่จะเป็นอย่างไร','ตัวอย่าง ขอคุยกับเจ้าหน้าที่','แปล talk to a human','ขอคุยกับเจ้าหน้าที่ เป็นตัวอย่าง','ไม่อยากคุยกับเจ้าหน้าที่','"ขอคุยกับเจ้าหน้าที่"','ขอคุยกับเจ้าหน้าที่\nเป็นตัวอย่าง', 'ขอคุยกับเจ้าหน้าที่'+ 'x'.repeat(2000)])assert.equal(humanIntent(s),undefined,s);
});
test('request is durable before reply, dedupes across messages/restart, does not pause ordinary bot turns or affect other identities',async()=>{
 const f=setup();try{
  const id=randomUUID();assert.equal(f.receive('ขอคุยกับเจ้าหน้าที่ครับ','A',id).code,200);
  const waiting=f.control.mode(key).waiting!;assert.ok(waiting);assert.equal(f.control.mode(key).human,false);assert.equal(f.control.ticket(key).allowed,true);assert.equal(f.replies.length,0);
  assert.equal(JSON.parse(readFileSync(join(f.root,'control/control.json'),'utf8')).modes[key].waiting.id,waiting.id);
  await f.adapter.drain();assert.equal(f.replies.length,1);assert.match(f.replies[0],/ยังไม่มีผู้รับช่วง/);assert.equal(f.calls.length,0);
  await f.send('ขอคุยกับเจ้าหน้าที่ครับ','A',id);await f.send('อยากคุยกับคนจริง');assert.equal(f.replies.length,1);assert.equal(f.control.mode(key).waiting!.id,waiting.id);
  await f.send('หลักสูตร Excel');await f.send('สวัสดี','B');assert.deepEqual(f.calls,['หลักสูตร Excel','สวัสดี']);assert.equal(f.control.mode(conversationKey('oa','B')).waiting,undefined);assert.equal(f.control.mode(conversationKey('other','A')).waiting,undefined);
  f.adapter.close();const restarted=new ConversationControl(join(f.root,'control'));f.adapter=f.make(restarted);await f.send('ขอคุยกับเจ้าหน้าที่ครับ');assert.equal(f.replies.length,3);assert.equal(restarted.mode(key).waiting!.id,waiting.id);
 }finally{await f.close()}
});
test('stop during active generation suppresses active/queued answers; one acknowledgement, inbox retained, help available, explicit resume cancels waiting',async()=>{
 let start!:()=>void,unblock!:()=>void;const started=new Promise<void>(r=>start=r),gate=new Promise<void>(r=>unblock=r);
 const f=setup(async(prompt,out)=>{if(prompt==='active'){start();await gate}out.text('BOT '+prompt)});try{
  f.receive('active');await started;f.receive('queued');f.receive('ไม่คุยกับบอตแล้ว');assert.equal(f.control.ticket(key).allowed,false);f.receive('ข้อความระหว่างรอ');f.receive('สวัสดี','B');
  unblock();await f.adapter.drain();assert.deepEqual(f.calls,['active','สวัสดี']);assert.equal(f.replies.length,2);assert.match(f.replies[0],/พักตอบ/);assert.equal(f.replies[1],'BOT สวัสดี');
  assert.equal(f.monitor.snapshot().events.filter(e=>e.direction==='in').length,5);
  await f.send('/help');assert.match(f.replies.at(-1)!,/คำสั่งซีบอต/);assert.equal(f.control.ticket(key).allowed,false);
  await f.send('คุยกับบอตต่อ');assert.equal(f.control.mode(key).waiting,undefined);assert.equal(f.control.ticket(key).allowed,true);await f.send('ถามใหม่');assert.equal(f.replies.at(-1),'BOT ถามใหม่');assert.ok(!f.calls.includes('queued'));
 }finally{unblock();await f.close()}
});
test('take clears waiting without automatic transition messages and starts handover context at the original request',async()=>{
 const f=setup();try{
  await f.send('ขอคุยกับเจ้าหน้าที่');const waiting=f.control.mode(key).waiting!;const count=f.replies.length;
  f.control.change(key,true,0);assert.equal(f.control.mode(key).waiting,undefined);assert.equal(f.control.mode(key).startedAt,waiting.requestedAt);assert.equal(f.replies.length,count);
  await f.send('ขอคุยกับเจ้าหน้าที่อีกครั้ง');await f.send('คุยกับบอตต่อ');assert.equal(f.control.mode(key).waiting,undefined);assert.equal(f.control.mode(key).human,true);assert.equal(f.replies.length,count);
  await f.control.release(key,1,async()=>{});assert.equal(f.replies.length,count);assert.equal(f.control.ticket(key).allowed,true);
 }finally{await f.close()}
});
test('capability question creates no waiting item; normal request upgrades to stop without changing request id/time',async()=>{
 const f=setup();try{
  await f.send('มีเจ้าหน้าที่ไหม');assert.equal(f.control.mode(key).waiting,undefined);assert.match(f.replies[0],/รับช่วงคุยในแชต LINE/);
  await f.send('ขอคุยกับเจ้าหน้าที่');const original=f.control.mode(key).waiting!;
  await f.send('ไม่อยากคุยกับบอต');const upgraded=f.control.mode(key).waiting!;assert.equal(upgraded.id,original.id);assert.equal(upgraded.requestedAt,original.requestedAt);assert.equal(upgraded.stopBot,true);assert.equal(f.control.mode(key).epoch,1);
 }finally{await f.close()}
});
test('reset/confirmed forget clear waiting after success; human requests invalidate destructive challenges even when queued together',async()=>{
 const f=setup();try{
  await f.send('ไม่คุยกับบอตแล้ว');await f.send('/reset');assert.equal(f.resets,1);assert.equal(f.control.mode(key).waiting,undefined);assert.match(f.replies.at(-1)!,/เริ่มบทสนทนาใหม่/);
  await f.send('ไม่คุยกับบอตแล้ว');await f.send('/forget');await f.send('/confirm-forget');assert.equal(f.forgot,1);assert.equal(f.control.mode(key).waiting,undefined);assert.match(f.replies.at(-1)!,/ลืมทั้งหมดแล้ว/);
  f.receive('/forget');f.receive('ขอคุยกับเจ้าหน้าที่');f.receive('/confirm-forget');await f.adapter.drain();assert.equal(f.forgot,1);assert.match(f.replies.at(-1)!,/ต้องใช้ \/forget/);
 }finally{await f.close()}
});
test('request persistence failure returns 503 without deduping away a retry or falsely confirming',async()=>{
 const f=setup();try{
  const controlPath=join(f.root,'control');rmSync(controlPath,{recursive:true});const id=randomUUID();assert.equal(f.receive('ขอคุยกับเจ้าหน้าที่','A',id).code,503);assert.equal(f.control.mode(key).waiting,undefined);assert.equal(f.replies.length,0);
  const repaired=new ConversationControl(controlPath);f.adapter.close();f.adapter=f.make(repaired);await f.send('ขอคุยกับเจ้าหน้าที่','A',id);assert.ok(repaired.mode(key).waiting);assert.equal(f.replies.length,1);
 }finally{await f.close()}
});
