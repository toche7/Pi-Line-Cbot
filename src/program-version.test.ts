import { adminPage } from './admin.js';
import { currentBuildInfo } from './program-version.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {versionReply,runningVersion} from './program-version.js';
import {LineAdapter} from './line.js';
import {commandHelp} from './command-help.js';

test('program version displays only validated build metadata and safe server labels',()=>{
 const value=versionReply({code:'a'.repeat(64),builtAt:'2026-11-01T00:00:00Z',secret:'must-not-show'},{name:'Trial\nServer',environment:'cloud'});
 assert.match(value,/aaaaaaaaaaaa/);assert.match(value,/Trial Server/);assert.doesNotMatch(value,/must-not-show/);
 assert.match(versionReply({code:'malformed',builtAt:'bad'},{name:'Local',environment:'local'}),/ไม่ระบุ/);
 assert.match(runningVersion({name:'Local',environment:'local'}),/รุ่นโค้ด:/);
 assert.match(commandHelp('line'),/\/version/);assert.doesNotMatch(commandHelp('terminal'),/\/version/);
});
test('private /version bypasses model, respects allowlist and dry run, and dedupes events',async()=>{
 const user='U'+'a'.repeat(32),sent:string[]=[],core={client:()=>{throw Error('Must not create model session')}};
 const make=(dryRun=false)=>new LineAdapter({secret:'fixture',account:'oa',allowedUsers:new Set([user]),dryRun,core,versionText:'Version fixture · local',reply:async(_token,text)=>{sent.push(text)}});
 const event=(id:string,text='/version',type='user',userId=user)=>({type:'message',webhookEventId:id,replyToken:'fixture-'+id,source:{type,userId,groupId:'C'+'b'.repeat(32)},message:{type:'text',text}});
 const deliver=(adapter:LineAdapter,events:any[])=>{const raw=Buffer.from(JSON.stringify({events}));return adapter.accept(raw,createHmac('sha256','fixture').update(raw).digest('base64'))};
 const adapter=make();try{assert.equal(deliver(adapter,[event('one','  /version  ')]),200);deliver(adapter,[event('one')]);deliver(adapter,[event('group','/version','group'),event('foreign','/version','user','U'+'c'.repeat(32))]);await adapter.drain();assert.deepEqual(sent,['Version fixture · local'])}finally{adapter.close()}
 const dry=make(true);try{deliver(dry,[event('dry')]);await dry.drain();assert.equal(sent.length,1)}finally{dry.close()}
});


test('admin header and system settings show the running build snapshot',()=>{
 const info=currentBuildInfo();assert.ok(info);
 const html=adminPage('fixture',{principal:{subject:'fixture',email:'fixture@example.test',role:'admin',enabled:true,extras:[]},csrf:'fixture'},{name:'Local fixture',environment:'local'});
 assert.ok(html.includes('รุ่นโค้ด: '+info.code.slice(0,12)));assert.ok(html.includes('id="program-version-details"'));assert.ok(html.includes(info.code));
 const staff=adminPage('fixture',{principal:{subject:'fixture',email:'fixture@example.test',role:'staff',enabled:true,extras:[]},csrf:'fixture'},{name:'Local fixture',environment:'local'});
 assert.ok(staff.includes('รุ่นโค้ด: '+info.code.slice(0,12)));assert.ok(!staff.includes('id="program-version-details"'));
});
