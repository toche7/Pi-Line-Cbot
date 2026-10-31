import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, request } from 'node:http';
import { Script } from 'node:vm';
import { PendingLineUsers } from './line-pending-users.js';
import { pendingUsersHandler } from './line-pending-admin.js';
import { adminPage } from './admin.js';

test('pending-user view is read-only, filters current OA/allowed users and enforces local host/origin',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pending-view-')),store=new PendingLineUsers(root);
 const unknown='U'+'a'.repeat(32),known='U'+'b'.repeat(32),foreign='U'+'c'.repeat(32),allowedUsers=new Set([known]);
 store.record('oa',unknown);store.record('oa',known);store.record('other-oa',foreign);
 const before=readdirSync(root).map(n=>readFileSync(join(root,n),'utf8')).sort();
 const server=createServer(pendingUsersHandler({store,account:'oa',allowedUsers}));
 try{
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const response=await fetch(url),data=await response.json();assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(data.users.map((u:any)=>u.userId),[unknown]);assert.equal(data.allowedUserCount,1);assert.equal(data.readOnly,true);
  assert.equal((await fetch(url,{headers:{Origin:'https://foreign.invalid'}})).status,403);
  assert.equal((await fetch(url,{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({action:'allow',userId:unknown})})).status,405);assert.equal(allowedUsers.has(unknown),false);
  const code=await new Promise<number|undefined>((resolve,reject)=>{const req=request(url,{headers:{Host:'foreign.invalid'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()});assert.equal(code,403);
  allowedUsers.add(unknown);assert.equal((await(await fetch(url)).json()).users.length,0);
  assert.deepEqual(readdirSync(root).map(n=>readFileSync(join(root,n),'utf8')).sort(),before);
  new Script(adminPage().match(/<script>([\s\S]*?)<\/script>/)![1]);assert.ok(adminPage().includes('ผู้ทักใหม่ที่ยังไม่ได้รับอนุญาต'));
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true})}
});
