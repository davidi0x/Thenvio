import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea} from '../core/idea-graph.mjs';
import {thinkNext,applyThoughts} from '../core/brainstorm.mjs';
test('optional local suggestion engine remains deterministic and context-aware',()=>{
 const g=makeIdea('Platforma do poznawania znajomych');
 const root=thinkNext(g,g.rootId,{mode:'explore',count:4,locale:'pl'});
 const result=applyThoughts(g,g.rootId,root);
 const first=result.added[0];
 const next=thinkNext(result.graph,first,{mode:'explore',count:4,locale:'pl'});
 assert.equal(next.length,4);
 assert.ok(next.every(s=>!root.some(t=>t.title===s.title)));
 assert.ok(next.every(s=>s.question&&s.description.startsWith(s.question)));
});
