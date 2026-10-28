import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { KnowledgeStore } from './knowledge-store.js';
import { knowledgeHandler } from './knowledge-api.js';
import { knowledgeScript } from './knowledge-admin.js';
import { adminPage } from './admin.js';

test('KM API enforces loopback/Host/Origin/CSRF/JSON/size and rejects authority/prototype writes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'km-api-'));try{
 const store=new KnowledgeStore(root),handler=knowledgeHandler(store,'csrf');
 async function call(method='POST',headers:any={},body:any={},remote='127.0.0.1') {const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]) as any;req.method=method;req.socket={remoteAddress:remote};req.headers={host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-knowledge-token':'csrf','content-type':'application/json',...headers};let status=0,value:any;const res:any={writeHead(s:number){status=s;return res},end(v:string){value=JSON.parse(v)}};await handler(req,res);return{status,value}}
 assert.equal((await call('GET')).status,200);assert.equal((await call('GET',{},'', '192.168.1.1')).status,403);
 for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{origin:undefined},{'x-knowledge-token':'bad'},{'content-type':'text/plain'},{'sec-fetch-site':'cross-site'}])assert.equal((await call('POST',headers)).status,403);
 assert.equal((await call('PUT')).status,405);assert.equal((await call('POST',{},'broken')).status,400);assert.equal((await call('POST',{},'x'.repeat(32769))).status,413);
 for(const input of [{action:'enable',revision:0},{action:'review',revision:0,policy:'grant-all'},JSON.parse('{"action":"review","revision":0,"__proto__":{"polluted":true}}')])assert.equal((await call('POST',{},input)).status,400);
 assert.equal(({} as any).polluted,undefined);assert.equal(store.snapshot().revision,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('KM API previews bound draft versus actual published answers with no network/model; review/publish/restore flow',async()=>{
 const root=mkdtempSync(join(tmpdir(),'km-preview-'));try{
 const store=new KnowledgeStore(root),handler=knowledgeHandler(store,'csrf');
 async function call(input?:any) {const req=Readable.from(input?[JSON.stringify(input)]:[]) as any;req.method=input?'POST':'GET';req.socket={remoteAddress:'127.0.0.1'};req.headers={host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-knowledge-token':'csrf','content-type':'application/json'};let status=0,value:any;const res:any={writeHead(s:number){status=s;return res},end(v:string){value=JSON.parse(v)}};await handler(req,res);return{status,value}}
 let s=(await call()).value;assert.equal(s.catalog.courses.length,20);assert.ok(s.catalog.courses.some((c:any)=>c.fields.instructors===null));assert.ok(s.catalog.warnings.length>0);
 const newEntry={...s.draft[0],id:'new-topic',terms:['topic-qa']};let created=await call({action:'save',revision:s.revision,entry:newEntry});assert.equal(created.status,200);s=created.value;assert.equal(s.diff.find((d:any)=>d.id==='new-topic').before,undefined);s=(await call({action:'remove',revision:s.revision,id:'new-topic'})).value;
 const seed=s.draft[0];s=(await call({action:'save',revision:s.revision,entry:{...seed,text:'ข้อความร่าง <script>alert(1)</script>'}})).value;
 assert.equal(s.diff.filter((d:any)=>d.changed).length,1);const result=await call({action:'try',revision:s.revision,query:'สมัครสมาชิก'});assert.equal(result.status,200);assert.match(result.value.draft,/<script>/);assert.doesNotMatch(result.value.published,/<script>/);assert.equal(result.value.revision,s.revision);
 assert.equal((await call({action:'try',revision:s.revision-1,query:'สมัคร'})).status,409);assert.equal((await call({action:'try',revision:s.revision,query:'x'.repeat(2001)})).status,400);
 s=(await call({action:'review',revision:s.revision})).value;assert.ok(s.review);assert.equal((await call({action:'publish',revision:s.revision,digest:s.review.digest,confirm:false})).status,409);
 s=(await call({action:'publish',revision:s.revision,digest:s.review.digest,confirm:true})).value;assert.equal(s.diff.filter((d:any)=>d.changed).length,0);
 const after=(await call({action:'try',revision:s.revision,query:'สมัคร'})).value;assert.equal(after.draft,after.published);
 s=(await call({action:'restore',revision:s.revision,version:'seed'})).value;assert.equal(s.review,undefined);assert.equal(s.diff.filter((d:any)=>d.changed).length,1);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('KM browser script parses, uses safe text rendering and separate navigation preserving the five work tabs',()=>{
 assert.doesNotThrow(()=>new Function(knowledgeScript));assert.ok(!knowledgeScript.includes('innerHTML'));const html=adminPage('fixture');assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.match(html,/aria-label="จัดการข้อมูลบอต"/);assert.match(html,/id="knowledge-panel"/);assert.match(html,/\/api\/knowledge/);assert.ok(!html.includes('3002'));
});
