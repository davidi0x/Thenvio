import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,addIdeaBranch,updateIdeaBranch,linkIdeaBranches,validateIdeaGraph} from '../core/idea-graph.mjs';
import {analyzeFutures,countFutures,findForks,scoreOption,decisionRecord,confidenceLabel,FUTURE_LIMITS} from '../core/futures.mjs';

// Small builder: returns the graph plus named ids.
function build(spec){
 let g=makeIdea(spec.title||'Root idea');
 const ids={root:g.rootId};
 for(const [name,parent,title,kind,extra] of spec.nodes){
  g=addIdeaBranch(g,ids[parent],{title,kind});
  ids[name]=g.nodes.at(-1).id;
  if(extra)g=updateIdeaBranch(g,ids[name],extra);
 }
 for(const [a,b,type] of spec.links||[]){
  g=linkIdeaBranches(g,ids[a],ids[b]);
  if(type)g={...g,links:g.links.map(l=>l.from===ids[a]&&l.to===ids[b]?{...l,type}:l)};
 }
 return {g,ids};
}
const TWO_FORKS=[
 ['who','root','Who is it for?','question'],
 ['students','who','Students','direction',{impact:4,effort:2}],
 ['expats','who','Expats','direction',{impact:5,effort:4}],
 ['money','root','How does it earn?','question'],
 ['sub','money','Subscription','direction',{impact:4,effort:3}],
 ['ads','money','Ads','direction',{impact:2,effort:2}]
];
const twoForks=()=>build({nodes:TWO_FORKS});

test('every combination of choices is counted and enumerated exhaustively',()=>{
 const {g}=twoForks();
 assert.equal(countFutures(g),4n);
 assert.equal(findForks(g).length,2);
 const r=analyzeFutures(g);
 assert.equal(r.total,'4');
 assert.equal(r.evaluated,4);
 assert.equal(r.exhaustive,true);
 assert.equal(r.viable+r.blocked,4);
 assert.ok(r.winner);
 assert.equal(r.winner.choices.length,2,'a scenario picks one option at each fork');
 assert.ok(r.scenarios.every((s,i,a)=>i===0||a[i-1].blocked<s.blocked||a[i-1].score>=s.score),'ranking is ordered');
});

test('a conflict link blocks only the scenarios that combine both notes',()=>{
 const {g,ids}=build({nodes:TWO_FORKS,links:[['students','ads','conflicts']]});
 const r=analyzeFutures(g);
 assert.equal(r.blocked,1);
 const blocked=r.blockedSamples[0];
 assert.ok(blocked.options.includes(ids.students)&&blocked.options.includes(ids.ads));
 assert.equal(blocked.blockers[0].code,'conflict');
});

test('a refuted assumption kills every future that depends on it',()=>{
 const {g,ids}=build({nodes:[
  ['a','root','Option A','direction',{impact:5,effort:1}],
  ['b','root','Option B','direction',{impact:2,effort:3}],
  ['risk','a','People will pay for A','assumption',{status:'refuted'}]
 ]});
 const r=analyzeFutures(g);
 assert.equal(r.winner.options[0],ids.b,'the high-impact option is blocked by refuted evidence');
 assert.ok(r.blockedSamples[0].blockers.some(b=>b.code==='refuted'&&b.nodeId===ids.risk));
 assert.ok(scoreOption(g,ids.a).blockers.length>0);
});

test('ratings and evidence change the ranking transparently',()=>{
 const base=build({nodes:[['a','root','Option A','direction'],['b','root','Option B','direction']]});
 const flat=analyzeFutures(base.g);
 assert.equal(flat.margin,0,'unrated options tie');
 assert.equal(flat.nextMove.code,'rate');
 const rated=updateIdeaBranch(base.g,base.ids.b,{impact:5,effort:1});
 assert.equal(analyzeFutures(rated).winner.options[0],base.ids.b);
 let ev=addIdeaBranch(base.g,base.ids.a,{title:'Users asked for A',kind:'assumption'});
 ev=updateIdeaBranch(ev,ev.nodes.at(-1).id,{status:'supported'});
 assert.ok(scoreOption(ev,base.ids.a).score>scoreOption(base.g,base.ids.a).score,'supported evidence raises the option');
});

test('the weakest link names the assumption whose failure hurts most, with a plan B',()=>{
 const {g,ids}=build({nodes:[
  ['a','root','Option A','direction',{impact:5,effort:2}],
  ['b','root','Option B','direction',{impact:3,effort:3}],
  ['must','a','Teams will adopt A weekly','assumption'],
  ['test','a','Run a pilot with 5 teams if ≥3 return','experiment']
 ]});
 const r=analyzeFutures(g,{locale:'en'});
 assert.equal(r.winner.options[0],ids.a);
 assert.equal(r.weakest.nodeId,ids.must);
 assert.equal(r.weakest.fallback.options[0],ids.b);
 assert.ok(r.weakest.drop>0);
 assert.equal(r.nextMove.code,'test');
 assert.equal(r.nextMove.nodeId,ids.must);
});

test('shared assumptions above every fork are flagged as critical',()=>{
 const {g,ids}=build({nodes:[
  ['core','root','People feel lonely in new cities','assumption'],
  ['a','core','Option A','direction',{impact:4,effort:2}],
  ['b','core','Option B','direction',{impact:3,effort:2}]
 ]});
 const r=analyzeFutures(g);
 assert.equal(r.weakest.nodeId,ids.core);
 assert.equal(r.weakest.everything,true);
 assert.equal(r.weakest.fallback,null);
});

test('no forks gives an honest empty state and a concrete next move',()=>{
 const {g}=build({nodes:[['a','root','Only option','direction']]});
 const r=analyzeFutures(g);
 assert.equal(r.forks.length,0);
 assert.equal(r.nextMove.code,'add-alternative');
 const empty=analyzeFutures(makeIdea('Nothing yet'));
 assert.equal(empty.winner,null);
 assert.equal(empty.nextMove.code,'add-alternative');
});

test('all blocked means no winner and a pivot move, never a phantom recommendation',()=>{
 const {g}=build({nodes:[
  ['a','root','A','direction',{status:'refuted'}],
  ['b','root','B','direction',{status:'refuted'}]
 ]});
 const r=analyzeFutures(g);
 assert.equal(r.winner,null);
 assert.equal(r.viable,0);
 assert.equal(r.nextMove.code,'pivot');
 assert.throws(()=>decisionRecord(g,r),/No winning route/);
});

test('supporting links add a capped synergy bonus',()=>{
 const plain=twoForks();
 const linked=build({nodes:TWO_FORKS,links:[['students','sub','supports']]});
 const a=analyzeFutures(plain.g).scenarios.find(s=>s.options.includes(plain.ids.students)&&s.options.includes(plain.ids.sub));
 const b=analyzeFutures(linked.g).scenarios.find(s=>s.options.includes(linked.ids.students)&&s.options.includes(linked.ids.sub));
 assert.equal(b.synergy,FUTURE_LIMITS.synergy);
 assert.equal(Math.round((b.score-a.score)*10)/10,FUTURE_LIMITS.synergy);
});

test('huge graphs switch to a deterministic guided search instead of freezing',()=>{
 let g=makeIdea('Big decision');
 for(let f=0;f<7;f++){
  g=addIdeaBranch(g,g.rootId,{title:'Choice '+f,kind:'question'});
  const fork=g.nodes.at(-1).id;
  for(let o=0;o<5;o++){g=addIdeaBranch(g,fork,{title:'Option '+f+'.'+o,kind:'direction'});g=updateIdeaBranch(g,g.nodes.at(-1).id,{impact:1+((f+o)%5),effort:1+((f*o)%5)});}
 }
 assert.equal(countFutures(g),78125n);
 const t0=Date.now();
 const r=analyzeFutures(g);
 assert.ok(Date.now()-t0<4000,'analysis stays interactive');
 assert.equal(r.total,'78125');
 assert.equal(r.exhaustive,false);
 assert.ok(r.evaluated<=FUTURE_LIMITS.beam);
 assert.deepEqual(analyzeFutures(g).winner.key,r.winner.key,'same input, same answer');
});

test('loose notes stay out of the analysis until they are connected',()=>{
 const {g}=build({nodes:[['a','root','A','direction'],['b','root','B','direction']]});
 const withLoose={...g,nodes:[...g.nodes,{...g.nodes.at(-1),id:'loose_1',title:'Random loose thought',free:true}]};
 assert.deepEqual(validateIdeaGraph(withLoose),[]);
 assert.equal(countFutures(withLoose),2n);
});

test('analysis is pure, bilingual and labels itself as a heuristic',()=>{
 const {g}=twoForks();
 const before=JSON.stringify(g);
 const en=analyzeFutures(g,{locale:'en'}),pl=analyzeFutures(g,{locale:'pl'});
 assert.equal(JSON.stringify(g),before);
 assert.match(en.disclaimer,/not a probability/);
 assert.match(pl.disclaimer,/nie prawdopodobieństwo/);
 assert.equal(en.winner.key,pl.winner.key);
 assert.equal(confidenceLabel('solid','pl'),'solidna');
 assert.throws(()=>confidenceLabel('certain'));
 const rec=decisionRecord(g,en,{locale:'en'});
 assert.match(rec.title,/^Decision: /);
 assert.match(rec.description,/not a probability/);
 assert.ok(rec.title.length<=150&&rec.description.length<=4000);
});
