import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { StaffStore } from './staff-store.js';
import { StaffAuth, routePermission } from './staff-auth.js';
import { adminPage } from './admin.js';
import { currentStaffActor } from './staff-context.js';
import { runAsStaff } from './staff-context.js';
import { ConversationControl, conversationKey } from './conversation-control.js';
import type { StaffPrincipal } from './staff-policy.js';

function storeFixture() { const root=mkdtempSync(join(tmpdir(),'staff-auth-')); const store=new StaffStore(join(root,'staff'),'owner@example.test'); return {root,store,clean:()=>rmSync(root,{recursive:true,force:true})}; }
test('staff invitations bind only verified exact addresses once, persist and do not elevate other Google accounts',()=>{
 const f=storeFixture();try{
  assert.equal(f.store.identity('unknown','other@example.test'),undefined);
  const owner=f.store.identity('owner-sub','owner@example.test')!;assert.equal(owner.role,'admin');
  assert.equal(f.store.identity('different-sub','owner@example.test'),undefined);
  f.store.mutate(owner,{action:'invite',revision:f.store.snapshot().revision,email:'person@example.test',role:'content',enabled:true,extras:['knowledge.publish']});
  const p=f.store.identity('content-sub','person@example.test')!;assert.equal(p.role,'content');
  const restart=new StaffStore(join(f.root,'staff'),'other-bootstrap@example.test');assert.equal(restart.identity('owner-sub')?.role,'admin');assert.equal(restart.identity('new-admin','other-bootstrap@example.test'),undefined);
  assert.equal(statSync(join(f.root,'staff','accounts.json')).mode&0o777,0o600);
 }finally{f.clean()}
});
test('staff changes prevent removing last admin, reject stale revisions, unauthorized mutation and unreadable state',()=>{
 const f=storeFixture();try{
  const owner=f.store.identity('owner-sub','owner@example.test')!,s=f.store.snapshot(),id=s.accounts[0].id;
  const update={action:'update',id,revision:s.revision,role:'staff',enabled:true,extras:[]};
  assert.throws(()=>f.store.mutate(owner,update),/อย่างน้อยหนึ่งคน/);assert.equal(f.store.snapshot().revision,s.revision);
  assert.throws(()=>f.store.mutate({...owner,subject:'forged'},update),/เฉพาะผู้ดูแล/);
  assert.throws(()=>f.store.mutate(owner,{...update,revision:-1}),/ล่าสุด/);
  f.store.mutate(owner,{action:'invite',revision:s.revision,email:'next@example.test',role:'admin',enabled:true,extras:[]});
  assert.throws(()=>f.store.mutate(owner,{...update,revision:f.store.snapshot().revision}),/อย่างน้อยหนึ่งคน/);
  f.store.identity('next-sub','next@example.test');
  f.store.mutate(owner,{...update,revision:f.store.snapshot().revision});assert.equal(f.store.identity('owner-sub')?.role,'staff');
  writeFileSync(join(f.root,'staff','accounts.json'),'{bad');assert.throws(()=>f.store.identity('owner-sub'),/ปฏิเสธ/);
 }finally{f.clean()}
});
test('staff form updates preserve omitted extras while explicit API updates still replace them',()=>{
 const f=storeFixture();try{
  const owner=f.store.identity('owner-sub','owner@example.test')!;
  const mutate=(input:object)=>f.store.mutate(owner,{...input,revision:f.store.snapshot().revision});
  const email='person@example.test',extras=['news.send','line.approve','knowledge.publish'];
  mutate({action:'invite',email,role:'content',enabled:true,extras});
  const id=f.store.snapshot().accounts.find(a=>a.email===email)!.id;
  mutate({action:'update',id,role:'staff',enabled:false});
  assert.deepEqual(f.store.snapshot().accounts.find(a=>a.id===id)?.extras,extras);
  mutate({action:'update',id,role:'staff',enabled:true});
  assert.deepEqual(f.store.identity('person-sub',email)?.extras,extras);
  mutate({action:'update',id,role:'staff',enabled:true,extras:[]});
  assert.deepEqual(f.store.identity('person-sub')?.extras,[]);
  mutate({action:'invite',email:'new@example.test',role:'staff',enabled:true});
  assert.deepEqual(f.store.identity('new-sub','new@example.test')?.extras,[]);
 }finally{f.clean()}
});
test('role-aware admin page omits unauthorized data loaders and shows Manager work and hides admin controls',()=>{
 for(const role of ['staff','content','admin'] as const){
  const p:StaffPrincipal={subject:'fixture',email:'fixture@example.test',role,enabled:true,extras:[]},page=adminPage('fixture-csrf',{principal:p,csrf:'staff-fixture'});
  for(const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(match[1]));
  assert.ok(page.includes('ออกจากระบบ'));
  if(role==='admin')assert.match(page, /id="staff-extras"[\s\S]*?id="staff-extra-news"[\s\S]*?id="staff-extra-line"/);
  else assert.doesNotMatch(page, /id="staff-extra-(?:news|line)"/);
  if(role==='staff'){assert.ok(!page.includes('id="settings-users"'));assert.ok(!page.includes('id="km-form"'));assert.ok(!page.includes('id="rs-form"'));assert.ok(!page.includes("'/api/knowledge'"));assert.ok(!page.includes("'/api/response-settings'"));assert.ok(!page.includes("'/api/line-pending-users'"));}
  if(role==='content'){
    assert.match(page, /fixture@example.test · ผู้จัดการ/);
    for(const id of ['km-form','km-publish','km-versions','settings-system','pending-line-reload']) {
      assert.ok(page.includes('id="'+id+'"'), id);
    }
    for(const id of ['rs-form','staff-form','settings-profile','bot-profile-form','settings-line','bot-line-check']) assert.ok(!page.includes('id="'+id+'"'), id);
    assert.ok(page.includes("'/api/news'"));
    assert.doesNotMatch(page, /['"]\/api\/bot-(?:profile|line)['"]/);
  }
  if(role==='admin')for(const s of ['profile','line','knowledge','ai','system','users'])assert.ok(page.includes('id="settings-'+s+'"'));
 }
});
test('HTTP Google flow, API role/CSRF gates, replayed bodies, actor context, revocation and logout (fixtures only)',async()=>{
 const f=storeFixture();let handler:(req:IncomingMessage,res:ServerResponse)=>unknown=()=>{};const server=createServer((req,res)=>handler(req,res));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as any).port,base='http://127.0.0.1:'+port;
 let nextIdentity='owner-sub',nextEmail='owner@example.test';const nonces=new Map<string,string>();
 const auth=new StaffAuth(f.store,{clientId:'fixture',clientSecret:'fixture',redirectUri:base+'/auth/google/callback'},{
  authorizationUrl:(state,nonce)=>{nonces.set(state,nonce);return 'https://accounts.google.com/?state='+state},
  exchange:async(code)=>({subject:nextIdentity,email:nextEmail,emailVerified:true,nonce:nonces.get(code)!})});
 handler=auth.wrap(async(req,res)=>{let data='';for await(const p of req)data+=p;res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({url:req.url,body:data?JSON.parse(data):null,actor:currentStaffActor('legacy')}));},(p,csrf)=>JSON.stringify({p,csrf}));
 async function login(){const begin=await fetch(base+'/auth/google/start',{redirect:'manual'}),flow=begin.headers.get('set-cookie')!.split(';')[0],state=new URL(begin.headers.get('location')!).searchParams.get('state')!;const done=await fetch(base+'/auth/google/callback?state='+state+'&code='+state,{headers:{Cookie:flow},redirect:'manual'});assert.equal(done.status,303);return done.headers.get('set-cookie')!.split(';')[0];}
 try{
  assert.equal((await fetch(base+'/api/customers')).status,401);
  const loginHtml=await(await fetch(base+'/')).text();assert.ok(loginHtml.includes('เข้าสู่ระบบด้วย Google'));assert.ok(!loginHtml.includes('CUSTOMER_CSRF_TOKEN'));
  const ownerCookie=await login();const me=await(await fetch(base+'/auth/me',{headers:{Cookie:ownerCookie}})).json() as any;
  const raw = (path:string,headers:Record<string,string>,method='GET') => new Promise<{status:number;body:string}>( (resolve,reject) => {
    const req=httpRequest(base+path,{method,headers},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode!,body}))});req.on('error',reject);req.end();
  });
  const crossSite={'Cookie':ownerCookie,'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
  const homeAfterGoogle=await raw('/',crossSite);assert.equal(homeAfterGoogle.status,200);assert.equal(JSON.parse(homeAfterGoogle.body).p.role,'admin');
  assert.equal((await raw('/',{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'})).status,200);
  for(const [path,mode,dest,method] of [['/api/customers','navigate','document','GET'],['/','navigate','iframe','GET'],['/','cors','empty','GET'],['/','no-cors','image','GET'],['/','navigate','document','POST'],['/?bypass=1','navigate','document','GET']]) {
    assert.equal((await raw(path,{...crossSite,'Sec-Fetch-Mode':mode,'Sec-Fetch-Dest':dest},method)).status,403,[path,mode,dest,method].join(' '));
  }
  assert.equal((await raw('/',{...crossSite,Origin:'https://evil.example'})).status,403);
  const owner=f.store.identity('owner-sub')!;
  const headers={Cookie:ownerCookie,Origin:base,'X-Staff-Token':me.csrf,'Content-Type':'application/json'};
  let r=await fetch(base+'/api/customers',{method:'POST',headers,body:JSON.stringify({action:'fixture',role:'forged'})});assert.equal(r.status,200);const d=await r.json() as any;assert.equal(d.body.action,'fixture');assert.equal(d.actor,'staff:owner-sub');
  assert.equal((await fetch(base+'/api/customers',{method:'POST',headers:{...headers,'X-Staff-Token':'wrong'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/bot-profile',{method:'POST',headers,body:JSON.stringify({name:'Test bot'})})).status,200);
  assert.equal((await fetch(base+'/api/bot-line',{headers})).status,200);
  assert.equal((await fetch(base+'/api/customers?bypass=1',{headers:{Cookie:ownerCookie}})).status,404);
  assert.equal((await fetch(base+'/api/unknown',{headers:{Cookie:ownerCookie}})).status,403);
  f.store.mutate(owner,{action:'invite',revision:f.store.snapshot().revision,email:'staff@example.test',role:'staff',enabled:true,extras:[]});
  nextIdentity='staff-sub';nextEmail='staff@example.test';const staffCookie=await login(),staffMe=await(await fetch(base+'/auth/me',{headers:{Cookie:staffCookie}})).json() as any;
  const sh={Cookie:staffCookie,Origin:base,'X-Staff-Token':staffMe.csrf,'Content-Type':'application/json'};
  for(const path of ['/api/staff','/api/response-settings','/api/knowledge','/api/system-status','/api/line-pending-users','/api/news','/api/browse/staff?page=1','/api/browse/staff-history?q=owner','/api/browse/knowledge?selected=fixture','/api/browse/news-recipients?selected=fixture','/api/browse/grants?page=1'])assert.equal((await fetch(base+path,{headers:sh})).status,403,path);
  assert.equal((await fetch(base+'/api/browse/customers?page=2&q=fixture',{headers:sh})).status,200);
  assert.equal((await fetch(base+'/api/browse/customers?size=9999',{headers:sh})).status,400);
  assert.equal((await fetch(base+'/api/response-settings',{method:'POST',headers:sh,body:JSON.stringify({action:'apply',role:'admin'})})).status,403);
  const staff=f.store.snapshot().accounts.find(a=>a.subject==='staff-sub')!;
  f.store.mutate(owner,{action:'update',revision:f.store.snapshot().revision,id:staff.id,role:'content',enabled:true,extras:[]});
  for(const path of ['/api/conversations','/api/customers','/api/requests','/api/news','/api/knowledge','/api/system-status',
    '/api/line-pending-users','/api/browse/rooms','/api/browse/room-profiles','/api/browse/grants','/api/browse/knowledge-versions']){
    assert.equal((await fetch(base+path,{headers:sh})).status,200,path);
  }
  const postAsManager=(path:string,action:string)=>fetch(base+path,{method:'POST',headers:sh,body:JSON.stringify({action,role:'admin'})});
  for(const [path,actions] of [
    ['/api/conversations',['take','send','release']], ['/api/customers',['save']], ['/api/requests',['update']],
    ['/api/news',['create','review','confirm','cancel']], ['/api/knowledge',['save','review','try','publish','restore']],
    ['/api/line-pending-users',['allow']], ['/api/line-groups',['set-reply-mode','save-profile','send-staff']],
    ['/api/system-status/check',['check']],
  ] as const) for(const action of actions) assert.equal((await postAsManager(path,action)).status,200,path+' '+action);
  for(const path of ['/api/staff','/api/browse/staff','/api/browse/staff-history','/api/response-settings','/api/bot-line']){
    assert.equal((await fetch(base+path,{headers:sh})).status,403,path);
  }
  for(const [path,actions] of [
    ['/api/staff',['invite','update']], ['/api/response-settings',['save','try','apply']], ['/api/bot-line',['check']],
    ['/api/bot-profile',['save']],
  ] as const) for(const action of actions) assert.equal((await postAsManager(path,action)).status,403,path+' '+action);
  f.store.mutate(owner,{action:'update',revision:f.store.snapshot().revision,id:staff.id,role:'content',enabled:false,extras:[]});
  assert.equal((await fetch(base+'/api/customers',{headers:sh})).status,401);
  assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/api/customers',{headers:{Cookie:ownerCookie}})).status,401);
  assert.ok(f.store.snapshot().history.some(h=>h.actor==='owner-sub'&&h.event==='request:fixture'));
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));f.clean()}
});
test('unknown and sending actions fail closed in permission routing',()=>{
 assert.equal(routePermission('/api/news','POST','confirm'),'news.send');assert.equal(routePermission('/api/news','POST','unrecognized'),undefined);
 assert.equal(routePermission('/api/knowledge','POST','restore'),'knowledge.publish');assert.equal(routePermission('/api/knowledge','POST','evil'),undefined);
 assert.equal(routePermission('/api/monitor','POST'),undefined);
});
test('verified staff actor persists in takeover history and remains readable across restart',()=>{
 const f=storeFixture();try{
  const owner=f.store.identity('owner-sub','owner@example.test')!,root=join(f.root,'control'),control=new ConversationControl(root),key=conversationKey('fixture-oa','fixture-user');
  runAsStaff(owner,()=>control.change(key,true,0));
  assert.equal(control.mode(key).actor,'staff:owner-sub');
  const restart=new ConversationControl(root);assert.equal(restart.mode(key).actor,'staff:owner-sub');
  assert.equal(currentStaffActor('legacy'),'legacy');
 }finally{f.clean()}
});
