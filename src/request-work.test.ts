import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { CourseRequestStore, type CourseRequest } from './course-requests.js';
import { customerId, localActor } from './customers.js';
import { RequestWorkStore } from './request-work.js';
const fixture = (run: (f: ReturnType<typeof setup>) => unknown) => { const f=setup(); return Promise.resolve().then(async()=>{await run(f)}).finally(()=>rmSync(f.dir,{recursive:true,force:true})); };
function setup() {
 const dir=mkdtempSync(join(tmpdir(),'request-work-')), requests=new CourseRequestStore(join(dir,'requests'));
 const row:CourseRequest={version:1,id:randomUUID(),kind:'contact',createdAt:new Date().toISOString(),owner:{channel:'line',scope:'oa:direct',user:'user-A'},course:null,message:'ช่วยติดต่อเรื่องอบรม',status:'pending_team',delivery:{channel:null,status:'not_selected'},sourceSha256:'a'.repeat(64)};
 requests.save(row); const root=join(dir,'work'),work=new RequestWorkStore(root,requests);
 const command=(action='claim',value='',revision=0)=>({requestId:row.id,customerId:customerId(row.owner),revision,operationId:randomUUID(),action,value});
 return {dir,root,requests,row,work,command};
}
test('work persists across restart; original request unchanged; retries are idempotent even with stale revision',()=>fixture(f=>{
 const original=readFileSync(join(f.requests.root,f.row.id+'.json'),'utf8'),claim=f.command();
 const first=f.work.mutate(claim); assert.equal(first.status,'in_progress');assert.equal(first.timeline[0].actor,localActor);
 assert.deepEqual(new RequestWorkStore(f.root,f.requests).mutate(claim),first);
 const note=f.command('note','<img src=x onerror=alert(1)>',1);f.work.mutate(note);
 const s=new RequestWorkStore(f.root,f.requests).snapshot().requests[0].work;assert.equal(s.revision,2);assert.equal(s.timeline[1].text,note.value);
 assert.equal(readFileSync(join(f.requests.root,f.row.id+'.json'),'utf8'),original);
 assert.equal(statSync(join(f.root,f.row.id+'.json')).mode&0o777,0o600);assert.equal(statSync(f.root).mode&0o777,0o700);
 assert.deepEqual(readdirSync(f.root),[f.row.id+'.json']);
}));
test('revision conflicts, invalid transitions, forged actor/foreign owner and duplicate payload conflicts preserve data',()=>fixture(f=>{
 assert.throws(()=>f.work.mutate(f.command('status','done')),/เปลี่ยนสถานะ/);
 assert.throws(()=>f.work.mutate({...f.command(),customerId:customerId({...f.row.owner,user:'B'})}),/ตัวตน/);
 assert.throws(()=>f.work.mutate({...f.command(),actor:'เจ้าหน้าที่ที่ตรวจแล้ว'}),/รูปแบบ/);
 const c=f.command();f.work.mutate(c);
 assert.throws(()=>f.work.mutate(f.command('note','stale',0)),/งานเปลี่ยน/);
 assert.throws(()=>f.work.mutate({...c,action:'note',value:'different'}),/รหัสทำรายการซ้ำ/);
 f.work.mutate(f.command('assign','ป้ายทีม A',1));f.work.mutate(f.command('status','done',2));
 assert.throws(()=>f.work.mutate(f.command('status','new',3)),/เปลี่ยนสถานะ/);
 assert.equal(f.work.mutate(f.command('status','in_progress',3)).revision,4);
 assert.equal(f.work.snapshot().requests[0].work.timeline.length,4);
}));
test('missing, forgotten and expired requests never expose or recreate orphan work',()=>fixture(f=>{
 f.work.mutate(f.command());f.requests.deleteOwner(f.row.owner);
 assert.throws(()=>f.work.mutate(f.command('note','missing',1)),/ไม่มีแล้ว/);assert.equal(f.work.snapshot().requests.length,0);assert.deepEqual(readdirSync(f.root),[]);
 const old={...f.row,id:randomUUID(),createdAt:new Date(Date.now()-91*86400000).toISOString()};
 writeFileSync(join(f.requests.root,old.id+'.json'),JSON.stringify(old));
 assert.equal(f.work.snapshot().requests.length,0);assert.deepEqual(readdirSync(f.requests.root),[]);
}));
test('corrupt store and lock do not overwrite work; atomic failure keeps existing data',()=>fixture(f=>{
 f.work.mutate(f.command());const path=join(f.root,f.row.id+'.json'),original=readFileSync(path,'utf8');
 writeFileSync(join(f.root,'.write-lock'),'');assert.throws(()=>f.work.mutate(f.command('note','locked',1)),/กำลังถูกบันทึก/);rmSync(join(f.root,'.write-lock'));assert.equal(readFileSync(path,'utf8'),original);
 writeFileSync(path,'broken');assert.throws(()=>f.work.snapshot(),/อ่านข้อมูลงานไม่ได้/);assert.throws(()=>f.work.mutate(f.command('note','cannot overwrite',1)),/อ่านข้อมูลงานไม่ได้/);assert.equal(readFileSync(path,'utf8'),'broken');
 // Rename cannot replace a directory: temp must be removed and source preserved.
 rmSync(path);mkdirSync(path);assert.throws(()=>f.work.mutate(f.command()));assert.equal(readdirSync(f.root).filter(n=>n.endsWith('.tmp')).length,0);
}));
test('two independent processes cannot lose updates with the same revision',()=>fixture(async f=>{
 const commands=[f.command('note','process A'),f.command('note','process B')];
 const script=`import {CourseRequestStore} from './dist/course-requests.js';import {RequestWorkStore} from './dist/request-work.js';const w=new RequestWorkStore(process.argv[1],new CourseRequestStore(process.argv[2]));try{w.mutate(JSON.parse(process.argv[3]));process.exitCode=0}catch(e){process.exitCode=e.status===409?9:1}`;
 const codes=await Promise.all(commands.map(c=>new Promise<number|null>((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',script,f.root,f.requests.root,JSON.stringify(c)],{stdio:'pipe'});child.on('error',reject);child.on('exit',resolve)})));
 assert.deepEqual(codes.sort(),[0,9]);assert.equal(f.work.snapshot().requests[0].work.revision,1);
}));

test('failure before atomic rename preserves prior file and removes temporary write',()=>fixture(async f=>{
 f.work.mutate(f.command());const path=join(f.root,f.row.id+'.json'),before=readFileSync(path,'utf8');
 const script=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';fs.renameSync=()=>{throw Error('simulated disk failure')};syncBuiltinESMExports();const {CourseRequestStore}=await import('./dist/course-requests.js');const {RequestWorkStore}=await import('./dist/request-work.js');try{new RequestWorkStore(process.argv[1],new CourseRequestStore(process.argv[2])).mutate(JSON.parse(process.argv[3]));process.exitCode=1}catch{process.exitCode=0}`;
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',script,f.root,f.requests.root,JSON.stringify(f.command('note','must not persist',1))],{stdio:'pipe'});child.on('error',reject);child.on('exit',resolve)});
 assert.equal(code,0);assert.equal(readFileSync(path,'utf8'),before);assert.deepEqual(readdirSync(f.root),[f.row.id+'.json']);
}));
