#!/usr/bin/env node
// Thenvio local: one process for the localhost canvas, the shared-brain folder and MCP over HTTP.
//   npm start [-- --brain <folder>] [--port 4173]
// - http://localhost:4173        the canvas, saved live into the brain folder
// - http://localhost:4173/mcp    MCP (Streamable HTTP, JSON responses) for ChatGPT / claude.ai via a tunnel
// Listens on 127.0.0.1 only. Without THENVIO_MCP_TOKEN only localhost Host headers are accepted;
// set THENVIO_MCP_TOKEN before exposing /mcp through a tunnel and give the URL as /mcp?key=<token>.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {timingSafeEqual} from 'node:crypto';
import {readIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {createBrainStore,defaultBrainDir} from '../integrations/brain-store.mjs';
import {handleRequest} from '../integrations/mcp/handler.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const port=Number(arg('port',process.env.PORT||4173));
const store=createBrainStore(arg('brain',defaultBrainDir()));
store.url='http://localhost:'+port;
const token=process.env.THENVIO_MCP_TOKEN||'';
const base=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const serverPath=fileURLToPath(new URL('../integrations/mcp/server.mjs',import.meta.url));
if(process.argv.includes('--no-build')===false){
 const build=spawnSync(process.execPath,[fileURLToPath(new URL('./build.mjs',import.meta.url))],{stdio:'inherit'});
 if(build.status!==0)process.exit(build.status||1);
}
await store.ensure();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const localHost=h=>/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h||'');
const sameToken=v=>!!token&&!!v&&v.length===token.length&&timingSafeEqual(Buffer.from(v),Buffer.from(token));
const clients=new Set();
store.onChange(()=>{for(const res of clients)res.write('event: change\ndata: {}\n\n');});
setInterval(()=>{for(const res of clients)res.write(': ping\n\n');},25000).unref();
function json(res,status,body){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));}
async function body(req,limit=5_000_000){
 let size=0;const chunks=[];
 for await (const c of req){size+=c.length;if(size>limit)throw Error('Request too large');chunks.push(c);}
 return Buffer.concat(chunks).toString('utf8');
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/mcp'){
   const auth=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||url.searchParams.get('key')||'';
   if(token?!sameToken(auth):!localHost(req.headers.host))return json(res,401,{error:'Set THENVIO_MCP_TOKEN and send it as a Bearer token or ?key= to use /mcp outside localhost.'});
   if(req.method!=='POST'){res.writeHead(405,{allow:'POST'});return res.end();}
   let msg;try{msg=JSON.parse(await body(req));}catch{return json(res,400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});}
   const ctx={store,uiHtml:readFileSync(new URL('../web/mcp-app.html',import.meta.url),'utf8')};
   if(Array.isArray(msg)){const out=(await Promise.all(msg.map(m=>handleRequest(m,ctx)))).filter(Boolean);if(!out.length){res.writeHead(202);return res.end();}return json(res,200,out);}
   const out=await handleRequest(msg,ctx);
   if(!out){res.writeHead(202);return res.end();}
   return json(res,200,out);
  }
  if(url.pathname.startsWith('/api/')){
   // EventSource cannot send headers; the change stream carries no data, so only the Host check applies to it.
   const stream=url.pathname==='/api/events'&&req.method==='GET';
   if(!localHost(req.headers.host)||(!stream&&req.headers['x-thenvio']!=='1'))return json(res,403,{error:'Local app only.'});
   if(url.pathname==='/api/brain'&&req.method==='GET')
    return json(res,200,{dir:store.dir,canvases:await store.list(),
     mcp:{stdio:{command:process.execPath,args:[serverPath,'--brain',store.dir]},http:'http://localhost:'+port+'/mcp',tokenSet:!!token}});
   if(url.pathname==='/api/canvases'&&req.method==='GET'){const {canvases,errors}=await store.load();return json(res,200,{canvases,errors});}
   if(url.pathname==='/api/context'&&req.method==='GET')return json(res,200,{context:await store.context()});
   const m=url.pathname.match(/^\/api\/canvases\/([\w-]{1,90})$/);
   if(m&&req.method==='PUT'){
    const graph=prepareBoard(readIdeaGraph(await body(req)));
    if(graph.id!==m[1])return json(res,400,{error:'Canvas id mismatch.'});
    return json(res,200,{ok:true,...await store.save(graph)});
   }
   if(url.pathname==='/api/events'&&req.method==='GET'){
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store',connection:'keep-alive'});
    res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
   }
   return json(res,404,{error:'Not found'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  const file=resolve(base,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(file!==base&&!file.startsWith(base+sep))throw Error('Forbidden');
  if(!(await stat(file)).isFile())throw Error('Not found');
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
  let data=await readFile(file);
  // Mark pages served by the local server so the app knows the brain API exists (no probing on static hosts).
  if(file.endsWith('index.html'))data=Buffer.from(String(data).replace('<head>','<head>\n  <meta name="thenvio-local" content="1">'));
  res.end(req.method==='HEAD'?null:data);
 }catch(e){if(!res.headersSent){res.writeHead(e.message==='Request too large'?413:404,{'content-type':'text/plain'});res.end(e.message==='Request too large'?'Too large':'Not found');}}
});
server.listen(port,'127.0.0.1',()=>{
 console.log('Thenvio:      http://localhost:'+port);
 console.log('Brain folder: '+store.dir);
 console.log('MCP (HTTP):   http://localhost:'+port+'/mcp'+(token?' (token required)':' (localhost only; set THENVIO_MCP_TOKEN for a tunnel)'));
 console.log('MCP (stdio):  '+process.execPath+' '+serverPath+' --brain '+store.dir);
});
