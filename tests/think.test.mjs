import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,addIdeaBranch,validateIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {thinkRequest,applyThinkResult,parseThinkResult,readGoal,withGoal,THINK_SCHEMA,THINK_MODEL} from '../core/think.mjs';
import {analyzeFutures} from '../core/futures.mjs';

import {SAMPLE} from './fixtures/think-sample.mjs';

test('the request asks Claude for a goal-driven brainstorm with structured output',()=>{
 let g=prepareBoard(makeIdea('Phone payments for cafes'));
 g=addIdeaBranch(g,g.rootId,{title:'Pay at the counter',kind:'direction'});
 const req=thinkRequest(g,{goal:'100 paying cafes',context:[{path:'brand/README.md',content:'We are for independent cafes.'}],locale:'en'});
 assert.equal(req.model,THINK_MODEL);
 assert.equal(req.output_config.format.type,'json_schema');
 assert.deepEqual(req.output_config.format.schema,THINK_SCHEMA);
 assert.match(req.system,/genuinely different/);
 assert.match(req.system,/Never invent statistics/);
 assert.match(req.messages[0].content,/Goal: 100 paying cafes/);
 assert.match(req.messages[0].content,/Pay at the counter/,'the canvas is sent as context');
 assert.match(req.messages[0].content,/independent cafes/,'shared-brain files are sent as context');
 const walk=s=>{if(s.type==='object'){assert.equal(s.additionalProperties,false);Object.values(s.properties).forEach(walk);}if(s.type==='array')walk(s.items);};
 walk(THINK_SCHEMA);
});

test('the answer lands on the canvas as rated options with assumptions, tests, questions and a best route',()=>{
 const g=prepareBoard(makeIdea('Phone payments for cafes'));
 const {graph,added}=applyThinkResult(g,SAMPLE,{locale:'en'});
 assert.deepEqual(validateIdeaGraph(graph),[]);
 const by=t=>graph.nodes.find(n=>n.title===t);
 assert.equal(by('QR sticker instead of a terminal').impact,4);
 assert.equal(by('Customers already pay by phone in cafes').kind,'assumption');
 assert.equal(by('5 cafes for 2 weeks; pass if 30% of payments use QR').kind,'experiment');
 assert.equal(by('What do cafes pay for card terminals today?').kind,'question');
 const best=graph.nodes.find(n=>n.title.startsWith('Best route:'));
 assert.equal(best.parentId,by('QR sticker instead of a terminal').id);
 assert.match(best.description,/hypothesis to test, not a fact/);
 assert.equal(readGoal(graph),'100 paying cafes in 6 months');
 assert.ok(added.length>=9);
 assert.equal(applyThinkResult(graph,SAMPLE).added.length,0,'running it again does not duplicate notes');
 const f=analyzeFutures(graph);
 assert.ok(f.forks.length>=1&&f.winner,'the brainstorm feeds the futures scan');
});

test('goals are stored in the main idea and malformed answers are rejected',()=>{
 const g=prepareBoard(makeIdea('Idea'));
 const withG=withGoal(g,'Ship in May',{locale:'pl'});
 assert.equal(readGoal(withG),'Ship in May');
 assert.match(withG.nodes[0].description,/^Cel: Ship in May/);
 assert.equal(readGoal(withGoal(withG,'',{})),'');
 assert.throws(()=>parseThinkResult('{"nope":1}'),/Unexpected/);
 const big=parseThinkResult({...SAMPLE,alternatives:[{...SAMPLE.alternatives[0],impact:9,title:'x'.repeat(300)}]});
 assert.equal(big.alternatives[0].impact,5,'ratings are clamped');
 assert.ok(big.alternatives[0].title.length<=150);
});
