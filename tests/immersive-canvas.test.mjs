import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('canvas is immersive with one header and no second global toolbar',async()=>{
 const html=await read('web/index.html'),css=await read('web/board.css'),app=await read('web/app.mjs');
 assert.match(html,/<body class="canvas-mode">/);
 assert.match(css,/body\.canvas-mode \.topbar,body\.canvas-mode \.footer\{display:none\}/);
 assert.match(css,/body\.canvas-mode \.board-shell\{height:100dvh/);
 assert.match(app,/classList\.toggle\('canvas-mode',tab==='branches'\)/);
 assert.match(html,/id="boardSettings"/);
 assert.match(html,/id="boardExport"/);
 assert.match(html,/id="boardImport"/);
});

test('phone offers import export and preferences from compact overflow menu',async()=>{
 const html=await read('web/index.html'),css=await read('web/board.css'),js=await read('web/free-canvas.mjs');
 for(const id of ['boardMenuDetails','boardMenuImport','boardMenuExport','boardMenuSettings'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/body\.canvas-mode \.board-menu\{display:block\}/);
 assert.match(js,/boardMenuImport/);
 assert.match(js,/boardMenuExport/);
 assert.match(js,/boardMenuSettings/);
});
