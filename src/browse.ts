import type { LineProfiles } from './line-profile.js';
import { hasPermission, roleLabels } from './staff-policy.js';
import { staffIdentity } from './staff-context.js';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { ConversationMonitor } from './monitor.js';
import type { CustomerStore } from './customers.js';
import type { CourseRequestStore } from './course-requests.js';
import type { RequestWorkStore } from './request-work.js';
import type { ConversationService } from './conversations-api.js';
import type { NewsService } from './news.js';
import { roomAcceptsNews, type LineGroupService } from './line-groups.js';
import type { PendingUserService } from './line-pending-admin.js';
import type { StaffStore } from './staff-store.js';
import type { KnowledgeStore } from './knowledge-store.js';
import { knowledgeSnapshot } from './knowledge-api.js';
import { pageQuery,pageOf,matches,customerName,customerSummary,olderMessages,PageError,type PageQuery } from './pagination.js';
type Sources={profiles?:LineProfiles;monitor:ConversationMonitor;customers?:CustomerStore;requests:CourseRequestStore;work:RequestWorkStore;conversations?:ConversationService;news?:NewsService;rooms?:LineGroupService;pending?:PendingUserService;staff?:StaffStore;knowledge?:KnowledgeStore};
const conversationKey=(c:any)=>JSON.stringify([c.identity.scope.replace(/:direct$/,''),c.identity.user]);
const identityKey=(r:any)=>JSON.stringify([r.owner.channel,r.owner.scope,r.owner.user]);
const customerKey=(c:any)=>JSON.stringify([c.identity.channel,c.identity.scope,c.identity.user]);
const byNewest=(a:any,b:any)=>String(b.lastContactAt||b.updatedAt||b.createdAt||'').localeCompare(String(a.lastContactAt||a.updatedAt||a.createdAt||''))||String(a.id).localeCompare(String(b.id));
function staffEmails(store?: StaffStore) {
  return new Map(store?.snapshot().accounts.flatMap(a => a.subject ? [['staff:' + a.subject, a.email] as const] : []));
}
export function browseSnapshot(resource:string,q:PageQuery,s:Sources):any {
  if(resource.startsWith('knowledge')){
    if(!s.knowledge)throw new PageError(503,'ยังไม่เปิดความรู้บอต');const state=knowledgeSnapshot(s.knowledge);
    if(resource==='knowledge-changes'){const list=pageOf(state.diff.filter(d=>d.changed&&matches(q.q,d.id,d.before?.title,d.after?.title)),q);return {items:list.items,pagination:list.pagination}}
    if(resource==='knowledge-history'){const list=pageOf([...state.history].reverse().filter(h=>matches(q.q,h.actor,h.event)),q);return {items:list.items,pagination:list.pagination}}
    if(resource==='knowledge-versions'){const list=pageOf([...state.versions].reverse().filter(v=>matches(q.q,v.id,v.actor,v.event)),q);return {items:list.items.map(v=>({...v,entries:[],entryCount:v.entries.length})),pagination:list.pagination}}
    if(resource==='knowledge-version'){const version=state.versions.find(v=>v.id===q.selected);if(!version)throw new PageError(404,'ไม่พบเวอร์ชัน');const list=pageOf(version.entries.filter(e=>matches(q.q,e.id,e.title,e.text,...e.terms)),q);return {items:list.items,pagination:list.pagination}}
    if(resource!=='knowledge')throw new PageError(404,'ไม่พบรายการความรู้');
    const courses=state.catalog.courses.map((c,sourceIndex)=>({...c,sourceIndex}));
    const list=q.kind==='courses'?pageOf(courses.filter(c=>matches(q.q,c.id,c.name,...c.flags)),q):pageOf(state.draft.filter(e=>matches(q.q,JSON.stringify(e))).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)),q);
    const ids=new Set(list.items.map(e=>e.id));
    return {...state,draft:q.kind==='courses'?[]:list.items,selectedEntry:state.draft.find(e=>e.id===q.selected)||null,versions:[],history:[],diff:state.diff.filter(d=>ids.has(d.id)).map(d=>({id:d.id,changed:d.changed})),diffCount:state.diff.filter(d=>d.changed).length,
      catalog:{...state.catalog,courses:q.kind==='courses'?list.items:[],courseCount:courses.length},pagination:list.pagination};
  }
  if(resource==='staff-history'){
    if(!s.staff)throw new PageError(503,'ยังไม่เปิดบัญชีเจ้าหน้าที่');const state=s.staff.snapshot(),list=pageOf([...state.history].reverse().filter(h=>matches(q.q,h.actor,h.event,h.target)),q);return {items:list.items,pagination:list.pagination};
  }
  if(resource==='grants'){
    if(!s.pending)throw new PageError(503,'ยังไม่เปิดผู้ทักใหม่');const rows=s.pending.access?.snapshot().grants||[],list=pageOf([...rows].reverse().filter(g=>matches(q.q,g.userId,g.actor)),q);return {items:list.items,pagination:list.pagination};
  }
  if(resource==='staff'){
    if(!s.staff)throw new PageError(503,'ยังไม่เปิดบัญชีเจ้าหน้าที่');
    const state=s.staff.snapshot(),list=pageOf(state.accounts.filter(a=>matches(q.q,a.email,a.role,roleLabels[a.role])).sort((a,b)=>a.email.localeCompare(b.email)),q);
    return {...state,accounts:list.items,history:[],pagination:list.pagination};
  }
  if(resource==='pending'){
    if(!s.pending)throw new PageError(503,'ยังไม่เปิดผู้ทักใหม่');
    const service=s.pending,access=service.access?.snapshot(),all=service.store.list().filter(u=>u.account===service.account&&!service.allowedUsers.has(u.userId));
    const list=pageOf(all.filter(u=>matches(q.q,u.userId)).sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt)||a.userId.localeCompare(b.userId)),q);
    return {users:list.items,pendingCount:all.length,grants:[],revision:access?.revision||0,allowedUserCount:service.allowedUsers.size,readOnly:!service.access,pagination:list.pagination};
  }
  if(resource==='rooms'||resource==='room-profiles'){
    if(!s.rooms)throw new PageError(503,'ยังไม่เปิดห้อง LINE');
    const state=s.rooms.store.list(),list=pageOf(state.filter(r=>matches(q.q,r.name,r.groupId,...(r.profile?.tags??[]))).sort((a,b)=>b.seenAt.localeCompare(a.seenAt)||a.groupId.localeCompare(b.groupId)),q);
    const selected=state.find(r=>r.groupId===q.selected);
    const emails=staffEmails(s.staff);
    if(resource==='room-profiles'){
      const profile=selected?.profile;
      return {rooms:list.items.map(({messages, ...r})=>r),selectedRoom:selected?{...selected,messages:[],
        updatedByEmail:profile&&emails.get(profile.updatedBy),newsChangedByEmail:profile&&emails.get(profile.newsChangedBy)}:null,
        pagination:list.pagination,canEdit:hasPermission(staffIdentity(), 'room.manage')};
    }
    const messages=olderMessages(selected?.messages||[],q,(m:any)=>String(m.eventId)+':'+m.direction);
    return {server:s.rooms.serverIdentity,canSend:!!selected&&s.rooms.canSend(selected),canManageMode:hasPermission(staffIdentity(), 'room.manage'),rooms:list.items.map(r=>({...r,messages:[]})),selectedRoom:selected?{...selected,messages:messages.items.map(m=>({...m,actorEmail:m.actor?emails.get(m.actor):undefined}))}:null,messagesPage:messages.messagesPage,pagination:list.pagination,replyEnabled:state.some(r=>!!r.replyMode&&r.status!=='left')};
  }
  const needsRegistry=['customers','conversations','requests','membership','options'].includes(resource);
  const events=needsRegistry?s.monitor.snapshot().events:[],jobs=needsRegistry?s.requests.list(undefined,true):[];
  const registry=needsRegistry?s.customers?.snapshot({events,requests:jobs}):undefined;
  if(resource==='options'){
    let rows:{id:string;name:string;consent?:string}[]=[];
    if(q.kind==='customers')rows=(registry?.customers||[]).map(c=>({id:c.id,name:customerName(c),consent:c.consent}));
    else if(q.kind==='groups')rows=(registry?.groups||[]).map(g=>({id:g.id,name:g.name}));
    else if(q.kind==='rooms')rows=(s.rooms?.store.list()||[]).filter(r=>!!s.news&&roomAcceptsNews(r,s.news.account)).map(r=>({id:r.groupId,name:r.name||r.groupId}));
    else throw new PageError(400,'ประเภทตัวเลือกไม่ถูกต้อง');
    const list=pageOf(rows.filter(r=>matches(q.q,r.name,r.id)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),q);return {items:list.items,pagination:list.pagination};
  }
  if(resource==='membership'){
    if(!registry||!registry.groups.some(g=>g.id===q.selected))throw new PageError(404,'ไม่พบกลุ่ม');
    return {revision:registry.revision,memberIds:registry.customers.filter(c=>c.groupIds.includes(q.selected)).map(c=>c.id)};
  }
  if(['news-deliveries','news-recipients','news-history'].includes(resource)){
    const campaign=s.news?.store.list().find(c=>c.id===q.selected);if(!campaign)throw new PageError(404,'ไม่พบข่าว');
    const rows:any[]=resource==='news-deliveries'?campaign.deliveries:resource==='news-recipients'?campaign.review?.recipients||[]:[...campaign.history].reverse();
    const list=pageOf(rows.filter(r=>matches(q.q,r.name,r.id,r.status,r.result,r.event,r.actor)),q);return {items:list.items,pagination:list.pagination};
  }
  if(resource==='customers'){
    if(!registry)throw new PageError(503,'ยังไม่เปิดทะเบียนลูกค้า');
    const all=registry.customers.filter(c=>matches(q.q,customerName(c),c.displayName,c.identity.user,c.profile.email,c.profile.phone,c.profile.organization,c.id,c.identity.scope,...c.tags)
      &&(!q.group||c.groupIds.includes(q.group))&&(!q.tag||c.tags.includes(q.tag))&&(!q.consent||c.consent===q.consent)).sort(byNewest);
    const list=pageOf(all,q),selected=registry.customers.find(c=>c.id===q.selected);
    const groupCounts:Record<string,{total:number;subscribed:number}>=Object.fromEntries(registry.groups.map(g=>[g.id,{total:0,subscribed:0}]));
    for(const c of registry.customers)for(const id of c.groupIds)if(groupCounts[id]){groupCounts[id].total++;if(c.consent==='subscribed')groupCounts[id].subscribed++;}
    return {...registry,customers:list.items.map(c=>({...customerSummary(c),canRefreshLineProfile:s.profiles?.canRefresh(c)??false})),selectedCustomer:selected?{...selected,canRefreshLineProfile:s.profiles?.canRefresh(selected)??false}:null,pagination:list.pagination,totalCustomers:registry.customers.length,groupCounts};
  }
  if(resource==='conversations'){
    if(!registry)throw new PageError(503,'ยังไม่เปิดทะเบียนลูกค้า');
    const service=s.conversations,control=service?.control.snapshot()??null;
    const mode=(c:any)=>control?.modes[conversationKey(c)]||{human:false,waiting:undefined};
    const all=registry.customers.filter(c=>c.identity.channel==='line'&&matches(q.q,customerName(c),c.displayName,c.identity.user,c.profile.fullName)
      &&(!q.status||q.status==='all'||q.status==='waiting'&&!!mode(c).waiting||q.status==='human'&&mode(c).human||q.status==='bot'&&!mode(c).human&&!mode(c).waiting))
      .sort((a,b)=>Number(!!mode(b).waiting)-Number(!!mode(a).waiting)||(mode(a).waiting&&mode(b).waiting?mode(a).waiting!.requestedAt.localeCompare(mode(b).waiting!.requestedAt):byNewest(a,b))||a.id.localeCompare(b.id));
    const list=pageOf(all,q),selected=registry.customers.find(c=>conversationKey(c)===q.selected),key=selected&&conversationKey(selected);
    const relevant=events.filter(e=>JSON.stringify([e.account,e.userId])===key).map(e=>({...e,source:'monitor'}));
    const emails=staffEmails(s.staff);
    const deliveries=(control?.deliveries||[]).filter(d=>d.key===key).map(d=>({...d,actorEmail:emails.get(d.actor),source:'staff'}));
    const combined=olderMessages<any>([...relevant,...deliveries],q,r=>JSON.stringify([r.source,r.id,r.direction]));
    const relevantKeys=new Set([...list.items,...(selected?[selected]:[])].map(conversationKey));
    const recent=!!selected&&relevant.some(e=>e.direction==='in'&&Date.now()-Date.parse(e.at)>=0&&Date.now()-Date.parse(e.at)<7*86400000);
    return {...registry,customers:list.items.map(customerSummary),selectedCustomer:selected||null,events:combined.items.filter(e=>e.source==='monitor'),
      requests:selected?jobs.filter(r=>identityKey(r)===customerKey(selected)):[],control:control?{...control,modes:Object.fromEntries(Object.entries(control.modes).filter(([k])=>relevantKeys.has(k)).map(([k,m])=>[k,{...m,actorEmail:k===key&&m.actor?emails.get(m.actor):undefined}])),deliveries:combined.items.filter(e=>e.source==='staff')}:null,
      allowedUsers:selected&&service?.allowedUsers.has(selected.identity.user)?[selected.identity.user]:[],sendEnabled:!!service&&!service.dryRun,account:service?.account||'',selectedRecent:recent,
      waitingCount:registry.customers.filter(c=>c.identity.channel==='line'&&mode(c).waiting).length,messagesPage:combined.messagesPage,pagination:list.pagination};
  }
  if(resource==='requests'){
    const state=s.work.snapshot(),byId=new Map(registry?.customers.map(c=>[c.id,c])||[]);
    const all=state.requests.filter(r=>(!q.kind||r.kind===q.kind)&&(!q.status||r.work.status===q.status)&&matches(q.q,r.id,byId.has(r.customerId)?customerName(byId.get(r.customerId)):r.owner.user,r.course?.name,r.message,r.work.assignee)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
    const list=pageOf(all,q),selected=state.requests.find(r=>r.id===q.selected),ids=new Set([...list.items,...(selected?[selected]:[])].map(r=>r.customerId));
    return {...state,requests:list.items.map(r=>({...r,work:{...r.work,timeline:[]}})),selectedRequest:selected||null,customers:(registry?.customers||[]).filter(c=>ids.has(c.id)).map(customerSummary),pagination:list.pagination,totalRequests:state.requests.length};
  }
  if(resource==='news'){
    if(!s.news)throw new PageError(503,'ยังไม่เปิดส่งข่าว');
    const state=s.news.snapshot(false),all=state.campaigns.filter(c=>(!q.status||c.status===q.status)&&matches(q.q,c.title,c.text)).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)),list=pageOf(all,q);
    const selected=state.campaigns.find(c=>c.id===q.selected);
    const detail=selected?{...selected,history:[],deliveries:[],deliveryTotal:selected.deliveries.length,deliveryCounts:selected.deliveries.reduce((counts:Record<string,number>,d)=>{counts[d.status]=(counts[d.status]||0)+1;return counts},{}),review:selected.review?{...selected.review,recipients:[],recipientTotal:selected.review.recipients.length,roomCount:selected.review.recipients.filter(r=>r.kind==='room').length}:undefined}:null;
    return {...state,customers:[],groups:[],lineRooms:[],campaigns:list.items.map(c=>({...c,text:'',selection:{customerIds:[],groupIds:[],lineRoomIds:[]},history:[],deliveries:[],review:undefined})),selectedCampaign:detail,pagination:list.pagination};
  }
  throw new PageError(404,'ไม่พบรายการ');
}
export function browseHandler(s:Sources){return async(req:IncomingMessage,res:ServerResponse)=>{
  const reply=(status:number,data:unknown)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}).end(JSON.stringify(data));
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)||(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(String(req.headers['sec-fetch-site']))))return reply(403,{error:'ไม่อนุญาตคำขอข้ามเว็บ'});
  if(req.method!=='GET')return reply(405,{error:'รองรับเฉพาะอ่านรายการ'});
  try{const u=new URL(req.url||'','http://127.0.0.1'),resource=u.pathname.slice('/api/browse/'.length),query=pageQuery(req.url||'');
    let snapshot=browseSnapshot(resource,query,s);
    if(s.profiles&&['customers','conversations'].includes(resource)){
      // Refresh only the visible page plus the separately selected customer.
      // Existing profile client bounds calls, caches names and backs off failures.
      const candidates=[...(snapshot.selectedCustomer?[snapshot.selectedCustomer]:[]),...snapshot.customers];
      await s.profiles.refreshDue([...new Map(candidates.map(c=>[c.id,c])).values()]);
      snapshot=browseSnapshot(resource,query,s);
    }
    return reply(200,snapshot)}catch(e){return reply(e instanceof PageError?e.status:503,{error:e instanceof PageError?e.message:'อ่านรายการไม่ได้ กรุณาลองใหม่'});}
};}
