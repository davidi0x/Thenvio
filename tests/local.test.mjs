import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SAMPLE} from './fixtures/think-sample.mjs';
import http from 'node:http';
// fetch cannot override Host; node:http can.
const withHost=(port,host,path='/mcp')=>new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port,path,method:'POST',headers:{host,'content-type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);r.end('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');});

async function startServer(env={}){
 const dir=mkdtempSync(join(tmpdir(),'thenvio-local-'));
 const port=4300+Math.floor(Math.random()*400);
 const child=spawn(process.execPath,['scripts/local-server.mjs','--brain',dir,'--port',String(port),'--no-build'],{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('Thenvio:'))resolve();});child.on('exit',c=>reject(Error('server exited '+c)));setTimeout(()=>reject(Error('server did not start')),8000);});
 return {dir,port,stop(){child.kill();rmSync(dir,{recursive:true,force:true});}};
}
const rpc=(port,method,params,headers={})=>fetch('http://localhost:'+port+'/mcp'+(headers.query||''),{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});

test('chat apps brainstorm into the shared brain over MCP HTTP; the canvas app sees it',async()=>{
 const s=await startServer();
 try{
  const init=await (await rpc(s.port,'initialize',{protocolVersion:'2025-11-25'})).json();
  assert.ok(init.result.capabilities.resources);
  const tools=(await (await rpc(s.port,'tools/list')).json()).result.tools;
  const ui=tools.filter(t=>t._meta?.ui?.resourceUri);
  assert.deepEqual(ui.map(t=>t.name).sort(),['thenvio_brainstorm','thenvio_new_canvas','thenvio_show','thenvio_update_note']);
  assert.ok(ui.every(t=>t._meta['openai/outputTemplate']===t._meta.ui.resourceUri),'ChatGPT alias is set');
  const res=(await (await rpc(s.port,'resources/read',{uri:ui[0]._meta.ui.resourceUri})).json()).result.contents[0];
  assert.equal(res.mimeType,'text/html;profile=mcp-app');
  assert.match(res.text,/ui\/initialize/);
  const call=async(name,args)=>(await (await rpc(s.port,'tools/call',{name,arguments:args})).json()).result;
  const created=await call('thenvio_new_canvas',{title:'Phone payments for cafes',goal:'100 paying cafes in 6 months'});
  assert.equal(created.structuredContent.canvas.goal,'100 paying cafes in 6 months');
  const brainstorm=await call('thenvio_brainstorm',{canvas:'cafes',...SAMPLE});
  assert.equal(brainstorm.isError,undefined,JSON.stringify(brainstorm));
  assert.match(brainstorm.content[0].text,/Best route .*QR sticker instead of a terminal/);
  assert.match(brainstorm.structuredContent.openUrl,new RegExp('^http://localhost:'+s.port+'/\\?canvas='));
  const files=readdirSync(join(s.dir,'product-data/ideas'));
  assert.equal(files.length,1);
  assert.match(readFileSync(join(s.dir,'product-data/ideas',files[0]),'utf8'),/\[option\] QR sticker instead of a terminal/);
  for(const p of ['AGENTS.md','how-we-work/README.md','brand/README.md','product-data/assumptions.md'])assert.ok(readdirSync(join(s.dir,p.split('/').slice(0,-1).join('/')||'.')).includes(p.split('/').at(-1)),p);
  const updated=await call('thenvio_update_note',{canvas:'cafes',note:'Customers already pay by phone in cafes',status:'refuted'});
  assert.ok(updated.structuredContent.canvas.nodes.some(n=>n.status==='refuted'));
  assert.notEqual(updated.structuredContent.futures.winner?.choices[0]?.optionTitle,'QR sticker instead of a terminal','a refuted assumption changes the best route');
  const api=await fetch('http://localhost:'+s.port+'/api/canvases',{headers:{'x-thenvio':'1'}});
  assert.equal((await api.json()).canvases[0].title,'Phone payments for cafes');
  assert.equal((await fetch('http://localhost:'+s.port+'/api/canvases')).status,403,'the app API needs its header');
  assert.equal(await withHost(s.port,'attacker.example'),401,'no tokenless access from other hosts');
  assert.equal(await withHost(s.port,'attacker.example','/api/canvases'),403);
 }finally{s.stop();}
});

test('a token unlocks /mcp for a tunnel (ChatGPT, claude.ai) and nothing else does',async()=>{
 const s=await startServer({THENVIO_MCP_TOKEN:'t0ken-long-enough'});
 try{
  assert.equal((await rpc(s.port,'tools/list')).status,401);
  assert.equal((await rpc(s.port,'tools/list',{},{authorization:'Bearer wrong-token-xx'})).status,401);
  assert.equal((await rpc(s.port,'tools/list',{},{authorization:'Bearer t0ken-long-enough'})).status,200);
  assert.equal((await rpc(s.port,'tools/list',{},{query:'?key=t0ken-long-enough'})).status,200);
  assert.equal(await withHost(s.port,'abc.trycloudflare.com'),401,'a tunnel without the key is refused');
 }finally{s.stop();}
});

test('Claude Desktop / Claude Code: stdio MCP works on the same brain folder',()=>{
 const dir=mkdtempSync(join(tmpdir(),'thenvio-stdio-'));
 try{
  const input=[{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'thenvio_new_canvas',arguments:{title:'Stdio idea'}}},
   {jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'thenvio_canvases',arguments:{}}}].map(x=>JSON.stringify(x)).join('\n')+'\n';
  const p=spawnSync(process.execPath,['integrations/mcp/server.mjs','--brain',dir],{input,encoding:'utf8',timeout:8000});
  const [, list]=p.stdout.trim().split('\n').map(l=>JSON.parse(l));
  assert.equal(list.result.structuredContent.canvases[0].title,'Stdio idea');
  assert.match(readFileSync(new URL('../.mcp.json',import.meta.url),'utf8'),/integrations\/mcp\/server\.mjs/,'Claude Code picks the server up from .mcp.json');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
