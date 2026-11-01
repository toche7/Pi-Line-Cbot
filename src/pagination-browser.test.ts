import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { paginationScript } from './pagination-browser.js';
import { conversationScript } from './conversations-admin.js';

test('conversation browser cache keeps customer replies during handover and updates each direction without duplicates',()=>{
 const expression=conversationScript.match(/const merge=([^;]+);cachedEvents=/)?.[1];
 assert.ok(expression,'exercise the merge function shipped in the conversation page');
 const merge=runInNewContext('('+expression+')',{Map,JSON});
 const incoming={account:'oa',userId:'user',id:'webhook',direction:'in',text:'Customer reply',status:'received'};
 const paused={...incoming,direction:'out',text:'',status:'bot_paused'};
 let rows=merge([],[incoming,paused]);
 assert.equal(rows.length,2);
 assert.equal(rows.find((e:any)=>e.direction==='in').text,'Customer reply');
 rows=merge(rows,[incoming,paused]);
 assert.equal(rows.length,2,'polling must not duplicate either record');
 rows=merge(rows,[{...paused,text:'Bot answer',status:'replied'}]);
 assert.equal(rows.length,2);
 assert.equal(rows.find((e:any)=>e.direction==='in').text,'Customer reply');
 assert.equal(rows.find((e:any)=>e.direction==='out').status,'replied');
});
test('list client cancels superseded requests and rejects late results even if the transport ignores cancellation',async()=>{
 const calls:{url:string;signal:AbortSignal;resolve:(value:unknown)=>void}[]=[];
 const api=runInNewContext(paginationScript+'\nCBOT_PAGES',{Map,Set,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,
   fetch:(url:string,options:any)=>new Promise(resolve=>calls.push({url,signal:options.signal,resolve}))});
 const old=api.read('customers',{q:'old'}),oldResult=assert.rejects(old,(e:any)=>e.name==='AbortError');
 const latest=api.read('customers',{q:'latest'});assert.equal(calls[0].signal.aborted,true);
 calls[1].resolve({ok:true,json:async()=>({items:['latest']})});assert.deepEqual(await latest,{items:['latest']});
 calls[0].resolve({ok:true,json:async()=>({items:['obsolete']})});await oldResult;
 assert.match(calls[1].url,/q=latest/);assert.match(calls[1].url,/size=25/);
});
