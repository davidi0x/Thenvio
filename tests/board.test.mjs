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

// ── v0.6 placement, layout, metadata and connections ──
import {freeSlots,tidyLayout,updateBoardMeta,setLinkType,connectNotes,detachNote,moveBoardNodes,CARD_W,CARD_H} from '../core/board.mjs';
import {validateIdeaGraph} from '../core/idea-graph.mjs';
const overlap=(a,b)=>a.x<b.x+CARD_W&&a.x+CARD_W>b.x&&a.y<b.y+CARD_H&&a.y+CARD_H>b.y;
test('free slots never overlap notes and are deterministic',()=>{
 let g=prepareBoard(makeIdea('Root'));
 for(let i=0;i<5;i++)g=addBoardNode(g,{title:'N'+i,parentId:g.rootId,x:g.nodes[0].x+312,y:g.nodes[0].y+(i-2)*130,free:false}).graph;
 const slots=freeSlots(g,g.rootId,4);
 assert.equal(slots.length,4);
 assert.deepEqual(freeSlots(g,g.rootId,4),slots);
 for(const s of slots){
  assert.ok(g.nodes.every(n=>!overlap(s,n)));
  assert.ok(slots.every(o=>o===s||!overlap(s,o)));
 }
 assert.throws(()=>freeSlots(g,g.rootId,0));
});
test('tidy layout keeps the main idea anchored and removes overlaps',()=>{
 let g=prepareBoard(makeIdea('Root'));
 const rootPos={x:g.nodes[0].x,y:g.nodes[0].y};
 let parent=g.rootId;
 for(let i=0;i<6;i++){const r=addBoardNode(g,{title:'N'+i,parentId:i%2?parent:g.rootId,x:2000,y:1200,free:false});g=r.graph;if(i===0)parent=r.id;}
 const tidy=tidyLayout(g);
 assert.deepEqual({x:tidy.nodes[0].x,y:tidy.nodes[0].y},rootPos);
 for(const a of tidy.nodes)for(const b of tidy.nodes)if(a!==b)assert.ok(!overlap(a,b),'no two notes overlap');
 assert.deepEqual(validateIdeaGraph(tidy),[]);
});
test('metadata edits validate kinds, statuses and 1–5 ratings; null clears a rating',()=>{
 let g=prepareBoard(makeIdea('Root'));
 const n=addBoardNode(g,{title:'Option',x:1800,y:900,free:false});g=n.graph;
 g=updateBoardMeta(g,n.id,{kind:'assumption',status:'supported',impact:4,effort:2,evidence:'Interview #3'});
 const node=g.nodes.find(x=>x.id===n.id);
 assert.equal(node.kind,'assumption');assert.equal(node.impact,4);assert.equal(node.evidence,'Interview #3');
 g=updateBoardMeta(g,n.id,{impact:null});
 assert.equal('impact' in g.nodes.find(x=>x.id===n.id),false);
 assert.throws(()=>updateBoardMeta(g,n.id,{effort:7}),/1 to 5/);
 assert.throws(()=>updateBoardMeta(g,g.rootId,{kind:'question'}),/keeps its kind/);
 assert.throws(()=>updateBoardMeta(g,n.id,{status:'certain'}));
 const bad=structuredClone(g);bad.nodes[1].impact=9;
 assert.ok(validateIdeaGraph(bad).some(e=>/rating/.test(e)));
});
test('connecting a loose note attaches it; connecting tree notes makes a typed link',()=>{
 let g=prepareBoard(makeIdea('Root'));
 const a=addBoardNode(g,{title:'A',x:1800,y:900,free:false});g=a.graph;
 const b=addBoardNode(g,{title:'B',x:1800,y:1100,free:false});g=b.graph;
 const loose=addBoardNode(g,{title:'Loose',x:300,y:300,free:true});g=loose.graph;
 const attached=connectNotes(g,a.id,loose.id);
 assert.equal(attached.mode,'attached');
 const moved=attached.graph.nodes.find(n=>n.id===loose.id);
 assert.equal(moved.parentId,a.id);assert.equal(moved.free,false);
 const linked=connectNotes(attached.graph,a.id,b.id);
 assert.equal(linked.mode,'linked');
 assert.deepEqual(visibleBoardEdges(linked.graph).find(e=>e.type==='link'),{from:a.id,to:b.id,type:'link',relation:'relates'});
 assert.equal(connectNotes(linked.graph,b.id,a.id).mode,'exists');
 const typed=setLinkType(linked.graph,a.id,b.id,'conflicts');
 assert.equal(typed.links[0].type,'conflicts');
 assert.throws(()=>setLinkType(typed,a.id,b.id,'hates'));
 const badLink=structuredClone(typed);badLink.links[0].type='hates';
 assert.ok(validateIdeaGraph(badLink).some(e=>/connection type/.test(e)));
 const detached=detachNote(typed,a.id);
 assert.equal(detached.nodes.find(n=>n.id===a.id).free,true);
 assert.throws(()=>detachNote(typed,typed.rootId));
});
test('a dragged subtree moves in one undoable step',()=>{
 let g=prepareBoard(makeIdea('Root'));
 const a=addBoardNode(g,{title:'A',x:1800,y:900,free:false});g=a.graph;
 const moved=moveBoardNodes(g,[{id:g.rootId,x:100,y:100},{id:a.id,x:420,y:100}]);
 assert.deepEqual(moved.nodes.map(n=>[n.x,n.y]),[[100,100],[420,100]]);
 assert.throws(()=>moveBoardNodes(g,[{id:'missing',x:1,y:1}]));
 assert.throws(()=>moveBoardNodes(g,[{id:a.id,x:-5,y:1}]));
});
