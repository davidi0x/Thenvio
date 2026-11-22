import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('browser click smoke is an opt-in same-origin script only',async()=>{
 const source=await readFile(new URL('../web/canvas-smoke.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../scripts/cloudflare-worker.mjs',import.meta.url),'utf8');
 assert.match(source,/get\('__canvas_qa'\)!=='1'/);
 assert.match(source,/boardAdd/);
 assert.match(source,/board-note-inline/);
 assert.match(source,/boardFutures/);
 assert.match(source,/boardUndo/);
 assert.match(source,/boardRedo/);
 assert.match(source,/boardAi/);
 assert.match(worker,/canvas-smoke\.js/);
});
