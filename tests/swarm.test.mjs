import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,addIdeaBranch,updateIdeaBranch,validateIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {simulateSwarm,swarmNotes,summarizeVoices,SWARM_LIMITS} from '../core/swarm.mjs';

function canvas(){
 let g=prepareBoard(makeIdea('Phone payments for cafes'));
 const add=(p,title,kind,extra)=>{g=addIdeaBranch(g,p,{title,kind});const id=g.nodes.at(-1).id;if(extra)g=updateIdeaBranch(g,id,extra);return id;};
 const ids={
  qr:add(g.rootId,'QR sticker with phone payment','direction',{impact:4,effort:2}),
  app:add(g.rootId,'New app with account and subscription','direction',{impact:4,effort:4}),
  loyalty:add(g.rootId,'Loyalty stamps without an app','direction',{impact:2,effort:1})
 };
 add(ids.qr,'Customers trust paying by phone in cafes','assumption');
 return {g:prepareBoard(g),ids};
}

test('the crowd is deterministic, bounded and shows adoption over rounds',()=>{
 const {g}=canvas();
 const a=simulateSwarm(g,{locale:'en'}),b=simulateSwarm(g,{locale:'en'});
 assert.deepEqual(a.options.map(o=>o.adoption),b.options.map(o=>o.adoption),'same canvas, same crowd');
 assert.notDeepEqual(simulateSwarm(g,{seed:3}).frames.at(-1),a.frames.at(-1),'another seed is another crowd');
 assert.equal(a.frames.length,a.rounds);
 assert.equal(a.frames[0].length,a.agents);
 for(const o of a.options){
  assert.ok(o.curve.every((v,i,arr)=>i===0||v>=arr[i-1]),'adoption never goes down');
  assert.ok(o.adoption>=0&&o.adoption<=100);
 }
 assert.ok(a.winner,'someone takes something up');
 assert.match(a.disclaimer,/not real people/);
 const big=simulateSwarm(g,{agents:9999,rounds:999});
 assert.equal(big.agents,SWARM_LIMITS.agents);assert.equal(big.rounds,SWARM_LIMITS.rounds);
});

test('objections follow the option: trust for payments, effort and price for a subscription app',()=>{
 const {g,ids}=canvas();
 const r=simulateSwarm(g,{locale:'en'});
 const by=id=>r.options.find(o=>o.optionId===id);
 assert.equal(by(ids.qr).objections[0].category,'trust');
 assert.ok(['friction','price'].includes(by(ids.app).objections[0].category));
 assert.ok(!by(ids.loyalty).objections.some(o=>o.category==='install'),'"without an app" is not read as a new app');
 assert.ok(by(ids.app).objections[0].segments.length>0,'objections say who raises them');
});

test('refuted evidence removes an option from the crowd; no options gives an honest empty state',()=>{
 const {g,ids}=canvas();
 const refuted=updateIdeaBranch(g,g.nodes.find(n=>n.title.startsWith('Customers trust')).id,{status:'refuted'});
 const r=simulateSwarm(refuted);
 const qr=r.options.find(o=>o.optionId===ids.qr);
 assert.equal(qr.blocked,true);assert.equal(qr.adoption,0);
 const empty=simulateSwarm(prepareBoard(makeIdea('Nothing yet')),{locale:'pl'});
 assert.equal(empty.options.length,0);assert.match(empty.empty,/Opcja/);
});

test('personas from a chat model shape the crowd and their voices land on the canvas',()=>{
 const {g,ids}=canvas();
 const personas=[
  {name:'Busy barista',share:3,traits:{gain:.5,timeCost:1,caution:.4,priceSens:.4,trustNeed:.3,habit:.7,social:.4,threshold:.5},
   reactions:[{option:'QR sticker with phone payment',stance:'reject',why:'I have no time to explain QR codes at the till.',wouldChangeMindIf:'It works with zero setup.'}]},
  {name:'Student regular',share:1,traits:{gain:.9,timeCost:.2,caution:.2,priceSens:.9,trustNeed:.2,habit:.2,social:.9,threshold:.3},
   reactions:[{option:'QR sticker with phone payment',stance:'adopt',why:'Faster than cards.'}]}
 ];
 const r=simulateSwarm(g,{personas,locale:'en'});
 assert.deepEqual(r.segments.map(s=>s.name),['Busy barista','Student regular']);
 assert.deepEqual(r.segments.map(s=>s.share),[75,25]);
 const voices=summarizeVoices(g,personas);
 assert.equal(voices[0].reject,1);assert.equal(voices[0].adopt,1);
 const out=swarmNotes(g,r,{locale:'en',voices});
 assert.deepEqual(validateIdeaGraph(out.graph),[]);
 const titles=out.graph.nodes.map(n=>n.title);
 assert.ok(titles.some(t=>t.startsWith('Crowd voice (1/2 against): I have no time')));
 assert.ok(titles.some(t=>t.startsWith('Check for real: 5 conversations')),'one real-world check is added');
 assert.equal(swarmNotes(out.graph,r,{locale:'en',voices}).added.length,0,'no duplicates on a second run');
});

test('honest verdict: unrated options are a guess, ranges hold the estimate, uptake is not zero-sum',()=>{
 let g=prepareBoard(makeIdea('Phone payments for cafes'));
 for(const t of ['QR sticker with phone payment','New app with account and subscription','Loyalty stamps without an app'])g=addIdeaBranch(g,g.rootId,{title:t,kind:'direction'});
 g=prepareBoard(g);
 const guess=simulateSwarm(g,{locale:'en'});
 assert.equal(guess.certainty,'unclear','titles alone never make a verdict');
 assert.equal(guess.next.code,'rate');
 assert.match(guess.verdict,/Too early/);
 const {g:rated,ids}=canvas();
 const r=simulateSwarm(rated,{locale:'en'});
 for(const o of r.options)assert.ok(o.range[0]<=o.adoption&&o.adoption<=o.range[1],'the range holds the estimate');
 assert.ok(r.options.every(o=>o.adoption>0),'no option is cut to zero by a keyword');
 const by=id=>r.options.find(o=>o.optionId===id);
 assert.ok(by(ids.app).adoption<by(ids.qr).adoption,'a paid app with an account is taken up less than a QR sticker');
 assert.ok(['clear','close'].includes(r.certainty));
 assert.ok(r.next&&r.next.optionId===r.winner.optionId&&r.next.code==='test','next step tests the leader\'s main objection');
 const pl=simulateSwarm(rated,{locale:'pl'});
 assert.match(pl.verdict,/prowadzi|Na styk/);
});
