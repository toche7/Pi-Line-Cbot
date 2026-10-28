import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CustomerStore } from './customers.js';
import { NewsService, NewsStore } from './news.js';
import { newsHandler } from './news-api.js';
import { newsScript } from './news-admin.js';

test('news HTTP guards loopback, host, origin, CSRF, JSON and payload; does not accept enable/grant commands',async()=>{
 const root=mkdtempSync(join(tmpdir(),'news-api-'));
 try {
  const service=new NewsService(new NewsStore(join(root,'news')),new CustomerStore(join(root,'customers')),'oa'),handler=newsHandler(service,'token');
  async function call(method='POST',headers:any={},body='{}',remote='127.0.0.1'){
   const req=Readable.from([body]) as any;req.method=method;req.socket={remoteAddress:remote};req.headers={host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-news-token':'token','content-type':'application/json',...headers};
   let status=0,value:any;const res:any={writeHead(s:number){status=s;return res},end(v:string){value=JSON.parse(v);return res}};await handler(req,res);return {status,value};
  }
  assert.equal((await call('GET')).status,200);
  for(const headers of [{host:'evil.example'},{origin:'http://evil.example'},{'x-news-token':'bad'},{'content-type':'text/plain'},{'sec-fetch-site':'cross-site'}])assert.equal((await call('POST',headers)).status,403);
  assert.equal((await call('GET',{},'', '192.168.1.2')).status,403);
  assert.equal((await call('POST',{},'x')).status,400);
  assert.equal((await call('POST',{},'x'.repeat(32769))).status,413);
  assert.equal((await call('PUT')).status,405);
  for(const action of ['enable','authorizeCampaign'])assert.equal((await call('POST',{},JSON.stringify({action}))).status,404);
  assert.equal((await call('POST',{},JSON.stringify({action:'create',title:'fixture',text:'hello',customerIds:[],groupIds:[]}))).status,200);
  assert.equal(service.store.list().length,1);assert.equal(service.enabled,false);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('news browser script parses independently',()=>{assert.doesNotThrow(()=>new Function(newsScript));assert.ok(!newsScript.includes('innerHTML'));});
