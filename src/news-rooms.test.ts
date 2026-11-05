import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CustomerStore} from './customers.js';
import {LineGroupStore} from './line-groups.js';
import {NewsStore,NewsService,type NewsTransport} from './news.js';
const room='C'+'a'.repeat(32),other='C'+'b'.repeat(32);
function fixture(){const root=mkdtempSync(join(tmpdir(),'news-rooms-'));let now=Date.now();const rooms=new LineGroupStore(join(root,'rooms'),'oa',()=>now);for(const id of [room,other])rooms.observe({groupId:id,type:'join',at:new Date(now).toISOString()});for(const id of [room,other])rooms.saveProfile(id,{purpose:'',note:'',tags:[],newsAllowed:true,approvedBy:'fixture'},'initial');rooms.saveName(room,'ห้องเรียน <b>AI</b>');const customers=new CustomerStore(join(root,'customers'));const store=new NewsStore(join(root,'news'),()=>now);let calls:{to:string,key:string}[]=[];const transport:NewsTransport=async(to,_text,key)=>{calls.push({to,key});return {status:200}};const service=new NewsService(store,customers,'oa',transport,()=>now,true,rooms);const draft=()=>service.mutate({action:'create',title:'ข่าวห้อง',text:'ทดสอบ',customerIds:[],groupIds:[],lineRoomIds:[room,room,other]});const review=(c=draft())=>service.mutate({action:'review',id:c.id,revision:c.revision});const queue=(c=review())=>{service.authorizeCampaign(c.id,c.review!.digest);return service.mutate({action:'confirm',id:c.id,revision:c.revision,digest:c.review!.digest})};return {root,rooms,store,service,calls,draft,review,queue,advance(){now+=2000},clean(){rmSync(root,{recursive:true,force:true})}}}
test('room selection dedupes, counts rooms, binds approval and sends once to each room through mock',async()=>{const f=fixture();try{const r=f.review();assert.equal(r.review!.recipients.length,2);assert.ok(r.review!.recipients.every(r=>r.kind==='room'));assert.equal(f.service.snapshot().lineRooms.length,2);assert.equal(f.service.snapshot().campaigns[0].canConfirm,false);f.queue(r);await Promise.all([f.service.tick(),f.service.tick()]);f.advance();await f.service.tick();f.advance();await f.service.tick();assert.equal(f.calls.length,2);assert.deepEqual(new Set(f.calls.map(c=>c.to)),new Set([room,other]));assert.equal(new Set(f.calls.map(c=>c.key)).size,2);assert.equal(f.store.list()[0].status,'complete');const restarted=new NewsService(f.store,new CustomerStore(join(f.root,'customers')),'oa',async()=>{throw Error('must not resend')},Date.now,true,f.rooms);restarted.recover();await restarted.tick();assert.equal(f.store.list()[0].deliveries.filter(d=>d.status==='accepted').length,2)}finally{f.clean()}});
test('room leave after review blocks confirmation and leave after queue cancels unsent work',async()=>{for(const stage of ['review','queue']){const f=fixture();try{const r=f.review();f.service.authorizeCampaign(r.id,r.review!.digest);if(stage==='queue')f.service.mutate({action:'confirm',id:r.id,revision:r.revision,digest:r.review!.digest});f.advance();f.rooms.observe({groupId:room,type:'leave',at:new Date(Date.now()+10000).toISOString()});if(stage==='review')assert.throws(()=>f.service.mutate({action:'confirm',id:r.id,revision:r.revision,digest:r.review!.digest}),/ห้อง LINE/);else{await f.service.tick();assert.equal(f.calls.length,0);assert.ok(f.store.list()[0].deliveries.every(d=>d.status==='cancelled'))}}finally{f.clean()}}});
test('unknown rooms and rooms belonging to another OA cannot be selected',()=>{const f=fixture();try{const foreign=new LineGroupStore(join(f.root,'foreign'),'another');foreign.observe({groupId:room,type:'join',at:new Date().toISOString()});const service=new NewsService(f.store,new CustomerStore(join(f.root,'customers')),'oa',undefined,Date.now,true,foreign);const c=f.draft();assert.throws(()=>service.mutate({action:'review',id:c.id,revision:c.revision}),/ห้อง LINE/);const changed=f.service.mutate({action:'save',id:c.id,revision:c.revision,title:c.title,text:c.text,customerIds:[],groupIds:[],lineRoomIds:['C'+'f'.repeat(32)]});assert.throws(()=>f.review(changed),/ห้อง LINE/)}finally{f.clean()}});

test('revoking room news permission removes the room from the picker and cancels queued news',async()=>{
 const f=fixture();
 try{
  f.queue();
  const profile=f.rooms.list().find(r=>r.groupId===room)!.profile!;
  f.rooms.saveProfile(room,{...profile,newsAllowed:false,approvedBy:''},profile.revision);
  assert.equal(f.service.snapshot().lineRooms.some(r=>r.id===room),false);
  await f.service.tick();
  assert.equal(f.calls.length,0);
  assert.ok(f.store.list()[0].deliveries.every(d=>d.status==='cancelled'));
 }finally{f.clean()}
});
