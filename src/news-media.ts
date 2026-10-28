import {mkdirSync,lstatSync,chmodSync,readdirSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
export type NewsImage={id:string;sha256:string;bytes:number;url:string};
export function jpegDimensions(data:Buffer){
 if(data.length<16||data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217)throw Error('Invalid JPEG');
 let offset=2;
 while(offset+4<data.length){
  if(data[offset++]!==255)throw Error('Invalid JPEG marker');while(data[offset]===255)offset++;
  const marker=data[offset++];if(marker===218)break;
  const length=data.readUInt16BE(offset);if(length<2||offset+length>data.length)throw Error('Invalid JPEG segment');
  if([192,193,194].includes(marker)){if(length<8)throw Error('Invalid JPEG frame');const height=data.readUInt16BE(offset+3),width=data.readUInt16BE(offset+5);if(!width||!height||width>4096||height>4096)throw Error('Image dimensions too large');return {width,height};}
  offset+=length;
 }throw Error('JPEG frame missing');
}
export class NewsMediaStore{
 constructor(readonly root:string,readonly publicBase:string){
  mkdirSync(root,{recursive:true,mode:0o700});if(lstatSync(root).isSymbolicLink())throw Error('Unsafe media directory');chmodSync(root,0o700);
  if(publicBase){const u=new URL(publicBase);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error('Invalid image base');}
 }
 get ready(){return !!this.publicBase;}
 read(id:string){
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid image id');const path=join(this.root,id+'.jpg'),stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>900000)throw Error('Invalid image file');const data=readFileSync(path);jpegDimensions(data);return data;
 }
 upload(base64:unknown):NewsImage{
  if(!this.ready)throw Error('ยังไม่มี HTTPS สำหรับส่งรูป');
  if(typeof base64!=='string'||base64.length>1200000||!base64.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('ข้อมูลรูปไม่ถูกต้องหรือใหญ่เกินกำหนด');
  const data=Buffer.from(base64,'base64');if(data.toString('base64')!==base64||data.length>900000)throw Error('รูปเกิน 900 KB');jpegDimensions(data);
  // Reserve one bounded slot under a lock; orphaned uploads are private and consume a slot.
  const lock=join(this.root,'.upload-lock');let fd:number;try{fd=openSync(lock,'wx',0o600)}catch{throw Error('กำลังอัปโหลดรูป กรุณาลองใหม่')}
  let temp:string|undefined;
  try{if(readdirSync(this.root).filter(n=>/^[a-f0-9]{64}\.jpg$/.test(n)).length>=200)throw Error('ที่เก็บรูปเต็ม 200 รูป');const id=randomBytes(32).toString('hex');temp=join(this.root,'.'+id+'.tmp');const out=openSync(temp,'wx',0o600);try{writeFileSync(out,data);fsyncSync(out)}finally{closeSync(out)}renameSync(temp,join(this.root,id+'.jpg'));temp=undefined;const dir=openSync(this.root,'r');try{fsyncSync(dir)}finally{closeSync(dir)}return {id,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,url:this.publicBase+'/news-media/'+id+'.jpg'};
  }finally{if(temp)try{unlinkSync(temp)}catch{}closeSync(fd);unlinkSync(lock)}
 }
 verify(image:NewsImage){
  if(!this.ready||image.url!==this.publicBase+'/news-media/'+image.id+'.jpg')throw Error('ปลายทาง HTTPS ของรูปเปลี่ยน กรุณาแนบรูปและตรวจใหม่');
  const data=this.read(image.id);if(image.bytes!==data.length||image.sha256!==createHash('sha256').update(data).digest('hex'))throw Error('รูปเปลี่ยน กรุณาแนบใหม่');return data;
 }
}
