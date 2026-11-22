import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const file=async p=>readFile(new URL(p,root),'utf8');

test('branches are primary product entry; decision analysis is secondary',async()=>{
 const html=await file('web/index.html');
 const app=await file('web/app.mjs');
 assert.match(html,/class="view active ideas-view" id="view-branches"/);
 assert.ok(html.indexOf('id="view-branches"')<html.indexOf('id="view-overview"'));
 assert.match(html,/data-tab="branches"/);
 assert.match(html,/data-tab="overview"/);
 assert.match(app,/let activeTab='branches'/);
 assert.match(app,/initIdeaExplorer/);
 assert.match(html,/id="ideaViewport"/);
 assert.match(html,/id="ideaNodes"/);
 assert.match(html,/id="ideaInspectorForm"/);
 assert.match(html,/id="ideaCreateDialog"/);
});

test('idea map has actual editing and connection handlers instead of empty controls',async()=>{
 const source=await file('web/idea-explorer.mjs');
 for(const id of ['ideaNew','ideaProjectSelect','ideaUndo','ideaRedo','ideaAddChild','ideaDevelop','ideaDelete',
   'ideaInspectorForm','ideaCreateForm','ideaLink','ideaCopy','ideaSearch','ideaZoomIn','ideaZoomOut','ideaFit',
   'ideaExpandAll','ideaCollapseAll','ideaImportInput']){
   assert.match(source,new RegExp("['\"]#"+id+"['\"]"));
 }
 assert.match(source,/pointerdown/);
 assert.match(source,/pointermove/);
 assert.match(source,/wheel/);
 assert.match(source,/localStorage/);
 assert.match(source,/makeIdea/);
});

test('build and cloudflare source include all idea assets',async()=>{
 const build=await file('scripts/build.mjs');
 const worker=await file('scripts/cloudflare-worker.mjs');
 for(const path of ['idea-graph.mjs','demo-ideas.mjs']){assert.ok(build.includes(path));assert.ok(worker.includes(path));}
 for(const path of ['ideas.css','idea-explorer.mjs'])assert.ok(worker.includes(path));
});
