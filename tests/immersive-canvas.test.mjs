import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const between=(html,start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));

test('the canvas is the whole app: no sidebar, one quiet header, panel closed until needed',async()=>{
 const html=await read('web/index.html'),css=await read('web/board.css'),app=await read('web/app.mjs');
 assert.match(html,/<body class="canvas-mode">/);
 assert.match(css,/body\.canvas-mode \.topbar,body\.canvas-mode \.footer,body\.canvas-mode \.sidebar\{display:none\}/);
 assert.match(css,/body\.canvas-mode \.board-shell\{height:100dvh/);
 assert.match(app,/classList\.toggle\('canvas-mode',tab==='branches'\)/);
 const header=between(html,'<header class="board-header">','</header>');
 const visible=header.replace(/<details[\s\S]*<\/details>/,'');
 assert.equal((visible.match(/<button/g)||[]).length,3,'only Brain, Think and Scan futures sit in the header');
 assert.match(visible,/id="boardThink"/);
 assert.match(visible,/id="boardBrain"/);
 assert.match(visible,/id="boardFutures"/);
 assert.match(html,/<aside id="boardPanel" class="board-panel"[^>]*hidden>/,'the panel starts closed');
 assert.doesNotMatch(html,/role="tablist"/,'no tabs: the panel has one purpose at a time');
});

test('everything else lives in one menu: canvases, import, export, own AI, appearance, classic tools',async()=>{
 const html=await read('web/index.html'),js=await read('web/free-canvas.mjs');
 const menu=between(html,'<details id="boardMenuDetails"','</details>');
 for(const id of ['boardNew','boardMenuImport','boardMenuExport','boardAi','boardMenuSettings'])assert.match(menu,new RegExp('id="'+id+'"'),id);
 for(const tab of ['overview','assumptions','skills','integrations'])assert.match(menu,new RegExp('data-tab="'+tab+'"'),tab);
 for(const id of ['boardMenuImport','boardMenuExport','boardMenuSettings','boardAi'])assert.match(js,new RegExp("'#"+id+"'"),id);
 assert.match(js,/menu\.open=false/,'the menu closes after a choice');
});

test('one next step at a time instead of a list of advice',async()=>{
 const html=await read('web/index.html'),js=await read('web/free-canvas.mjs');
 assert.match(html,/id="boardNext"[^>]*hidden/);
 assert.match(js,/nextMove=moves\.find\(m=>!skipped\.has\(m\.id\)\)/);
 assert.match(js,/skipped\.add\(nextMove\.id\)/);
 assert.match(html,/<details class="board-more" id="boardMore">/,'rarely used note fields are folded away');
});
