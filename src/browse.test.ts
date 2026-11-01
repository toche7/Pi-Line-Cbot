import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { browseSnapshot } from './browse.js';
import { pageQuery } from './pagination.js';
// Shared fixture is JavaScript so browser QA can use exactly the same data set.
const {paginationFixture}=await import('../scripts/pagination-fixture-data.mjs' as string);
const query=(params:Record<string,string|number>={})=>pageQuery('/?'+new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])));
test('server paging searches the whole registry, bounds list payloads and preserves selected detail outside the page',()=>{
 const f=paginationFixture();try{
  const first=browseSnapshot('customers',query(),f),second=browseSnapshot('customers',query({page:2}),f);assert.equal(first.customers.length,25);assert.equal(first.pagination.total,120);assert.equal(second.customers.length,25);
  assert.equal(second.customers.some((c:any)=>first.customers.some((x:any)=>x.id===c.id)),false);
  const search=browseSnapshot('customers',query({q:'Customer 119'}),f);assert.equal(search.customers.length,1);assert.equal(search.pagination.total,1);
  const picked=second.customers[10],detail=browseSnapshot('customers',query({selected:picked.id}),f);assert.equal(detail.selectedCustomer.id,picked.id);assert.equal(detail.customers.some((c:any)=>c.id===picked.id),false);
  assert.equal(browseSnapshot('customers',query({tag:'even'}),f).pagination.total,60);
  assert.equal(browseSnapshot('customers',query({group:'fixture-group'}),f).pagination.total,80);
  assert.equal(browseSnapshot('customers',query({page:99999}),f).pagination.page,5);
 }finally{f.clean()}
});
test('conversation and room histories load one bounded window with stable older-message cursors and global search',()=>{
 const f=paginationFixture();try{
  const person=f.all.find((c:any)=>c.profile.nickname==='Customer 000'),selected=JSON.stringify(['fixture-oa',person.identity.user]);
  const page=browseSnapshot('conversations',query({selected}),f);assert.equal(page.events.length,25);assert.equal(page.customers.length,25);assert.equal(page.messagesPage.hasOlder,true);assert.equal(page.selectedRecent,true);
  const older=browseSnapshot('conversations',query({selected,before:page.messagesPage.before}),f);assert.equal(older.events.length,25);assert.equal(older.events.some((e:any)=>page.events.some((v:any)=>v.id===e.id)),false);
  assert.equal(browseSnapshot('conversations',query({q:'Customer 119'}),f).pagination.total,1);
  const room=browseSnapshot('rooms',query({selected:f.roomId,page:2}),f);assert.equal(room.rooms.length,20);assert.equal(room.selectedRoom.messages.length,25);assert.equal(room.messagesPage.hasOlder,true);
  assert.ok(room.rooms.every((r:any)=>r.messages.length===0));
 }finally{f.clean()}
});
test('work, news, recipients, staff, pending and knowledge collections page without truncating global totals or mutation selections',()=>{
 const f=paginationFixture();try{
  const before=readFileSync(join(f.root,'news','news.json'),'utf8');
  assert.equal(browseSnapshot('requests',query({q:'Request fixture 074'}),f).pagination.total,1);
  const requests=browseSnapshot('requests',query(),f);assert.equal(requests.requests.length,25);assert.equal(requests.customers.length,25);assert.equal(requests.pagination.total,75);
  const selected=browseSnapshot('news',query({selected:f.selectedNewsId}),f);assert.equal(selected.campaigns.length,25);assert.equal(selected.pagination.total,81);assert.equal(selected.customers.length,0);
  assert.equal(selected.selectedCampaign.selection.customerIds.length,60);assert.equal(selected.selectedCampaign.review.recipientTotal,80);assert.equal(selected.selectedCampaign.review.recipients.length,0);
  const recipients=browseSnapshot('news-recipients',query({selected:f.selectedNewsId,page:3}),f);assert.equal(recipients.items.length,25);assert.equal(recipients.pagination.total,80);
  const membership=browseSnapshot('membership',query({selected:'fixture-group'}),f);assert.equal(membership.memberIds.length,80);
  assert.equal(browseSnapshot('options',query({kind:'customers',q:'Customer 119'}),f).pagination.total,1);
  assert.equal(browseSnapshot('pending',query(),f).users.length,25);assert.equal(browseSnapshot('pending',query(),f).pagination.total,40);
  assert.equal(browseSnapshot('staff',query(),f).accounts.length,25);assert.equal(browseSnapshot('staff',query(),f).pagination.total,46);
  assert.equal(browseSnapshot('staff-history',query(),f).items.length,25);
  const km=browseSnapshot('knowledge',query({q:'FAQ 054',selected:'fixture-000'}),f);assert.equal(km.draft.length,1);assert.equal(km.selectedEntry.id,'fixture-000');assert.equal(km.versions.length,0);assert.equal(km.diffCount,55);
  assert.equal(browseSnapshot('knowledge-changes',query(),f).items.length,25);
  assert.equal(browseSnapshot('knowledge-history',query(),f).items.length,25);
  const course=browseSnapshot('knowledge',query({kind:'courses',size:5,page:2}),f);assert.equal(course.catalog.courses.length,5);assert.ok(course.catalog.courses[0].sourceIndex>=5);
  assert.equal(readFileSync(join(f.root,'news','news.json'),'utf8'),before,'browsing must not mutate or authorize any campaign');
 }finally{f.clean()}
});
