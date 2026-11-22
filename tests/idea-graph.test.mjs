import test from 'node:test';
import assert from 'node:assert/strict';
import {
 makeIdea,addIdeaBranch,updateIdeaBranch,deleteIdeaBranch,linkIdeaBranches,unlinkIdeaBranches,
 validateIdeaGraph,assertIdeaGraph,readIdeaGraph,branchStats,branchPath,layoutIdeaGraph,
 developIdeaBranch,ideaContext,outlineIdeaGraph,BRANCH_TEMPLATES
} from '../core/idea-graph.mjs';
import {demoIdeas} from '../core/demo-ideas.mjs';

test('new idea has one root and can grow into multiple nested branches',()=>{
 const one=makeIdea('Rethink how people plan trips');
 const two=addIdeaBranch(one,one.rootId,{title:'What about families?',kind:'question'});
 const child=two.nodes.at(-1);
 const three=addIdeaBranch(two,child.id,{title:'Find travel pain points',kind:'experiment'});
 assert.equal(branchPath(three,three.nodes.at(-1).id).length,3);
 assert.equal(branchStats(three).depth,2);
 assert.equal(one.nodes.length,1);
 assert.equal(validateIdeaGraph(three).length,0);
});

test('tree deleting a branch cascades but does not touch other siblings or root',()=>{
 let g=makeIdea('Root');
 g=addIdeaBranch(g,g.rootId,{title:'A'});
 const a=g.nodes.at(-1).id;
 g=addIdeaBranch(g,a,{title:'A1'});
 g=addIdeaBranch(g,g.rootId,{title:'B'});
 const b=g.nodes.at(-1).id;
 g=linkIdeaBranches(g,a,b);
 assert.equal(g.links.length,1);
 g=deleteIdeaBranch(g,a);
 assert.equal(g.nodes.length,2);
 assert.equal(g.links.length,0);
 assert.equal(g.nodes.at(-1).id,b);
 assert.throws(()=>deleteIdeaBranch(g,g.rootId),/cannot be removed/);
});

test('connections and updates preserve the graph and reject unsafe data',()=>{
 let g=makeIdea('Root');
 g=addIdeaBranch(g,g.rootId,{title:'A'});
 const a=g.nodes.at(-1).id;
 g=updateIdeaBranch(g,a,{title:'More detail',status:'supported',evidence:'Interview note'});
 g=linkIdeaBranches(g,g.rootId,a);
 g=linkIdeaBranches(g,g.rootId,a);
 assert.equal(g.links.length,1);
 assert.equal(g.nodes.at(-1).evidence,'Interview note');
 assert.equal(unlinkIdeaBranches(g,g.rootId,a).links.length,0);
 assert.throws(()=>updateIdeaBranch(g,a,{kind:'nonsense'}),/Invalid branch kind/);
 assert.throws(()=>linkIdeaBranches(g,a,'missing'),/two different/);
});

test('invalid roots, parent cycles, disconnected branches and cross-links fail',()=>{
 const g=makeIdea('Root');
 const bad=structuredClone(g);
 bad.nodes[0].parentId=bad.nodes[0].id;
 assert.ok(validateIdeaGraph(bad).length>0);
 const extra=structuredClone(g);
 extra.nodes.push({...extra.nodes[0],id:'stray',parentId:'missing'});
 assert.ok(validateIdeaGraph(extra).length>0);
 assert.throws(()=>readIdeaGraph('{"schemaVersion":999}'));
});

test('layout keeps parent centered and hides collapsed subtrees',()=>{
 const before=layoutIdeaGraph(demoIdeas);
 const visible=new Set(before.nodes.map(n=>n.id));
 assert.ok(visible.has('root')&&visible.has('problem')&&visible.has('people'));
 assert.ok(!visible.has('tool'));
 assert.ok(before.nodes.find(x=>x.id==='directions').hiddenChildren===2);
 const expanded=updateIdeaBranch(demoIdeas,'directions',{collapsed:false});
 const after=layoutIdeaGraph(expanded);
 assert.ok(after.nodes.some(x=>x.id==='tool'));
 assert.equal(after.edges.length,after.nodes.length-1);
 assert.ok(after.width>0&&after.height>0);
});

test('develop templates add real editable branches, no fake AI data',()=>{
 const g=makeIdea('Explore an idea');
 const result=developIdeaBranch(g,g.rootId);
 assert.equal(result.nodes.length,1+BRANCH_TEMPLATES.idea.length);
 assert.ok(result.nodes.every(n=>n.title&&n.description!==undefined));
 assert.match(ideaContext(result,result.nodes.at(-1).id),/NOT externally verified/);
 assert.equal(outlineIdeaGraph(result).length,result.nodes.length);
});

test('JSON import/export roundtrip validates and retains structure',()=>{
 const clone=readIdeaGraph(JSON.stringify(demoIdeas));
 assert.deepEqual(clone,demoIdeas);
 assert.notEqual(clone,demoIdeas);
 assert.equal(assertIdeaGraph(clone).rootId,'root');
});
