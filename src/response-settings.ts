import { currentStaffActor, staffIdentity, validStoredActor } from './staff-context.js';
import { mkdirSync, chmodSync, lstatSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { requestTimeout } from './diagnostics.js';

export type ResponseConfig = { provider: string; model: string; personality: string; instructions: string; limits: { inputChars: number; maxTokens: number; lineTimeoutMs: number; terminalTimeoutMs: number; modelCalls: number; toolCalls: number } };
export type SettingsBinding = { version: string; config: ResponseConfig };
export type SettingsTrial = { at: number; configDigest: string; context: string; question: string; activeAnswer: string; draftAnswer: string; activeTokens: number; draftTokens: number; activeVersion: string };
type Review = { at: number; revision: number; digest: string; context: string };
type Version = SettingsBinding & { at: number; actor: string; event: string; digest: string };
type State = { schema: 1; revision: number; active: string; draft: ResponseConfig; versions: Version[]; trial?: SettingsTrial; review?: Review; history: { at: number; actor: string; event: string }[] };
export const settingsActor = 'ผู้ใช้บนเครื่องนี้ (ยังไม่มี login)';
export class SettingsError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export const settingsFail = (message: string, status = 400): never => { throw new SettingsError(status, message); };
export const settingsHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex');
export function settingsKeys(value: any, allowed: string[]) { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value)) || Object.keys(value).some(k => !allowed.includes(k))) settingsFail('ข้อมูลมีช่องที่ไม่รองรับ'); }
export function settingsText(v: unknown, max: number, required = false): string { if (typeof v !== 'string' || v.length > max || (required && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) return settingsFail('ข้อความไม่ถูกต้องหรือยาวเกินกำหนด'); return v.trim(); }
function integer(v: any, min: number, max: number) { if (!Number.isSafeInteger(v) || v < min || v > max) settingsFail(`ค่าต้องเป็นจำนวนเต็ม ${min}–${max}`); return v as number; }
export function validateResponseConfig(v: unknown): ResponseConfig {
  settingsKeys(v,['provider','model','personality','instructions','limits']); const x = v as ResponseConfig;
  const provider = settingsText(x.provider,80,true), model = settingsText(x.model,120,true);
  if (!/^[a-zA-Z0-9._-]+$/.test(provider) || !/^[a-zA-Z0-9._:/-]+$/.test(model) || /^sk-/i.test(provider+model)) settingsFail('provider/model ไม่ถูกต้อง');
  const personality = settingsText(x.personality,800), instructions = settingsText(x.instructions,1600);
  if (/\b(?:sk-[a-z0-9]{12,}|Bearer\s+\S+|(?:api[_ -]?key|access[_ -]?token|password|รหัสผ่าน)\s*[:=]\s*\S+)|-----BEGIN|\b\d{10,16}\b|ignore.{0,30}(?:instructions|policy)|(?:เพิ่มสิทธิ์|ข้ามสิทธิ์|ละเว้นคำสั่งระบบ)|(?:disable|bypass|override).{0,30}(?:guard|policy|safety|security)|(?:แสดง|เปิดเผย).{0,15}(?:ข้อมูลผู้เรียน|รหัสผ่าน|secret|credentials)|https?:\/\//i.test(personality+'\n'+instructions)) settingsFail('คำสั่งปรับได้เฉพาะน้ำเสียง/วิธีอธิบาย ไม่รับข้อมูลลับ URL หรือคำสั่งข้ามกติกา');
  settingsKeys(x.limits,['inputChars','maxTokens','lineTimeoutMs','terminalTimeoutMs','modelCalls','toolCalls']); const l=x.limits;
  return { provider,model,personality,instructions,limits:{inputChars:integer(l.inputChars,100,2000),maxTokens:integer(l.maxTokens,128,1600),lineTimeoutMs:integer(l.lineTimeoutMs,1000,25000),terminalTimeoutMs:integer(l.terminalTimeoutMs,1000,60000),modelCalls:integer(l.modelCalls,1,4),toolCalls:integer(l.toolCalls,0,4)} };
}
export function defaultResponseConfig(): ResponseConfig { const deadline=requestTimeout(process.env.PI_TIMEOUT_MS); return validateResponseConfig({provider:process.env.PI_PROVIDER||'groq',model:process.env.PI_MODEL||'qwen/qwen3.8-27b',personality:'',instructions:'',limits:{inputChars:2000,maxTokens:800,lineTimeoutMs:Math.min(deadline,25000),terminalTimeoutMs:Math.min(deadline,60000),modelCalls:4,toolCalls:4}}); }
const digest = (v: any) => typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
function validateState(s: any): State {
  settingsKeys(s,['schema','revision','active','draft','versions','trial','review','history']);
  if(s.schema!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.versions)||!s.versions.length||s.versions.length>30||!Array.isArray(s.history)||s.history.length>200)settingsFail('ที่เก็บตั้งค่าไม่ถูกต้อง');
  s.draft=validateResponseConfig(s.draft);const ids=new Set<string>();
  for(const v of s.versions){settingsKeys(v,['version','config','at','actor','event','digest']);settingsText(v.version,64,true);settingsText(v.actor,120,true);settingsText(v.event,120,true);integer(v.at,0,Number.MAX_SAFE_INTEGER);v.config=validateResponseConfig(v.config);if(v.digest!==settingsHash(v.config)||ids.has(v.version))settingsFail('checksum ตั้งค่าไม่ผ่าน');ids.add(v.version)}
  if(!ids.has(s.active))settingsFail('ไม่พบตั้งค่าที่ใช้งาน');
  for(const h of s.history){settingsKeys(h,['at','actor','event']);integer(h.at,0,Number.MAX_SAFE_INTEGER);settingsText(h.actor,120,true);settingsText(h.event,120,true)}
  if(s.trial){const t=s.trial;settingsKeys(t,['at','configDigest','context','question','activeAnswer','draftAnswer','activeTokens','draftTokens','activeVersion']);integer(t.at,0,Number.MAX_SAFE_INTEGER);if(t.configDigest!==settingsHash(s.draft)||!digest(t.context)||t.activeVersion!==s.active)settingsFail('ผลลองไม่ตรงร่าง');settingsText(t.question,1000,true);settingsText(t.activeAnswer,6000,true);settingsText(t.draftAnswer,6000,true);integer(t.activeTokens,0,1000000);integer(t.draftTokens,0,1000000)}
  if(s.review){settingsKeys(s.review,['at','revision','digest','context']);if(!s.trial||s.review.revision!==s.revision||s.review.digest!==settingsHash(s.draft)||s.review.context!==s.trial.context)settingsFail('ผลตรวจไม่ตรงร่าง');integer(s.review.at,0,Number.MAX_SAFE_INTEGER)}
  return s;
}
export class ResponseSettingsStore {
  private file:string;private backup:string;private good:State;private initialized=false;private healthy=true;
  constructor(readonly root:string,baseline=defaultResponseConfig(),private now=()=>Date.now(),private beforeCommit?:()=>void){
    mkdirSync(root,{recursive:true,mode:0o700});if(lstatSync(root).isSymbolicLink())settingsFail('ที่เก็บตั้งค่าไม่ปลอดภัย',503);chmodSync(root,0o700);this.file=join(root,'settings.json');this.backup=join(root,'last-good.json');const config=validateResponseConfig(baseline);this.good={schema:1,revision:0,active:'initial',draft:structuredClone(config),versions:[{version:'initial',config,at:now(),actor:'ค่าเดิมก่อนเปิดหน้าตั้งค่า',event:'initial',digest:settingsHash(config)}],history:[]};this.read();this.initialized=true;
  }
  private load(path:string){const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2_000_000)throw Error();return validateState(JSON.parse(readFileSync(path,'utf8')))}
  private read():State{try{const s=this.load(this.file);this.good=structuredClone(s);this.healthy=true;return s}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT'){try{lstatSync(this.backup)}catch(err){if((err as NodeJS.ErrnoException).code==='ENOENT'&&this.good.revision===0)return structuredClone(this.good)}}this.healthy=false;let recovered=false;try{const b=this.load(this.backup);if(b.revision>=this.good.revision)this.good=b;recovered=true}catch{}if(!recovered&&!this.initialized)settingsFail('ที่เก็บตั้งค่าเสียและไม่มี last-good ไม่เขียนทับ',503);return structuredClone(this.good)}}
  snapshot(){const s=this.read();return {...structuredClone(s),healthy:this.healthy,actor:currentStaffActor(settingsActor),warning:this.healthy?'':'ที่เก็บตั้งค่าเสีย/หาย ใช้ last-good แบบอ่านอย่างเดียว กรุณากู้ไฟล์ก่อนแก้หรือใช้ค่าใหม่'};}
  binding():SettingsBinding{const s=this.read(),v=s.versions.find(v=>v.version===s.active)!;return {version:v.version,config:structuredClone(v.config)}}
  private atomic(path:string,json:string){const tmp=join(this.root,'.'+randomUUID()+'.tmp');let fd:number|undefined;try{fd=openSync(tmp,'wx',0o600);writeFileSync(fd,json);fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(tmp,path)}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(tmp)}catch{}}}
  private transaction(revision:number,run:(s:State)=>void){const path=join(this.root,'.write-lock');let fd:number;try{fd=openSync(path,'wx',0o600)}catch{return settingsFail('ตั้งค่ากำลังถูกบันทึก กรุณาลองใหม่',409)}try{const s=this.read();if(!this.healthy)settingsFail('ที่เก็บตั้งค่าเสีย ไม่เขียนทับข้อมูลเดิม',503);if(s.revision!==revision)settingsFail('ตั้งค่าเปลี่ยนแล้ว โหลดล่าสุดก่อน ข้อความที่กรอกยังอยู่',409);run(s);s.revision++;s.history=s.history.slice(-200);validateState(s);const json=JSON.stringify(s);if(Buffer.byteLength(json)>2_000_000)settingsFail('ที่เก็บตั้งค่าเต็ม',413);this.beforeCommit?.();this.atomic(this.file,json);this.good=structuredClone(s);try{this.atomic(this.backup,json);const d=openSync(this.root,'r');try{fsyncSync(d)}finally{closeSync(d)}}catch{}return this.snapshot()}finally{closeSync(fd);unlinkSync(path)}}
  beginTrial(revision:number){return this.transaction(revision,s=>{delete s.trial;delete s.review;s.history.push({at:this.now(),actor:currentStaffActor(settingsActor),event:'trial-start'})})}
  recordTrial(revision:number,trial:SettingsTrial){return this.transaction(revision,s=>{if(trial.configDigest!==settingsHash(s.draft)||trial.activeVersion!==s.active)settingsFail('ร่างเปลี่ยนระหว่างลอง กรุณาลองใหม่',409);s.trial=structuredClone(trial);delete s.review;s.history.push({at:this.now(),actor:currentStaffActor(settingsActor),event:'trial-model-success'})})}
  mutate(input:any,context:string){settingsKeys(input,['action','revision','config','version','digest','confirm']);return this.transaction(input.revision,s=>{let event=settingsText(input.action,30,true);if(input.action==='save'){s.draft=validateResponseConfig(input.config);delete s.trial;delete s.review}else if(input.action==='restore'){const v=s.versions.find(v=>v.version===input.version);if(!v)settingsFail('ไม่พบเวอร์ชัน',404);s.draft=structuredClone(v!.config);delete s.trial;delete s.review;event='restore:'+v!.version}else if(input.action==='review'||input.action==='apply'){if(!s.trial||s.trial.configDigest!==settingsHash(s.draft)||s.trial.context!==context||s.trial.activeVersion!==s.active||this.now()-s.trial.at>15*60000)settingsFail('ต้องลองโมเดลกับร่างล่าสุดก่อน ผลลองหมดอายุเมื่อความรู้/กติกาเปลี่ยนหรือเกิน 15 นาที',409);if(input.action==='review'){s.review={at:this.now(),revision:s.revision+1,digest:settingsHash(s.draft),context}}else{if(input.confirm!==true||!s.review||s.review.revision!==s.revision||input.digest!==s.review.digest||s.review.context!==context)settingsFail('ต้องตรวจร่างล่าสุดและยืนยันใช้จริงอย่างชัดเจน',409);const v:Version={version:randomUUID(),config:structuredClone(s.draft),at:this.now(),actor:currentStaffActor(settingsActor),event:'apply',digest:settingsHash(s.draft)};s.versions.push(v);s.versions=s.versions.slice(-30);s.active=v.version;delete s.trial;delete s.review}}else settingsFail('ไม่รองรับคำสั่งตั้งค่า');s.history.push({at:this.now(),actor:currentStaffActor(settingsActor),event})})}
}
let settingsStore:ResponseSettingsStore|undefined;
export function configureResponseSettings(store?:ResponseSettingsStore){settingsStore=store}
export function captureResponseSettings():SettingsBinding|undefined{return settingsStore?.binding()}
