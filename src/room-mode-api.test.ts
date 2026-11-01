import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LineGroupStore,LineGroupService,lineGroupsHandler} from './line-groups.js';
import {runAsStaff} from './staff-context.js';
import {routePermission} from './staff-auth.js';
import {adminPage} from './admin.js';
import {Script} from 'node:vm';

test('mode API requires authenticated admin, origin and token; stale update is conflict and identity escapes HTML',async()=>{
 const root=mkdtempSync(join(tmpdir(),'room-mode-api-')),groupId='C'+'a'.repeat(32),store=new LineGroupStore(root,'fixture');
 store.observe({groupId,type:'join',at:new Date().toISOString()});
 const service=new LineGroupService(store,'',fetch,()=>Date.now(),{name:'<script>bad</script>',environment:'cloud'}),handler=lineGroupsHandler(service,'token');
 let role: 'admin'|'staff'|'content'|undefined='admin';
 const server=createServer((req,res)=>role?runAsStaff({subject:'fixture',email:'fixture@example.test',enabled:true,role,extras:[]},()=>handler(req,res)):handler(req,res));
 try{
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as any).port;
  const post=(extra={},headers={})=>fetch(url,{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-Customer-Token':'token',...headers},body:JSON.stringify({action:'set-reply-mode',groupId,mode:'mention',revision:'initial',...extra})});
  for(const r of [undefined,'staff','content'] as const){role=r;assert.equal((await post()).status,403)}role='admin';
  assert.equal((await post({}, {Origin:'https://foreign.invalid'})).status,403);
  assert.equal((await post({}, {'X-Customer-Token':'bad'})).status,403);
  assert.equal((await post({mode:'anything'})).status,400);assert.equal((await post({destination:'https://foreign.invalid'})).status,400);
  const ok=await post();assert.equal(ok.status,200);const value=await ok.json();assert.equal(value.mode,'mention');
  assert.equal((await post()).status,409);assert.equal((await post({groupId:'C'+'b'.repeat(32)})).status,404);
  assert.equal(routePermission('/api/line-groups','POST','set-reply-mode'),'ai.manage');
  const html=adminPage('fixture',undefined,service.serverIdentity);assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!html.includes('<script>bad</script>'));assert.ok(html.includes('line-rooms-mode-save'));
  for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(script[1]);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true})}
});
