// Temporary fixtures only. Run after build; uses an ephemeral loopback listener.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CourseRequestStore, CourseRequests } from '../dist/course-requests.js';
import { RequestWorkStore } from '../dist/request-work.js';
import { CustomerStore } from '../dist/customers.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { adminHandler } from '../dist/admin.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=mkdtempSync(join(tmpdir(),'cbtu-work-ui-')),requests=new CourseRequestStore(join(root,'requests')),work=new RequestWorkStore(join(root,'request-work'),requests),customers=new CustomerStore(join(root,'customers')),monitor=new ConversationMonitor(join(root,'monitor'));
const flow=new CourseRequests(requests),owner={channel:'line',scope:'fixture-oa:direct',user:'fixture-work-user'};
for(const text of ['/contact <img src=x onerror=alert(1)> ข้อความต้นทางทดสอบ','/book Excel']){const preview=flow.handle(owner,text);flow.handle(owner,'/confirm-request '+preview.match(/confirm-request ([A-F0-9]+)/)[1])}
const contact=requests.list().find(r=>r.kind==='contact'),booking=requests.list().find(r=>r.kind==='booking');
monitor.record({id:'work-fixture',account:'fixture-oa',userId:owner.user,direction:'in',text:'ข้อความบทสนทนาต้นทาง',status:'received',at:new Date().toISOString()});
let state=customers.snapshot({events:monitor.snapshot().events,requests:requests.list()});
customers.mutate({revision:state.revision,action:'profile.update',id:state.customers[0].id,data:{profile:{nickname:'ลูกค้าทดสอบงาน',fullName:'',email:'',phone:'',organization:''},source:'ทีมตรวจสอบ',reference:'temp fixture'}});
const before=JSON.stringify(requests.list());
const unified=adminHandler(monitor,requests,customers);
const server=createServer(unified);
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/#requests');const panel=page.locator('#requests-panel'),button=name=>panel.getByRole('button',{name,exact:true});
 await panel.locator('.task').first().waitFor();assert.equal(await page.getByRole('tab').count(),5);assert.equal(await panel.locator('.task').count(),2);
 await panel.getByLabel('ค้นหาคำขอ').fill('ลูกค้าทดสอบงาน');assert.equal(await panel.locator('.task').count(),2);
 await panel.getByLabel('สถานะงาน').selectOption('new');assert.equal(await panel.locator('.task').count(),2);await panel.getByLabel('ประเภทคำขอ').selectOption({value:'booking'});assert.equal(await panel.locator('.task').count(),1);await panel.getByLabel('ประเภทคำขอ').selectOption('contact');assert.equal(await panel.locator('.task').count(),1);await panel.locator('.task').click();
 await panel.getByText(contact.message,{exact:true}).last().waitFor();assert.equal(await panel.locator('img').count(),0);
 async function saved(fn){const response=page.waitForResponse(r=>r.url().endsWith('/api/requests')&&r.request().method()==='POST');await fn();await response;await page.waitForFunction(()=>document.getElementById('requests-status').textContent==='บันทึกแล้ว')}
 await saved(()=>button('รับงาน').click());assert.equal(work.snapshot().requests.find(r=>r.id===contact.id).work.status,'in_progress');
 await panel.getByLabel('ผู้รับผิดชอบ',{exact:true}).fill('ทีมหลักสูตร A');await saved(()=>button('มอบหมาย').click());
 await panel.getByLabel('บันทึกภายในงาน').fill('<script>window.injected=true</script> บันทึกภายใน');await saved(()=>button('บันทึกโน้ต').click());assert.equal(await page.evaluate(()=>window.injected),undefined);
 await saved(()=>button('เสร็จแล้ว').click());await panel.getByLabel('สถานะงาน').selectOption('done');assert.equal(await panel.locator('.task').count(),1);
 await page.reload();await panel.locator('.task').first().waitFor();await panel.getByLabel('ประเภทคำขอ').selectOption('contact');await panel.locator('.task').click();
 await panel.getByLabel('บันทึกภายในงาน').fill('โน้ตที่ต้องรักษาเมื่อชนกัน');const current=work.snapshot().requests.find(r=>r.id===contact.id);work.mutate({requestId:contact.id,customerId:current.customerId,revision:current.work.revision,operationId:randomUUID(),action:'assign',value:'อีกหน้าจอ'});
 await button('บันทึกโน้ต').click();await panel.getByText('งานเปลี่ยนแล้ว ข้อความโน้ตยังอยู่ ตรวจสถานะและประวัติล่าสุดก่อนทำรายการใหม่',{exact:true}).waitFor();assert.equal(await panel.getByLabel('บันทึกภายในงาน').inputValue(),'โน้ตที่ต้องรักษาเมื่อชนกัน');await saved(()=>button('ตรวจเทียบแล้ว ทำรายการที่ค้างกับฉบับล่าสุด').click());
 {await button('ดูโปรไฟล์ลูกค้า').click();await page.locator('#customers-panel').getByRole('heading',{name:'ลูกค้าทดสอบงาน',exact:true}).waitFor();await page.getByRole('tab',{name:'งานรอดูแล',exact:true}).click();await button('ดูบทสนทนา').click();await page.locator('#monitor-panel').getByText('ข้อความบทสนทนาต้นทาง',{exact:true}).waitFor();await page.getByRole('tab',{name:'งานรอดูแล',exact:true}).click()}
 // Server accepts a note but the browser loses the response: retry uses the same ID.
 await panel.getByLabel('บันทึกภายในงาน').fill('ทดสอบผลบันทึกที่ขาดการตอบกลับ');let drop=true;
 await page.route('**/api/requests',async route=>{if(drop&&route.request().method()==='POST'){drop=false;await route.fetch();await route.abort();return}await route.continue()});
 await button('บันทึกโน้ต').click();await button('ลองทำรายการเดิมอีกครั้ง').waitFor();const revision=work.snapshot().requests.find(r=>r.id===contact.id).work.revision;await saved(()=>button('ลองทำรายการเดิมอีกครั้ง').click());assert.equal(work.snapshot().requests.find(r=>r.id===contact.id).work.revision,revision);await page.unroute('**/api/requests');
 const output=resolve('design/request-work');mkdirSync(output,{recursive:true});await page.screenshot({path:join(output,'implemented-work-test-data.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'implemented-work-mobile-test-data.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(JSON.stringify(requests.list()),before);assert.deepEqual(errors,[]);
 requests.deleteOwner(owner);await button('โหลดล่าสุด').click();await panel.getByText('ยังไม่มีคำขอที่ยืนยันแล้ว',{exact:true}).waitFor();assert.equal(await panel.getByLabel('บันทึกภายในงาน').count(),0);
 console.log(JSON.stringify({ok:true,checks:'search/type/status/claim/assign/note/untrusted/conflict/reload/mobile/forget/source-unchanged'+'/profile/conversation',output}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true})}
