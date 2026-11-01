import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { paginationScript } from './pagination-browser.js';
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
