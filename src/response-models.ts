import { InMemoryCredentialStore } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { resolve } from 'node:path';
import { settingsFail, type ResponseConfig } from './response-settings.js';
export type ResponseModel = { provider:string; id:string; name:string; configured:boolean; maxTokens:number; text:boolean; api:string };
export async function discoverResponseModels():Promise<ResponseModel[]>{
  const runtime=await ModelRuntime.create({credentials:new InMemoryCredentialStore(),modelsPath:null,modelsStorePath:resolve('.pi-runtime/models.json'),allowModelNetwork:false});
  return runtime.getModels().map(m=>({provider:m.provider,id:m.id,name:m.name,configured:runtime.hasConfiguredAuth(m.provider),maxTokens:m.maxTokens,text:m.input.includes('text'),api:m.api}));
}
export function validateResponseModel(config:ResponseConfig,models:ResponseModel[],requireCredentials=false){const model=models.find(m=>m.provider===config.provider&&m.id===config.model);if(!model||!model.text)settingsFail('ไม่พบคู่ provider/model แบบข้อความใน SDK บนเครื่องนี้');if(config.limits.maxTokens>model!.maxTokens)settingsFail('maxTokens สูงกว่าที่โมเดลรองรับ');if(requireCredentials&&!model!.configured)settingsFail('ผู้ให้บริการนี้ยังไม่มี credentials ที่ตั้งพร้อมบนเครื่อง กรุณาตั้งแยกนอกหน้าเว็บ ไม่ส่ง key ผ่านแชต',409);return model!}
