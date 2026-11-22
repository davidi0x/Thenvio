import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,addIdeaBranch,updateIdeaBranch} from '../core/idea-graph.mjs';
import {coachGraph,recommendTools,recommendSkill,skillBrief,nodeAdvice,inferKind,detectLocale,defaultModeFor,isPlaceholder,TOOL_IDS} from '../core/coach.mjs';
import {analyzeFutures} from '../core/futures.mjs';
import {SKILLS} from '../core/skills.mjs';

const add=(g,parent,title,kind,extra)=>{let next=addIdeaBranch(g,parent,{title,kind});const id=next.nodes.at(-1).id;if(extra)next=updateIdeaBranch(next,id,extra);return [next,id];};

test('typed notes get a sensible kind in Polish and English, defaulting to an option',()=>{
 assert.equal(inferKind('Kto zapłaci za to?'),'question');
 assert.equal(inferKind('What would make this fail'),'question');
 assert.equal(inferKind('Ludzie chcą płacić telefonem'),'assumption');
 assert.equal(inferKind('Users will share results'),'assumption');
 assert.equal(inferKind('Test: landing page for 50 visitors'),'experiment');
 assert.equal(inferKind('Zapytaj 5 kawiarni'),'experiment');
 assert.equal(inferKind('Okazało się, że studenci nie mają budżetu'),'insight');
 assert.equal(inferKind('Subscription for teams'),'direction');
 assert.equal(defaultModeFor('question'),'answer');
 assert.equal(defaultModeFor('assumption'),'test');
});

test('language follows what the person writes',()=>{
 assert.equal(detectLocale('Aplikacja do poznawania ludzi'),'pl');
 assert.equal(detectLocale('Sklep z ceramiką'),'pl');
 assert.equal(detectLocale('An app that helps people meet'),'en');
 assert.equal(detectLocale('',  'pl'),'pl');
 assert.ok(isPlaceholder('Untitled idea')&&isPlaceholder('Nowa myśl')&&!isPlaceholder('Real idea'));
});

test('a blank canvas is coached one step at a time',()=>{
 const blank=makeIdea('Untitled idea');
 const first=coachGraph(blank);
 assert.equal(first[0].action.type,'edit');
 assert.equal(first.length,1,'no noise before the idea has a name');
 const named=makeIdea('A marketplace for local repair');
 const second=coachGraph(named,{locale:'pl'});
 assert.equal(second[0].action.type,'suggest');
 assert.equal(second[0].title,'Otwórz pierwsze kierunki');
});

test('coach finds the untested assumption, the missing audience and the scan',()=>{
 let g=makeIdea('Coffee payments app'),a,b,risk;
 [g,a]=add(g,g.rootId,'Pay at the counter','direction');
 [g,b]=add(g,g.rootId,'Order ahead','direction');
 [g,risk]=add(g,a,'Baristas accept a new terminal','assumption');
 const moves=coachGraph(g,{locale:'en'});
 const byType=Object.fromEntries(moves.map(m=>[m.id.split(':')[0],m]));
 assert.equal(byType.test.action.parentId,risk);
 assert.equal(byType.test.action.seed.kind,'experiment');
 assert.equal(byType.who.action.seed.kind,'question');
 assert.ok(byType.scan,'with a fork in place the coach proposes scanning futures');
 assert.ok(moves.every((m,i,arr)=>i===0||arr[i-1].priority>=m.priority));
 const withFutures=coachGraph(g,{locale:'en',futures:analyzeFutures(g,{locale:'en'})});
 assert.ok(withFutures.some(m=>m.id.startsWith('futures:')));
 assert.ok(!withFutures.some(m=>m.id==='scan'));
});

test('a refuted assumption triggers a pivot suggestion next to the blocked option',()=>{
 let g=makeIdea('Language learning'),opt,risk;
 [g,opt]=add(g,g.rootId,'Video lessons','direction');
 [g,risk]=add(g,opt,'People finish long videos','assumption',{status:'refuted'});
 const pivot=coachGraph(g,{locale:'en'}).find(m=>m.id==='pivot:'+risk);
 assert.ok(pivot);
 assert.equal(pivot.action.type,'add');
 assert.equal(pivot.action.parentId,g.rootId);
 assert.match(pivot.action.seed.title,/Alternative to: Video lessons/);
});

test('tool suggestions explain themselves and never claim a connection',()=>{
 let g=makeIdea('Aplikacja do płatności za kawę'),exp;
 const root=recommendTools(g,g.rootId,{locale:'pl'});
 assert.equal(root[0].id,'payments');
 assert.match(root[0].why,/płatności/,'reason quotes the whole word');
 assert.ok(root.every(t=>t.examples.length>=2&&t.how&&t.why));
 [g,exp]=add(g,g.rootId,'Run a survey with 20 cafe owners','experiment');
 assert.equal(recommendTools(g,exp,{locale:'en'})[0].id,'survey');
 const plain=makeIdea('Something vague');
 assert.ok(recommendTools(plain,plain.rootId).length>0,'kind defaults fill in when no keyword matches');
 assert.ok(TOOL_IDS.length>=15);
});

test('skill recommendations map to the real 24-skill catalog',()=>{
 let g=makeIdea('New product'),q,a;
 [g,q]=add(g,g.rootId,'What price would teams pay?','question');
 [g,a]=add(g,g.rootId,'Teams churn after a month','assumption');
 assert.equal(recommendSkill(g,q).id,'pricing-lab');
 assert.equal(recommendSkill(g,a).id,'assumption-audit');
 const ids=new Set(SKILLS.map(s=>s.id));
 assert.ok(ids.has(recommendSkill(g,g.rootId).id));
 const brief=skillBrief(g,q,'pricing-lab');
 assert.match(brief,/Never invent metrics/);
 assert.match(brief,/NOT externally verified/);
});

test('node advice bundles a thinking mode, tools, a skill and moves for that note',()=>{
 let g=makeIdea('Community for new parents'),opt;
 [g,opt]=add(g,g.rootId,'Weekly meetups','direction');
 const advice=nodeAdvice(g,opt,{locale:'en'});
 assert.equal(advice.mode,'challenge');
 assert.ok(advice.tools.length>0);
 assert.ok(advice.skill.id);
 assert.ok(advice.moves.every(m=>m.action.nodeId===opt||m.action.parentId===opt));
 assert.throws(()=>nodeAdvice(g,'missing'));
});
