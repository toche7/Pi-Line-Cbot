// Reusable disposable test data only. Never reads .env or real runtime.
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CustomerStore } from '../dist/customers.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { CourseRequestStore } from '../dist/course-requests.js';
import { RequestWorkStore } from '../dist/request-work.js';
import { ConversationControl } from '../dist/conversation-control.js';
import { NewsService,NewsStore } from '../dist/news.js';
import { LineGroupStore,LineGroupService } from '../dist/line-groups.js';
import { PendingLineUsers } from '../dist/line-pending-users.js';
import { LineAccess } from '../dist/line-access.js';
import { StaffStore } from '../dist/staff-store.js';
import { KnowledgeStore } from '../dist/knowledge-store.js';
export function paginationFixture(){
 const root=mkdtempSync(join(tmpdir(),'cbot-pagination-')),at=new Date().toISOString(),account='fixture-oa';
 const monitor=new ConversationMonitor(join(root,'monitor')),customers=new CustomerStore(join(root,'customers')),requests=new CourseRequestStore(join(root,'requests')),work=new RequestWorkStore(join(root,'request-work'),requests);
 const userId=i=>'U'+i.toString(16).padStart(32,'0');
 for(let i=0;i<120;i++)monitor.record({id:randomUUID(),account,userId:userId(i),direction:'in',text:'Message fixture '+i,at,status:'received'});
 customers.snapshot({events:monitor.snapshot().events,requests:[]});
 const file=join(root,'customers','customers.json'),raw=JSON.parse(readFileSync(file,'utf8'));
 raw.groups=[{id:'fixture-group',name:'Fixture group',description:'Fixture only',createdAt:at,updatedAt:at,actor:'fixture'}];
 raw.customers.forEach(c=>{const i=parseInt(c.identity.user.slice(1),16);c.profile.nickname='Customer '+String(i).padStart(3,'0');c.tags=[i%2?'odd':'even'];c.groupIds=i<80?['fixture-group']:[];c.consentHistory=[{status:'subscribed',evidence:'fixture consent only',at,actor:'fixture'}]});writeFileSync(file,JSON.stringify(raw));
 const all=customers.snapshot({events:[],requests:[]}).customers;
 for(let i=0;i<75;i++){const c=all.find(c=>c.identity.user===userId(i));requests.save({version:1,id:randomUUID(),kind:'contact',createdAt:at,owner:c.identity,course:null,message:'Request fixture '+String(i).padStart(3,'0'),status:'pending_team',delivery:{channel:null,status:'not_selected'},sourceSha256:'a'.repeat(64)})}
 const allowedUsers=new Set(all.map(c=>c.identity.user)),control=new ConversationControl(join(root,'control'));
 for(let i=0;i<120;i++)monitor.record({id:randomUUID(),account,userId:userId(0),direction:i%2?'in':'out',text:'Thread message '+String(i).padStart(3,'0'),at,status:i%2?'received':'replied'});
 const news=new NewsService(new NewsStore(join(root,'news')),customers,account);
 for(let i=0;i<80;i++)news.mutate({action:'create',title:'Campaign '+String(i).padStart(3,'0'),text:'Campaign fixture '+i,customerIds:[],groupIds:[]});
 const selectedNews=news.mutate({action:'create',title:'Selected campaign',text:'Never sent fixture',customerIds:all.filter(c=>parseInt(c.identity.user.slice(1),16)<60).map(c=>c.id),groupIds:['fixture-group']});
 news.mutate({action:'review',id:selectedNews.id,revision:selectedNews.revision});
 const groupStore=new LineGroupStore(join(root,'rooms'),account);
 for(let i=0;i<45;i++)groupStore.observe({groupId:'C'+i.toString(16).padStart(32,'0'),type:'message',eventId:randomUUID(),at,userId:userId(i),text:'Room fixture '+i});
 const roomId='C'+'0'.repeat(32);for(let i=0;i<120;i++)groupStore.observe({groupId:roomId,type:'message',eventId:String(i).padStart(4,'0'),at,userId:userId(0),text:'Old room message '+i});
 const rooms=new LineGroupService(groupStore,'fixture-only',async()=>new Response('{}',{status:503}));
 const pendingStore=new PendingLineUsers(join(root,'pending'));for(let i=5000;i<5040;i++)pendingStore.record(account,userId(i));
 const access=new LineAccess(join(root,'access'),account,allowedUsers),pending={store:pendingStore,account,allowedUsers,access};
 const staff=new StaffStore(join(root,'staff'),'owner@example.test'),owner=staff.identity('fixture-owner','owner@example.test');
 for(let i=0;i<45;i++)staff.mutate(owner,{action:'invite',revision:staff.snapshot().revision,email:'staff'+String(i).padStart(3,'0')+'@example.test',role:'staff',enabled:true,extras:[]});
 const knowledge=new KnowledgeStore(join(root,'knowledge'));
 for(let i=0;i<55;i++)knowledge.mutate({action:'save',revision:knowledge.snapshot().revision,entry:{id:'fixture-'+String(i).padStart(3,'0'),title:'FAQ '+String(i).padStart(3,'0'),terms:['fixture'],text:'Public fixture answer '+i,source:'https://cbtumu.net/faq/',capturedAt:at,reviewedAt:at,conflict:false,conflictNote:'',retired:false}});
 return {root,monitor,customers,requests,work,conversations:{control,account,allowedUsers,dryRun:true,push:async()=>{throw Error('No transport in fixture')}},news,rooms,pending,staff,knowledge,all,selectedNewsId:selectedNews.id,roomId,clean:()=>rmSync(root,{recursive:true,force:true})};
}
