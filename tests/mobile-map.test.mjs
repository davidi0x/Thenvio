import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('phones get pinch zoom, double-tap creation and a bottom sheet instead of a side panel',async()=>{
 const source=await read('web/free-canvas.mjs');
 const style=await read('web/board.css');
 assert.match(source,/pointers\.size===2/,'two pointers start a pinch gesture');
 assert.match(source,/gesture\.scale\*Math\.hypot/,'pinch scales around the fingers');
 assert.match(source,/now-lastBgTap\.t<340/,'double-tap on empty canvas adds a note');
 assert.match(source,/now-lastTap\.t<340/,'double-tap on a note edits it');
 assert.match(source,/function revealSelection\(\)/,'selection and its suggestions are brought into view');
 assert.match(style,/@media\(max-width:690px\)\{[^@]*\.board-panel\{position:fixed;left:0;right:0;bottom:0/s);
 assert.match(style,/\.board-coach-pill\{/);
 assert.match(style,/\.board-note-plus\{opacity:1/,'the connector dot is always visible on touch screens');
 assert.match(style,/\.board-dock\{bottom:calc\(12px \+ env\(safe-area-inset-bottom\)\)/);
});
