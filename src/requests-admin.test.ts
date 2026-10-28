import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CourseRequestStore, type CourseRequest } from './course-requests.js';
import { customerId } from './customers.js';
import { requestsAdminHandler, requestsPage } from './requests-admin.js';
test('request API rejects cross-site writes, bounds payload and protects actor and identity',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'requests-api-'));try{
 const store=new CourseRequestStore(join(dir,'requests')),row:CourseRequest={version:1,id:randomUUID(),kind:'contact',createdAt:new Date().toISOString(),owner:{channel:'terminal',scope:'test',user:'A'},course:null,message:'เรื่องเดิม',status:'pending_team',delivery:{channel:null,status:'not_selected'},sourceSha256:'a'.repeat(64)};store.save(row);
 const handler=requestsAdminHandler(store,'secret'),host='127.0.0.1:3001';
 const call=(method='GET',body='',extra:Record<string,string | undefined>={})=>new Promise<{status:number;body:any}>(resolve=>{let status=0;const req=Readable.from(body?[Buffer.from(body)]:[]) as IncomingMessage;Object.assign(req,{url:'/api/requests',method,headers:{host,origin:'http://'+host,'content-type':'application/json','x-request-token':'secret',...extra}});handler(req,{writeHead(n:number){status=n;return this},end(s:string){resolve({status,body:JSON.parse(s)})}} as unknown as ServerResponse)});
 const cmd={requestId:row.id,customerId:customerId(row.owner),revision:0,operationId:randomUUID(),action:'claim',value:''},body=JSON.stringify(cmd);
 assert.equal((await call('GET')).body.requests.length,1);
 for(const extra of [{host:'foreign.invalid'},{origin:'http://evil.invalid'},{'sec-fetch-site':'cross-site'},{'x-request-token':'wrong'},{'content-type':'text/plain'}])assert.equal((await call('POST',body,extra)).status,403);
 assert.equal((await call('POST','x'.repeat(16385))).status,413);assert.equal((await call('POST','bad-json')).status,400);
 assert.equal((await call('POST',body)).status,200);assert.equal((await call('POST',body)).body.work.revision,1);
 assert.equal((await call('POST',JSON.stringify({...cmd,operationId:randomUUID(),action:'note',value:'stale'}))).status,409);
 assert.equal((await call('DELETE')).status,405);assert.equal(store.list()[0].status,'pending_team');
 assert.match(requestsPage,/n.textContent=text/);assert.doesNotMatch(requestsPage,/innerHTML/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
