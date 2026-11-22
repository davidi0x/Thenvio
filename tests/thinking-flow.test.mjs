import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('the open canvas does not require the old brainstorming flow',async()=>{
 const html=await file('web/index.html');
 const canvas=await file('web/free-canvas.mjs');
 assert.match(html,/id="boardEditTitle"/);
 assert.match(html,/id="boardEditBody"/);
 assert.match(canvas,/addBoardNode/);
 assert.doesNotMatch(canvas,/initIdeaFlow/);
 assert.doesNotMatch(html,/data-think="explore"/);
});

test('AI is clearly optional and does not claim a live connector',async()=>{
 const html=await file('web/index.html');
 const code=await file('web/free-canvas.mjs');
 assert.match(html,/No model connected/);
 assert.match(html,/href="https:\/\/chatgpt\.com\/"/);
 assert.match(code,/brainstormPrompt/);
 assert.match(code,/parseBrainstormResponse/);
 assert.match(code,/navigator\.clipboard\.writeText/);
 assert.doesNotMatch(code,/fetch\(/);
});

test('tap or drag a note acts on the note rather than panning the whole canvas',async()=>{
 const code=await file('web/free-canvas.mjs');
 const css=await file('web/board.css');
 assert.match(code,/e\.stopPropagation\(\)/);
 assert.match(code,/setPointerCapture/);
 assert.match(code,/Math\.hypot\(dx,dy\)>5/);
 assert.match(css,/\.board-note\{[^}]*pointer-events:auto/s);
 assert.match(css,/\.board-viewport\{[^}]*touch-action:none/s);
});
