import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea} from '../core/idea-graph.mjs';
import {thinkNext,applyThoughts} from '../core/brainstorm.mjs';
import {readFile} from 'node:fs/promises';

test('deep branch expansion does not repeat the root category brainstorm',()=>{
 const g=makeIdea('Platforma do poznawania znajomych');
 const root=thinkNext(g,g.rootId,{mode:'explore',count:4,locale:'pl'});
 const result=applyThoughts(g,g.rootId,root);
 const first=result.added[0];
 const sub=thinkNext(result.graph,first,{mode:'explore',count:4,locale:'pl'});
 assert.equal(sub.length,4);
 assert.ok(sub.every(s=>!root.some(t=>t.title===s.title)));
 assert.ok(sub.every(s=>s.description.includes(result.graph.nodes.find(n=>n.id===first).title)));
});

test('one-tap flow changes from discovery to answers then experiments',async()=>{
 const flow=await readFile(new URL('../web/idea-flow.mjs',import.meta.url),'utf8');
 assert.match(flow,/depth===1\)return 'answer'/);
 assert.match(flow,/depth>=2\)return 'test'/);
 assert.match(flow,/node\.kind==='question'\)return 'answer'/);
 assert.match(flow,/node\.kind==='assumption'\)return 'challenge'/);
});

test('mobile shows a visible explore CTA and new ideas reveal suggestions instantly',async()=>{
 const css=await readFile(new URL('../web/ideas.css',import.meta.url),'utf8');
 const ui=await readFile(new URL('../web/idea-explorer.mjs',import.meta.url),'utf8');
 assert.match(css,/\.idea-open-flow\{top:12px;bottom:auto;/);
 assert.match(ui,/if\(window\.matchMedia\('\(max-width: 690px\)'\)\.matches\)flow\.open\(\)/);
});
