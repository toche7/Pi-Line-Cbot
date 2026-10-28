// Independent module QA; temporary loopback listener and stores only. No external requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CustomerStore } from '../dist/customers.js';
import { NewsService, NewsStore } from '../dist/news.js';
import { adminHandler } from '../dist/admin.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { CourseRequestStore } from '../dist/course-requests.js';
import { newsHandler } from '../dist/news-api.js';
import { newsBody, newsStyle, newsScript } from '../dist/news-admin.js';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=mkdtempSync(join(tmpdir(),'news-ui-'));
const customers=new CustomerStore(join(root,'customers'));
let cs=customers.snapshot({events:[],requests:['A','B','C'].map(user=>({owner:{channel:'line',scope:'mock:direct',user}}))});
function change(id,action,data){customers.mutate({revision:cs.revision,id,action,data});cs=customers.snapshot({events:[],requests:[]})}
for(const [i,c] of cs.customers.entries()){change(c.id,'profile.update',{profile:{nickname:['ลูกค้ารับข่าว (จำลอง)','ลูกค้าไม่รับข่าว (จำลอง)','ยังไม่ทราบ (จำลอง)'][i],fullName:'',email:'',phone:'',organization:''},source:'ทีมตั้งชื่อเรียก',reference:'fixture'});if(i<2)change(c.id,'consent.update',{status:i===0?'subscribed':'unsubscribed',evidence:'fixture only'})}
change('','group.create',{name:'กลุ่มทดสอบ',description:''});change(cs.groups[0].id,'group.members',{customerIds:cs.customers.map(c=>c.id)});
const before=JSON.stringify(cs);let calls=0;
let service=new NewsService(new NewsStore(join(root,'news')),customers,'mock');
const integrated=process.argv.includes('--integrated');
const monitor=new ConversationMonitor(join(root,'monitor')),requests=new CourseRequestStore(join(root,'requests'));
const buildHandler=()=>integrated?adminHandler(monitor,requests,customers,undefined,undefined,service):newsHandler(service,'qa');
let handler=buildHandler();
const html=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;margin:0;background:#f3f7fa}button{font:inherit}${newsStyle}</style><main id="news-panel">${newsBody}</main><script>const CUSTOMER_CSRF_TOKEN='qa';${newsScript}</script></html>`;
const server=createServer((req,res)=>{if(integrated)return handler(req,res);if(req.url==='/api/news')return void handler(req,res);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html)});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',route=>{if(new URL(route.request().url()).origin===url)route.continue();else{calls++;route.abort()}});
 await page.goto(url+(integrated?'/#news':''));if(integrated){assert.equal(await page.getByRole('tab').count(),5);for(const name of ['บทสนทนา','ลูกค้าและกลุ่ม','งานรอดูแล','ส่งข่าว']){await page.getByRole('tab',{name,exact:true}).click()}await page.locator('#news-panel').waitFor({state:'visible'})}const panel=page.locator('#news-panel'),button=name=>panel.getByRole('button',{name,exact:true});
 await button('สร้างข่าว').click();await page.getByLabel('ชื่อข่าว (ใช้ภายในทีม)').fill('ข่าวทดสอบใน temp');await page.getByLabel('ข้อความถึงลูกค้า').fill('<script>alert(1)</script> เรียนรู้ AI กับ CBTU');await page.getByLabel('กลุ่มทดสอบ',{exact:true}).check();await page.getByLabel('ลูกค้ารับข่าว (จำลอง) · รับข่าว',{exact:true}).check();
 await button('บันทึกฉบับร่าง').click();await button('ตรวจผู้รับจริงและตัวอย่าง').click();await panel.getByText('ผู้รับจริง 1 คน · ไม่เข้าเงื่อนไข 2 คน',{exact:true}).waitFor();
 assert.equal(await button('ยืนยันส่ง 1 คน').isDisabled(),true);assert.equal(await panel.locator('script').count(),0);assert.equal(await page.locator('#news-preview').textContent(),'<script>alert(1)</script> เรียนรู้ AI กับ CBTU');
 await panel.getByText('ตรวจรายชื่อผู้รับทั้งหมด',{exact:true}).click();assert.ok((await panel.textContent()).includes('ลูกค้ารับข่าว (จำลอง) · C-'));
 const screenshots=resolve('design/news');mkdirSync(screenshots,{recursive:true});await page.screenshot({path:join(screenshots,'implemented-news-test-data.png'),fullPage:true});
 await page.getByLabel('ข้อความถึงลูกค้า').fill('เปลี่ยนข้อความหลังตรวจ');assert.equal(await button('ตรวจผู้รับจริงและตัวอย่าง').isDisabled(),true);assert.equal(await button('ยืนยันส่ง 1 คน').isVisible(),false);await button('บันทึกฉบับร่าง').click();await button('ตรวจผู้รับจริงและตัวอย่าง').click();
 // Stale revision leaves typed content intact.
 const c=service.store.list()[0];service.mutate({action:'save',id:c.id,revision:c.revision,title:'another editor',text:c.text,customerIds:c.selection.customerIds,groupIds:c.selection.groupIds});await page.getByLabel('ข้อความถึงลูกค้า').fill('ข้อความที่ยังอยู่');await button('บันทึกฉบับร่าง').click();await page.locator('#news-status').filter({hasText:'ข้อมูลเปลี่ยนแล้ว'}).waitFor();assert.equal(await page.getByLabel('ข้อความถึงลูกค้า').inputValue(),'ข้อความที่ยังอยู่');
 await button('โหลดล่าสุด').click();await page.reload();await page.getByRole('button',{name:'another editor · ฉบับร่าง',exact:true}).click();assert.equal(await page.getByLabel('ข้อความถึงลูกค้า').inputValue(),'เปลี่ยนข้อความหลังตรวจ');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(screenshots,'implemented-news-mobile-test-data.png'),fullPage:true});
 // Owner authorization is injected by the test host, never through the browser API.
 let mockSends=0;service=new NewsService(service.store,customers,'mock',async()=>{mockSends++;return {status:200,requestId:'MOCK-ACCEPTED'}});handler=buildHandler();if(integrated){await page.reload();await page.getByRole('button',{name:'another editor · ฉบับร่าง',exact:true}).click()}
 await button('ตรวจผู้รับจริงและตัวอย่าง').click();await panel.getByText('ผู้รับจริง 1 คน · ไม่เข้าเงื่อนไข 2 คน',{exact:true}).waitFor();assert.equal(await button('ยืนยันส่ง 1 คน').isDisabled(),true);let reviewed=service.store.list()[0];
 service.authorizeCampaign(reviewed.id,reviewed.review.digest);await button('โหลดล่าสุด').click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('#news-editor button')).some(b=>b.textContent==='ยืนยันส่ง 1 คน'&&!b.disabled));assert.equal(await button('ยืนยันส่ง 1 คน').isEnabled(),true);await button('ยืนยันส่ง 1 คน').click();await panel.getByText('อยู่ในคิว',{exact:true}).waitFor();
 await Promise.all([service.tick(),service.tick()]);await button('โหลดล่าสุด').click();await panel.getByText('สิ้นสุด',{exact:true}).waitFor();assert.equal(mockSends,1);assert.equal(service.store.list()[0].deliveries[0].status,'accepted');assert.ok((await panel.textContent()).includes('ไม่ได้ยืนยันว่าลูกค้าได้รับหรืออ่าน'));
 assert.equal(JSON.stringify(customers.snapshot({events:[],requests:[]})),before);assert.equal(calls,0);assert.deepEqual(errors,[]);
 console.log('PASS news '+(integrated?'integrated five-tab ':'')+'browser: draft/reload, group+person dedupe, consent filter, safe preview, actual recipients, disabled sending, mock owner grant/confirm/accepted result, edit invalidation, stale form preservation, mobile. Temp stores only; zero external requests.');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true})}
