import { createDemo } from './agent.js';
import { runDialogue } from './dialogue.js';
import { cbtuPolicy } from './knowledge.js';
import { activeKnowledge } from './knowledge-store.js';
import { courseCatalog } from './course-catalog.js';
import { safeMemoryInput } from './memory-request.js';
import { safeText } from './memory.js';
import { failureCategory } from './diagnostics.js';
import { ResponseSettingsStore, settingsFail, settingsHash, settingsKeys, settingsText, validateResponseConfig, type SettingsBinding } from './response-settings.js';
import { discoverResponseModels, validateResponseModel, type ResponseModel } from './response-models.js';
export type SettingsModelResult = { answer:string; tokens:number };
export type SettingsRunner = { run:(binding:SettingsBinding,question:string,signal:AbortSignal)=>Promise<SettingsModelResult>; prepare:(binding:SettingsBinding)=>Promise<void> };
export const settingsRunner:SettingsRunner={
  async run(binding,question,signal){
    const {session}=await createDemo({settings:binding});
    const abort=()=>{void session.abort().catch(()=>{})};signal.addEventListener('abort',abort,{once:true});
    try{if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);const answer=await runDialogue(session,question,binding.config.limits.lineTimeoutMs,{text:()=>{},status:()=>{}});if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);const tokens=session.messages.filter(m=>m.role==='assistant').reduce((n,m)=>n+(m.usage?.totalTokens||0),0);return {answer:safeText(answer).slice(0,6000),tokens:Math.min(1000000,Math.max(0,Math.floor(tokens)))}}finally{signal.removeEventListener('abort',abort);session.dispose()}
  },
  async prepare(binding){const {session}=await createDemo({settings:binding});session.dispose()},
};
export class ResponseSettingsService {
  private busy=false;private lastTrialAt=-Infinity;
  constructor(readonly store:ResponseSettingsStore,private models:()=>Promise<ResponseModel[]>=discoverResponseModels,private runner:SettingsRunner=settingsRunner,private now=()=>Date.now()){}
  context(){return settingsHash({policy:cbtuPolicy,hostContract:'response-settings-v1-fixed-tools-json-host-grounding',knowledge:activeKnowledge(),catalog:courseCatalog.sourceSha256})}
  async snapshot(){const s=this.store.snapshot(),models=await this.models(),active=s.versions.find(v=>v.version===s.active)!.config,context=this.context();return {...s,models,context,fixedPolicy:cbtuPolicy,trialValid:!!s.trial&&s.trial.context===context&&this.now()-s.trial.at<=15*60000,reviewValid:!!s.review&&s.review.context===context&&!!s.trial&&this.now()-s.trial.at<=15*60000,activeConfig:active,diff:JSON.stringify(active)===JSON.stringify(s.draft)?[]:['provider','model','personality','instructions','limits'].filter(k=>settingsHash(active[k as keyof typeof active])!==settingsHash(s.draft[k as keyof typeof active])),busy:this.busy,scope:'Terminal และ LINE: คำถามที่กำลังตอบใช้ค่าเดิม คำถามถัดไปใช้เวอร์ชันใหม่โดยสร้าง session จากความจำเดิม ไม่ล้าง memory; รอบลองโมเดลใช้ session ชั่วคราว ไม่ส่ง LINE ไม่เขียน memory และไม่จำลองคำขอหรือการค้นหลักสูตรเต็ม workflow'};}
  async mutate(input:any,signal:AbortSignal=new AbortController().signal){
    settingsKeys(input,['action','revision','config','version','digest','confirm','question','confirmQuota']);
    if(input.action==='trial'){
      if(input.confirmQuota!==true)settingsFail('ต้องยืนยันว่าการลองเรียก provider จริงและใช้โควตาก่อน',400);
      const question=settingsText(input.question,1000,true);if(safeMemoryInput(question)!==question)settingsFail('ห้ามใส่ข้อมูลลับหรือข้อมูลผู้เรียนในคำถามทดลอง');
      if(this.busy||this.now()-this.lastTrialAt<15000)settingsFail('มีการลองกำลังทำงานหรือเพิ่งลอง กรุณารอ 15 วินาที',429);
      let s=this.store.snapshot();if(!s.healthy)settingsFail('ที่เก็บตั้งค่าเสีย ไม่ลองหรือเขียนทับ',503);if(s.revision!==input.revision)settingsFail('ร่างเปลี่ยนแล้ว โหลดล่าสุดก่อนลอง',409);
      const models=await this.models();validateResponseModel(s.draft,models,true);const active=s.versions.find(v=>v.version===s.active)!;const context=this.context();
      if(this.busy||this.now()-this.lastTrialAt<15000)settingsFail('มีการลองกำลังทำงานหรือเพิ่งลอง กรุณารอ 15 วินาที',429);
      this.busy=true;this.lastTrialAt=this.now();
      try{
        s=this.store.beginTrial(s.revision);
        let current:SettingsModelResult;try{validateResponseModel(active.config,models,true);current=await this.runner.run({version:active.version,config:active.config},question,signal)}catch{if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);current={answer:'ค่าปัจจุบันลองไม่สำเร็จ อาจเกิดจาก credentials โควตา โมเดล หรือรูปแบบคำตอบ ไม่ได้เปลี่ยนค่าจริง',tokens:0}}
        if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);
        let draft:SettingsModelResult;try{draft=await this.runner.run({version:'draft:'+settingsHash(s.draft),config:s.draft},question,signal)}catch(e){if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);settingsFail('โมเดลร่างลองไม่สำเร็จ ('+failureCategory(e)+') ยังใช้ค่าใหม่ไม่ได้ ตรวจโมเดล/โควตา/ข้อจำกัดแล้วลองใหม่',409)}
        if(signal.aborted)settingsFail('ยกเลิกการลองแล้ว',409);if(context!==this.context())settingsFail('ความรู้หรือกติกาเปลี่ยนระหว่างลอง กรุณาลองใหม่',409);
        this.store.recordTrial(s.revision,{at:this.now(),configDigest:settingsHash(s.draft),context,question,activeAnswer:settingsText(current.answer,6000,true),draftAnswer:settingsText(draft!.answer,6000,true),activeTokens:current.tokens,draftTokens:draft!.tokens,activeVersion:active.version});
      }finally{this.busy=false}
    }else{
      const {action,revision,config,version,digest,confirm}=input;
      if(action==='save')validateResponseModel(validateResponseConfig(config),await this.models());
      if(action==='apply'){
        const s=this.store.snapshot();if(s.revision!==revision||!s.review||confirm!==true||digest!==s.review.digest)settingsFail('ต้องตรวจร่างล่าสุดและยืนยันใช้จริง',409);
        validateResponseModel(s.draft,await this.models(),true);
        try{await this.runner.prepare({version:'preflight',config:s.draft})}catch{settingsFail('โหลด session ของโมเดลร่างไม่ได้ คงค่าจริงเดิม',409)}
      }
      this.store.mutate({action,revision,...(config!==undefined?{config}:{}),...(version!==undefined?{version}:{}),...(digest!==undefined?{digest}:{}),...(confirm!==undefined?{confirm}:{})},this.context());
    }
    return this.snapshot();
  }
}
