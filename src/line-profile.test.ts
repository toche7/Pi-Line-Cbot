import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { CustomerStore } from './customers.js';
import { LineProfiles } from './line-profile.js';
import { ConversationMonitor, type MonitorEvent } from './monitor.js';
import { CourseRequestStore } from './course-requests.js';
import { adminHandler } from './admin.js';

const user = 'U' + 'a'.repeat(32);
const event = (account = 'oa', userId = user): MonitorEvent => ({ id: userId + account, account, userId, direction: 'in', text: 'fixture', status: 'received', at: new Date().toISOString() });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cbtu-line-profile-'));
  let now = Date.now();
  const store = new CustomerStore(join(dir, 'customers'), () => now);
  const sources = { events: [event(), event('other-oa')], requests: [] };
  return { dir, store, sources, now: () => now, advance: (ms: number) => { now += ms; }, get: () => store.snapshot(sources), clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test('LINE names use fixed authenticated GET, persist cache, preserve manually edited fields and never imply consent', async () => {
  const f = fixture();
  try {
    const initial = f.get(), c = initial.customers[0];
    f.store.mutate({ revision: initial.revision, action: 'profile.update', id: c.id, data: { profile: { ...c.profile, nickname: 'ชื่อที่ทีมตั้ง' }, source: 'ทีมตั้งชื่อเรียก', reference: '' } });
    let calls = 0;
    const fetcher = (async (url: any, init: any) => {
      calls++; assert.equal(url, 'https://api.line.me/v2/bot/profile/' + user); assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer fixture-token'); assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ userId: user, displayName: 'ชื่อจริงจาก LINE ใน fixture', statusMessage: 'ไม่เก็บข้อความสถานะ', pictureUrl: 'https://example.invalid/not-used' }));
    }) as typeof fetch;
    const profiles = new LineProfiles(f.store, 'oa', 'fixture-token', fetcher, f.now);
    await profiles.refreshDue(f.get().customers);
    let snapshot = f.get();
    assert.equal(calls, 1); assert.equal(snapshot.customers[0].displayName, 'ชื่อจริงจาก LINE ใน fixture');
    assert.equal(snapshot.customers[0].profile.nickname, 'ชื่อที่ทีมตั้ง'); assert.equal(snapshot.customers[0].profile.fullName, '');
    assert.equal(snapshot.customers[0].consent, 'unknown'); assert.equal(snapshot.customers[0].notes.length, 0);
    assert.equal(snapshot.customers[1].displayName, null); assert.doesNotMatch(JSON.stringify(snapshot), /fixture-token|ไม่เก็บข้อความสถานะ|example.invalid/);
    await profiles.refreshDue(snapshot.customers); assert.equal(calls, 1);
    const restarted = new CustomerStore(join(f.dir, 'customers'), f.now);
    await new LineProfiles(restarted, 'oa', 'fixture-token', fetcher, f.now).refreshDue(restarted.snapshot(f.sources).customers);
    assert.equal(calls, 1); // Persisted success TTL also survives process/client restart.
    f.advance(24 * 60 * 60_000 + 1);
    await profiles.refreshDue(f.get().customers); assert.equal(calls, 2);
    assert.equal(f.get().customers[0].provenance.nickname?.source, 'ทีมตั้งชื่อเรียก');
  } finally { f.clean(); }
});

test('unavailable/malformed/mismatched LINE profiles preserve cached names, keep errors safe and back off automatic retries', async () => {
  const f = fixture();
  try {
    const c = f.get().customers[0]; f.store.saveLineProfile(c.id, 'ชื่อที่เคยดึงสำเร็จ');
    for (const scenario of ['404', '429', '401', 'network', 'malformed', 'foreign-user', 'empty-name']) {
      let calls = 0;
      const fetcher = (async () => {
        calls++;
        if (scenario === 'network') throw Error('private-token/body');
        if (/^\d+$/.test(scenario)) return new Response('private-token/body', { status: Number(scenario) });
        if (scenario === 'malformed') return new Response('{broken');
        return new Response(JSON.stringify({ userId: scenario === 'foreign-user' ? 'U' + 'f'.repeat(32) : user, displayName: scenario === 'empty-name' ? ' ' : 'wrong' }));
      }) as typeof fetch;
      const profiles = new LineProfiles(f.store, 'oa', 'fixture-token', fetcher, f.now);
      await assert.rejects(profiles.refresh(c), (e: any) => e.status === 502 && !/private-token|body/.test(e.message));
      assert.equal(f.get().customers[0].displayName, 'ชื่อที่เคยดึงสำเร็จ');
      // Use a missing profile in the input to verify automatic failure cooldown.
      const missing = { ...c, lineProfile: undefined };
      await profiles.refreshDue([missing]); assert.equal(calls, 1);
      f.advance(5 * 60_000 + 1);
      await profiles.refreshDue([missing]); assert.equal(calls, 2);
    }
    const profiles = new LineProfiles(f.store, 'oa', 'fixture-token', (() => { throw Error('should not fetch'); }) as typeof fetch);
    await assert.rejects(profiles.refresh(f.get().customers[1]), /บัญชีที่เชื่อม/);
    await assert.rejects(profiles.refresh({ ...c, identity: { ...c.identity, user: '../bad' } }), /บัญชีที่เชื่อม/);
  } finally { f.clean(); }
});

test('profile enrichment deduplicates concurrent calls and bounds work per registry snapshot', async () => {
  const f = fixture();
  try {
    const c = f.get().customers[0]; let calls = 0;
    const fetcher = (async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return new Response(JSON.stringify({ userId: user, displayName: 'ชื่อจาก fixture' })); }) as typeof fetch;
    const profiles = new LineProfiles(f.store, 'oa', 'fixture-token', fetcher, f.now);
    await Promise.all([profiles.refresh(c), profiles.refresh(c), profiles.refresh(c)]);
    assert.equal(calls, 1);
    const many = { events: Array.from({ length: 7 }, (_, i) => event('oa', 'U' + String(i).repeat(32))), requests: [] };
    const customers = f.store.snapshot(many).customers;
    const bounded = new LineProfiles(f.store, 'oa', 'fixture-token', (async (url: any) => {
      calls++; return new Response(JSON.stringify({ userId: String(url).split('/').at(-1), displayName: 'fixture' }));
    }) as typeof fetch, f.now);
    await bounded.refreshDue(customers); assert.equal(calls, 5);
  } finally { f.clean(); }
});

test('profile API refresh resolves the existing identity server-side, ignores spoofed names, and uses same CSRF checks', async () => {
  const f = fixture(); const monitor = new ConversationMonitor(join(f.dir, 'monitor')), requests = new CourseRequestStore(join(f.dir, 'requests'));
  monitor.record(event()); let calls = 0;
  const profiles = new LineProfiles(f.store, 'oa', 'fixture-token', (async () => { calls++; return new Response(JSON.stringify({ userId: user, displayName: 'ชื่อจาก API fixture' })); }) as typeof fetch, f.now);
  const server = createServer(adminHandler(monitor, requests, f.store, profiles));
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
    const html = await (await fetch(url)).text(), token = html.match(/const CUSTOMER_CSRF_TOKEN="([a-f0-9]+)"/)![1];
    let snapshot = await (await fetch(url + '/api/customers')).json(); assert.equal(calls, 1);
    const c = snapshot.customers[0]; assert.equal(c.displayName, 'ชื่อจาก API fixture'); assert.equal(c.canRefreshLineProfile, true);
    assert.doesNotMatch(html, /fixture-token/);
    const body = JSON.stringify({ action: 'line-profile.refresh', id: c.id, data: { displayName: 'ห้ามใช้ชื่อจาก client', userId: 'foreign' } });
    const headers = { Origin: url, 'Content-Type': 'application/json', 'X-Customer-Token': token };
    assert.equal((await fetch(url + '/api/customers', { method: 'POST', headers: { ...headers, 'X-Customer-Token': 'invalid' }, body })).status, 403);
    assert.equal(calls, 1);
    assert.equal((await fetch(url + '/api/customers', { method: 'POST', headers, body })).status, 200); assert.equal(calls, 2);
    snapshot = await (await fetch(url + '/api/customers')).json(); assert.equal(snapshot.customers[0].displayName, 'ชื่อจาก API fixture');
    assert.equal(snapshot.customers[0].consent, 'unknown');
    assert.equal((await fetch(url + '/api/customers', { method: 'POST', headers, body: JSON.stringify({ action: 'line-profile.refresh', id: 'unknown' }) })).status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); f.clean(); }
});

test('paged registry refreshes only visible profiles plus off-page selection and preserves manual refresh capability', async()=>{
 const f=fixture(),monitor=new ConversationMonitor(join(f.dir,'paged-monitor')),requests=new CourseRequestStore(join(f.dir,'paged-requests'));
 for(let i=0;i<30;i++)monitor.record(event('oa','U'+i.toString(16).padStart(32,'0')));
 monitor.record(event('other-oa'));
 let calls:string[]=[],fail=false;
 const profiles=new LineProfiles(f.store,'oa','private-fixture-token',(async(url:any)=>{
  const userId=String(url).split('/').at(-1)!;calls.push(userId);
  return fail?new Response('secret-error',{status:429}):new Response(JSON.stringify({userId,displayName:'LINE '+userId}));
 }) as typeof fetch,f.now);
 const server=createServer(adminHandler(monitor,requests,f.store,profiles));
 try{
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const html=await(await fetch(base)).text(),csrf=html.match(/const CUSTOMER_CSRF_TOKEN="([a-f0-9]+)"/)![1];
  const initial=f.store.snapshot({events:monitor.snapshot().events,requests:[]}),own=initial.customers.filter(c=>c.identity.scope==='oa:direct'),selected=own.at(-1)!;
  const url=base+'/api/browse/customers?size=2&selected='+encodeURIComponent(selected.id);
  let page=await(await fetch(url)).json();assert.equal(page.pagination.total,31);assert.equal(page.customers.length,2);
  assert.equal(page.selectedCustomer.canRefreshLineProfile,true);assert.equal(page.selectedCustomer.displayName,'LINE '+selected.identity.user);
  assert.ok(calls.length<=3);assert.ok(calls.includes(selected.identity.user));
  for(const c of page.customers)assert.equal(c.canRefreshLineProfile,c.identity.scope==='oa:direct');
  const firstCalls=calls.length;await fetch(url);assert.equal(calls.length,firstCalls);
  fail=true;
  const other=own.find(c=>!calls.includes(c.identity.user))!;
  const failed=await fetch(base+'/api/browse/customers?size=1&selected='+encodeURIComponent(other.id));assert.equal(failed.status,200);
  const failedCalls=calls.length;await fetch(base+'/api/browse/customers?size=1&selected='+encodeURIComponent(other.id));assert.equal(calls.length,failedCalls);
  fail=false;
  const post=await fetch(base+'/api/customers',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Customer-Token':csrf},body:JSON.stringify({action:'line-profile.refresh',id:other.id})});assert.equal(post.status,200);
  page=await(await fetch(base+'/api/browse/customers?size=1&selected='+encodeURIComponent(other.id))).json();assert.equal(page.selectedCustomer.displayName,'LINE '+other.identity.user);assert.equal(page.selectedCustomer.canRefreshLineProfile,true);
  assert.equal(page.selectedCustomer.consent,'unknown');assert.doesNotMatch(JSON.stringify(page),/private-fixture-token|secret-error/);
  const conv=await(await fetch(base+'/api/browse/conversations?size=1&selected='+encodeURIComponent(JSON.stringify(['oa',other.identity.user])))).json();assert.equal(conv.selectedCustomer.displayName,'LINE '+other.identity.user);
  const prior=calls.length;assert.equal((await fetch(base+'/api/browse/customers?size=1000')).status,400);assert.equal((await fetch(url,{headers:{Origin:'https://foreign.invalid'}})).status,403);assert.equal(calls.length,prior);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));f.clean()}
});

test('paged profile controls stay disabled when no LINE profile service is configured',async()=>{
 const f=fixture(),monitor=new ConversationMonitor(join(f.dir,'no-profile-monitor')),requests=new CourseRequestStore(join(f.dir,'no-profile-requests'));monitor.record(event());
 const server=createServer(adminHandler(monitor,requests,f.store));
 try{await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port;const first=await(await fetch(url+'/api/browse/customers')).json();assert.equal(first.customers[0].canRefreshLineProfile,false);const selected=await(await fetch(url+'/api/browse/customers?selected='+encodeURIComponent(first.customers[0].id))).json();assert.equal(selected.selectedCustomer.canRefreshLineProfile,false)}
 finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));f.clean()}
});
