import { readFileSync } from 'node:fs';
export type BuildInfo = { code: string; builtAt: string };
const cleanLabel = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 100);
export function versionReply(info: unknown, server: { name: string; environment: string }) {
  const data=info as Partial<BuildInfo>|null;
  const valid=data && typeof data.code==='string' && /^[a-f0-9]{64}$/.test(data.code)
    && typeof data.builtAt==='string' && Number.isFinite(Date.parse(data.builtAt));
  return ['CBot · เวอร์ชันโปรแกรม',
    valid?'รุ่นโค้ด: '+data.code!.slice(0,12):'รุ่นโค้ด: ไม่ระบุ (ยังไม่มีข้อมูล build)',
    ...(valid?['สร้างเมื่อ: '+new Date(data.builtAt!).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' (เวลาไทย)']:[]),
    'เซิร์ฟเวอร์: '+cleanLabel(server.name),'สภาพแวดล้อม: '+cleanLabel(server.environment)].join('\n');
}
let buildMetadata:unknown;try{buildMetadata=JSON.parse(readFileSync(new URL('./build-info.json',import.meta.url),'utf8'))}catch{}
export function currentBuildInfo(): BuildInfo | undefined {
  const value=buildMetadata as Partial<BuildInfo>|undefined;
  return value && typeof value.code==='string' && /^[a-f0-9]{64}$/.test(value.code) && typeof value.builtAt==='string' && Number.isFinite(Date.parse(value.builtAt)) ? {code:value.code,builtAt:value.builtAt} : undefined;
}
// Read once at process startup: never claim the current checkout is running code.
export function runningVersion(server: {name:string;environment:string}) {
  return versionReply(currentBuildInfo(),server);
}
