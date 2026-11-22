// Thenvio Futures: look through every combination of choices in an idea graph and
// rank the resulting scenarios. Pure, deterministic and dependency-free.
// Scores are comparative heuristics built from the user's own notes and ratings.
// They are NOT probabilities, forecasts or verified research.
import {assertIdeaGraph} from './idea-graph.mjs';

export const FUTURE_WEIGHTS=Object.freeze({impact:.40,ease:.25,evidence:.25,testability:.10});
export const FUTURE_LIMITS=Object.freeze({exhaustive:4000,beam:160,synergy:4,synergyCap:12});
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const round1=v=>Math.round(v*10)/10;
const isOption=n=>n.kind==='direction';
const isOpenStatus=n=>n.status==='open'||n.status==='exploring';
const L=(locale,pl,en)=>locale==='pl'?pl:en;
const short=(s,n=60)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
const CONFIDENCE={solid:['solidna','solid'],shaky:['chwiejna','shaky'],speculative:['spekulatywna','speculative']};
export function confidenceLabel(level,locale='en'){const pair=CONFIDENCE[level];if(!pair)throw Error('Unknown confidence');return locale==='pl'?pair[0]:pair[1];}

function indexGraph(graph){
 const byId=new Map(graph.nodes.map(n=>[n.id,n]));
 const kids=new Map();
 for(const n of graph.nodes){
  if(n.parentId===null||n.free===true)continue; // loose notes are not part of a scenario until connected
  const list=kids.get(n.parentId)||[];list.push(n);kids.set(n.parentId,list);
 }
 return {graph,byId,kids:id=>kids.get(id)||[],cache:new Map()};
}
// The option's own territory: everything below it, except nested options (separate choices).
function territory(ix,optionId){
 const out=[],stack=[...ix.kids(optionId)].reverse();
 while(stack.length){
  const n=stack.pop();
  if(isOption(n))continue;
  out.push(n);
  stack.push(...[...ix.kids(n.id)].reverse());
 }
 return out;
}
function answered(ix,n){return n.status==='supported'||ix.kids(n.id).length>0;}
function rateOption(ix,id){
 if(ix.cache.has(id))return ix.cache.get(id);
 const o=ix.byId.get(id),own=territory(ix,id);
 const assumptions=own.filter(n=>n.kind==='assumption');
 const untested=assumptions.filter(isOpenStatus);
 const openQuestions=own.filter(n=>n.kind==='question'&&!answered(ix,n));
 const supported=own.filter(n=>n.status==='supported'&&n.kind!=='question');
 const experiments=own.filter(n=>n.kind==='experiment');
 const blockers=[];
 if(o.status==='refuted')blockers.push({code:'refuted-option',nodeId:o.id});
 for(const n of own)if(n.status==='refuted'&&(n.kind==='assumption'||n.kind==='experiment'))blockers.push({code:'refuted',nodeId:n.id});
 const parts={
  impact:o.impact?(o.impact-1)/4*100:50,
  ease:o.effort?(5-o.effort)/4*100:50,
  evidence:clamp(50+15*supported.length-8*untested.length-4*openQuestions.length+(o.status==='supported'?20:0)),
  testability:experiments.length?100:30
 };
 const score=Object.entries(FUTURE_WEIGHTS).reduce((sum,[k,w])=>sum+w*parts[k],0);
 const result={id,title:o.title,score:round1(score),parts,blockers,
  untested:untested.map(n=>n.id),openQuestions:openQuestions.map(n=>n.id),
  unrated:!o.impact||!o.effort,
  unknowns:untested.length+openQuestions.length+(o.impact?0:1)+(o.effort?0:1),
  territory:own.map(n=>n.id)};
 ix.cache.set(id,result);
 return result;
}
export function scoreOption(graph,id){
 assertIdeaGraph(graph);
 const ix=indexGraph(graph);
 if(!ix.byId.has(id)||!isOption(ix.byId.get(id)))throw Error('Option not found.');
 return rateOption(ix,id);
}
// Number of distinct scenarios, as a BigInt so very large idea graphs never overflow.
function countFrom(ix,id){
 const kids=ix.kids(id),options=kids.filter(isOption);
 let total=1n;
 for(const c of kids)if(!isOption(c))total*=countFrom(ix,c.id);
 if(options.length>=2)total*=options.reduce((s,o)=>s+countFrom(ix,o.id),0n);
 else if(options.length===1)total*=countFrom(ix,options[0].id);
 return total;
}
export function countFutures(graph){assertIdeaGraph(graph);return countFrom(indexGraph(graph),graph.rootId);}
export function findForks(graph){
 assertIdeaGraph(graph);
 const ix=indexGraph(graph),forks=[];
 const walk=id=>{
  const kids=ix.kids(id),options=kids.filter(isOption);
  if(options.length>=2)forks.push({id,title:ix.byId.get(id).title,options:options.map(o=>o.id)});
  kids.forEach(k=>walk(k.id));
 };
 walk(graph.rootId);
 return forks;
}
function evaluate(ix,partial){
 const options=partial.options.map(id=>rateOption(ix,id));
 const included=new Set(partial.nodes);
 const blockers=[];
 let unknowns=0;
 for(const id of partial.nodes){
  const n=ix.byId.get(id);
  if(n.status==='refuted'&&(isOption(n)||n.kind==='assumption'||n.kind==='experiment'))
   blockers.push({code:isOption(n)?'refuted-option':'refuted',nodeId:id});
  if(n.kind==='assumption'&&isOpenStatus(n))unknowns++;
  if(n.kind==='question'&&!answered(ix,n))unknowns++;
  if(isOption(n))unknowns+=(n.impact?0:1)+(n.effort?0:1);
 }
 let synergy=0;
 for(const link of ix.graph.links){
  if(!included.has(link.from)||!included.has(link.to))continue;
  if(link.type==='supports')synergy+=FUTURE_LIMITS.synergy;
  if(link.type==='conflicts')blockers.push({code:'conflict',nodeId:link.from,otherId:link.to});
 }
 synergy=Math.min(synergy,FUTURE_LIMITS.synergyCap);
 const base=options.length?options.reduce((s,o)=>s+o.score,0)/options.length:0;
 return {...partial,key:partial.choices.map(c=>c.optionId).join('|')||'base',
  score:options.length?round1(clamp(base+synergy)):null,synergy,blockers,blocked:blockers.length>0,unknowns,
  confidence:unknowns<=1?'solid':unknowns<=4?'shaky':'speculative'};
}
const rank=(a,b)=>(a.blocked-b.blocked)||((b.score??-1)-(a.score??-1))||(a.unknowns-b.unknowns)||(a.key<b.key?-1:a.key>b.key?1:0);
function merge(a,b){return {choices:[...a.choices,...b.choices],options:[...a.options,...b.options],nodes:[...a.nodes,...b.nodes]};}
function prune(ix,list,beam){
 if(!beam||list.length<=beam)return list;
 return list.map(p=>({p,e:evaluate(ix,p)})).sort((x,y)=>rank(x.e,y.e)).slice(0,beam).map(x=>x.p);
}
function expand(ix,id,beam){
 const node=ix.byId.get(id);
 let acc=[{choices:[],options:isOption(node)?[id]:[],nodes:[id]}];
 const kids=ix.kids(id),options=kids.filter(isOption),dims=[];
 for(const c of kids)if(!isOption(c))dims.push(expand(ix,c.id,beam));
 if(options.length>=2){
  dims.push(prune(ix,options.flatMap(o=>expand(ix,o.id,beam).map(p=>({...p,choices:[{forkId:id,optionId:o.id},...p.choices]}))),beam));
 }else if(options.length===1)dims.push(expand(ix,options[0].id,beam));
 for(const dim of dims){
  const next=[];
  for(const a of acc)for(const b of dim)next.push(merge(a,b));
  acc=prune(ix,next,beam);
 }
 return acc;
}
function describe(ix,s){
 return {key:s.key,score:s.score,blocked:s.blocked,confidence:s.confidence,unknowns:s.unknowns,synergy:s.synergy,
  choices:s.choices.map(c=>({forkId:c.forkId,forkTitle:ix.byId.get(c.forkId).title,optionId:c.optionId,optionTitle:ix.byId.get(c.optionId).title})),
  options:s.options,nodes:s.nodes,
  blockers:s.blockers.map(b=>({...b,title:ix.byId.get(b.nodeId)?.title||'',otherTitle:b.otherId?ix.byId.get(b.otherId)?.title||'':undefined}))};
}
function routeLabel(s){return s.choices.map(c=>c.optionTitle).join(' → ');}
export function analyzeFutures(graph,{locale='en',cap=FUTURE_LIMITS.exhaustive,top=8,samples=28}={}){
 assertIdeaGraph(graph);
 const lang=locale==='pl'?'pl':'en';
 const ix=indexGraph(graph);
 const total=countFrom(ix,graph.rootId);
 const forks=findForks(graph);
 const exhaustive=total<=BigInt(cap);
 const raw=expand(ix,graph.rootId,exhaustive?0:FUTURE_LIMITS.beam);
 const evaluated=raw.map(p=>evaluate(ix,p)).filter(s=>s.score!==null);
 const ranked=[...evaluated].sort(rank);
 const viable=ranked.filter(s=>!s.blocked);
 const winner=viable[0]||null,runnerUp=viable[1]||null;
 const unrated=[...new Set(ranked.flatMap(s=>s.options))].filter(id=>rateOption(ix,id).unrated);
 // Stress test the winner: what if each of its untested assumptions turned out false?
 let weakest=null;
 if(winner){
  const untested=winner.nodes.filter(id=>{const n=ix.byId.get(id);return n.kind==='assumption'&&isOpenStatus(n);});
  for(const nodeId of untested){
   const fallback=viable.find(s=>!s.nodes.includes(nodeId))||null;
   const drop=round1(winner.score-(fallback?fallback.score:0));
   if(!weakest||drop>weakest.drop)weakest={nodeId,title:ix.byId.get(nodeId).title,drop,fallback:fallback?describe(ix,fallback):null,
    everything:!fallback};
  }
 }
 const margin=winner&&runnerUp?round1(winner.score-runnerUp.score):null;
 const differing=winner&&runnerUp?winner.choices.filter(c=>!runnerUp.choices.some(r=>r.optionId===c.optionId)).map(c=>c.forkId):[];
 const evenSamples=[];
 if(evaluated.length){
  const step=Math.max(1,Math.floor(evaluated.length/samples));
  for(let i=0;i<evaluated.length&&evenSamples.length<samples;i+=step)evenSamples.push(evaluated[i].nodes);
 }
 const result={
  total:total.toString(),evaluated:evaluated.length,exhaustive,forks,
  viable:viable.length,blocked:ranked.length-viable.length,
  scenarios:ranked.slice(0,top).map(s=>describe(ix,s)),
  blockedSamples:ranked.filter(s=>s.blocked).slice(0,3).map(s=>describe(ix,s)),
  winner:winner?describe(ix,winner):null,runnerUp:runnerUp?describe(ix,runnerUp):null,
  margin,differing,weakest,unrated,samples:evenSamples,
  why:winner?explainWinner(ix,winner,runnerUp,lang):[],
  disclaimer:L(lang,'Porównanie heurystyczne na podstawie Twoich notatek i ocen — nie prawdopodobieństwo ani prognoza.',
   'A heuristic comparison of your own notes and ratings — not a probability or forecast.')
 };
 result.nextMove=nextMove(ix,result,lang);
 return result;
}
function explainWinner(ix,w,runnerUp,lang){
 const out=[];
 const opts=w.options.map(id=>rateOption(ix,id));
 const best=[...opts].sort((a,b)=>b.score-a.score)[0];
 if(best){
  const [part]=Object.entries(best.parts).sort((a,b)=>b[1]*FUTURE_WEIGHTS[b[0]]-a[1]*FUTURE_WEIGHTS[a[0]]);
  const names={impact:L(lang,'wpływ','impact'),ease:L(lang,'łatwość','ease'),evidence:L(lang,'dowody','evidence'),testability:L(lang,'testowalność','testability')};
  out.push(L(lang,'Najmocniejszy element: „'+short(best.title)+'” ('+names[part[0]]+').','Strongest piece: “'+short(best.title)+'” ('+names[part[0]]+').'));
 }
 const supported=opts.reduce((s,o)=>s+o.territory.filter(id=>ix.byId.get(id).status==='supported').length,0);
 if(supported)out.push(L(lang,supported+' potwierdzon'+(supported===1?'a notatka':'e notatki')+' na tej ścieżce.',supported+' supported note'+(supported===1?'':'s')+' on this route.'));
 if(w.synergy)out.push(L(lang,'Wybory wzajemnie się wspierają (+'+w.synergy+').','Choices reinforce each other (+'+w.synergy+').'));
 if(runnerUp){
  const lead=round1(w.score-runnerUp.score);
  out.push(lead<=0?L(lang,'Remis z następną ścieżką — oceny wpływu i wysiłku go rozstrzygną.','Tied with the next route — impact and effort ratings will break the tie.')
   :L(lang,'Przewaga nad następną ścieżką: '+lead+' pkt.','Lead over the next route: '+lead+' pts.'));
 }
 if(w.unknowns)out.push(L(lang,w.unknowns+' niewiadom'+(w.unknowns===1?'a':'e')+' wciąż otwart'+(w.unknowns===1?'a':'e')+'.',w.unknowns+' unknown'+(w.unknowns===1?'':'s')+' still open.'));
 return out;
}
function nextMove(ix,r,lang){
 if(!r.forks.length){
  const firstOption=ix.graph.nodes.find(n=>isOption(n)&&n.free!==true);
  const anchor=firstOption?firstOption.parentId:ix.graph.rootId;
  return {code:'add-alternative',nodeId:anchor,
   title:L(lang,'Dodaj alternatywę','Add an alternative'),
   why:L(lang,'Przyszłości powstają z rozwidleń: notatki z co najmniej dwiema opcjami (typ „Opcja”).','Futures come from forks: a note with two or more options (kind “Option”).')};
 }
 if(!r.winner)return {code:'pivot',nodeId:ix.graph.rootId,title:L(lang,'Wszystkie ścieżki są zablokowane','Every route is blocked'),
  why:L(lang,'Obalone założenia lub konflikty blokują każdy scenariusz. Otwórz nowy kierunek.','Refuted assumptions or conflicts block every scenario. Open a new direction.')};
 const unratedWinner=r.winner.options.find(id=>rateOption(ix,id).unrated)
  ||(r.runnerUp&&r.runnerUp.options.find(id=>rateOption(ix,id).unrated));
 if(unratedWinner)return {code:'rate',nodeId:unratedWinner,
  title:L(lang,'Oceń wpływ i wysiłek: „'+short(ix.byId.get(unratedWinner).title)+'”','Rate impact and effort: “'+short(ix.byId.get(unratedWinner).title)+'”'),
  why:L(lang,'Bez ocen opcje wyglądają podobnie. Dwa kliknięcia wyostrzą ranking.','Unrated options look alike. Two taps sharpen the ranking.')};
 if(r.weakest)return {code:'test',nodeId:r.weakest.nodeId,
  title:L(lang,'Przetestuj najpierw: „'+short(r.weakest.title)+'”','Test this first: “'+short(r.weakest.title)+'”'),
  why:r.weakest.everything
   ?L(lang,'Każda przyszłość zależy od tego założenia.','Every future depends on this assumption.')
   :L(lang,'Jeśli okaże się fałszywe, zwycięska ścieżka spada o '+r.weakest.drop+' pkt.','If it is false, the winning route drops by '+r.weakest.drop+' pts.')};
 if(r.margin!==null&&r.margin<3&&r.differing.length)return {code:'differentiate',nodeId:r.differing[0],
  title:L(lang,'Remis — rozstrzygnij: „'+short(ix.byId.get(r.differing[0]).title)+'”','Too close to call: settle “'+short(ix.byId.get(r.differing[0]).title)+'”'),
  why:L(lang,'Dwie najlepsze ścieżki różnią się tylko tym wyborem.','The two best routes differ only at this choice.')};
 return {code:'commit',nodeId:r.winner.options[0],
  title:L(lang,'Zdecyduj: '+short(routeLabel(r.winner),80),'Commit: '+short(routeLabel(r.winner),80)),
  why:L(lang,'Brak otwartych założeń na tej ścieżce. Zapisz decyzję i warunek powrotu.','No open assumptions on this route. Record the decision and a revisit trigger.')};
}
// A plain-language decision record the user can drop onto the canvas.
export function decisionRecord(graph,analysis,{locale='en'}={}){
 const lang=locale==='pl'?'pl':'en';
 if(!analysis?.winner)throw Error(L(lang,'Brak zwycięskiej ścieżki.','No winning route.'));
 const w=analysis.winner;
 const title=short(L(lang,'Decyzja: ','Decision: ')+(w.choices.map(c=>c.optionTitle).join(' + ')||graph.title),150);
 const lines=[
  L(lang,'Wybrana ścieżka (najlepsza z '+analysis.total+' scenariuszy, ocena '+w.score+'/100, '+confidenceLabel(w.confidence,'pl')+').','Chosen route (best of '+analysis.total+' scenarios, score '+w.score+'/100, '+w.confidence+').'),
  ...w.choices.map(c=>'• '+c.forkTitle+' → '+c.optionTitle),
  '',
  ...analysis.why,
  analysis.weakest?L(lang,'Wróć do decyzji, jeśli „'+analysis.weakest.title+'” okaże się fałszywe'+(analysis.weakest.fallback?' — plan B: '+routeLabel(analysis.weakest.fallback):'')+'.','Revisit if “'+analysis.weakest.title+'” proves false'+(analysis.weakest.fallback?' — plan B: '+routeLabel(analysis.weakest.fallback):'')+'.'):'',
  '',
  analysis.disclaimer
 ].filter((x,i,a)=>x!==''||a[i-1]!=='');
 return {title,description:lines.join('\n').slice(0,4000)};
}
