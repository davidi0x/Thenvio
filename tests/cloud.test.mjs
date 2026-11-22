import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkerAssets} from '../scripts/build-worker.mjs';
import {mapStorage} from '../integrations/kv-brain-store.mjs';
import {makeIdea} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {SAMPLE} from './fixtures/think-sample.mjs';

await buildWorkerAssets();
const {default:worker,Brain}=await import('../integrations/cloud/worker.mjs');
// Minimal stand-in for a Durable Object namespace: one Brain instance per name.
function fakeEnv(){
 const objects=new Map();
 return {BRAIN:{idFromName:n=>n,get:id=>{if(!objects.has(id))objects.set(id,new Brain({storage:mapStorage()}));const o=objects.get(id);return {fetch:r=>o.fetch(r)};}}};
}
const HOST='https://thenvio.example';
const ID='abcdefghijklmnopqrstuv1234';
const mcp=(env,method,params,id=ID)=>worker.fetch(new Request(HOST+'/mcp/'+id,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),env).then(r=>r.json());

test('a pasted connector URL is a full MCP server: tools, UI view and a persistent brain',async()=>{
 const env=fakeEnv();
 const init=await mcp(env,'initialize',{protocolVersion:'2025-11-25',capabilities:{}});
 assert.equal(init.result.serverInfo.name,'thenvio');
 const tools=(await mcp(env,'tools/list')).result.tools.map(t=>t.name);
 for(const n of ['thenvio_new_canvas','thenvio_canvas','thenvio_brainstorm','thenvio_update_note','thenvio_show'])assert.ok(tools.includes(n),n);
 const ui=(await mcp(env,'resources/read',{uri:'ui://thenvio/canvas-v1.html'})).result.contents[0];
 assert.equal(ui.mimeType,'text/html;profile=mcp-app');
 const created=(await mcp(env,'tools/call',{name:'thenvio_new_canvas',arguments:{title:'Phone payments for cafes',goal:'100 paying cafes'}})).result;
 assert.match(created.structuredContent.openUrl,new RegExp('^'+HOST+'/\\?brain='+ID+'&canvas='));
 const b=(await mcp(env,'tools/call',{name:'thenvio_brainstorm',arguments:{canvas:'cafes',...SAMPLE}})).result;
 assert.match(b.content[0].text,/Best route .*QR sticker/);
 const again=(await mcp(env,'tools/call',{name:'thenvio_canvas',arguments:{}})).result;
 assert.match(again.structuredContent.markdown,/\[option\] QR sticker instead of a terminal/,'the brain persists between calls');
 const other=(await mcp(env,'tools/call',{name:'thenvio_canvases',arguments:{}},'zyxwvutsrqponmlkjihgfedcba99')).result;
 assert.deepEqual(other.structuredContent.canvases,[],'every connector URL has its own brain');
});

test('transport details clients rely on: CORS preflight, 405 on GET, 202 for notifications, unknown ids refused',async()=>{
 const env=fakeEnv();
 const pre=await worker.fetch(new Request(HOST+'/mcp/'+ID,{method:'OPTIONS'}),env);
 assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),'*');
 assert.equal((await worker.fetch(new Request(HOST+'/mcp/'+ID),env)).status,405);
 const note=await worker.fetch(new Request(HOST+'/mcp/'+ID,{method:'POST',body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}),env);
 assert.equal(note.status,202);
 assert.equal((await worker.fetch(new Request(HOST+'/mcp/short',{method:'POST',body:'{}'}),env)).status,404);
});

test('the site syncs with the same brain; its API is same-origin only',async()=>{
 const env=fakeEnv();
 const page=await worker.fetch(new Request(HOST+'/'),env);
 assert.match(await page.text(),/<meta name="thenvio-cloud" content="1">/);
 assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);
 const g=prepareBoard(makeIdea('Synced from the browser'));
 const put=await worker.fetch(new Request(HOST+'/api/b/'+ID+'/canvases/'+g.id,{method:'PUT',headers:{'x-thenvio':'1','content-type':'application/json'},body:JSON.stringify(g)}),env);
 assert.equal(put.status,200);
 const list=(await mcp(env,'tools/call',{name:'thenvio_canvases',arguments:{}})).result.structuredContent.canvases;
 assert.equal(list[0].title,'Synced from the browser','what the person draws, the chat sees');
 const v=await (await worker.fetch(new Request(HOST+'/api/b/'+ID+'/version',{headers:{'x-thenvio':'1'}}),env)).json();
 assert.equal(v.version,1);
 assert.equal((await worker.fetch(new Request(HOST+'/api/b/'+ID+'/canvases'),env)).status,403);
 assert.equal((await worker.fetch(new Request(HOST+'/api/b/'+ID+'/canvases',{headers:{'x-thenvio':'1',origin:'https://evil.example'}}),env)).status,403);
});
