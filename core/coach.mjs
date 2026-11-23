// Thenvio Coach: reads the whole idea graph and proposes the next useful move,
// the kind of tool worth connecting and the founder skill that fits.
// Pure and deterministic. Rules are transparent heuristics, not AI output or research.
import {assertIdeaGraph,branchPath,ideaContext} from './idea-graph.mjs';
import {getSkill} from './skills.mjs';
import {readFrame} from './brainstorm.mjs';

const L=(locale,pl,en)=>locale==='pl'?pl:en;
const short=(s,n=56)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
export const PLACEHOLDER_TITLES=Object.freeze(['Untitled idea','New thought','Nowy pomysł','Nowa myśl']);
export const isPlaceholder=title=>PLACEHOLDER_TITLES.includes(String(title||'').trim());

export function detectLocale(text,fallback='en'){
 const t=' '+String(text||'').toLowerCase().replace(/[^\p{L}\s]/gu,' ')+' ';
 if(/[ąćęłńśźż]/.test(t))return 'pl';
 const pl=(t.match(/\s(i|w|na|się|jak|co|czy|dla|nie|jest|że|do|po|od|aplikacja|pomysł|ludzi|który|żeby)(?=\s)/g)||[]).length;
 const en=(t.match(/\s(the|and|is|for|how|what|with|to|of|an|app|idea|it|people|that|this)(?=\s)/g)||[]).length;
 return pl>en?'pl':en>pl?'en':fallback;
}
// Suggest a kind for a freshly typed note. The user can always override it.
const KIND_RULES=[
 ['experiment',/^(test|eksperyment|sprawdź|sprawdzić|zweryfikuj|zapytaj|przeprowadź|zrób|pilot|prototyp|mvp|landing|ankieta|wywiad|interview|survey|try|run|validate|prototype|experiment|measure|ask \d)/i],
 ['assumption',/^(założenie|zakładam|zakładamy|hipoteza|ryzyko|musi być prawdą|assum|hypothes|risk|we believe|i believe|must be true)|^(ludzie|użytkownicy|klienci|people|users|customers) (chcą|będą|zapłacą|potrzebują|want|will|would|need)/i],
 ['insight',/^(wniosek|okazało się|nauczyłem|nauczyłam|nauczyliśmy|wiemy|fakt|dane pokazują|decyzja|learned|insight|turns out|we found|finding|fact|data shows|decision)/i],
 ['question',/\?\s*$|^(kto|co|jak|czy|dlaczego|gdzie|kiedy|ile|jaki|jaka|jakie|po co|who|what|how|why|where|when|which|should|could|would|can)\b/i]
];
export function inferKind(title){
 const t=String(title||'').trim();
 for(const [kind,re] of KIND_RULES)if(re.test(t))return kind;
 return 'direction';
}
export function defaultModeFor(kind){
 return {question:'answer',assumption:'test',experiment:'challenge',insight:'explore',direction:'challenge',idea:'explore'}[kind]||'explore';
}
// A catalog of tool CATEGORIES with well-known examples. Thenvio is not connected to any of them.
// Record: [id, Polish name, English name, matcher, examples, Polish how, English how]
const TOOLKIT=[
 ['interviews','Rozmowy z użytkownikami','User interviews',/(rozmow|wywiad|zapytaj|klient|użytkownik|odbiorc|interview|talk to|customer|user research|persona)/i,['Cal.com','Calendly','Google Meet'],'Umów 5 rozmów o ostatniej prawdziwej sytuacji, nie o opiniach.','Book five calls about a recent real situation, not opinions.'],
 ['survey','Ankieta','Survey',/(ankiet|formularz|feedback|opini|survey|\bform\b|questionnaire|\bpoll)/i,['Tally','Google Forms','Typeform'],'Zbierz odpowiedzi od 20+ osób z grupy docelowej.','Collect answers from 20+ people in the target group.'],
 ['landing','Landing page z zapisami','Landing page + waitlist',/(landing|strona www|stron[ay] intern|waitlist|lista oczek|zapis|przedsprzeda|pre-?order|signup|sign up|website)/i,['Carrd','Framer','Webflow'],'Opisz obietnicę jednym zdaniem i licz realne zapisy.','State the promise in one sentence and count real sign-ups.'],
 ['prototype','Klikalny prototyp','Clickable prototype',/(prototyp|makiet|ekran|interfejs|\bui\b|\bux\b|design|mockup|wireframe|figma)/i,['Figma','Excalidraw','Framer'],'Pokaż 3 ekrany pięciu osobom i zapisz, gdzie utknęły.','Show three screens to five people and note where they get stuck.'],
 ['payments','Płatności','Payments',/(płat|płac|zapłac|\bcen[aęyi]|subskrypc|abonament|pricing|\bprice|\bpay|checkout|subscription|monetiz|monetyz|zarabia)/i,['Stripe','Lemon Squeezy','RevenueCat'],'Ustaw prawdziwy link płatności — przedsprzedaż mówi więcej niż ankieta.','Set up a real payment link — a pre-sale says more than a survey.'],
 ['analytics','Analityka produktu','Product analytics',/(metryk|analityk|konwersj|retencj|lejek|mierz|analytics|metric|conversion|retention|funnel|measure|\bkpi)/i,['PostHog','Plausible'],'Zdefiniuj jedno zdarzenie aktywacji i mierz je od pierwszego dnia.','Define one activation event and track it from day one.'],
 ['automation','Automatyzacja','Automation',/(automatyz|integrac|workflow|automation|integrat|zapier|webhook)/i,['Zapier','Make','n8n'],'Połącz narzędzia bez kodu, zanim cokolwiek zbudujesz.','Wire tools together without code before building anything.'],
 ['backend','Baza danych i logowanie','Database + auth',/(baz[aęy] danych|backend|serwer|logowan|\bkont[ao]\b|rejestrac|database|\bauth|login|account|storage)/i,['Supabase','Firebase'],'Gotowe logowanie i baza oszczędzają tygodnie pracy.','Hosted auth and a database save weeks of work.'],
 ['mobile','Aplikacja mobilna','Mobile app',/(mobiln|telefon|\bios\b|android|smartfon|mobile|iphone|app store|google play)/i,['Expo','TestFlight'],'Zacznij od jednej platformy i testów z 10 osobami.','Start on one platform and test with ten people.'],
 ['ai','Funkcje AI','AI features',/(\bai\b|sztuczn|asystent|chatbot|\bllm|\bgpt|claude|model językow|\bagent|assistant|machine learning)/i,['Claude','ChatGPT','MCP'],'Sprawdź ręcznie na 5 przykładach, zanim zautomatyzujesz.','Check by hand on five examples before automating.'],
 ['social','Treści i social media','Content + social',/(tiktok|instagram|youtube|social|marketing|treśc|treść|content|kampani|reklam|\bads?\b|influenc|viral)/i,['Buffer','CapCut','Meta Ads'],'Opublikuj 5 krótkich materiałów i porównaj reakcje.','Publish five short pieces and compare responses.'],
 ['seo','SEO i newsletter','SEO + newsletter',/(\bseo|wyszukiw|\bblog|newsletter|mailing|search engine)/i,['Google Search Console','Beehiiv','Substack'],'Sprawdź, czego ludzie już szukają, i napisz pod to.','Check what people already search for and write for it.'],
 ['community','Społeczność','Community',/(społeczno|community|discord|grup[ay]|forum|slack|whatsapp|członk|member)/i,['Discord','Circle','WhatsApp'],'Zbierz 20 osób w jednym miejscu i obserwuj, co robią.','Gather 20 people in one place and watch what they do.'],
 ['events','Wydarzenia','Events',/(spotkani|spotkań|wydarzen|event|meetup|warsztat|workshop|webinar)/i,['Luma','Meetup','Eventbrite'],'Zorganizuj jedno małe spotkanie, zanim zbudujesz platformę.','Host one small gathering before building a platform.'],
 ['commerce','Sklep online','Online store',/(sklep|e-?commerce|sprzeda[żj]|produkt fizyczn|marketplace|\bshop|\bstore|\bsell|etsy|allegro)/i,['Shopify','Gumroad','Etsy'],'Wystaw jeden produkt i sprawdź, czy ktoś kupi.','List one product and see whether anyone buys.'],
 ['outreach','E-mail outreach','Email outreach',/(e-?mail|\bmail\b|outreach|\bcold\b|dotrzeć|\bleady|\blead|sales)/i,['Gmail','Resend','Apollo'],'Napisz 20 spersonalizowanych wiadomości z legalną podstawą kontaktu.','Send 20 personal messages with a lawful basis for contact.'],
 ['planning','Plan i zadania','Planning + tasks',/(\bplan|zadani|roadmap|harmonogram|termin|sprint|\btask|milestone|deadline)/i,['Linear','Notion','Trello'],'Rozpisz najbliższy tydzień na 3 konkretne kroki.','Break the next week into three concrete steps.'],
 ['deploy','Hosting i domena','Hosting + domain',/(deploy|hosting|domen|wdroż|\blaunch|\bhost\b|domain|vercel|cloudflare)/i,['Cloudflare','Vercel','Netlify'],'Opublikuj najprostszą wersję pod własną domeną.','Ship the simplest version on your own domain.'],
 ['legal','Prywatność i regulamin','Privacy + terms',/(rodo|gdpr|prywatno|regulamin|umow[ay]|prawn|privacy|\bterms|legal|compliance|dane osobowe)/i,['Termly','iubenda'],'Zbieraj tylko niezbędne dane i opisz to prosto.','Collect only the data you need and explain it plainly.']
];
const KIND_TOOLS={experiment:['landing','survey'],assumption:['interviews','survey'],question:['interviews','survey'],direction:['prototype','landing'],idea:['interviews','landing'],insight:['planning','analytics']};
// Expand a regex hit to the whole word so the reason reads naturally ("płatności", not "płat").
function wordOf(text,hit){
 const isLetter=c=>/[\p{L}\p{N}-]/u.test(c);
 let a=hit.index,b=hit.index+hit[0].length;
 while(a>0&&isLetter(text[a-1]))a--;
 while(b<text.length&&isLetter(text[b]))b++;
 return text.slice(a,b).trim()||hit[0].trim();
}
const TOOL_BY_ID=new Map(TOOLKIT.map(t=>[t[0],t]));
export const TOOL_IDS=Object.freeze(TOOLKIT.map(t=>t[0]));
function toolCard(record,locale,why){
 const [id,plName,enName,,examples,plHow,enHow]=record;
 return {id,name:L(locale,plName,enName),examples:[...examples],how:L(locale,plHow,enHow),why};
}
export function recommendTools(graph,nodeId,{locale='en',limit=3}={}){
 assertIdeaGraph(graph);
 const path=branchPath(graph,nodeId),node=path.at(-1);
 const own=[node.title,node.description,node.evidence].join(' ');
 const context=path.slice(0,-1).map(n=>n.title).join(' ');
 const scored=[];
 for(const record of TOOLKIT){
  const hit=own.match(record[3]);
  const near=hit?null:context.match(record[3]);
  if(hit){const w=wordOf(own,hit);scored.push({record,score:3,why:L(locale,'Notatka wspomina „'+w+'”.','The note mentions “'+w+'”.')});}
  else if(near){const w=wordOf(context,near);scored.push({record,score:1,why:L(locale,'Kontekst ścieżki: „'+w+'”.','Path context: “'+w+'”.')});}
 }
 const kindName={experiment:L(locale,'eksperymentu','an experiment'),assumption:L(locale,'założenia','an assumption'),question:L(locale,'pytania','a question'),direction:L(locale,'opcji','an option'),idea:L(locale,'pomysłu','an idea'),insight:L(locale,'wniosku','an insight')}[node.kind];
 for(const id of KIND_TOOLS[node.kind]||[]){
  if(!scored.some(s=>s.record[0]===id))scored.push({record:TOOL_BY_ID.get(id),score:.5,why:L(locale,'Typowy następny krok dla '+kindName+'.','A typical next step for '+kindName+'.')});
 }
 return scored.sort((a,b)=>b.score-a.score).slice(0,limit).map(s=>toolCard(s.record,locale,s.why));
}
const SKILL_RULES=[
 ['pricing-lab',/(\bcen[aęyi]|pricing|\bprice|subskryp|abonament|zapłac|willingness)/i],
 ['competitor-map',/(konkuren|competitor|alternatyw|alternative)/i],
 ['market-mapping',/(rynek|rynku|\bmarket|\btam\b|wielkość)/i],
 ['customer-discovery',/(rozmow|wywiad|interview|klient|customer|persona|użytkownik|dla kogo|who is)/i],
 ['distribution-design',/(dystrybuc|kanał|marketing|pozysk|distribution|channel|acquisition|growth)/i],
 ['mvp-scope',/(\bmvp|zakres|\bscope|pierwsza wersja|first version)/i],
 ['pitch-narrative',/(inwestor|\bpitch|fundrais|finansowan|investor)/i],
 ['risk-register',/(ryzyk|\brisk)/i],
 ['security-privacy',/(prywatno|rodo|gdpr|security|bezpiecze)/i],
 ['unit-economics',/(koszt|marż|unit econ|\bcost|margin|break-even|rentown)/i]
];
export function recommendSkill(graph,nodeId,{locale='en'}={}){
 assertIdeaGraph(graph);
 const node=graph.nodes.find(n=>n.id===nodeId);
 if(!node)throw Error('Node not found.');
 const text=node.title+' '+node.description;
 let id=SKILL_RULES.find(([,re])=>re.test(text))?.[0];
 let why=id?L(locale,'Pasuje do treści notatki.','Matches what the note is about.'):'';
 if(!id){
  const siblings=graph.nodes.filter(n=>n.parentId===node.parentId&&n.kind==='direction'&&n.free!==true).length;
  id=node.id===graph.rootId?'problem-framing':node.kind==='assumption'?'assumption-audit':node.kind==='experiment'?'experiment-design':node.kind==='question'?'problem-framing':node.kind==='insight'?'decision-memo':siblings>=2?'red-team':'scenario-builder';
  why=L(locale,'Pasuje do typu notatki.','Fits this kind of note.');
 }
 const skill=getSkill(id);
 return {id,name:skill.name,summary:skill.summary,why};
}
export function skillBrief(graph,nodeId,skillId){
 const s=getSkill(skillId);
 return ['# Thenvio / '+s.name,'MISSION: '+s.summary,'DELIVERABLE: '+s.deliverable,'METHOD: '+s.instructions,
  'RULES: Separate facts, estimates, hypotheses and unknowns. Never invent metrics, interviews, sources or market data. End with the cheapest next experiment and a go/no-go trigger.',
  '',ideaContext(graph,nodeId)].join('\n');
}
function words(s){return new Set(String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2));}
function similarity(a,b){const A=words(a),B=words(b);if(A.size<2||B.size<2)return 0;let both=0;for(const w of A)if(B.has(w))both++;return both/(A.size+B.size-both);}
// Ranked list of next moves for the whole canvas. `futures` is an optional analyzeFutures() result.
export function coachGraph(graph,{locale='en',futures=null,limit=6}={}){
 assertIdeaGraph(graph);
 const byId=new Map(graph.nodes.map(n=>[n.id,n]));
 const attached=graph.nodes.filter(n=>n.id!==graph.rootId&&n.free!==true);
 const kids=id=>graph.nodes.filter(n=>n.parentId===id&&n.free!==true);
 const root=byId.get(graph.rootId);
 const depth=n=>{let d=0,p=n;while(p.parentId){d++;p=byId.get(p.parentId);}return d;};
 const moves=[];
 const push=(priority,id,icon,title,why,action)=>moves.push({id,priority,icon,title,why,action});
 if(isPlaceholder(root.title))push(100,'name:'+root.id,'✎',L(locale,'Nazwij swój pomysł','Name your idea'),
  L(locale,'Jedno zdanie wystarczy. Reszta zacznie się podpowiadać sama.','One sentence is enough. Suggestions start from there.'),{type:'edit',nodeId:root.id});
 else if(!attached.length)push(95,'open:'+root.id,'✦',L(locale,'Otwórz pierwsze kierunki','Open the first directions'),
  L(locale,'Kliknij podpowiedź obok pomysłu albo naciśnij Tab, żeby dopisać własną.','Click a suggestion next to your idea, or press Tab to write your own.'),{type:'suggest',nodeId:root.id,mode:'explore'});
 for(const n of graph.nodes)if(n.id!==root.id&&isPlaceholder(n.title))push(90,'finish:'+n.id,'✎',L(locale,'Dokończ tę myśl','Finish this thought'),
  L(locale,'Pusta notatka nic nie wnosi do analizy.','An empty note adds nothing to the analysis.'),{type:'edit',nodeId:n.id});
 for(const n of attached.filter(n=>n.status==='refuted'&&(n.kind==='assumption'||n.kind==='experiment'))){
  let option=byId.get(n.parentId);while(option&&option.kind!=='direction'&&option.parentId)option=byId.get(option.parentId);
  const base=option&&option.kind==='direction'?option:root;
  push(85,'pivot:'+n.id,'↺',L(locale,'Obalone: „'+short(n.title)+'” — czas na zwrot','Refuted: “'+short(n.title)+'” — time to pivot'),
   L(locale,'Ta ścieżka jest zablokowana. Co by zadziałało zamiast niej?','This route is blocked. What would work instead?'),
   {type:'add',parentId:base.parentId||root.id,seed:{title:L(locale,'Alternatywa dla: ','Alternative to: ')+short(base.title,110),kind:'direction',description:''}});
 }
 if(futures?.nextMove){
  const m=futures.nextMove;
  const action=m.code==='rate'?{type:'rate',nodeId:m.nodeId}
   :m.code==='test'?{type:'add',parentId:m.nodeId,seed:testSeed(byId.get(m.nodeId),locale)}
   :m.code==='differentiate'?{type:'select',nodeId:m.nodeId}
   :m.code==='commit'?{type:'decide'}
   :{type:'suggest',nodeId:m.nodeId,mode:'explore'};
  push(80,'futures:'+m.code+':'+m.nodeId,'◎',m.title,m.why,action);
 }
 const untested=attached.filter(n=>n.kind==='assumption'&&(n.status==='open'||n.status==='exploring')&&!kids(n.id).some(k=>k.kind==='experiment'))
  .sort((a,b)=>depth(a)-depth(b));
 if(untested[0])push(78,'test:'+untested[0].id,'⚗',L(locale,'Przetestuj założenie: „'+short(untested[0].title)+'”','Test the assumption: “'+short(untested[0].title)+'”'),
  L(locale,'Najbardziej podstawowe nieprzetestowane założenie. Najtańszy test daje najwięcej wiedzy.','The most foundational untested assumption. The cheapest test teaches the most.'),
  {type:'add',parentId:untested[0].id,seed:testSeed(untested[0],locale)});
 const frame=readFrame(root.title);
 // Real content comes from the person's own chat model: offer it once there is something to think about.
 if(attached.length>=1&&!isPlaceholder(root.title))push(frame.type==='product'?52:72,'think:'+root.id,'✦',L(locale,'Pomyśl nad tym w Claude albo ChatGPT','Think it through in Claude or ChatGPT'),
  L(locale,'Twój czat rozumie temat: dopisze prawdziwe alternatywy, pytania i testy prosto na canvas.','Your chat understands the topic: it adds real alternatives, questions and tests straight to the canvas.'),{type:'think',nodeId:root.id});
 const audience=/(kto|dla kogo|użytkownik|klient|odbiorc|grupa docelowa|\bwho\b|audience|\buser|customer|persona|target)/i;
 if(frame.type==='product'&&attached.length&&!graph.nodes.some(n=>audience.test(n.title+' '+n.description)))push(70,'who:'+root.id,'?',L(locale,'Dla kogo dokładnie to jest?','Who exactly is this for?'),
  L(locale,'Bez konkretnej osoby każdy kierunek wygląda dobrze.','Without a specific person every direction looks good.'),
  {type:'add',parentId:root.id,seed:{title:L(locale,'Dla kogo dokładnie to jest?','Who exactly is this for?'),kind:'question',description:''}});
 const openQ=attached.find(n=>n.kind==='question'&&n.status!=='supported'&&!kids(n.id).length&&!isPlaceholder(n.title));
 if(openQ)push(66,'answer:'+openQ.id,'↳',L(locale,'Odpowiedz: „'+short(openQ.title)+'”','Answer: “'+short(openQ.title)+'”'),
  L(locale,'Dwie lub więcej odpowiedzi tworzy rozwidlenie, które można porównać.','Two or more answers create a fork you can compare.'),{type:'suggest',nodeId:openQ.id,mode:'answer'});
 const naked=attached.find(n=>n.kind==='direction'&&!isPlaceholder(n.title)&&!kids(n.id).some(k=>k.kind==='assumption'||k.kind==='experiment'));
 const bare=attached.find(n=>n.kind==='direction'&&!isPlaceholder(n.title)&&!kids(n.id).length);
 if(frame.type!=='product'){if(bare)push(62,'why:'+bare.id,'△',L(locale,'Co przemawia za „'+short(bare.title)+'”, a co przeciw?','What speaks for “'+short(bare.title)+'”, and against it?'),
  L(locale,'Jeden konkretny powód z każdej strony wystarczy, żeby porównać opcje.','One concrete reason on each side is enough to compare the options.'),
  {type:'add',parentId:bare.id,seed:{title:L(locale,'Za i przeciw: ','For and against: ')+short(bare.title,100),kind:'question',description:''}});}
 else if(naked)push(62,'must:'+naked.id,'△',L(locale,'Co musi być prawdą dla „'+short(naked.title)+'”?','What must be true for “'+short(naked.title)+'”?'),
  L(locale,'Każda opcja opiera się na założeniach. Nazwij najważniejsze.','Every option rests on assumptions. Name the key one.'),
  {type:'add',parentId:naked.id,seed:{title:L(locale,'Co musi być prawdą, żeby „','What must be true for “')+short(naked.title,90)+L(locale,'” zadziałało?','” to work?'),kind:'question',description:''}});
 const forkCount=new Set(attached.filter(n=>n.kind==='direction').map(n=>n.parentId)).size;
 const hasFork=graph.nodes.some(p=>kids(p.id).filter(k=>k.kind==='direction').length>=2);
 if(hasFork&&!futures)push(60,'scan','◎',L(locale,'Przeskanuj możliwe przyszłości','Scan the possible futures'),
  L(locale,'Porównaj każdą kombinację wyborów i zobacz najlepszą ścieżkę.','Compare every combination of choices and see the best route.'),{type:'futures'});
 if(!hasFork&&!futures){
  const lone=attached.find(n=>n.kind==='direction'&&!isPlaceholder(n.title));
  if(lone)push(58,'alt:'+lone.id,'⑂',L(locale,'Dodaj alternatywę dla „'+short(lone.title)+'”','Add an alternative to “'+short(lone.title)+'”'),
   L(locale,'Jedna opcja to nie wybór. Dwie tworzą rozwidlenie do porównania.','One option is not a choice. Two make a fork to compare.'),{type:'suggest',nodeId:lone.parentId,mode:'explore'});
 }
 if(hasFork&&forkCount){
  const unrated=attached.find(n=>n.kind==='direction'&&(!n.impact||!n.effort)&&kids(n.parentId).filter(k=>k.kind==='direction').length>=2);
  if(unrated)push(56,'rate:'+unrated.id,'◐',L(locale,'Oceń: „'+short(unrated.title)+'”','Rate: “'+short(unrated.title)+'”'),
   L(locale,'Wpływ i wysiłek (1–5) wyostrzają porównanie ścieżek.','Impact and effort (1–5) sharpen the route comparison.'),{type:'rate',nodeId:unrated.id});
 }
 const vague=attached.find(n=>n.kind==='experiment'&&!isPlaceholder(n.title)&&!/(\d|jeśli|jeżeli|gdy|kryter|\bif\b|when|criteria|≥|>|<)/i.test(n.title+' '+n.description));
 if(vague)push(50,'criteria:'+vague.id,'✓',L(locale,'Jaki wynik się liczy w „'+short(vague.title)+'”?','What result counts in “'+short(vague.title)+'”?'),
  L(locale,'Zapisz z góry liczbę, która potwierdzi lub obali pomysł.','Write down the number that confirms or kills the idea — before testing.'),{type:'edit',nodeId:vague.id,field:'body'});
 const leaves=attached.filter(n=>!kids(n.id).length&&depth(n)>=3);
 const untestedLeaf=leaves.find(n=>!branchPath(graph,n.id).some(p=>p.kind==='experiment'));
 if(untestedLeaf)push(48,'deep:'+untestedLeaf.id,'⚗',L(locale,'Głęboko, ale bez testu: „'+short(untestedLeaf.title)+'”','Deep but untested: “'+short(untestedLeaf.title)+'”'),
  L(locale,'Trzy poziomy myślenia bez eksperymentu. Sprawdź coś w realu.','Three levels of thinking without an experiment. Check something in reality.'),{type:'suggest',nodeId:untestedLeaf.id,mode:'test'});
 const linked=new Set(graph.links.flatMap(l=>[l.from,l.to]));
 const loose=graph.nodes.filter(n=>n.free===true&&!linked.has(n.id)&&!graph.nodes.some(k=>k.parentId===n.id&&k.free!==true));
 if(loose.length)push(44,'loose:'+loose[0].id,'⌁',L(locale,'Połącz luźne notatki ('+loose.length+')','Connect loose notes ('+loose.length+')'),
  L(locale,'Przeciągnij kropkę z notatki na inną. Połączone notatki biorą udział w analizie.','Drag a note’s dot onto another. Connected notes join the analysis.'),{type:'select',nodeId:loose[0].id});
 const learned=attached.find(n=>n.kind==='insight'&&n.status==='supported'&&!kids(n.id).length);
 if(learned)push(42,'apply:'+learned.id,'→',L(locale,'Co zmienia „'+short(learned.title)+'”?','What does “'+short(learned.title)+'” change?'),
  L(locale,'Wniosek bez działania to tylko notatka.','A learning without an action is just a note.'),
  {type:'add',parentId:learned.id,seed:{title:L(locale,'Zmiana po wniosku: ','Change after learning: ')+short(learned.title,100),kind:'direction',description:''}});
 const pool=attached.filter(n=>!isPlaceholder(n.title)&&!/^(najlepsza droga|best route|decyzja|decision)\s*:/i.test(n.title));
 outer:for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
  if(similarity(pool[i].title,pool[j].title)>=.6){
   push(36,'similar:'+pool[i].id,'≈',L(locale,'Połącz lub rozróżnij: „'+short(pool[i].title,30)+'” i „'+short(pool[j].title,30)+'”','Merge or differentiate “'+short(pool[i].title,30)+'” and “'+short(pool[j].title,30)+'”'),
    L(locale,'Dwie bardzo podobne notatki rozmywają porównanie.','Two near-identical notes blur the comparison.'),{type:'select',nodeId:pool[i].id});
   break outer;
  }
 }
 if(kids(root.id).length>7)push(30,'group:'+root.id,'▤',L(locale,'Pogrupuj gałęzie','Group related branches'),
  L(locale,'Ponad 7 gałęzi przy pomyśle. Zbierz podobne pod wspólnym pytaniem.','More than seven branches on the idea. Gather similar ones under a shared question.'),{type:'select',nodeId:root.id});
 const seen=new Set();
 return moves.sort((a,b)=>b.priority-a.priority).filter(m=>{const k=m.action.type+':'+(m.action.nodeId||m.action.parentId||'');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,limit);
}
function testSeed(node,locale){
 return {title:L(locale,'Jak sprawdzić: ','How to test: ')+short(node?.title||'',100),kind:'experiment',
  description:L(locale,'Najtańszy test do wykonania w tydzień. Zanim zaczniesz, zapisz wynik, który obali założenie.','The cheapest test you can run this week. Before starting, write down the result that would disprove the assumption.')};
}
// Everything the side panel needs to advise on one selected note.
export function nodeAdvice(graph,nodeId,{locale='en',futures=null}={}){
 assertIdeaGraph(graph);
 const node=graph.nodes.find(n=>n.id===nodeId);
 if(!node)throw Error('Node not found.');
 const moves=coachGraph(graph,{locale,futures,limit:20}).filter(m=>m.action.nodeId===nodeId||m.action.parentId===nodeId);
 return {mode:defaultModeFor(node.kind),tools:recommendTools(graph,nodeId,{locale}),skill:recommendSkill(graph,nodeId,{locale}),moves:moves.slice(0,2)};
}
