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
  return {id:o.id,title:o.title,rated:{impact:!!o.impact,effort:!!o.effort},
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
const BASE_WEIGHTS=Object.freeze({price:.45,trust:.45,install:.4});
function utility(a,o,noise){
 const w=o.w||BASE_WEIGHTS;
 const parts={value:a.gain*(.3+.7*o.value),friction:-a.timeCost*o.friction*.8,price:-a.priceSens*o.price*w.price,trust:-a.trustNeed*o.trust*w.trust,
  install:-a.habit*o.install*w.install,risk:-a.caution*o.risk};
 const u=Object.values(parts).reduce((s,v)=>s+v,0)+o.evidence+noise;
 return {u,parts};
}
function smallWorld(n,k,p,rand){
 const adj=Array.from({length:n},()=>new Set());
 for(let i=0;i<n;i++)for(let j=1;j<=k/2;j++){const t=(i+j)%n;adj[i].add(t);adj[t].add(i);}
 for(let i=0;i<n;i++)for(const t of [...adj[i]]){if(t>i&&rand()<p){const r=Math.floor(rand()*n);if(r!==i&&!adj[i].has(r)){adj[i].delete(t);adj[t].delete(i);adj[i].add(r);adj[r].add(i);}}}
 return adj.map(s=>[...s]);
}
// One crowd run. Each option spreads on its own (would this person take it up if it were offered?),
// so options do not steal each other's share; frames record each agent's first choice for the animation.
function runCrowd(options,crowd,net,R){
 const n=crowd.length,pct=c=>Math.round(c/n*1000)/10;
 const util=crowd.map(a=>options.map(o=>o.blocked?{u:-9,parts:{}}:utility(a,o,a.noise)));
 const on=options.map(()=>new Uint8Array(n)),curves=options.map(()=>[]),frames=[];
 for(let round=0;round<R;round++){
  options.forEach((o,j)=>{
   if(o.blocked){curves[j].push(0);return;}
   const prev=on[j],next=Uint8Array.from(prev);let count=0;
   for(let i=0;i<n;i++){
    if(prev[i]){count++;continue;}
    const a=crowd[i],nb=net[i];
    let adopted=0;for(const t of nb)adopted+=prev[t];
    const pull=round===0?0:a.social*(1+.5*o.social)*(adopted/nb.length)*.9;
    if(util[i][j].u+pull>a.threshold){next[i]=1;count++;}
   }
   on[j]=next;curves[j].push(pct(count));
  });
  const frame=new Array(n).fill(-1);
  for(let i=0;i<n;i++){let best=-Infinity;for(let j=0;j<options.length;j++)if(on[j][i]&&util[i][j].u>best){best=util[i][j].u;frame[i]=j;}}
  frames.push(frame);
 }
 return {curves,frames,on,util};
}
// What we do not know is varied between runs: unrated impact/effort can be anything, rated ones are
// fuzzy, and the weight of the keyword cues (payment → trust, app → new habit) is only a guess.
function perturb(options,rand){
 const vary=(v,rated)=>rated?clamp01(v+(rand()-.5)*.2):.1+rand()*.8;
 return options.map(o=>({...o,value:vary(o.value,o.rated.impact),friction:vary(o.friction,o.rated.effort),
  w:{price:BASE_WEIGHTS.price*(.4+rand()*1.2),trust:BASE_WEIGHTS.trust*(.4+rand()*1.2),install:BASE_WEIGHTS.install*(.4+rand()*1.2)}}));
}
const ENSEMBLE=10;

export function simulateSwarm(graph,{agents=240,rounds=12,seed=0,locale='en',personas=null}={}){
 assertIdeaGraph(graph);
 const lang=locale==='pl'?'pl':'en';
 const n=Math.max(20,Math.min(SWARM_LIMITS.agents,Math.round(agents))),R=Math.max(3,Math.min(SWARM_LIMITS.rounds,Math.round(rounds)));
 const options=optionsOf(graph);
 const disclaimer=L(lang,'Syntetyczny tłum: cechy i zasady ustawione z góry, nie prawdziwi ludzie. Służy do znajdowania pytań, nie do prognozowania.',
  'Synthetic crowd: traits and rules set up front, not real people. Use it to find questions, not to forecast.');
 if(!options.length)return {agents:n,rounds:R,options:[],segments:[],winner:null,frames:[],disclaimer,certainty:null,verdict:null,next:null,
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
 const base=runCrowd(options,crowd,net,R);
 const finals=options.map((_,j)=>[base.curves[j].at(-1)]);
 for(let k=0;k<ENSEMBLE;k++){const run=runCrowd(perturb(options,rand),crowd,net,R);run.curves.forEach((c,j)=>finals[j].push(c.at(-1)));}
 const band=list=>{const s=[...list].sort((a,b)=>a-b);return [Math.min(s[1],list[0]),Math.max(s[s.length-2],list[0])];};
 // Who would not take each option up, and the biggest reason why.
 const objections=options.map(()=>new Map());
 for(let i=0;i<n;i++)for(let j=0;j<options.length;j++){
  if(options[j].blocked||base.on[j][i])continue;
  const x=base.util[i][j];if(x.u>=crowd[i].threshold)continue;
  let cat='value',worst=-(crowd[i].threshold-x.parts.value);
  for(const k of ['friction','price','trust','install','risk'])if(x.parts[k]<worst){worst=x.parts[k];cat=k;}
  const m=objections[j];const e=m.get(cat)||{count:0,segments:{}};e.count++;e.segments[crowd[i].seg]=(e.segments[crowd[i].seg]||0)+1;m.set(cat,e);
 }
 const segName=id=>{const s=segs.find(x=>x.id===id);return s?.name||s?.[lang]||id;};
 const last=base.frames.at(-1);
 const result=options.map((o,j)=>{
  const curve=base.curves[j],adoption=curve.at(-1);
  // A tipping point only when friends actually carried it: who takes it up alone does so in round 1.
  const fromFriends=Math.round((adoption-curve[0])*10)/10;
  let tipping=null;
  if(fromFriends>=5){let best=0;for(let k=1;k<curve.length;k++){const d=curve[k]-curve[k-1];if(d>best){best=d;tipping=k+1;}}}
  const bySegment={};
  for(const s of segs){let m=0,yes=0;for(let i=0;i<n;i++)if(crowd[i].seg===s.id){m++;if(base.on[j][i])yes++;}bySegment[segName(s.id)]=m?Math.round(yes/m*100):0;}
  const objs=[...objections[j]].map(([category,e])=>({category,count:e.count,share:Math.round(e.count/n*1000)/10,
   segments:Object.entries(e.segments).sort((a,b)=>b[1]-a[1]).map(([id,c])=>({name:segName(id),count:c})),name:OBJECTION_NAMES[category][lang==='pl'?0:1],text:OBJECTIONS[category][lang==='pl'?0:1]}))
   .sort((a,b)=>b.count-a.count);
  return {optionId:o.id,title:o.title,blocked:o.blocked,rated:o.rated.impact&&o.rated.effort,adoption,range:o.blocked?[0,0]:band(finals[j]),
   firstChoice:Math.round(last.filter(c=>c===j).length/n*1000)/10,fromFriends,curve,tippingRound:tipping,bySegment,objections:objs};
 });
 const ranked=[...result].filter(r=>!r.blocked).sort((a,b)=>b.adoption-a.adoption);
 const top=ranked[0]&&ranked[0].adoption>0?ranked[0]:null,second=ranked[1]||null;
 const unrated=ranked.filter(r=>!r.rated);
 // Honest verdict: clear only when the ranges do not overlap. Unrated options make it a guess.
 let certainty='none';
 if(top){
  if(!second)certainty=top.range[1]-top.range[0]>35&&unrated.length?'unclear':'clear';
  else if(top.range[0]>second.range[1])certainty='clear';
  else certainty=unrated.length?'unclear':'close';
  // Without ratings the gap comes only from words in the titles: never call that a verdict.
  if(!top.rated||(second&&!second.rated))certainty='unclear';
 }
 const q=s=>L(lang,'„'+s+'”','“'+s+'”'),rg=r=>r.range[0]===r.range[1]?r.adoption+'%':r.range[0]+'–'+r.range[1]+'%';
 const verdict=certainty==='none'?L(lang,'Nikt nie wziąłby żadnej opcji — tłum widzi za małą korzyść albo za duży wysiłek.','Nobody would take any option up — the crowd sees too little benefit or too much effort.')
  :certainty==='clear'?L(lang,q(top.title)+' wyraźnie prowadzi: '+rg(top)+' by to wzięło.',q(top.title)+' clearly leads: '+rg(top)+' would take it up.')
  :certainty==='close'?L(lang,'Na styk: '+q(top.title)+' '+rg(top)+' vs '+q(second.title)+' '+rg(second)+'. O wyniku zdecyduje obiekcja, nie liczby.','Close call: '+q(top.title)+' '+rg(top)+' vs '+q(second.title)+' '+rg(second)+'. An objection will decide this, not the numbers.')
  :L(lang,'Za wcześnie na werdykt: '+unrated.length+' z '+ranked.length+' opcji nie ma oceny korzyści i wysiłku, więc tłum zgaduje (widełki się nakładają).','Too early to call: '+unrated.length+' of '+ranked.length+' options have no benefit/effort rating, so the crowd is guessing (the ranges overlap).');
 // The single most useful next step.
 let next=null;
 if(certainty==='unclear'){
  const pick=[...unrated].sort((a,b)=>(b.range[1]-b.range[0])-(a.range[1]-a.range[0]))[0];
  next={code:'rate',optionId:pick.optionId,title:L(lang,'Oceń korzyść i wysiłek: '+q(pick.title),'Rate benefit and effort: '+q(pick.title)),
   why:L(lang,'Ta opcja ma najszersze widełki. Dwa kliknięcia zawężą wynik bardziej niż kolejna symulacja.','This option has the widest range. Two taps narrow the result more than another simulation.')};
 }else if(top){
  const ob=top.objections[0];
  next=ob?{code:'test',optionId:top.optionId,category:ob.category,title:L(lang,'Sprawdź w realu: '+ob.name+' przy '+q(top.title),'Check for real: '+ob.name+' for '+q(top.title)),
   why:ob.text+' '+L(lang,'('+ob.share+'% tłumu, głównie '+ob.segments.slice(0,2).map(s=>s.name).join(', ')+')','('+ob.share+'% of the crowd, mostly '+ob.segments.slice(0,2).map(s=>s.name).join(', ')+')')}:null;
 }
 const undecided=Math.round(last.filter(c=>c<0).length/n*1000)/10;
 const loudest=result.flatMap(r=>r.objections.map(o=>({...o,optionId:r.optionId,optionTitle:r.title}))).sort((a,b)=>b.count-a.count)[0]||null;
 return {agents:n,rounds:R,seed,options:result,ranking:ranked.map(r=>r.optionId),
  winner:top&&{optionId:top.optionId,title:top.title,adoption:top.adoption,range:top.range,tippingRound:top.tippingRound},
  certainty,verdict,next,undecided,loudest,segments:segs.map(s=>({id:s.id,name:segName(s.id),share:Math.round(s.share*100)})),frames:base.frames,disclaimer};
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
