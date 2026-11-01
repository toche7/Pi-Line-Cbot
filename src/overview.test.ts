import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConversationMonitor } from './monitor.js';
import { CustomerStore, customerId } from './customers.js';
import { CourseRequestStore, type CourseRequest } from './course-requests.js';
import { RequestWorkStore } from './request-work.js';
import { ConversationControl, conversationKey } from './conversation-control.js';
import { PendingLineUsers } from './line-pending-users.js';
import { NewsStore, NewsService } from './news.js';
import { overviewHandler, overviewSnapshot } from './overview.js';
import { adminPage } from './admin.js';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cbot-overview-')), now = Date.now();
  const requests = new CourseRequestStore(join(root, 'requests'), () => now), work = new RequestWorkStore(join(root, 'work'), requests, () => now);
  const monitor = new ConversationMonitor(join(root, 'monitor')), customers = new CustomerStore(join(root, 'customers'));
  const control = new ConversationControl(join(root, 'control')), pending = { store: new PendingLineUsers(join(root, 'pending'), () => now), account: 'oa', allowedUsers: new Set(['U'+'a'.repeat(32)]) };
  const news = new NewsService(new NewsStore(join(root, 'news')), customers, 'oa', async () => { throw Error('must never send'); });
  const sources = { monitor, work, customers, pending, news, conversations: { control, account: 'oa', allowedUsers: pending.allowedUsers, dryRun: true, push: async () => { throw Error('must never send'); } } };
  const save = (user: string, at = now) => {
    const r: CourseRequest = { version: 1, id: randomUUID(), kind: 'contact', createdAt: new Date(at).toISOString(), owner: { channel: 'line', scope: 'oa:direct', user }, course: null, message: 'private request body', status: 'pending_team', delivery: { channel: null, status: 'not_selected' }, sourceSha256: 'a'.repeat(64) };
    requests.save(r); return r;
  };
  return { root, now, sources, requests, save, clean: () => rmSync(root, { recursive: true, force: true }) };
}
function files(root: string): unknown {
  return Object.fromEntries(readdirSync(root).sort().map(n => { const p = join(root,n); return [n,statSync(p).isDirectory()?files(p):readFileSync(p,'utf8')]; }));
}
test('overview counts Bangkok midnight, distinct OA identities, inbound only, and omits private content', () => {
  const f = fixture(); try {
    const start = Date.parse(new Date(f.now + 7*3600000).toISOString().slice(0,10)+'T00:00:00+07:00');
    const event = (at: number, userId = 'A', account = 'oa', direction: 'in'|'out' = 'in') => f.sources.monitor.record({ id: randomUUID(), userId, account, direction, text: 'private chat body', at: new Date(at).toISOString(), status: 'received' });
    event(start-1);event(start);event(start+1);event(start+2,'A','other-oa');event(start+3,'B');event(start+4,'C','oa','out');event(f.now+60000,'future');
    const d = overviewSnapshot(f.sources, f.now);
    assert.deepEqual(d.today,{people:3,messages:4});assert.equal(d.periodStart,new Date(start).toISOString());assert.equal(d.contacts?.length,3);
    assert.doesNotMatch(JSON.stringify(d),/private chat body|private request body|sourceSha256|replyToken/);
    assert.deepEqual(d.errors,[]);
  } finally { f.clean(); }
});
test('overview reads persisted work statuses and waiting separately; pending excludes allowed/other OA/expired', () => {
  const f = fixture(); try {
    const a=f.save('A'),b=f.save('B'),c=f.save('C');
    const mutate=(r:CourseRequest,action:string,revision:number,value='')=>f.sources.work.mutate({requestId:r.id,customerId:customerId(r.owner),operationId:randomUUID(),revision,action,value});
    mutate(b,'claim',0);mutate(c,'claim',0);mutate(c,'status',1,'done');
    f.sources.conversations.control.requestHuman(conversationKey('oa','A'),false);
    f.sources.pending.store.record('oa','U'+'a'.repeat(32));f.sources.pending.store.record('oa','U'+'b'.repeat(32));f.sources.pending.store.record('other','U'+'c'.repeat(32));
    new PendingLineUsers(f.sources.pending.store.root, () => f.now-8*86400000).record('oa','U'+'e'.repeat(32));
    const d=overviewSnapshot(f.sources,f.now);assert.deepEqual(d.work,{new:1,inProgress:1});assert.equal(d.waiting,1);assert.equal(d.pending,1);assert.equal(d.registryCount,0);assert.equal(a.kind,'contact');
  } finally { f.clean(); }
});
test('overview GET never discovers customers, prunes expired requests/work, writes files or changes rights', () => {
  const f=fixture();try {
    const r=f.save('A');f.sources.customers.snapshot({events:[],requests:[r]});
    f.sources.monitor.record({id:'e',userId:'undiscovered',account:'oa',direction:'in',text:'private',at:new Date(f.now).toISOString(),status:'received'});
    const expired={...r,id:randomUUID(),createdAt:new Date(f.now-91*86400000).toISOString()};
    writeFileSync(join(f.requests.root,expired.id+'.json'),JSON.stringify(expired));
    writeFileSync(join(f.sources.work.root,randomUUID()+'.json'),'orphan preserved');
    const before=files(f.root);const d=overviewSnapshot(f.sources,f.now);overviewSnapshot(f.sources,f.now);
    assert.equal(d.registryCount,1);assert.deepEqual(d.work,{new:1,inProgress:0});assert.deepEqual(files(f.root),before);
  }finally{f.clean()}
});
test('overview keeps healthy sections when a source is corrupt or absent; unavailable is null not zero', () => {
  const f=fixture();try {
    f.save('A');writeFileSync(join(f.sources.news.store.root,'news.json'),'broken');
    let d=overviewSnapshot(f.sources,f.now);assert.equal(d.newsAvailable,false);assert.deepEqual(d.today,{people:0,messages:0});assert.deepEqual(d.work,{new:1,inProgress:0});assert.match(d.errors.join(),/ส่งข่าว/);
    d=overviewSnapshot({...f.sources,customers:undefined,pending:undefined,conversations:undefined},f.now);assert.equal(d.registryCount,null);assert.equal(d.pending,null);assert.equal(d.waiting,null);
    writeFileSync(join(f.requests.root,readdirSync(f.requests.root)[0]),'broken');assert.equal(overviewSnapshot(f.sources,f.now).work,null);
  }finally{f.clean()}
});
test('overview news aggregates delivery states and ignores newer unsent drafts without sending', () => {
  const f=fixture();try {
    const r=f.save('A');const cs=f.sources.customers.snapshot({events:[],requests:[r]}),id=cs.customers[0].id;
    f.sources.customers.mutate({revision:cs.revision,id,action:'consent.update',data:{status:'subscribed',evidence:'fixture'}});
    const n=f.sources.news,draft=n.mutate({action:'create',title:'fixture sent',text:'private news body',customerIds:[id],groupIds:[]});
    const review=n.mutate({action:'review',id:draft.id,revision:draft.revision});
    n.authorizeCampaign(review.id,review.review!.digest);n.mutate({action:'confirm',id:review.id,revision:review.revision,digest:review.review!.digest});
    n.store.transaction(s=>{s.campaigns[0].deliveries[0].status='ambiguous';s.campaigns[0].status='complete'});
    n.mutate({action:'create',title:'new unsent draft',text:'not sent',customerIds:[],groupIds:[]});
    const before=files(f.root),d=overviewSnapshot(f.sources,f.now+1000);assert.equal(d.news?.title,'fixture sent');assert.equal(d.news?.counts.ambiguous,1);assert.equal(d.news?.counts.accepted,0);assert.doesNotMatch(JSON.stringify(d),/private news body|consentStamp|consentHistory/);assert.deepEqual(files(f.root),before);
  }finally{f.clean()}
});
test('overview API rejects foreign origins, cross-site and writes; overview navigation defaults correctly', () => {
  const f=fixture();try {
    const handler=overviewHandler(f.sources);
    const call=(method='GET',headers:Record<string,string>={host:'127.0.0.1:3001'})=>{let status=0,body='';handler({method,headers} as IncomingMessage,{writeHead(s:number){status=s;return this},end(s:string){body=s}} as unknown as ServerResponse);return {status,body}};
    assert.equal(call().status,200);assert.equal(call('POST').status,405);assert.equal(call('GET',{host:'foreign.invalid'}).status,403);assert.equal(call('GET',{host:'127.0.0.1:3001',origin:'https://foreign.invalid'}).status,403);assert.equal(call('GET',{host:'127.0.0.1:3001','sec-fetch-site':'cross-site'}).status,403);
    const page=adminPage();assert.match(page,/id="tab-overview"/);assert.match(page,/id="overview-panel"/);assert.match(page,/tabs.includes\(name\)\?name:'overview'/);assert.match(page,/fetch\('\/api\/overview'/);assert.doesNotMatch(page,/disabled title="ยังไม่พัฒนา"/);
    // Parse all inline JS without executing application side effects.
    new Function(page.match(/<script>([\s\S]*?)<\/script>/)![1]);
  }finally{f.clean()}
});
