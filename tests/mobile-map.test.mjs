import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('mobile offers a big freeform canvas with visible floating actions and editable note',async()=>{
 const source=await readFile(new URL('../web/free-canvas.mjs',import.meta.url),'utf8');
 const style=await readFile(new URL('../web/board.css',import.meta.url),'utf8');
 assert.match(source,/function center\(id\)/);
 assert.match(source,/requestAnimationFrame\(\(\)=>center\(graph\(\)\.rootId\)\)/);
 assert.match(style,/\.board-dock\{bottom:calc\(14px/);
 assert.match(style,/\.board-note-plus\{opacity:1/);
 assert.match(style,/\.board-panel,.board-ai-panel\{display:block;position:fixed/);
});
