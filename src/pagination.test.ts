import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOf,pageQuery,olderMessages } from './pagination.js';
test('page parser bounds size, rejects duplicate/unknown/malformed parameters and clamps deleted last pages',()=>{
 for(const query of ['size=0','size=101','page=-1','page=1.2','page=1&page=2','unknown=1','q='+encodeURIComponent('\u0000'),'page=1000001'])assert.throws(()=>pageQuery('/api/browse/customers?'+query),query);
 assert.equal(pageQuery('/api/browse/customers').size,25);
 const empty=pageOf([],pageQuery('/?page=999'));assert.deepEqual(empty.pagination,{page:1,size:25,total:0,pages:1,from:0,to:0,hasNext:false,hasPrevious:false});
 const one=pageOf([1,2],{page:999,size:25});assert.equal(one.pagination.page,1);assert.deepEqual(one.items,[1,2]);
});
test('message cursor orders tied timestamps, returns every retained message exactly once and resists newer arrivals',()=>{
 const at=new Date().toISOString(),messages=Array.from({length:77},(_,i)=>({id:String(i).padStart(4,'0'),at}));
 let before='',seen:string[]=[];
 do{const d=olderMessages(messages,{...pageQuery('/'),size:20,before},r=>r.id);seen.push(...d.items.map(r=>r.id));if(!d.messagesPage.hasOlder)break;before=d.messagesPage.before!;}while(before);
 assert.equal(seen.length,77);assert.equal(new Set(seen).size,77);
 const first=olderMessages(messages,{...pageQuery('/'),size:20},r=>r.id);
 const next=olderMessages([...messages,{id:'9999',at:new Date(Date.now()+1000).toISOString()}],{...pageQuery('/'),size:20,before:first.messagesPage.before!},r=>r.id);
 assert.equal(next.items.some(r=>first.items.some(v=>v.id===r.id)),false);
 assert.throws(()=>olderMessages(messages,{...pageQuery('/'),before:'bad-cursor'},r=>r.id));
});
