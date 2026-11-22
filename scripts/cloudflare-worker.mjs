// Thenvio self-contained Cloudflare Worker builder. Uses only Node built-ins.
import {readFile} from 'node:fs/promises';
const fileMap={
 '/':'web/index.html','/index.html':'web/index.html',
 '/styles.css':'web/styles.css','/canvas-smoke.js':'web/canvas-smoke.js','/board.css':'web/board.css','/ideas.css':'web/ideas.css','/app.mjs':'web/app.mjs','/free-canvas.mjs':'web/free-canvas.mjs','/brain-sync.mjs':'web/brain-sync.mjs','/ai-think.mjs':'web/ai-think.mjs','/github-brain.mjs':'web/github-brain.mjs','/local-brain.mjs':'web/local-brain.mjs','/mcp-app.html':'web/mcp-app.html','/idea-explorer.mjs':'web/idea-explorer.mjs','/idea-flow.mjs':'web/idea-flow.mjs','/favicon.svg':'web/favicon.svg',
 '/core/engine.mjs':'core/engine.mjs','/core/demo.mjs':'core/demo.mjs','/core/skills.mjs':'core/skills.mjs','/core/visuals.mjs':'core/visuals.mjs','/core/idea-graph.mjs':'core/idea-graph.mjs','/core/demo-ideas.mjs':'core/demo-ideas.mjs','/core/brainstorm.mjs':'core/brainstorm.mjs','/core/board.mjs':'core/board.mjs','/core/futures.mjs':'core/futures.mjs','/core/coach.mjs':'core/coach.mjs','/core/brain.mjs':'core/brain.mjs','/core/zip.mjs':'core/zip.mjs','/core/think.mjs':'core/think.mjs'
};
const mime={
 '/':'text/html; charset=utf-8','/index.html':'text/html; charset=utf-8',
 '/styles.css':'text/css; charset=utf-8','/canvas-smoke.js':'text/javascript; charset=utf-8','/board.css':'text/css; charset=utf-8','/ideas.css':'text/css; charset=utf-8','/app.mjs':'text/javascript; charset=utf-8','/free-canvas.mjs':'text/javascript; charset=utf-8','/brain-sync.mjs':'text/javascript; charset=utf-8','/ai-think.mjs':'text/javascript; charset=utf-8','/github-brain.mjs':'text/javascript; charset=utf-8','/local-brain.mjs':'text/javascript; charset=utf-8','/mcp-app.html':'text/html; charset=utf-8','/idea-explorer.mjs':'text/javascript; charset=utf-8','/idea-flow.mjs':'text/javascript; charset=utf-8',
 '/favicon.svg':'image/svg+xml','/core/engine.mjs':'text/javascript; charset=utf-8',
 '/core/demo.mjs':'text/javascript; charset=utf-8','/core/skills.mjs':'text/javascript; charset=utf-8','/core/visuals.mjs':'text/javascript; charset=utf-8','/core/idea-graph.mjs':'text/javascript; charset=utf-8','/core/demo-ideas.mjs':'text/javascript; charset=utf-8','/core/brainstorm.mjs':'text/javascript; charset=utf-8','/core/board.mjs':'text/javascript; charset=utf-8','/core/futures.mjs':'text/javascript; charset=utf-8','/core/coach.mjs':'text/javascript; charset=utf-8','/core/brain.mjs':'text/javascript; charset=utf-8','/core/zip.mjs':'text/javascript; charset=utf-8','/core/think.mjs':'text/javascript; charset=utf-8'
};
export async function makeWorkerSource() {
 const pairs=await Promise.all(Object.entries(fileMap).map(async ([route,file])=>[
   route,(await readFile(new URL('../'+file,import.meta.url))).toString('base64')
 ]));
 const parts=[
  '// Thenvio static client. Data stays in the browser; outbound calls only to api.anthropic.com (user\'s own key) and api.github.com (read), on explicit action.',
  'const ASSETS='+JSON.stringify(Object.fromEntries(pairs))+';',
  'const MIME='+JSON.stringify(mime)+';',
  'export default { async fetch(request){',
  "if(request.method!=='GET' && request.method!=='HEAD') return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});",
  'const path=new URL(request.url).pathname;',
  "if(!Object.prototype.hasOwnProperty.call(ASSETS,path)) return new Response('Not found',{status:404});",
  'const body=Uint8Array.from(atob(ASSETS[path]),c=>c.charCodeAt(0));',
  "const headers={'content-type':MIME[path],'cache-control':path==='/'||path==='/index.html'?'no-store':'public,max-age=120','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':\"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.anthropic.com https://api.github.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\"};",
  "return new Response(request.method==='HEAD'?null:body,{status:200,headers});",
  '}};'
 ];
 return parts.join('\n');
}
