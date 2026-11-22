// Thenvio self-contained Cloudflare Worker builder. Uses only Node built-ins.
import {readFile} from 'node:fs/promises';
const fileMap={
 '/':'web/index.html','/index.html':'web/index.html',
 '/styles.css':'web/styles.css','/app.mjs':'web/app.mjs','/favicon.svg':'web/favicon.svg',
 '/core/engine.mjs':'core/engine.mjs','/core/demo.mjs':'core/demo.mjs','/core/skills.mjs':'core/skills.mjs'
};
const mime={
 '/':'text/html; charset=utf-8','/index.html':'text/html; charset=utf-8',
 '/styles.css':'text/css; charset=utf-8','/app.mjs':'text/javascript; charset=utf-8',
 '/favicon.svg':'image/svg+xml','/core/engine.mjs':'text/javascript; charset=utf-8',
 '/core/demo.mjs':'text/javascript; charset=utf-8','/core/skills.mjs':'text/javascript; charset=utf-8'
};
export async function makeWorkerSource() {
 const pairs=await Promise.all(Object.entries(fileMap).map(async ([route,file])=>[
   route,(await readFile(new URL('../'+file,import.meta.url))).toString('base64')
 ]));
 const parts=[
  '// Thenvio local-data static preview. No AI inference, database, trackers or outbound fetch.',
  'const ASSETS='+JSON.stringify(Object.fromEntries(pairs))+';',
  'const MIME='+JSON.stringify(mime)+';',
  'export default { async fetch(request){',
  "if(request.method!=='GET' && request.method!=='HEAD') return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});",
  'const path=new URL(request.url).pathname;',
  "if(!Object.prototype.hasOwnProperty.call(ASSETS,path)) return new Response('Not found',{status:404});",
  'const body=Uint8Array.from(atob(ASSETS[path]),c=>c.charCodeAt(0));',
  "const headers={'content-type':MIME[path],'cache-control':path==='/'||path==='/index.html'?'no-store':'public,max-age=120','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':\"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\"};",
  "return new Response(request.method==='HEAD'?null:body,{status:200,headers});",
  '}};'
 ];
 return parts.join('\n');
}
