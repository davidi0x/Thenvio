// Thenvio Think: a real brainstorm with the person's own Claude account.
// This module only builds the request and applies the answer — pure and deterministic.
// The network call lives in web/ai-think.mjs and runs only when the person clicks.
import {assertIdeaGraph,IDEA_KINDS} from './idea-graph.mjs';
import {addBoardNode,updateBoardMeta,updateBoardText,freeSlots} from './board.mjs';
import {canvasToMarkdown} from './brain.mjs';

export const THINK_MODEL='claude-opus-5-5';
const KINDS=['direction','question','assumption','experiment','insight'];
const GOAL_RE=/^(cel|goal)\s*:\s*(.+)$/im;
const clip=(s,n)=>{s=String(s??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'…':s;};
const rating=v=>Number.isInteger(v)?Math.min(5,Math.max(1,v)):undefined;

export function readGoal(graph){
 const root=graph.nodes.find(n=>n.id===graph.rootId);
 return root?.description.match(GOAL_RE)?.[2].trim()||'';
}
export function withGoal(graph,goal,{locale='en'}={}){
 const root=graph.nodes.find(n=>n.id===graph.rootId);
 const clean=clip(goal,300);
 const rest=root.description.replace(GOAL_RE,'').replace(/^\s*\n/,'');
 const description=clean?(locale==='pl'?'Cel: ':'Goal: ')+clean+(rest?'\n'+rest:''):rest;
 if(description===root.description)return graph;
 return updateBoardText(graph,root.id,{title:root.title,description});
}

export const THINK_SCHEMA=Object.freeze({
 type:'object',additionalProperties:false,
 required:['goal','questions','alternatives','bestPath'],
 properties:{
  goal:{type:'string',description:'The goal restated as one measurable outcome.'},
  questions:{type:'array',items:{type:'object',additionalProperties:false,required:['question','why'],properties:{
   question:{type:'string'},why:{type:'string'}}}},
  alternatives:{type:'array',items:{type:'object',additionalProperties:false,
   required:['title','how','parent','impact','effort','mustBeTrue','test'],properties:{
    title:{type:'string',description:'Short, concrete name of a genuinely different way to reach the goal.'},
    how:{type:'string',description:'How it would work, specific to this idea, 1-3 sentences.'},
    parent:{type:'string',description:'Exact title of the existing note this branches from, or ROOT.'},
    impact:{type:'integer',description:'1-5 estimate of how far it moves the goal.'},
    effort:{type:'integer',description:'1-5 estimate of cost, time and difficulty.'},
    mustBeTrue:{type:'array',items:{type:'string'},description:'The 1-3 assumptions it depends on.'},
    test:{type:'string',description:'The cheapest real-world test with a pass/fail number.'}}}},
  bestPath:{type:'object',additionalProperties:false,required:['choice','why','steps','risk','planB'],properties:{
   choice:{type:'string',description:'Title of the recommended alternative (or existing note).'},
   why:{type:'string'},steps:{type:'array',items:{type:'string'}},
   risk:{type:'string',description:'What would most likely make this fail.'},
   planB:{type:'string'}}}
 }
});

const SYSTEM=`You are a sharp brainstorming partner inside Thenvio, a thinking canvas. The person wants to reach a goal and pick the most efficient way there.

Think like a strategist, not a template:
- Start from the goal and work backwards: what has to be true right before it is reached?
- Propose genuinely different ways to reach it — different mechanisms, audiences, business models, channels, or doing much less — not cosmetic variations. Include at least one unconventional option and one that is radically cheaper or faster.
- Be specific to THIS idea and its context. Generic advice ("talk to users", "start small") is only acceptable when made concrete (who, where, what number).
- Ask the questions that would most change the decision if answered.
- For every option name what must be true and the cheapest test with a clear pass/fail threshold.
- Recommend the route with the best ratio of impact to effort and risk, explain why, give the next concrete steps and a plan B.
- Build on what is already on the canvas; never repeat an existing note. Use "parent" to attach an option under the existing note it belongs to (exact title) or ROOT.

Honesty rules: impact and effort are your estimates, not facts. Never invent statistics, customers, quotes, prices, competitors' numbers or sources; if a fact matters and is unknown, turn it into a question or a test. Do not pad.

Write every field in the same language as the canvas. Return 3-6 questions and 4-7 alternatives.`;

// Messages API request body for a brainstorm on the whole canvas or one focused note.
export function thinkRequest(graph,{focusId=null,goal='',context=[],locale='en',model=THINK_MODEL}={}){
 assertIdeaGraph(graph);
 const focus=focusId&&graph.nodes.find(n=>n.id===focusId);
 const ctx=context.filter(c=>c&&c.content).slice(0,6).map(c=>'<file path="'+c.path+'">\n'+String(c.content).slice(0,6000)+'\n</file>').join('\n');
 const text=[
  ctx?'Shared brain context (team files):\n'+ctx:'',
  'Canvas (Markdown):\n'+canvasToMarkdown(graph,{locale}),
  'Goal: '+(goal||readGoal(graph)||'(not stated — infer the most plausible goal from the main idea and say it)'),
  focus&&focus.id!==graph.rootId?'Focus the brainstorm on the note: "'+focus.title+'" (use it as the parent of new options).':'Brainstorm on the whole canvas.',
  'Language: '+(locale==='pl'?'Polish':'English')+'.'
 ].filter(Boolean).join('\n\n');
 return {
  model,max_tokens:16000,
  output_config:{effort:'high',format:{type:'json_schema',schema:THINK_SCHEMA}},
  system:SYSTEM,
  messages:[{role:'user',content:text}]
 };
}

export function parseThinkResult(raw){
 const body=typeof raw==='string'?JSON.parse(raw):raw;
 if(!body||typeof body!=='object'||!Array.isArray(body.alternatives)||!Array.isArray(body.questions)||!body.bestPath)throw Error('Unexpected brainstorm format.');
 return {
  goal:clip(body.goal,300),
  questions:body.questions.slice(0,8).map(q=>({question:clip(q?.question,150),why:clip(q?.why,600)})).filter(q=>q.question),
  alternatives:body.alternatives.slice(0,10).map(a=>({title:clip(a?.title,150),how:clip(a?.how,1500),parent:clip(a?.parent,150),
   impact:rating(a?.impact),effort:rating(a?.effort),mustBeTrue:(Array.isArray(a?.mustBeTrue)?a.mustBeTrue:[]).slice(0,3).map(s=>clip(s,150)).filter(Boolean),test:clip(a?.test,600)})).filter(a=>a.title),
  bestPath:{choice:clip(body.bestPath.choice,150),why:clip(body.bestPath.why,1200),steps:(Array.isArray(body.bestPath.steps)?body.bestPath.steps:[]).slice(0,8).map(s=>clip(s,300)).filter(Boolean),
   risk:clip(body.bestPath.risk,600),planB:clip(body.bestPath.planB,600)}
 };
}

// Put the brainstorm on the canvas: options with ratings, their assumptions and tests,
// questions under the focus, and the recommended route as a decision-ready insight.
export function applyThinkResult(graph,result,{focusId=null,locale='en'}={}){
 assertIdeaGraph(graph);
 const r=parseThinkResult(result);
 const L=(pl,en)=>locale==='pl'?pl:en;
 const norm=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 let g=graph;const added=[];const optionIds=new Map();
 const anchorDefault=focusId&&graph.nodes.some(n=>n.id===focusId)?focusId:graph.rootId;
 const existing=new Map(graph.nodes.map(n=>[norm(n.title),n.id]));
 const add=(parentId,title,kind,description='')=>{
  if(g.nodes.length>=400)return null;
  const key=norm(title);
  if(existing.has(key))return existing.get(key);
  const [slot]=freeSlots(g,parentId,1);
  if(!slot)return null;
  const made=addBoardNode(g,{title,kind:KINDS.includes(kind)?kind:'direction',description,parentId,x:slot.x,y:slot.y,free:false});
  g=made.graph;existing.set(key,made.id);added.push(made.id);return made.id;
 };
 if(r.goal&&!readGoal(g))g=withGoal(g,r.goal,{locale});
 for(const a of r.alternatives){
  const parent=a.parent&&a.parent.toUpperCase()!=='ROOT'&&existing.get(norm(a.parent))||anchorDefault;
  const id=add(parent,a.title,'direction',a.how);
  if(!id)continue;
  optionIds.set(norm(a.title),id);
  if(a.impact||a.effort){
   const patch={};if(a.impact)patch.impact=a.impact;if(a.effort)patch.effort=a.effort;
   const node=g.nodes.find(n=>n.id===id);if(!node.impact&&!node.effort)g=updateBoardMeta(g,id,patch);
  }
  for(const m of a.mustBeTrue)add(id,m,'assumption');
  if(a.test)add(id,clip(a.test,150),'experiment',a.test.length>150?a.test:'');
 }
 for(const q of r.questions)add(anchorDefault,q.question,'question',q.why);
 const b=r.bestPath;
 if(b.choice){
  const target=optionIds.get(norm(b.choice))||existing.get(norm(b.choice))||anchorDefault;
  const lines=[b.why,'',...b.steps.map((s,i)=>(i+1)+'. '+s),b.risk?'\n'+L('Ryzyko: ','Risk: ')+b.risk:'',b.planB?L('Plan B: ','Plan B: ')+b.planB:'',
   '',L('Rekomendacja AI na podstawie canvasu — hipoteza do sprawdzenia, nie fakt.','AI recommendation from the canvas — a hypothesis to test, not a fact.')].filter((x,i,a)=>x!==''||a[i-1]!=='');
  add(target,clip(L('Najlepsza droga: ','Best route: ')+b.choice,150),'insight',lines.join('\n').slice(0,4000));
 }
 return {graph:assertIdeaGraph(g),added,result:r};
}
export const THINK_KINDS=Object.freeze(KINDS.filter(k=>IDEA_KINDS.includes(k)));
