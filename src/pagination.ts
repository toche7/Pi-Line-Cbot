export class PageError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export type PageQuery = { page: number; size: number; q: string; selected: string; status: string; group: string; tag: string; consent: string; kind: string; before: string };
export function pageQuery(url: string): PageQuery {
  const params = new URL(url, 'http://127.0.0.1').searchParams;
  const allowed = new Set(['page','size','q','selected','status','group','tag','consent','kind','before']);
  for (const key of params.keys()) if (!allowed.has(key) || params.getAll(key).length !== 1) throw new PageError(400,'ตัวกรองไม่ถูกต้อง');
  const number = (key: string, fallback: number, max: number) => {
    const raw=params.get(key); if(raw===null)return fallback;
    if(!/^[1-9][0-9]{0,6}$/.test(raw))throw new PageError(400,'เลขหน้าและขนาดหน้าต้องเป็นจำนวนเต็มบวก');
    const n=Number(raw);if(n>max)throw new PageError(400,'เลขหน้าหรือขนาดหน้าเกินกำหนด');return n;
  };
  const text=(key:string,max=250)=>{const value=params.get(key)||'';if(value.length>max||/[\u0000-\u001f]/.test(value))throw new PageError(400,'ตัวกรองยาวหรือมีอักขระไม่ถูกต้อง');return value;};
  return {page:number('page',1,1000000),size:number('size',25,100),q:text('q').trim().toLocaleLowerCase(),selected:text('selected',300),status:text('status',50),group:text('group'),tag:text('tag'),consent:text('consent',30),kind:text('kind',30),before:text('before',500)};
}
export function pageOf<T>(items: T[], query: Pick<PageQuery,'page'|'size'>) {
  const total=items.length,pages=Math.max(1,Math.ceil(total/query.size)),page=Math.min(query.page,pages),start=(page-1)*query.size;
  return {items:items.slice(start,start+query.size),pagination:{page,size:query.size,total,pages,from:total?start+1:0,to:Math.min(start+query.size,total),hasNext:page<pages,hasPrevious:page>1}};
}
export const matches = (q:string,...values:unknown[]) => !q || values.filter(v=>v!==undefined&&v!==null).join(' ').toLocaleLowerCase().includes(q);
export const customerName = (c:any):string => c.profile?.nickname||c.profile?.fullName||c.displayName||c.identity?.user||c.id||'';
export const customerSummary = (c:any) => ({...c,notes:[],profileHistory:[],consentHistory:[],provenance:{}});
export function olderMessages<T extends {at:string}>(items:T[],query:PageQuery,key:(row:T)=>string){
  const rows=items.map(row=>({row,key:key(row)})).sort((a,b)=>a.row.at.localeCompare(b.row.at)||a.key.localeCompare(b.key));
  let before:{at:string;key:string}|undefined;
  if(query.before){try{before=JSON.parse(Buffer.from(query.before,'base64url').toString('utf8'));if(!before||typeof before.at!=='string'||typeof before.key!=='string'||!Number.isFinite(Date.parse(before.at))||before.key.length>250)throw Error();}catch{throw new PageError(400,'ตำแหน่งข้อความไม่ถูกต้อง');}}
  const eligible=before?rows.filter(v=>v.row.at<before!.at||v.row.at===before!.at&&v.key<before!.key):rows;
  const chunk=eligible.slice(-query.size),first=chunk[0];
  return {items:chunk.map(v=>v.row),messagesPage:{total:rows.length,hasOlder:eligible.length>chunk.length,before:first?Buffer.from(JSON.stringify({at:first.row.at,key:first.key})).toString('base64url'):null}};
}
