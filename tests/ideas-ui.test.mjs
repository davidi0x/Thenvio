import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('freeform spatial canvas is the default entry, and analysis remains optional',async()=>{
 const html=await read('web/index.html'),app=await read('web/app.mjs');
 assert.match(html,/class="view active board-view" id="view-branches"/);
 assert.ok(html.indexOf('id="view-branches"')<html.indexOf('id="view-overview"'));
 assert.match(html,/id="boardViewport"/);
 assert.match(html,/id="boardNodes"/);
 assert.match(html,/id="boardEdges"/);
 assert.match(html,/id="boardAdd"/);
 assert.match(html,/id="boardLink"/);
 assert.match(app,/initFreeCanvas/);
 assert.doesNotMatch(html,/id="ideaSuggestList"/);
 assert.doesNotMatch(html,/id="ideaInspectorForm"/);
});

test('visible canvas controls are bound to real editing or navigation actions',async()=>{
 const s=await read('web/free-canvas.mjs');
 for(const id of ['boardSelect','boardNew','boardCreateForm','boardAdd','boardChild','boardLink','boardPanelClose',
   'boardEditForm','boardDelete','boardUndo','boardRedo','boardZoomIn','boardZoomOut','boardFit',
   'boardAi','boardAiClose','boardCopyPrompt','boardImportAi'])
  assert.match(s,new RegExp("['\"]#"+id+"['\"]"));
 assert.match(s,/pointerdown/);
 assert.match(s,/pointermove/);
 assert.match(s,/pointerup/);
 assert.match(s,/dblclick/);
 assert.match(s,/moveBoardNode/);
 assert.match(s,/localStorage/);
});

test('Cloudflare build includes board CSS, canvas module and spatial graph core',async()=>{
 const html=await read('web/index.html'),worker=await read('scripts/cloudflare-worker.mjs'),build=await read('scripts/build.mjs');
 assert.match(html,/\.\/board\.css/);
 assert.match(worker,/free-canvas\.mjs/);
 assert.match(worker,/board\.css/);
 assert.match(worker,/core\/board\.mjs/);
 const {spawnSync}=await import('node:child_process');const {readdirSync}=await import('node:fs');
 assert.equal(spawnSync(process.execPath,['scripts/build.mjs']).status,0);
 const core=readdirSync(new URL('../core/',import.meta.url)).filter(f=>f.endsWith('.mjs')).sort();
 assert.deepEqual(readdirSync(new URL('../dist/core/',import.meta.url)).sort(),core,'every core module ships in the build');
 assert.ok(build.length>0);
});
