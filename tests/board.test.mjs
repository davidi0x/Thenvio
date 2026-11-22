import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,readIdeaGraph,linkIdeaBranches,deleteIdeaBranch} from '../core/idea-graph.mjs';
import {prepareBoard,moveBoardNode,addBoardNode,updateBoardText,visibleBoardEdges} from '../core/board.mjs';
test('old idea graphs gain stable freeform positions without losing their text',()=>{
 const original=makeIdea('Unrestricted idea');
 const ready=prepareBoard(original);
 assert.ok(Number.isFinite(ready.nodes[0].x));
 assert.ok(Number.isFinite(ready.nodes[0].y));
 assert.equal(ready.nodes[0].title,'Unrestricted idea');
 assert.deepEqual(prepareBoard(ready),ready);
});
test('free note stays unattached visually; explicit child and cross-link are visible',()=>{
 let graph=prepareBoard(makeIdea('Start'));
 const loose=addBoardNode(graph,{title:'A free note',x:1800,y:1200});
 graph=loose.graph;
 assert.equal(visibleBoardEdges(graph).length,0);
 const connected=addBoardNode(graph,{title:'Connected',parentId:loose.id,x:2050,y:1250,free:false});
 graph=connected.graph;
 assert.deepEqual(visibleBoardEdges(graph),[{from:loose.id,to:connected.id,type:'parent'}]);
 graph=linkIdeaBranches(graph,graph.rootId,loose.id);
 assert.equal(visibleBoardEdges(graph).length,2);
});
test('dragged positions persist in export and import without auto re-layout',()=>{
 let graph=prepareBoard(makeIdea('Freedom'));
 const id=graph.rootId;
 graph=moveBoardNode(graph,id,2700,1700);
 assert.equal(prepareBoard(readIdeaGraph(JSON.stringify(graph))).nodes[0].x,2700);
 assert.equal(prepareBoard(readIdeaGraph(JSON.stringify(graph))).nodes[0].y,1700);
 assert.throws(()=>moveBoardNode(graph,id,Infinity,20),/Invalid canvas/);
});
test('title and notes edit preserves graph identity, deletion cascading',()=>{
 let graph=prepareBoard(makeIdea('Start'));
 const child=addBoardNode(graph,{title:'Anything',x:1600,y:1100,free:true});graph=child.graph;
 graph=updateBoardText(graph,child.id,{title:'  Thought  ',description:'No rigid category'});
 assert.equal(graph.nodes.find(n=>n.id===child.id).title,'Thought');
 assert.equal(graph.nodes.find(n=>n.id===child.id).description,'No rigid category');
 assert.equal(deleteIdeaBranch(graph,child.id).nodes.length,1);
});


test('collapsed legacy branches also receive distinct positions during migration',async()=>{
 const {demoIdeas}=await import('../core/demo-ideas.mjs');
 const graph=prepareBoard(demoIdeas);
 const coords=new Set(graph.nodes.map(n=>n.x+':'+n.y));
 assert.equal(coords.size,graph.nodes.length);
 assert.equal(prepareBoard(graph).nodes.length,demoIdeas.nodes.length);
});
