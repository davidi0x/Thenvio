// Thenvio Swarm: a synthetic crowd reacts to the options on a canvas.
// Hundreds of agents with different traits live in a small-world social network; each round they
// may adopt an option, pulled by its value and by neighbours who already adopted it, pushed away by
// effort, price, trust, habit change and open risks. The result shows adoption curves, tipping points
// and — most useful — WHO rejects WHAT and WHY, turned into questions to test with real people.
// Pure and deterministic (seeded). Synthetic people with traits you can see: not research, not a forecast.
import {assertIdeaGraph} from './idea-graph.mjs';
import {addBoardNode,freeSlots} from './board.mjs';
import {stableHash} from './brain.mjs';

export const SWARM_LIMITS=Object.freeze({agents:400,rounds:20});
const TRAITS=['gain','timeCost','caution','priceSens','trustNeed','habit','social','threshold'];
// Default archetypes. Traits are 0..1; share is the part of the crowd.
export const ARCHETYPES=Object.freeze([
 {id:'early',pl:'Wczesny entuzjasta',en:'Early adopter',share:.15,traits:{gain:.9,timeCost:.3,caution:.2,priceSens:.3,trustNeed:.3,habit:.2,social:.4,threshold:.3}},
 {id:'pragmatist',pl:'Pragmatyk',en:'Pragmatist',share:.35,traits:{gain:.65,timeCost:.5,caution:.45,priceSens:.5,trustNeed:.5,habit:.5,social:.75,threshold:.42}},
 {id:'thrifty',pl:'Oszczędny',en:'Thrifty',share:.2,traits:{gain:.55,timeCost:.4,caution:.5,priceSens:.95,trustNeed:.5,habit:.55,social:.55,threshold:.45}},
 {id:'skeptic',pl:'Sceptyk',en:'Skeptic',share:.15,traits:{gain:.45,timeCost:.5,caution:.85,priceSens:.6,trustNeed:.9,habit:.7,social:.35,threshold:.55}},
 {id:'busy',pl:'Zabiegany',en:'Too busy',share:.15,traits:{gain:.6,timeCost:.95,caution:.4,priceSens:.4,trustNeed:.4,habit:.65,social:.5,threshold:.48}}
]);
const CUES={
 price:/(\bcen[aęyi]|subskryp|abonament|opłat|prowizj|płatn[ya] (wersj|plan)|\bprice|paid plan|subscription|\bfee|premium)/i,
 trust:/(dane|prywat|bezpiecz|zaufan|obcy|\bkont[oa]|logow|płatnoś|płac|\bdata\b|privacy|trust|secur|stranger|account|login|payment|\bpay)/i,
 install:/(aplikacj|zainstal|pobierz|nowy nawyk|\bapp\b|install|download|switch to)/i,
 social:/(znajom|grup|społeczn|polec|wspóln|friend|group|community|share|invite|together)/i
};
const NO_INSTALL=/(bez (aplikacji|instalacji|pobierania|konta)|without (an? )?(app|install|account)|no (app|install|download))/i;
export const OBJECTION_NAMES=Object.freeze({value:['korzyść','benefit'],friction:['wysiłek','effort'],price:['cena','price'],trust:['zaufanie','trust'],install:['nowy nawyk','new habit'],risk:['niewiadome','unknowns']});
export const OBJECTIONS=Object.freeze({
 value:['Za mała korzyść — czy to rozwiązuje wystarczająco bolesny problem?','Not enough benefit — does this solve a painful enough problem?'],
 friction:['Za dużo wysiłku na start — co da się usunąć z pierwszego kroku?','Too much effort to start — what can be removed from the first step?'],
 price:['Cena lub płatność zniechęca — jaką najmniejszą kwotę ktoś zapłaci od razu?','Price or payment puts people off — what is the smallest amount someone pays right away?'],
 trust:['Brak zaufania (dane, płatność, obcy ludzie) — co da dowód bezpieczeństwa przed pierwszym użyciem?','Not enough trust (data, payment, strangers) — what proves safety before first use?'],
 install:['Nowa aplikacja albo nawyk to bariera — czy da się to dostarczyć w kanale, którego już używają?','A new app or habit is a barrier — can it be delivered in a channel people already use?'],
 risk:['Za dużo niewiadomych — które założenie trzeba sprawdzić najpierw?','Too many unknowns — which assumption has to be checked first?']
});

function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const clamp01=v=>Math.max(0,Math.min(1,v));
const L=(lang,pl,en)=>lang==='pl'?pl:en;

function optionsOf(graph){
 const kids=new Map();
 for(const n of graph.nodes){if(n.parentId===null||n.free===true)continue;const l=kids.get(n.parentId)||[];l.push(n);kids.set(n.parentId,l);}
 const isFork=id=>(kids.get(id)||[]).filter(k=>k.kind==='direction').length>=2;
 let opts=graph.nodes.filter(n=>n.kind==='direction'&&n.free!==true&&isFork(n.parentId));
 if(!opts.length)opts=graph.nodes.filter(n=>n.kind==='direction'&&n.free!==true);
 const territory=id=>{const out=[],st=[...(kids.get(id)||[])];while(st.length){const n=st.pop();if(n.kind==='direction')continue;out.push(n);st.push(...(kids.get(n.id)||[]));}return out;};
 return opts.slice(0,12).map(o=>{
  const own=territory(o.id),text=[o.title,o.description,...own.map(n=>n.title)].join(' ');
  const untested=own.filter(n=>n.kind==='assumption'&&(n.status==='open'||n.status==='exploring')).length;
  const supported=own.filter(n=>n.status==='supported'&&n.kind!=='question').length;
  return {id:o.id,title:o.title,
   value:o.impact?(o.impact-1)/4:.5,friction:o.effort?(o.effort-1)/4:.5,
   price:CUES.price.test(text)?1:0,trust:CUES.trust.test(text)?1:0,install:CUES.install.test(text)&&!NO_INSTALL.test(text)?1:0,social:CUES.social.test(text)?1:0,
   risk:Math.min(.5,untested*.12),evidence:Math.min(.25,supported*.08),
   blocked:o.status==='refuted'||own.some(n=>n.status==='refuted'&&(n.kind==='assumption'||n.kind==='experiment'))};
 });
}
function segmentsFrom(personas){
 if(!Array.isArray(personas)||!personas.length)return ARCHETYPES.map(a=>({...a,name:null}));
 const list=personas.slice(0,30).map((p,i)=>{
  const traits={};
  for(const k of TRAITS){const v=Number(p?.traits?.[k]);traits[k]=Number.isFinite(v)?clamp01(v):ARCHETYPES[1].traits[k];}
  const share=Number(p?.share);
  return {id:'p'+i,name:String(p?.name||p?.segment||'Persona '+(i+1)).slice(0,60),share:Number.isFinite(share)&&share>0?share:1,traits};
 });
 const total=list.reduce((s,p)=>s+p.share,0);
 return list.map(p=>({...p,share:p.share/total}));
}
function utility(a,o,noise){
 const parts={value:a.gain*(.4+.6*o.value),friction:-a.timeCost*o.friction*.8,price:-a.priceSens*o.price*.45,trust:-a.trustNeed*o.trust*.45,
  install:-a.habit*o.install*.4,risk:-a.caution*o.risk};
 const u=Object.values(parts).reduce((s,v)=>s+v,0)+o.evidence+noise;
 return {u,parts};
}
function smallWorld(n,k,p,rand){
 const adj=Array.from({length:n},()=>new Set());
 for(let i=0;i<n;i++)for(let j=1;j<=k/2;j++){const t=(i+j)%n;adj[i].add(t);adj[t].add(i);}
 for(let i=0;i<n;i++)for(const t of [...adj[i]]){if(t>i&&rand()<p){const r=Math.floor(rand()*n);if(r!==i&&!adj[i].has(r)){adj[i].delete(t);adj[t].delete(i);adj[i].add(r);adj[r].add(i);}}}
 return adj.map(s=>[...s]);
}

export function simulateSwarm(graph,{agents=240,rounds=12,seed=0,locale='en',personas=null}={}){
 assertIdeaGraph(graph);
 const lang=locale==='pl'?'pl':'en';
 const n=Math.max(20,Math.min(SWARM_LIMITS.agents,Math.round(agents))),R=Math.max(3,Math.min(SWARM_LIMITS.rounds,Math.round(rounds)));
 const options=optionsOf(graph);
 const disclaimer=L(lang,'Syntetyczny tłum: cechy i zasady ustawione z góry, nie prawdziwi ludzie. Służy do znajdowania pytań, nie do prognozowania.',
  'Synthetic crowd: traits and rules set up front, not real people. Use it to find questions, not to forecast.');
 if(!options.length)return {agents:n,rounds:R,options:[],segments:[],winner:null,frames:[],disclaimer,
  empty:L(lang,'Dodaj co najmniej jedną opcję (typ „Opcja”), żeby tłum miał na co reagować.','Add at least one option (kind “Option”) for the crowd to react to.')};
 const rand=rng(Number.parseInt(stableHash(graph.id+'|'+seed+'|'+options.map(o=>[o.id,o.value,o.friction,o.risk,o.evidence,o.blocked].join(':')).join(',')),36));
 const segs=segmentsFrom(personas);
 // Agents: traits jittered around their segment, so nobody is a cardboard copy.
 const crowd=[];
 for(let i=0;i<n;i++){
  let r=rand(),seg=segs[segs.length-1];
  for(const s of segs){if(r<s.share){seg=s;break;}r-=s.share;}
  const a={seg:seg.id};
  for(const k of TRAITS)a[k]=clamp01(seg.traits[k]+(rand()-.5)*.24);
  a.noise=(rand()-.5)*.16;
  crowd.push(a);
 }
 const net=smallWorld(n,6,.12,rand);
 const choice=new Int16Array(n).fill(-1);
 const frames=[];const curves=options.map(()=>[]);
 const util=crowd.map(a=>options.map(o=>o.blocked?{u:-9,parts:{}}:utility(a,o,a.noise)));
 for(let round=0;round<R;round++){
  const next=Int16Array.from(choice);
  for(let i=0;i<n;i++){
   if(choice[i]>=0)continue;
   const a=crowd[i],nb=net[i];
   let best=-1,bestScore=-Infinity;
   for(let j=0;j<options.length;j++){
    if(options[j].blocked)continue;
    let adopted=0;for(const t of nb)if(choice[t]===j)adopted++;
    const pull=round===0?0:a.social*(1+.5*options[j].social)*(adopted/nb.length)*1.5;
    const score=util[i][j].u+pull;
    if(score>a.threshold&&score>bestScore){best=j;bestScore=score;}
   }
   if(best>=0)next[i]=best;
  }
  choice.set(next);
  frames.push(Array.from(choice));
  options.forEach((o,j)=>curves[j].push(Math.round(choice.filter(c=>c===j).length/n*1000)/10));
 }
 // Who would not take each option even with no competition, and the biggest reason why.
 const objections=options.map(()=>new Map());
 for(let i=0;i<n;i++)for(let j=0;j<options.length;j++){
  if(options[j].blocked||choice[i]===j)continue;
  const x=util[i][j];if(x.u>=crowd[i].threshold)continue;
  let cat='value',worst=-(crowd[i].threshold-x.parts.value);
  for(const k of ['friction','price','trust','install','risk'])if(x.parts[k]<worst){worst=x.parts[k];cat=k;}
  const m=objections[j];const e=m.get(cat)||{count:0,segments:{}};e.count++;e.segments[crowd[i].seg]=(e.segments[crowd[i].seg]||0)+1;m.set(cat,e);
 }
 const segName=id=>{const s=segs.find(x=>x.id===id);return s?.name||s?.[lang]||id;};
 const result=options.map((o,j)=>{
  const adoption=curves[j].at(-1);
  const tipping=curves[j].findIndex(v=>v>=16);
  const bySegment={};
  for(const s of segs){let m=0,yes=0;for(let i=0;i<n;i++)if(crowd[i].seg===s.id){m++;if(choice[i]===j)yes++;}bySegment[segName(s.id)]=m?Math.round(yes/m*100):0;}
  const objs=[...objections[j]].map(([category,e])=>({category,count:e.count,share:Math.round(e.count/n*1000)/10,
   segments:Object.entries(e.segments).sort((a,b)=>b[1]-a[1]).map(([id,c])=>({name:segName(id),count:c})),name:OBJECTION_NAMES[category][lang==='pl'?0:1],text:OBJECTIONS[category][lang==='pl'?0:1]}))
   .sort((a,b)=>b.count-a.count);
  return {optionId:o.id,title:o.title,blocked:o.blocked,adoption,curve:curves[j],tippingRound:tipping>=0?tipping+1:null,bySegment,objections:objs};
 });
 const ranked=[...result].filter(r=>!r.blocked).sort((a,b)=>b.adoption-a.adoption);
 const winner=ranked[0]&&ranked[0].adoption>0?ranked[0]:null;
 const undecided=Math.round(choice.filter(c=>c<0).length/n*1000)/10;
 const loudest=result.flatMap(r=>r.objections.map(o=>({...o,optionId:r.optionId,optionTitle:r.title}))).sort((a,b)=>b.count-a.count)[0]||null;
 return {agents:n,rounds:R,seed,options:result,ranking:ranked.map(r=>r.optionId),winner:winner&&{optionId:winner.optionId,title:winner.title,adoption:winner.adoption,tippingRound:winner.tippingRound},
  undecided,loudest,segments:segs.map(s=>({id:s.id,name:segName(s.id),share:Math.round(s.share*100)})),frames,disclaimer};
}

// The crowd's loudest objections become questions on the canvas, plus one real-world check.
export function swarmNotes(graph,sim,{locale='en',max=3,voices=[]}={}){
 assertIdeaGraph(graph);
 const lang=locale==='pl'?'pl':'en';
 let g=graph;const added=[];
 const norm=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const seen=new Set(graph.nodes.map(n=>norm(n.title)));
 const add=(parentId,title,kind,description)=>{
  if(seen.has(norm(title))||g.nodes.length>=400)return null;
  const [slot]=freeSlots(g,parentId,1);if(!slot)return null;
  const made=addBoardNode(g,{title:title.slice(0,150),kind,description:description.slice(0,4000),parentId,x:slot.x,y:slot.y,free:false});
  g=made.graph;seen.add(norm(title));added.push(made.id);return made.id;
 };
 const picks=sim.options.flatMap(o=>o.objections.slice(0,2).map(ob=>({o,ob}))).sort((a,b)=>b.ob.count-a.ob.count).slice(0,max);
 for(const {o,ob} of picks){
  if(!graph.nodes.some(n=>n.id===o.optionId))continue;
  const who=ob.segments.slice(0,2).map(s=>s.name).join(', ');
  add(o.optionId,L(lang,'Tłum ('+ob.share+'%): ','Crowd ('+ob.share+'%): ')+ob.text,'question',
   L(lang,'Najczęstsza obiekcja syntetycznego tłumu wobec tej opcji. Głównie: '+who+'.\n\n'+sim.disclaimer,
    'The synthetic crowd\'s most common objection to this option. Mostly: '+who+'.\n\n'+sim.disclaimer));
 }
 if(sim.loudest&&graph.nodes.some(n=>n.id===sim.loudest.optionId)){
  const who=sim.loudest.segments[0]?.name||'';
  add(sim.loudest.optionId,L(lang,'Sprawdź w realu: 5 rozmów („'+who+'”) o obiekcji „'+OBJECTION_NAMES[sim.loudest.category][0]+'”','Check for real: 5 conversations ("'+who+'") about the "'+OBJECTION_NAMES[sim.loudest.category][1]+'" objection'),'experiment',
   L(lang,'Zapytaj o ostatnią prawdziwą sytuację, nie o opinię. Sukces, jeśli co najmniej 3 z 5 osób nie zgłasza tej obiekcji albo wskazuje, co by ją usunęło.',
    'Ask about a recent real situation, not an opinion. Pass if at least 3 of 5 people do not raise this objection or name what would remove it.'));
 }
 // Voices from personas written by a chat model: the sharpest objection per option, quoted.
 for(const v of voices){
  if(!v.quotes.length||!graph.nodes.some(n=>n.id===v.optionId))continue;
  const q=v.quotes[0],total=v.adopt+v.maybe+v.reject;
  add(v.optionId,L(lang,'Głos tłumu ('+v.reject+'/'+total+' przeciw): ','Crowd voice ('+v.reject+'/'+total+' against): ')+q.text,'question',
   L(lang,'Persona symulowana przez AI: '+q.who+'. Co zmieniłoby zdanie: ','AI-simulated persona: '+q.who+'. What would change their mind: ')+(v.changeMind.join(' · ')||'—')+'\n\n'+sim.disclaimer);
 }
 return {graph:g,added};
}

// Personas written by a chat model (their own words) summarised per option.
export function summarizeVoices(graph,personas){
 assertIdeaGraph(graph);
 const byTitle=new Map(graph.nodes.map(n=>[n.title.toLowerCase().trim(),n]));
 const out=new Map();
 for(const p of Array.isArray(personas)?personas.slice(0,30):[]){
  for(const r of Array.isArray(p?.reactions)?p.reactions.slice(0,12):[]){
   const node=byTitle.get(String(r?.option||'').toLowerCase().trim());
   if(!node)continue;
   const e=out.get(node.id)||{optionId:node.id,title:node.title,adopt:0,maybe:0,reject:0,quotes:[],changeMind:[]};
   const stance=['adopt','maybe','reject'].includes(r.stance)?r.stance:'maybe';
   e[stance]++;
   if(stance!=='adopt'&&r.why)e.quotes.push({who:String(p.name||p.segment||'').slice(0,60),text:String(r.why).slice(0,300)});
   if(r.wouldChangeMindIf)e.changeMind.push(String(r.wouldChangeMindIf).slice(0,300));
   out.set(node.id,e);
  }
 }
 return [...out.values()];
}
