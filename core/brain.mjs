// Thenvio shared brain: one repo, plain text, for the whole team and its agents.
// Canvases become readable Markdown that people browse on GitHub and agents can edit;
// Thenvio reads the same files back. Pure, deterministic, dependency-free.
import {assertIdeaGraph,IDEA_STATES} from './idea-graph.mjs';
import {prepareBoard,freeSlots} from './board.mjs';
import {SKILLS,skillMarkdown} from './skills.mjs';
import {inferKind,detectLocale} from './coach.mjs';

export const IDEAS_DIR='product-data/ideas/';
export const BRAIN_FOLDERS=Object.freeze([
 {path:'how-we-work/',en:'How the team works and decides',pl:'Jak zespół pracuje i podejmuje decyzje'},
 {path:'product-data/',en:'Ideas, assumptions and decisions from your canvases',pl:'Pomysły, założenia i decyzje z canvasów'},
 {path:'brand/',en:'Voice and positioning, written by you',pl:'Głos i pozycjonowanie, wpisujesz Ty'},
 {path:'skills/',en:SKILLS.length+' founder skills your agents can use',pl:SKILLS.length+' skilli founderskich dla agentów'}
]);
const MAX_NODES=400;
const L=(lang,pl,en)=>lang==='pl'?pl:en;
const oneLine=s=>String(s??'').replace(/\s+/g,' ').trim();
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const KIND_WORD={idea:['idea','pomysł'],direction:['option','opcja'],question:['question','pytanie'],assumption:['assumption','założenie'],experiment:['test','test'],insight:['insight','wniosek']};
const STATUS_WORD={open:['open','otwarte'],exploring:['exploring','badam'],supported:['supported','potwierdzone'],refuted:['refuted','obalone']};
const LINK_WORD={relates:['relates','powiązane'],supports:['supports','wspiera'],conflicts:['conflicts','wyklucza']};
const reverse=(map,extra={})=>new Map([...Object.entries(map).flatMap(([k,words])=>words.map(w=>[w,k])),...Object.entries(extra)]);
const KIND_FROM=reverse(KIND_WORD,{direction:'direction',experiment:'experiment',eksperyment:'experiment',risk:'assumption',ryzyko:'assumption',decision:'insight',decyzja:'insight',learning:'insight'});
const STATUS_FROM=reverse(STATUS_WORD,{exploring:'exploring',testing:'exploring',testuję:'exploring'});
const LINK_FROM=reverse(LINK_WORD,{related:'relates',support:'supports',conflict:'conflicts',wyklucza:'conflicts'});
const word=(map,key,lang)=>map[key][lang==='pl'?1:0];
const GENERATED='<!-- thenvio:generated -->';

// FNV-1a: short, stable ids and file suffixes without randomness.
export function stableHash(text){
 let h=0x811c9dc5;
 for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(36);
}
export function slugify(text,fallback='idea'){
 const s=String(text||'').toLowerCase().replace(/ł/g,'l').normalize('NFKD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48).replace(/-+$/,'');
 return s||fallback;
}
export function canvasPath(graph){return IDEAS_DIR+slugify(graph.title)+'-'+stableHash(graph.id).slice(0,5)+'.md';}
function attrs(node,extra={}){
 const parts=['id='+node.id];
 if(Number.isFinite(node.x)&&Number.isFinite(node.y))parts.push('x='+Math.round(node.x),'y='+Math.round(node.y));
 if(node.impact)parts.push('impact='+node.impact);
 if(node.effort)parts.push('effort='+node.effort);
 for(const [k,v] of Object.entries(extra))parts.push(k+'='+v);
 return ' <!-- '+parts.join(' ')+' -->';
}
function quote(text,indent,label){
 if(!text)return [];
 return String(text).replace(/\r/g,'').split('\n').map(line=>indent+'>'+(label?' **'+label+':** ':line?' ':'')+line);
}

// ── Canvas → Markdown ──
export function canvasToMarkdown(graph,{locale}={}){
 assertIdeaGraph(graph);
 const lang=locale==='pl'||locale==='en'?locale:detectLocale(graph.nodes.map(n=>n.title).join(' '),'en');
 const root=graph.nodes.find(n=>n.id===graph.rootId);
 const kids=new Map();
 for(const n of graph.nodes){if(n.parentId===null)continue;const list=kids.get(n.parentId)||[];list.push(n);kids.set(n.parentId,list);}
 const evidenceLabel=L(lang,'Dowód','Evidence');
 const out=['---','thenvio: canvas','version: 1','id: '+graph.id,'title: '+oneLine(graph.title),'updated: '+graph.updatedAt,'---','',
  L(lang,'<!-- Canvas Thenvio. Każda linia „- [typ] tytuł” to notatka; wcięcie = gałąź. Zostaw znaczniki id, aby Thenvio rozpoznało notatki. Nowe linie bez id też działają. -->',
   '<!-- Thenvio canvas. Each "- [kind] title" line is a note; indent to branch. Keep the id tags so Thenvio can match notes. New lines without tags are fine. -->'),'',
  '# '+oneLine(root.title)+attrs(root)];
 out.push(...quote(root.description,'',''));
 const writeNote=(n,depth)=>{
  const pad='  '.repeat(depth);
  const tag=word(KIND_WORD,n.kind,lang)+(n.status!=='open'?' · '+word(STATUS_WORD,n.status,lang):'');
  out.push(pad+'- ['+tag+'] '+oneLine(n.title)+attrs(n));
  out.push(...quote(n.description,pad+'  ',''));
  out.push(...quote(n.evidence,pad+'  ',evidenceLabel));
  for(const c of kids.get(n.id)||[])if(c.free!==true)writeNote(c,depth+1);
 };
 const top=(kids.get(root.id)||[]);
 const attached=top.filter(n=>n.free!==true),loose=top.filter(n=>n.free===true);
 if(attached.length)out.push('');
 for(const n of attached)writeNote(n,0);
 // Children of loose notes are written under them; a loose note's own children stay attached.
 if(loose.length){out.push('','## '+L(lang,'Luźne notatki','Loose notes'),'');for(const n of loose)writeNote(n,0);}
 if(graph.links.length){
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  out.push('','## '+L(lang,'Połączenia','Connections'),'');
  for(const l of graph.links){
   const type=l.type||'relates';
   out.push('- '+oneLine(byId.get(l.from).title)+' → '+oneLine(byId.get(l.to).title)+' · '+word(LINK_WORD,type,lang)+' <!-- from='+l.from+' to='+l.to+' -->');
  }
 }
 return out.join('\n')+'\n';
}

// ── Markdown → Canvas (tolerant of human and agent edits) ──
function parseAttrs(text){
 const out={};const m=String(text||'').match(/<!--\s*(.*?)\s*-->/);
 if(!m)return out;
 for(const token of m[1].split(/\s+/)){const i=token.indexOf('=');if(i>0)out[token.slice(0,i)]=token.slice(i+1);}
 return out;
}
const stripComment=s=>s.replace(/<!--.*?-->/g,'').trim();
const num=(v,min,max)=>{const n=Number(v);return v!==undefined&&Number.isFinite(n)&&n>=min&&n<=max?n:undefined;};
export function markdownToCanvas(text,{now}={}){
 if(typeof text!=='string'||text.length>2_000_000)throw Error('Canvas file is missing or too large.');
 const lines=text.replace(/\r\n?/g,'\n').replace(/\t/g,'  ').split('\n');
 const front={};let i=0;
 if(lines[0]?.trim()==='---'){
  for(i=1;i<lines.length&&lines[i].trim()!=='---';i++){const m=lines[i].match(/^([\w-]+):\s?(.*)$/);if(m)front[m[1]]=m[2].trim();}
  i++;
 }
 const stamp=now||(!Number.isNaN(Date.parse(front.updated))?new Date(front.updated).toISOString():new Date(0).toISOString());
 const used=new Set();
 const takeId=(wanted,seed)=>{
  let id=safeId(wanted)&&!used.has(wanted)?wanted:'n_'+stableHash(seed);
  let k=1;while(used.has(id))id='n_'+stableHash(seed+'#'+(k++));
  used.add(id);return id;
 };
 let root=null;const nodes=[],links=[],pendingLinks=[];
 let section='tree',stack=[],last=null;
 const ensureRoot=title=>{
  if(root)return root;
  root={id:takeId(null,'root|'+(front.id||title)),parentId:null,title:(title||front.title||'Untitled idea').slice(0,150),description:'',kind:'idea',status:'exploring',evidence:'',collapsed:false,createdAt:stamp,updatedAt:stamp};
  nodes.push(root);return root;
 };
 for(;i<lines.length;i++){
  const line=lines[i];
  if(!line.trim()){continue;}
  const heading=line.match(/^(#{1,6})\s+(.*)$/);
  if(heading){
   if(heading[1].length===1&&!root){
    const a=parseAttrs(heading[2]);const title=stripComment(heading[2]);
    root={id:takeId(a.id,'root|'+title),parentId:null,title:(title||front.title||'Untitled idea').slice(0,150),description:'',kind:'idea',status:'exploring',evidence:'',collapsed:false,createdAt:stamp,updatedAt:stamp};
    const x=num(a.x,0,20000),y=num(a.y,0,20000);if(x!==undefined&&y!==undefined){root.x=x;root.y=y;}
    nodes.push(root);last=root;stack=[];section='tree';continue;
   }
   const h=heading[2].toLowerCase();
   section=/loose|luźn/.test(h)?'loose':/connection|połącz/.test(h)?'links':'ignore';
   stack=[];last=null;continue;
  }
  if(/^\s*<!--.*-->\s*$/.test(line))continue;
  const bullet=line.match(/^( *)[-*+] (.*)$/);
  if(bullet&&section==='links'){
   const a=parseAttrs(bullet[2]);const body=stripComment(bullet[2]);
   const m=body.match(/^(.*?)\s*(?:→|->)\s*(.*?)(?:\s*[·|]\s*(\S+))?$/);
   if(m)pendingLinks.push({from:a.from,to:a.to,fromTitle:m[1].trim(),toTitle:m[2].trim(),type:LINK_FROM.get((m[3]||'').toLowerCase())||'relates'});
   continue;
  }
  if(bullet&&section!=='ignore'){
   const r=ensureRoot(front.title);
   const indent=bullet[1].length;
   const a=parseAttrs(bullet[2]);
   let body=stripComment(bullet[2]);
   let kind=null,status='open';
   const tag=body.match(/^\[([^\]]*)\]\s*(.*)$/);
   if(tag){
    body=tag[2];
    for(const part of tag[1].split(/[·|,]/).map(s=>s.trim().toLowerCase()).filter(Boolean)){
     if(!kind&&KIND_FROM.has(part))kind=KIND_FROM.get(part);
     else if(STATUS_FROM.has(part))status=STATUS_FROM.get(part);
    }
   }
   const title=oneLine(body).slice(0,150);
   if(!title)continue;
   if(!kind||kind==='idea')kind=inferKind(title);
   while(stack.length&&stack.at(-1).indent>=indent)stack.pop();
   const parent=stack.at(-1)?.node;
   if(nodes.length>=MAX_NODES)throw Error('A canvas can hold up to 400 notes.');
   const node={id:takeId(a.id,(parent?.id||r.id)+'|'+title+'|'+i),parentId:parent?parent.id:r.id,title,description:'',kind,status:IDEA_STATES.includes(status)?status:'open',
    evidence:'',collapsed:false,createdAt:stamp,updatedAt:stamp};
   if(!parent&&section==='loose')node.free=true;
   const x=num(a.x,0,20000),y=num(a.y,0,20000);if(x!==undefined&&y!==undefined){node.x=x;node.y=y;}
   const impact=num(a.impact,1,5),effort=num(a.effort,1,5);
   if(Number.isInteger(impact))node.impact=impact;
   if(Number.isInteger(effort))node.effort=effort;
   nodes.push(node);stack.push({indent,node});last=node;
   continue;
  }
  const q=line.match(/^( *)>\s?(.*)$/);
  const target=last||(section==='tree'?root:null);
  if(!target)continue;
  const textLine=q?q[2]:line.trim();
  const ev=textLine.match(/^\*\*(Evidence|Dowód):\*\*\s?(.*)$/i);
  if(ev)target.evidence=(target.evidence?target.evidence+'\n':'')+ev[2];
  else if(q||(target!==root&&line.startsWith('  ')))target.description=(target.description?target.description+'\n':'')+textLine;
 }
 const r=ensureRoot(front.title);
 for(const n of nodes){n.description=n.description.slice(0,4000);n.evidence=n.evidence.slice(0,4000);}
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const byTitle=new Map();for(const n of nodes)if(!byTitle.has(n.title))byTitle.set(n.title,n.id);
 const seen=new Set();
 for(const p of pendingLinks){
  const from=byId.has(p.from)?p.from:byTitle.get(p.fromTitle),to=byId.has(p.to)?p.to:byTitle.get(p.toTitle);
  if(!from||!to||from===to||seen.has(from+'>'+to))continue;
  seen.add(from+'>'+to);
  links.push(p.type==='relates'?{from,to}:{from,to,type:p.type});
 }
 const graph={schemaVersion:1,id:safeId(front.id)?front.id:'g_'+stableHash(r.title+'|'+r.id),rootId:r.id,title:r.title,createdAt:stamp,updatedAt:stamp,nodes,links};
 assertIdeaGraph(graph);
 // Notes added by hand or by an agent have no position: put them in free space beside their parent,
 // so an existing layout is kept. A file without any positions gets a fresh tree layout.
 const has=n=>Number.isFinite(n.x)&&Number.isFinite(n.y);
 if(has(r)&&nodes.some(n=>!has(n))){
  for(const n of nodes){
   if(has(n))continue;
   const anchor=nodes.find(p=>p.id===n.parentId&&has(p))?(n.parentId):r.id;
   const [slot]=freeSlots(graph,anchor,1);
   if(slot){n.x=slot.x;n.y=slot.y;}
  }
 }
 return prepareBoard(graph);
}

// ── The whole brain: folders, generated product data and scaffold docs ──
const cell=s=>oneLine(s).replace(/\|/g,'\\|')||'—';
function decisionsOf(graph){return graph.nodes.filter(n=>n.kind==='insight'&&/^(decision|decyzja)\s*:/i.test(n.title));}
function assumptionsFile(graphs,lang){
 const out=['# '+L(lang,'Rejestr założeń','Assumption register'),'',GENERATED,
  L(lang,'Wygenerowane z canvasów w product-data/ideas/. Edytuj canvas, nie ten plik.','Generated from the canvases in product-data/ideas/. Edit the canvas, not this file.'),''];
 let any=false;
 for(const g of graphs){
  const list=g.nodes.filter(n=>n.kind==='assumption');
  if(!list.length)continue;any=true;
  out.push('## '+oneLine(g.title),'','| '+L(lang,'Założenie','Assumption')+' | Status | '+L(lang,'Dowód','Evidence')+' |','|---|---|---|');
  for(const n of list)out.push('| '+cell(n.title)+' | '+word(STATUS_WORD,n.status,lang)+' | '+cell(n.evidence)+' |');
  out.push('');
 }
 if(!any)out.push(L(lang,'_Brak założeń. Dodaj notatkę typu „Założenie” na canvasie._','_No assumptions yet. Add an “Assumption” note on a canvas._'),'');
 return out.join('\n');
}
function decisionFile(graph,node,lang){
 return ['---','thenvio: decision','canvas: '+graph.id,'note: '+node.id,'date: '+node.updatedAt.slice(0,10),'---','',GENERATED,'',
  '# '+oneLine(node.title),'',node.description||L(lang,'_Brak uzasadnienia._','_No rationale recorded._'),'',
  L(lang,'Canvas: ','Canvas: ')+oneLine(graph.title),''].join('\n');
}
export function scaffoldFiles({locale='en'}={}){
 const lang=locale==='pl'?'pl':'en';
 const table=BRAIN_FOLDERS.map(f=>'| `'+f.path+'` | '+f[lang]+' |').join('\n');
 const files=[
  {path:'README.md',content:[
   L(lang,'# Wspólny mózg','# Shared brain'),'',
   L(lang,'Jedno repo, zwykły tekst — dla całego zespołu i jego agentów.','One repo, plain text — for the whole team and its agents.'),'',
   L(lang,'| Folder | Co tu jest |','| Folder | What lives here |'),'|---|---|',table,'',
   L(lang,'## Na co dzień','## Every day'),
   L(lang,'1. Myśl w Thenvio. Canvasy zapisują się tutaj jako Markdown (połączony folder albo pobrany mózg).','1. Think in Thenvio. Canvases are saved here as Markdown (connected folder or downloaded brain).'),
   L(lang,'2. Zapisz zmiany w historii: `git add . && git commit -m "…" && git push`.','2. Save to history: `git add . && git commit -m "…" && git push`.'),
   L(lang,'3. Agenci (Claude Code, Codex, Cursor…) czytają `AGENTS.md` i pracują na tych samych plikach.','3. Agents (Claude Code, Codex, Cursor…) read `AGENTS.md` and work in the same files.'),'',
   L(lang,'Lekkie · pełna historia · kopia wszędzie, gdzie wypchniesz · darmowe repo na GitHubie.','Lightweight · full history · backed up wherever you push · free to host on GitHub.'),''].join('\n')},
  {path:'AGENTS.md',content:['# Agent guide — shared brain','',
   'This repository is the team\'s shared brain: one repo, plain text. People and agents read and write the same files.','',
   '## Where things live',
   '- `how-we-work/` — how this team works and decides. Follow it.',
   '- `product-data/ideas/` — Thenvio canvases, one Markdown file per idea. Format: `product-data/README.md`.',
   '- `product-data/assumptions.md` and `product-data/decisions/` — generated from the canvases. Change the canvas, not these.',
   '- `brand/` — voice and positioning written by the team. Never invent brand facts.',
   '- `skills/` — founder skills (`SKILL.md`). Use the one that fits the task.','',
   '## Rules',
   '- Separate facts, estimates, hypotheses and unknowns. Never invent customers, quotes, metrics, prices, sources or revenue.',
   '- To add a thought, add `- [kind] title` under the right note in a canvas file. Keep existing `<!-- id=… -->` tags; new lines without tags are fine.',
   '- Prefer the cheapest experiment over certainty. Write down what would disprove an assumption before testing it.',
   '- Do not push, publish, contact people or spend money without explicit human approval.',
   '- Optional: the Thenvio MCP server (`thenvio_futures`, `thenvio_next_moves`) ranks a canvas\'s scenarios and next moves locally, without network access.',''].join('\n')},
  {path:'CLAUDE.md',content:'Read and follow AGENTS.md.\n'},
  {path:'how-we-work/README.md',content:[
   L(lang,'# Jak pracujemy','# How we work'),'',
   L(lang,'Jak ten zespół zamienia pomysły w decyzje. Dopasuj ten plik do tego, jak naprawdę pracujecie.','How this team turns ideas into decisions. Edit this file to match how you really work.'),'',
   L(lang,'## Pętla','## The loop'),
   L(lang,'1. Zapisz pomysł jednym zdaniem.','1. Write the idea in one sentence.'),
   L(lang,'2. Otwórz co najmniej dwie naprawdę różne opcje.','2. Open at least two genuinely different options.'),
   L(lang,'3. Pod każdą opcją nazwij, co musi być prawdą (założenia).','3. Under each option, name what must be true (assumptions).'),
   L(lang,'4. Najbardziej podstawowe założenie sprawdź najtańszym testem. Przed startem zapisz wynik, który je obali.','4. Test the most foundational assumption with the cheapest experiment. Before starting, write down the result that would disprove it.'),
   L(lang,'5. Oznacz dowody: potwierdzone albo obalone, ze źródłem.','5. Mark evidence: supported or refuted, with a source.'),
   L(lang,'6. Przeskanuj przyszłości w Thenvio, zapisz decyzję i warunek, przy którym do niej wracacie.','6. Scan the futures in Thenvio, record the decision and the condition that would make you revisit it.'),'',
   L(lang,'## Zasady','## Rules'),
   L(lang,'- Fakty, szacunki, hipotezy i niewiadome są oznaczone.','- Facts, estimates, hypotheses and unknowns are labelled.'),
   L(lang,'- Decyzja ma właściciela i warunek powrotu.','- A decision has an owner and a revisit trigger.'),
   L(lang,'- _Dopisz swoje: spotkania, narzędzia, rytm przeglądów…_','- _Add your own: meetings, tools, review rhythm…_'),''].join('\n')},
  {path:'product-data/README.md',content:['# Product data','',
   '- `ideas/` — one Thenvio canvas per file. Thenvio reads and writes these; people and agents may edit them too.',
   '- `assumptions.md` — every assumption across canvases with its status and evidence (generated).',
   '- `decisions/` — decisions recorded from a futures scan (generated).','',
   '## Canvas file format','',
   '```markdown',
   '# Main idea <!-- id=n_root -->',
   '> Optional context for the main idea.',
   '',
   '- [option] Small weekly groups <!-- id=n_a impact=4 effort=2 -->',
   '  > Why this could work.',
   '  - [assumption · supported] People return weekly <!-- id=n_b -->',
   '    > **Evidence:** 7 of 10 pilot users came back',
   '  - [test] Run 5 sessions; success if 3 people return',
   '- [option] One big monthly event',
   '',
   '## Loose notes',
   '- [question] Who pays?',
   '',
   '## Connections',
   '- Small weekly groups → One big monthly event · conflicts',
   '```','',
   '- Kinds: `option`, `question`, `assumption`, `test`, `insight` (Polish words work too). Missing kind → inferred from the words.',
   '- Status after `·`: `open`, `exploring`, `supported`, `refuted`.',
   '- Indent two spaces to branch. `>` lines are notes; `**Evidence:**` holds the source.',
   '- `<!-- … -->` tags keep ids, positions and 1–5 impact/effort ratings. They are invisible on GitHub.',
   '- Connection types: `relates`, `supports`, `conflicts`.',''].join('\n')},
  {path:'brand/README.md',content:[
   L(lang,'# Marka','# Brand'),'',
   L(lang,'Pisane przez zespół. Nic w tym folderze nie jest generowane ani wymyślane przez Thenvio.','Written by the team. Nothing in this folder is generated or invented by Thenvio.'),'',
   L(lang,'## Dla kogo jesteśmy','## Who we are for'),L(lang,'_Jedno zdanie._','_One sentence._'),'',
   L(lang,'## Obietnica','## Promise'),L(lang,'_Co ktoś może zrobić dzięki nam, czego wcześniej nie mógł?_','_What can someone do with us that they could not before?_'),'',
   L(lang,'## Głos','## Voice'),L(lang,'- Słowa, których używamy:','- Words we use:'),L(lang,'- Słowa, których unikamy:','- Words we avoid:'),'',
   L(lang,'## Wygląd','## Visual identity'),L(lang,'_Logo, kolory, typografia — linki do plików._','_Logo, colours, type — links to files._'),'',
   L(lang,'## Dowody, które możemy pokazać','## Proof we can show'),L(lang,'_Tylko prawdziwe, sprawdzalne rzeczy._','_Only real, checkable things._'),''].join('\n')},
  {path:'skills/README.md',content:['# Skills','','Portable founder skills. Each folder holds a `SKILL.md` your agent can follow.','',
   ...SKILLS.map(s=>'- [`'+s.id+'`]('+s.id+'/SKILL.md) — '+s.summary),''].join('\n')},
  ...SKILLS.map(s=>({path:'skills/'+s.id+'/SKILL.md',content:skillMarkdown(s.id)}))
 ];
 return files.map(f=>({...f,owner:'team'}));
}
// Everything Thenvio writes into a brain. `owner:'thenvio'` files are regenerated on every save;
// `owner:'team'` scaffold files are only created when missing and never overwritten.
export function brainFiles(graphs,{locale='en',paths={}}={}){
 const lang=locale==='pl'?'pl':'en';
 const files=scaffoldFiles({locale:lang});
 for(const g of graphs){
  assertIdeaGraph(g);
  files.push({path:paths[g.id]||canvasPath(g),content:canvasToMarkdown(g),owner:'thenvio',canvasId:g.id});
  const slug=slugify(g.title);
  for(const d of decisionsOf(g))files.push({path:'product-data/decisions/'+slug+'-'+stableHash(d.id).slice(0,5)+'.md',content:decisionFile(g,d,lang),owner:'thenvio'});
 }
 files.push({path:'product-data/assumptions.md',content:assumptionsFile(graphs,lang),owner:'thenvio'});
 return files;
}
// Read canvases back from brain files ({path, content}); bad files are reported, not fatal.
export function readBrain(files,{now}={}){
 const canvases=[],errors=[],paths={};
 for(const f of files){
  if(!f||typeof f.path!=='string'||!f.path.startsWith(IDEAS_DIR)||!f.path.endsWith('.md')||f.path.slice(IDEAS_DIR.length).includes('/'))continue;
  try{
   const g=markdownToCanvas(String(f.content),{now});
   if(canvases.some(c=>c.id===g.id))throw Error('Duplicate canvas id '+g.id);
   canvases.push(g);paths[g.id]=f.path;
  }catch(e){errors.push({path:f.path,message:e.message});}
 }
 return {canvases,errors,paths};
}
