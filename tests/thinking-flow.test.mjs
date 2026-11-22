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

test('AI runs only on the person\'s own key, on click, to Anthropic only; GitHub is read-only',async()=>{
 const html=await file('web/index.html');
 const canvas=await file('web/free-canvas.mjs');
 const ai=await file('web/ai-think.mjs');
 const gh=await file('web/github-brain.mjs');
 const worker=await file('scripts/cloudflare-worker.mjs');
 assert.doesNotMatch(canvas,/fetch\(/,'the canvas itself makes no network calls');
 assert.equal((ai.match(/fetch\(/g)||[]).length,1);
 assert.match(ai,/fetch\('https:\/\/api\.anthropic\.com\/v1\/messages'/);
 assert.doesNotMatch(ai+gh,/localStorage|sessionStorage|indexedDB/,'keys and tokens are never stored');
 assert.match(gh,/https:\/\/api\.github\.com/);
 assert.doesNotMatch(gh,/method:\s*'(POST|PUT|PATCH|DELETE)'/,'GitHub access is read-only');
 assert.match(html,/Billed to your own account/);
 assert.match(html,/id="boardCopyPrompt"/,'works without a key via any assistant');
 assert.match(worker,/connect-src 'self' https:\/\/api\.anthropic\.com https:\/\/api\.github\.com/);
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
