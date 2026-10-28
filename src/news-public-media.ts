import type {IncomingMessage,ServerResponse} from 'node:http';
import type {NewsService} from './news.js';
// This handler exposes only confirmed campaign JPEGs at unguessable URLs. No admin API.
export function newsPublicMedia(service:NewsService){return(req:IncomingMessage,res:ServerResponse)=>{
 const found=/^\/news-media\/([a-f0-9]{64})\.jpg$/.exec(req.url||'');
 if(!found||!['GET','HEAD'].includes(req.method||'')){res.writeHead(404).end();return;}
 try{const data=service.imageData(found[1],true);res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':data.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Referrer-Policy':'no-referrer'}).end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404,{'Cache-Control':'no-store'}).end();}
};}
// Read only the already-running tunnel for this exact webhook listener. Never alter config.
export async function newsImageBase(port:number,configured:string,fetcher:typeof fetch=fetch){
 try{if(configured){const u=new URL(configured);if(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password)return u.origin;return '';}
 const r=await fetcher('http://127.0.0.1:4040/api/tunnels',{signal:AbortSignal.timeout(1500)});if(!r.ok)return '';const data=await r.json() as any;const tunnels=(Array.isArray(data.tunnels)?data.tunnels:[]).filter((t:any)=>['http://127.0.0.1:'+port,'http://localhost:'+port,'localhost:'+port,'127.0.0.1:'+port,String(port)].includes(t.config?.addr)&&typeof t.public_url==='string'&&t.public_url.startsWith('https://'));
 if(tunnels.length!==1)return '';const u=new URL(tunnels[0].public_url);if(u.pathname!=='/'||u.username||u.password||u.search||u.hash)return '';return u.origin;
 }catch{return '';}
}
