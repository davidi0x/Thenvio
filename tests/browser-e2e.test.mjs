// Real-browser checks of the thinking canvas. Runs when Playwright + Chromium are available
// (local development); skips cleanly elsewhere, e.g. in CI without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';

let playwright=null;
try{playwright=createRequire(import.meta.url)('playwright');}catch{}
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml'};
function serve(){
 return new Promise(resolve=>{
  const server=http.createServer(async(req,res)=>{
   const path=new URL(req.url,'http://x').pathname;
   const file=path==='/'?'web/index.html':path.startsWith('/core/')?path.slice(1):'web'+path;
   if(file.includes('..')){res.writeHead(404);res.end();return;}
   try{res.writeHead(200,{'content-type':types[extname(file)]||'text/plain'});res.end(await readFile(root+file));}
   catch{res.writeHead(404);res.end();}
  }).listen(0,'127.0.0.1',()=>resolve(server));
 });
}
async function launch(){
 try{return await playwright.chromium.launch();}catch{return null;}
}

test('thinking canvas: name, suggest, branch, drag, connect, scan futures',{skip:!playwright&&'Playwright is not installed'},async t=>{
 const browser=await launch();
 if(!browser){t.skip('Chromium is not available');return;}
 const server=await serve();
 const url='http://127.0.0.1:'+server.address().port+'/';
 try{
  const page=await browser.newPage({viewport:{width:1366,height:860}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url);
  await page.waitForSelector('.board-note.root textarea.board-note-inline');
  await page.keyboard.type('An app that helps people meet in a new city');
  await page.keyboard.press('Enter');
  await page.click('.board-note.root');
  await page.waitForSelector('.board-ghost');
  assert.equal(await page.$$eval('.board-ghost',g=>g.length),3,'three ghost suggestions appear next to the idea');
  await page.click('.board-ghost >> nth=0');
  await page.click('.board-ghost >> nth=0');
  assert.equal(await page.$$eval('.board-note',n=>n.length),3,'one tap turns a ghost into a real note');
  // Tab adds a branch and types straight into it; the kind is inferred from the words.
  await page.click('.board-note.root');
  await page.keyboard.press('Tab');
  await page.keyboard.type('People will join small weekly groups');
  await page.keyboard.press('Enter');
  const last=await page.$$eval('.board-note',n=>n.at(-1).querySelector('.board-note-kind').textContent);
  assert.equal(last,'Assumption');
  // Dragging the main idea carries its whole tree.
  const before=await page.$$eval('.board-note',n=>n.map(x=>x.style.transform));
  const box=await (await page.$('.board-note.root')).boundingBox();
  await page.mouse.move(box.x+40,box.y+50);await page.mouse.down();
  await page.mouse.move(box.x-60,box.y+120,{steps:6});await page.mouse.up();
  await page.waitForTimeout(700);
  const after=await page.$$eval('.board-note',n=>n.map(x=>x.style.transform));
  assert.equal(after.filter((v,i)=>v!==before[i]).length,after.length,'children follow the dragged parent');
  // Drag a connector dot onto another note to link them, then mark it as a conflict.
  const notes=await page.$$('.board-note:not(.root)');
  await notes[0].hover();
  const dot=await (await notes[0].$('.board-note-plus')).boundingBox();
  const target=await notes[1].boundingBox();
  await page.mouse.move(dot.x+dot.width/2,dot.y+dot.height/2);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up();
  assert.equal(await page.$$eval('.board-edge.link',e=>e.length),1);
  // Scan futures: the HUD reports the best route and the panel explains it.
  await page.click('#boardFutures');
  await page.waitForFunction(()=>document.querySelector('#boardHud.is-done'),null,{timeout:6000});
  assert.match(await page.textContent('#boardHudText'),/Best of \d+ futures/);
  assert.ok(await page.isVisible('.futures-card.win'));
  assert.ok(await page.$$eval('.board-note.is-lit',n=>n.length)>=2,'the winning route is highlighted on the canvas');
  // Undo restores; persistence keeps the work.
  const count=await page.$$eval('.board-note',n=>n.length);
  await page.click('.board-note:not(.root) >> nth=0');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(260);
  assert.ok(await page.$$eval('.board-note',n=>n.length)<count);
  await page.keyboard.press('Control+z');
  assert.equal(await page.$$eval('.board-note',n=>n.length),count);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('thenvio-ideas-portfolio-v1')).graphs[0].nodes.length);
  assert.equal(saved,count);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
});

test('opt-in canvas QA script passes against the live UI',{skip:!playwright&&'Playwright is not installed'},async t=>{
 const browser=await launch();
 if(!browser){t.skip('Chromium is not available');return;}
 const server=await serve();
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/?__canvas_qa=1');
  await page.addScriptTag({url:'/canvas-smoke.js'});
  await page.waitForSelector('#boardSmokeResult',{timeout:6000});
  assert.match(await page.textContent('#boardSmokeResult'),/PASS/,await page.textContent('#boardSmokeResult'));
 }finally{await browser.close();server.close();}
});

// In-memory stand-in for the File System Access API, so the brain sync runs end to end headlessly.
const memoryFolder=`(()=>{
 window.__fs={};
 const nf=()=>{const e=new Error('not found');e.name='NotFoundError';return e;};
 const file=(p,n)=>({kind:'file',name:n,async getFile(){return {text:async()=>__fs[p].content,lastModified:__fs[p].lastModified};},
  async createWritable(){let buf='';return {write:async c=>{buf+=c;},close:async()=>{__fs[p]={content:buf,lastModified:Date.now()};}};}});
 const dir=(prefix,name)=>({kind:'directory',name,
  async getDirectoryHandle(n){return dir(prefix+n+'/',n);},
  async getFileHandle(n,o={}){const p=prefix+n;if(!(p in __fs)){if(!o.create)throw nf();__fs[p]={content:'',lastModified:Date.now()};}return file(p,n);},
  async *entries(){const seen=new Set();for(const k of Object.keys(__fs)){if(!k.startsWith(prefix))continue;const [first,...more]=k.slice(prefix.length).split('/');if(seen.has(first))continue;seen.add(first);yield [first,more.length?dir(prefix+first+'/',first):file(prefix+first,first)];}},
  async queryPermission(){return 'granted';},async requestPermission(){return 'granted';}});
 window.showDirectoryPicker=async()=>dir('','team-brain');
})();`;

test('shared brain: connect a folder, autosave plain text, pick up an agent edit, download a zip',{skip:!playwright&&'Playwright is not installed'},async t=>{
 const browser=await launch();
 if(!browser){t.skip('Chromium is not available');return;}
 const server=await serve();
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:860},acceptDownloads:true});
  await ctx.addInitScript(memoryFolder);
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForSelector('.board-note.root textarea.board-note-inline');
  assert.ok(await page.isHidden('#boardPanel'),'nothing but the idea on first open');
  await page.keyboard.type('Coffee payments');await page.keyboard.press('Enter');
  await page.click('#boardBrain');
  await page.click('#boardBrainConnect');
  await page.waitForFunction(()=>document.querySelector('#boardBrainDot').classList.contains('synced'));
  const paths=await page.evaluate(()=>Object.keys(window.__fs));
  for(const p of ['README.md','AGENTS.md','how-we-work/README.md','brand/README.md','product-data/assumptions.md','skills/red-team/SKILL.md'])assert.ok(paths.includes(p),p);
  const idea=paths.find(p=>p.startsWith('product-data/ideas/'));
  assert.ok(idea,'the canvas is saved as a Markdown file');
  await page.click('.board-note.root');await page.keyboard.press('Tab');
  await page.keyboard.type('Customers will try a new terminal');await page.keyboard.press('Enter');
  await page.waitForFunction(p=>window.__fs[p].content.includes('[assumption] Customers will try a new terminal'),idea);
  // An agent appends a note to the file in the repo; returning to the tab reads it back.
  await page.evaluate(p=>{window.__fs[p]={content:window.__fs[p].content.replace(/\n$/,'\n- [test] Pilot in 3 cafes; success if 2 keep it\n'),lastModified:Date.now()+5000};},idea);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(()=>[...document.querySelectorAll('.board-note-title')].some(n=>n.textContent.startsWith('Pilot in 3 cafes')));
  await page.click('#boardBrain');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#boardBrainDownload')]);
  assert.match(download.suggestedFilename(),/^shared-brain-\d{4}-\d{2}-\d{2}\.zip$/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
});
