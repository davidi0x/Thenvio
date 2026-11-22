// Thenvio cloud: the public site plus a personal MCP connector per brain.
//   https://<host>/                 the canvas
//   https://<host>/mcp/<brain-id>   the connector URL people paste into Claude or ChatGPT
// Each brain lives in its own Durable Object (strongly consistent storage). The brain id is a
// random 128-bit secret created in the person's browser; anyone holding the URL can use that brain.
import {handleRequest} from '../mcp/handler.mjs';
import {createKvBrainStore} from '../kv-brain-store.mjs';
import {ASSETS,UI_HTML} from './assets.mjs';

const BRAIN_ID=/^[A-Za-z0-9_-]{22,64}$/;
const MAX_BODY=2_000_000;
const SECURITY={'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'POST, GET, OPTIONS','access-control-allow-headers':'content-type, accept, authorization, mcp-session-id, mcp-protocol-version','access-control-expose-headers':'mcp-session-id'};
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...SECURITY,...extra}});
async function readBody(request){
 const text=await request.text();
 if(text.length>MAX_BODY)throw Error('Request too large');
 return text;
}
export class Brain{
 constructor(state){this.state=state;}
 async fetch(request){
  const url=new URL(request.url);
  const origin=request.headers.get('x-thenvio-origin')||'';
  const brainId=request.headers.get('x-thenvio-brain')||'';
  const store=createKvBrainStore(this.state.storage,{url:origin,label:'Thenvio cloud brain'});
  store.openUrl=id=>origin+'/?brain='+encodeURIComponent(brainId)+'&canvas='+encodeURIComponent(id);
  try{
   if(url.pathname==='/mcp'){
    let msg;try{msg=JSON.parse(await readBody(request));}catch{return json(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}},CORS);}
    const ctx={store,uiHtml:UI_HTML};
    if(Array.isArray(msg)){const out=(await Promise.all(msg.map(m=>handleRequest(m,ctx)))).filter(Boolean);return out.length?json(200,out,CORS):new Response(null,{status:202,headers:CORS});}
    const out=await handleRequest(msg,ctx);
    return out?json(200,out,CORS):new Response(null,{status:202,headers:CORS});
   }
   if(url.pathname==='/version')return json(200,{version:await store.version()});
   if(url.pathname==='/canvases'&&request.method==='GET'){const {canvases,errors}=await store.load();return json(200,{canvases,errors,version:await store.version()});}
   const m=url.pathname.match(/^\/canvases\/([\w-]{1,90})$/);
   if(m&&request.method==='PUT'){
    const g=await store.putJson(await readBody(request));
    if(g.id!==m[1])return json(400,{error:'Canvas id mismatch.'});
    return json(200,{ok:true,version:await store.version()});
   }
   return json(404,{error:'Not found'});
  }catch(e){return json(e.message==='Request too large'?413:400,{error:e.message});}
 }
}
function brainStub(env,id){return env.BRAIN.get(env.BRAIN.idFromName(id));}
async function forward(env,request,id,path){
 const url=new URL(request.url);
 const headers=new Headers(request.headers);
 headers.set('x-thenvio-origin',url.origin);headers.set('x-thenvio-brain',id);
 let body;
 if(!['GET','HEAD'].includes(request.method)){try{body=await readBody(request);}catch(e){return json(413,{error:e.message},CORS);}}
 return brainStub(env,id).fetch(new Request('https://brain'+path,{method:request.method,headers,body}));
}
function asset(path){
 const a=ASSETS[path];
 if(!a)return null;
 let body=Uint8Array.from(atob(a.body),c=>c.charCodeAt(0));
 if(path==='/index.html')body=new TextEncoder().encode(new TextDecoder().decode(body).replace('<head>','<head>\n  <meta name="thenvio-cloud" content="1">'));
 return new Response(body,{headers:{'content-type':a.type,'cache-control':path==='/index.html'?'no-store':'public, max-age=300',...SECURITY,
  'x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.anthropic.com https://api.github.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"}});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const mcp=url.pathname.match(/^\/mcp\/([^/]+)\/?$/);
  if(mcp){
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
   if(!BRAIN_ID.test(mcp[1]))return json(404,{error:'Unknown connector. Create yours on the Thenvio site.'},CORS);
   if(request.method!=='POST')return new Response(null,{status:405,headers:{allow:'POST, OPTIONS',...CORS}});
   return forward(env,request,mcp[1],'/mcp');
  }
  const api=url.pathname.match(/^\/api\/b\/([^/]+)(\/.*)$/);
  if(api){
   const originOk=!request.headers.get('origin')||request.headers.get('origin')===url.origin;
   if(!BRAIN_ID.test(api[1])||request.headers.get('x-thenvio')!=='1'||!originOk)return json(403,{error:'Thenvio app only.'});
   if(!/^\/(version|canvases(\/[\w-]{1,90})?)$/.test(api[2]))return json(404,{error:'Not found'});
   return forward(env,request,api[1],api[2]);
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  return asset(url.pathname==='/'?'/index.html':url.pathname)||new Response('Not found',{status:404,headers:SECURITY});
 }
};
