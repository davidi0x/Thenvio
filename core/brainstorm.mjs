// Thenvio Flow: meaningful, structured hypotheses — not fabricated AI research.
import {assertIdeaGraph,branchPath,addIdeaBranch,IDEA_KINDS} from './idea-graph.mjs';
export const THINK_MODES=Object.freeze(['explore','answer','challenge','test']);
const tidy=s=>String(s||'').trim().replace(/\s+/g,' ');
const norm=s=>tidy(s).toLowerCase().replace(/[.,!?]+$/g,'');
const compact=(s,n=100)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
const l=(language,pl,en)=>language==='en'?en:pl;
const domainRules=[
 ['social',/(znajom|przyja|spotkan|relacj|randk|grup|samotn|pozna[wćj]|ludzi\b|community|friend|meet|social|dating|people|relationship)/i],
 ['travel',/(podróż|wyjazd|wakacj|hotel|loty|turyst|zwiedz|trip|travel|tour|flight|holiday|destination|esim)/i],
 ['health',/(zdrow|lekarz|szpital|trening|fitnes|dieta|health|doctor|clinic|fitness|workout|sleep|medical|wellness)/i],
 ['learning',/(nauk|edukac|uczen|szkoł|kurs|język|study|learn|education|teach|school|course|language)/i],
 ['commerce',/(sklep|zakup|sprzed|handl|produkt|klient|marketplace|ecommerce|shop|retail|sell|commerce|customer)/i],
 ['startup',/(startup|aplikac|platform|produkt cyfrow|asystent|saas|software|pomysł|idea|app\b|platform|business|founder|agent|biznes)/i]
];
// What kind of thinking the canvas needs. Only explicit product words make it a product idea; a
// question like "fries or pizza" is a choice between the options it names; anything else is general.
const PRODUCT=/(startup|aplikac|rezerwac|booking|usług|serwis|service|\bapp\b|saas|platform|produkt|klient|użytkownik|biznes|firm[aęy]|sklep|marketplace|monetyz|subskryp|customer|\busers?\b|business|product|software|founder|revenue|przychod)/i;
const CHOICE_SPLIT=/\s*(?:,|\bczy\b|\balbo\b|\blub\b|\bbądź\b|\bor\b|\bvs\.?|\bversus\b|\/)\s*/i;
export function readFrame(text){
 const raw=tidy(text).replace(/[?!.…]+$/,'');
 const body=raw.replace(/^(co wybrać|co lepsze|wybór|which|should i|choose|pick|decyzja|decision)\s*[:\-–—]?\s*/i,'');
 if(/\s(czy|albo|lub|bądź|or|vs\.?|versus)\s|\//i.test(' '+body+' ')){
  const parts=body.split(CHOICE_SPLIT).map(x=>x.trim()).filter(Boolean);
  const uniq=[...new Map(parts.map(x=>[x.toLowerCase(),x])).values()];
  if(uniq.length>=2&&uniq.length<=6&&uniq.every(x=>x.length<=60&&x.split(/\s+/).length<=7))
   return {type:'choice',options:uniq.map(x=>x[0].toUpperCase()+x.slice(1))};
 }
 return {type:PRODUCT.test(raw)?'product':'general'};
}
// Plain decision thinking that works for any topic and only reuses the person's own words. These are
// questions and prompts, never invented answers; real content comes from the person or their chat model.
const plainMethods={
 explore:[
  ['pro','Co przemawia za „{f}”?','What speaks for “{f}”?','question','Wypisz konkretne powody — Twoje, nie ogólne.','List concrete reasons — yours, not generic ones.'],
  ['con','Co przemawia przeciw „{f}”?','What speaks against “{f}”?','question','Co może pójść nie tak albo co Cię zniechęca?','What could go wrong, or what puts you off?'],
  ['alt','Inna opcja niż „{f}”','An option other than “{f}”','direction','Jaka trzecia droga w ogóle nie padła?','Which third way has not come up at all?'],
  ['crit','Co jest tu najważniejsze?','What matters most here?','question','Jedno kryterium, które rozstrzyga (np. czas, koszt, ochota, ludzie).','The one criterion that decides it (e.g. time, cost, appetite, people).']
 ],
 answer:[
  ['know','Co już wiem o: „{f}”','What I already know about “{f}”','insight','Zapisz fakty, które masz — oddziel je od przypuszczeń.','Write down the facts you have — keep them apart from guesses.'],
  ['ask','Kogo zapytać o „{f}”?','Who to ask about “{f}”?','question','Kto zna odpowiedź albo ma podobne doświadczenie?','Who knows the answer or has been through something similar?'],
  ['check','Jak szybko sprawdzić „{f}”?','How to check “{f}” quickly?','experiment','Najmniejszy krok, który da odpowiedź jeszcze dziś.','The smallest step that gives an answer today.']
 ],
 challenge:[
  ['wrong','A jeśli „{f}” to zły wybór?','What if “{f}” is the wrong choice?','assumption','Po czym poznasz, że to był błąd?','How would you know it was a mistake?'],
  ['regret','Czego mogę żałować przy „{f}”?','What might I regret with “{f}”?','question','Pomyśl o sobie za tydzień, nie za minutę.','Think about yourself a week from now, not a minute from now.'],
  ['cost','Ukryty koszt „{f}”','The hidden cost of “{f}”','assumption','Czas, pieniądze, energia albo inni ludzie — co tu płacisz?','Time, money, energy or other people — what do you pay here?']
 ],
 test:[
  ['try','Najmniejsza próba: „{f}”','Smallest trial: “{f}”','experiment','Spróbuj w małej skali, zanim się zobowiążesz.','Try it small before you commit.'],
  ['signal','Po czym poznam, że „{f}” było dobre?','How will I know “{f}” was right?','question','Zapisz to teraz, zanim zobaczysz wynik.','Write it down now, before you see the result.']
 ]
};
const goalMethods=[
 ['done','Jak wygląda dobry wynik?','What does a good result look like?','question','Opisz konkretnie, po czym poznasz, że się udało.','Describe concretely how you will know it worked.'],
 ['block','Co najbardziej przeszkadza w: „{f}”?','What gets in the way of “{f}” most?','question','Jedna główna przeszkoda, nie lista wszystkiego.','One main obstacle, not a list of everything.'],
 ['tried','Co już próbowałem?','What have I already tried?','insight','Co zadziałało choć trochę, a co nie — i dlaczego.','What worked a little, what did not — and why.'],
 ['ask','Kogo zapytać o „{f}”?','Who to ask about “{f}”?','question','Kto już to rozwiązał albo zna temat z bliska?','Who has already solved this or knows it up close?']
];
export function detectIdeaDomain(input){for(const [name,re] of domainRules)if(re.test(input))return name;return 'general';}
// Card record: [identifier, Polish title, English title, Polish question, English question, Polish hypothesis, English hypothesis]
const domainSeeds={
 social:[
 ['small','Małe grupy zamiast feedu','Small groups instead of feeds','Czy wspólne działanie jest lepsze od przeglądania profili?','Is a shared activity better than browsing profiles?','Hipoteza: konkretna aktywność pozwoli przełamać pierwszy kontakt bez sztucznej rozmowy.','Hypothesis: a concrete activity could make first contact feel natural.'],
 ['today','Spotkanie dziś, nie kiedyś','Meet today, not someday','Co jeśli dostępność tu i teraz jest ważniejsza niż dopasowanie?','What if availability matters more than matching?','Hipoteza: lokalny, spontaniczny plan może zmniejszać tarcie wielodniowego umawiania.','Hypothesis: a spontaneous local plan may remove scheduling friction.'],
 ['trust','Zaufanie przez wspólnych znajomych','Trust through mutual friends','Co pozwoli czuć się bezpieczniej przed spotkaniem?','What increases confidence before meeting?','Hipoteza: wiarygodne polecenie może mieć większą wartość niż długi profil.','Hypothesis: a trusted introduction may beat a detailed profile.'],
 ['ritual','Regularny rytuał zamiast jednego eventu','A ritual, not one event','Jak pomagać podtrzymywać nowo poznane relacje?','How can new relationships actually last?','Hipoteza: małe, cykliczne wydarzenia mogą działać bez mechanik uzależniających.','Hypothesis: small recurring gatherings may beat addictive feed mechanics.']
 ],
 travel:[
 ['moment','Pomoc dokładnie w momencie potrzeby','Help at the moment of need','Co podróżnik potrzebuje załatwić właśnie teraz?','What does a traveler need right now?','Hipoteza: pomoc kontekstowa może pokonać katalog setek opcji.','Hypothesis: contextual help may beat a huge catalog.'],
 ['offline','Podróż bez stałego internetu','Travel without constant connectivity','Co działa, gdy zasięg zawodzi?','What works when the connection fails?','Hipoteza: dostęp offline do rzeczy kluczowych da przewagę nad samą wyszukiwarką.','Hypothesis: essential offline access may outperform another search box.'],
 ['locals','Prawdziwe odkrycia od mieszkańców','Discover from local people','Jak zdobyć wartościowe rekomendacje bez udawania lokalnej wiedzy?','How to find quality local recommendations without pretending expertise?','Hipoteza: sprawdzony człowiek może dać lepsze wskazówki niż generyczna lista.','Hypothesis: a verified local person may provide more value than a generic list.']
 ],
 learning:[
 ['practice','Zacznij od realnego działania','Start with real practice','Jak wykonać pierwszą praktyczną czynność w ciągu minuty?','How can people practice in the first minute?','Hipoteza: konkretne zadanie może dać wartość wcześniej niż następny kurs wideo.','Hypothesis: a real task may help sooner than another video course.'],
 ['gap','Jedna luka wiedzy naraz','One knowledge gap at a time','Co dokładnie blokuje użytkownika w tym momencie?','What exactly blocks the learner now?','Hipoteza: jeden personalizowany krok zmniejsza przeciążenie materiałem.','Hypothesis: one tailored step may reduce information overload.'],
 ['teach','Wytłumacz to własnymi słowami','Explain it in your own words','Jak ujawnić brak rozumienia, zanim ktoś przejdzie dalej?','How can misunderstanding surface early?','Hipoteza: próba wytłumaczenia może ujawnić lukę lepiej niż odhaczony test.','Hypothesis: a teach-back attempt may reveal gaps better than a checklist.']
 ],
 health:[
 ['micro','Najmniejsza możliwa zmiana','The smallest achievable change','Jak zrobić pierwszy krok bez ogromnego planu?','How can someone begin without a huge plan?','Hipoteza: mini-krok łatwiej utrzymać w realnym życiu.','Hypothesis: a tiny step may be easier to sustain.'],
 ['flex','Plan odporny na trudne dni','A plan for difficult days','Co jeśli użytkownik dziś nie ma czasu ani energii?','What if the person has no time or energy today?','Hipoteza: elastyczność w trudne dni może zwiększać przydatność.','Hypothesis: flexibility on difficult days may improve usability.'],
 ['feedback','Informacja zwrotna bez oceniania','Feedback without judgment','Jak pokazać progres bez presji i fałszywych diagnoz?','How could progress be visible without pressure or false diagnosis?','Hipoteza: zrozumiały sygnał postępu daje większą kontrolę nad działaniem.','Hypothesis: a clear progress signal could improve agency.']
 ],
 commerce:[
 ['choice','Zaufanie zamiast większego katalogu','Confidence over a larger catalog','Co blokuje decyzję zakupową?','What blocks the purchase decision?','Hipoteza: przejrzyste porównanie może być cenniejsze niż kolejny filtr.','Hypothesis: a transparent comparison may beat another filter.'],
 ['repeat','Powód do powrotu bez promocji','A reason to return without discounts','Jaka realna wartość pozostaje po transakcji?','What value remains after the purchase?','Hipoteza: łatwość ponownego zakupu może wygrywać z promocjami.','Hypothesis: easier reordering may beat promotions.'],
 ['needs','Rozmowa o potrzebie, nie wyszukiwanie','Discover needs rather than keywords','Czy klient umie nazwać to, czego szuka?','Can the customer name exactly what they need?','Hipoteza: pomoc w wyborze może działać lepiej niż rozbudowane wyszukiwanie.','Hypothesis: guided choice may beat sophisticated search.']
 ],
 startup:[
 ['inside','Funkcja tam, gdzie ludzie już pracują','A feature where people already work','Czy to naprawdę musi być oddzielna aplikacja?','Does this really need to be a standalone app?','Hipoteza: integracja może mieć niższy koszt nauki niż kolejny produkt.','Hypothesis: an integration may have less adoption friction.'],
 ['manual','Ręczny prototyp przed kodowaniem','Manual pilot before building','Co można sprawdzić w jeden dzień bez programowania?','What can we test in a day without building?','Hipoteza: ręczna realizacja kilku sesji szybciej pokaże, co ma wartość.','Hypothesis: manual sessions may reveal value before integrations.'],
 ['wow','Jedna rzecz, którą zapamiętają','One unforgettable outcome','Co użytkownik robi w 30 sekund, czego wcześniej nie potrafił?','What can people do in 30 seconds that they could not before?','Hipoteza: jedna radykalnie łatwiejsza czynność może wyróżnić produkt.','Hypothesis: one radically simpler action may differentiate.'],
 ['sharing','Efekt, którym ludzie chcą się podzielić','A result worth sharing','Dlaczego ktoś sam pokazałby efekt innej osobie?','Why would someone naturally share the outcome?','Hipoteza: sam rezultat pracy może stać się kanałem dystrybucji.','Hypothesis: the work product itself may become a distribution channel.']
 ],
 general:[
 ['unserved','Zacznij od pomijanej grupy','Begin with an overlooked group','Kto ma silniejszy problem niż reszta?','Who experiences this problem more intensely?','Hipoteza: konkretna nisza może być lepszym początkiem niż rozwiązanie dla wszystkich.','Hypothesis: a focused niche may be a better starting point than everyone.'],
 ['moment','Zmień moment użycia','Change the moment of use','Czy ten pomysł ma sens wcześniej albo później w codziennym procesie?','Would this work earlier or later in the daily workflow?','Hipoteza: przesunięcie momentu może otworzyć całkowicie nowy kierunek.','Hypothesis: shifting the timing could reveal a new category.'],
 ['remove','Usuń cały etap','Remove an entire step','Czy da się osiągnąć rezultat bez najbardziej frustrującej czynności?','Could the result happen without the most frustrating task?','Hipoteza: innowacja może polegać na usunięciu pracy, nie dodaniu funkcji.','Hypothesis: removing work may matter more than adding features.']
 ]
};
const methods={
 explore:[
 ['inverse','Odwróć założenie','Invert the obvious approach','A gdyby zrobić dokładnie odwrotnie?','What if we did the exact opposite?','Hipoteza: odwrócenie modelu może ujawnić coś, czego nie widać przy optymalizacji starego.','Hypothesis: inverting the model may reveal something optimization misses.'],
 ['tenx','Skróć drogę dziesięciokrotnie','Make the path ten times shorter','Co trzeba usunąć, żeby rezultat pojawił się dużo szybciej?','What should disappear for the outcome to arrive much faster?','Hipoteza: usunięcie oczekiwania, konfiguracji lub zbędnej decyzji może być przełomem.','Hypothesis: removing waiting, setup or redundant decisions might be the breakthrough.'],
 ['collab','Rozwiąż to razem z inną osobą','Make the outcome collaborative','Co się zmienia, gdy rozwiązanie angażuje więcej niż jedną osobę?','What changes if the solution involves more than one person?','Hipoteza: współtworzenie może odblokować wartość niedostępną solo.','Hypothesis: co-creation may unlock value unavailable in a solo flow.'],
 ['edge','Zaprojektuj dla trudnego przypadku','Design for the hardest situation','Kto odczuwa ten problem najmocniej?','Who experiences the strongest version of this problem?','Hipoteza: trudny przypadek może prowadzić do lepszego, prostszego rdzenia produktu.','Hypothesis: an extreme case may expose a better product core.'],
 ['noapp','Bez nowej aplikacji','Without another app','Czy można dostarczyć ten rezultat w istniejącym kanale?','Could this outcome be delivered in an existing channel?','Hipoteza: mniej rejestracji i konfiguracji może oznaczać szybszą adopcję.','Hypothesis: fewer registrations and setup steps might accelerate adoption.']
 ],
 answer:[
 ['simple','Najprostsza możliwa odpowiedź','The simplest plausible answer','Czy wystarczy jedna czynność zamiast całego systemu?','Would one action work instead of a whole system?','Możliwa odpowiedź: usunąć główną przeszkodę jednym krokiem; dopiero potem dodawać funkcje.','Possible answer: remove the main obstacle in one step and only then add features.'],
 ['human','Odpowiedź oparta na człowieku','A human-first answer','Jak zrobiłby to ekspert bez technologii?','How would an expert solve this without software?','Możliwa odpowiedź: zrealizować potrzebę ręcznie kilka razy i dopiero później automatyzować.','Possible answer: deliver the value manually several times before automating.'],
 ['timely','Odpowiedz zanim padnie pytanie','Answer before the question','Czy można rozpoznać moment potrzeby wcześniej?','Can the moment of need be recognized earlier?','Możliwa odpowiedź: podpowiedzieć jedną rzecz w odpowiednim momencie, bez wyszukiwania.','Possible answer: provide one useful next step at the moment of need.'],
 ['transparent','Przejrzystość jako odpowiedź','Clarity as the answer','Co jeśli największym problemem jest niepewność?','What if uncertainty is the main problem?','Możliwa odpowiedź: pokazać opcje, ograniczenia i następny krok zamiast dodawać kolejne funkcje.','Possible answer: show the options, constraints and next step rather than adding features.'],
 ['community','Połącz właściwych ludzi','Connect the right people','Czy wartość można dostarczyć przez lepsze połączenie dwóch osób?','Could connecting the right two people deliver the value?','Możliwa odpowiedź: usunąć przeszkodę do kontaktu zamiast budować skomplikowany system.','Possible answer: remove the barrier to contact instead of building a complex system.']
 ],
 challenge:[
 ['behavior','Deklaracje to nie zachowanie','Words are not behavior','Co w działaniu użytkownika przeczyłoby temu założeniu?','What real behavior would contradict this assumption?','Ryzyko: ludzie mogą chwalić pomysł, ale z niego nie korzystać.','Risk: people can praise an idea without using it.'],
 ['habit','Obecny nawyk może wygrać','The existing habit could win','Dlaczego dzisiejsza metoda jest wystarczająco dobra?','Why might today’s workaround be good enough?','Ryzyko: konkurujesz z przyzwyczajeniem, nie tylko z aplikacjami.','Risk: you compete with familiar habits, not just apps.'],
 ['trust','Zaufanie jest przeszkodą','Trust is the barrier','Co użytkownik musi powierzyć rozwiązaniu przed poznaniem korzyści?','What must users trust before seeing the benefit?','Ryzyko: dane, zgody lub kontakt z obcymi mogą hamować start.','Risk: permissions, data or strangers can block first use.'],
 ['return','Po pierwszym razie nie ma powodu wrócić','No reason to return after the first time','Co sprawia, że wraca się do tego rozwiązania?','Why would someone return to this solution?','Ryzyko: świetne pierwsze wrażenie nie oznacza powtarzalnej potrzeby.','Risk: a great first experience does not prove a recurring need.'],
 ['reach','Nikt się o tym nie dowie','No one discovers the product','Skąd będą pochodzić pierwsi realni użytkownicy?','Where will the first real users actually come from?','Ryzyko: sam produkt nie rozwiązuje problemu dotarcia do ludzi.','Risk: product quality alone does not solve distribution.']
 ],
 test:[
 ['five','Pięć prawdziwych prób','Five real attempts','Czy potrafisz dostarczyć obiecaną wartość pięciu osobom bez pełnego produktu?','Can you deliver value to five people without a full product?','Eksperyment: zrealizuj pięć sesji i obserwuj momenty frustracji oraz chęć powrotu.','Experiment: run five sessions and observe friction and desire to return.'],
 ['act','Sprawdź konkretne działanie','Test actual commitment','Czy ktoś zrobi krok dalej zamiast jedynie pochwalić pomysł?','Will someone take the next step rather than praise it?','Eksperyment: poproś o zapis, powrót w konkretnym terminie lub poświęcenie czasu.','Experiment: request a sign-up, scheduled return or time commitment.'],
 ['observe','Zobacz co robią dziś','Observe what happens today','Jak rozwiązują ten problem teraz?','How do they solve this today?','Eksperyment: pytaj o ostatnie prawdziwe sytuacje, nie hipotetyczne opinie.','Experiment: ask about real recent experiences, not hypothetical opinions.'],
 ['day','Prototyp w jeden dzień','A one-day prototype','Jaki jeden ekran lub proces wystarczy do sprawdzenia rdzenia?','What single screen or workflow would validate the core?','Eksperyment: pokaż działający minimalny przepływ i zapisz, gdzie użytkownik utknął.','Experiment: show a minimal flow and observe the exact point of friction.'],
 ['falsify','Sygnał, który obali pomysł','A signal that would disprove it','Jaka obserwacja sprawi, że odrzucisz ten kierunek?','What observation would make you reject this direction?','Eksperyment: zapisz mierzalny warunek porażki przed rozpoczęciem testu.','Experiment: define a measurable failure condition before testing.']
 ]
};
const typeFor={explore:'direction',answer:'direction',challenge:'assumption',test:'experiment'};
export function thinkNext(graph,nodeId,{mode='explore',round=0,locale='pl',count=4}={}){
 assertIdeaGraph(graph);
 if(!THINK_MODES.includes(mode))throw Error('Unknown thinking mode');
 if(!Number.isInteger(round)||round<0||!Number.isInteger(count)||count<1||count>12)throw Error('Invalid suggestion window');
 const path=branchPath(graph,nodeId),focus=path.at(-1),lang=locale==='en'?'en':'pl';
 const root=graph.nodes.find(n=>n.id===graph.rootId)||graph.nodes[0];
 const frame=readFrame(root.title||graph.title);
 const existing=new Set(graph.nodes.filter(n=>n.parentId===nodeId).map(n=>norm(n.title)));
 let items;
 if(frame.type==='product'){
  const domain=detectIdeaDomain(graph.title+' '+focus.title+' '+root.description);
  const data=(mode==='explore'&&path.length===1?[...(domainSeeds[domain]||domainSeeds.general)]:[]).concat(methods[mode]);
  items=data.map(([id,plTitle,enTitle,plQuestion,enQuestion,plAnswer,enAnswer])=>{
   const title=l(lang,plTitle,enTitle);
   const question=mode==='answer'&&focus.kind==='question'
     ?l(lang,'Możliwa odpowiedź na: ','Possible answer to: ')+compact(focus.title,100)
     :l(lang,plQuestion,enQuestion);
   const answer=l(lang,plAnswer,enAnswer);
   return {id:mode+'_'+id,title,question,answer,kind:typeFor[mode],description:[question,answer].join('\n\n'),source:'structured-heuristic'};
  });
 }else{
  const f=compact(focus.title,48),cards=[];
  // A choice names its own options: offer exactly those first, in the person's words.
  if(frame.type==='choice'&&focus.id===root.id&&mode==='explore'){
   for(const o of frame.options)cards.push({id:'opt_'+norm(o),title:o,kind:'direction',question:'',answer:''});
   cards.push({id:'third',title:l(lang,'Coś innego niż: ','Something other than: ')+compact(frame.options.join(' / '),80),kind:'direction',question:'',answer:l(lang,'Czasem najlepsza opcja w ogóle nie padła.','Sometimes the best option has not come up at all.')});
  }
  // A goal or topic at the root is clarified first: what blocks it, what good looks like, what was tried.
  const list=focus.id===root.id&&mode==='explore'?(frame.type==='choice'?plainMethods.explore.filter(m=>m[0]==='crit'):goalMethods):plainMethods[mode];
  for(const [id,plT,enT,kind,plQ,enQ] of list){
   cards.push({id:mode+'_'+id,title:l(lang,plT,enT).replace('{f}',f),kind,question:l(lang,plQ,enQ),answer:''});
  }
  items=cards.map(c=>({...c,description:[c.question,c.answer].filter(Boolean).join('\n\n'),source:'structured-heuristic'}));
 }
 items=items.filter(card=>!existing.has(norm(card.title)));
 if(!items.length)return [];
 const offset=(round*count)%items.length;
 return Array.from({length:Math.min(count,items.length)},(_,i)=>items[(offset+i)%items.length]);
}
export function applyThoughts(graph,parentId,suggestions,{limit=8}={}){
 assertIdeaGraph(graph);
 if(!graph.nodes.some(n=>n.id===parentId))throw Error('Parent not found.');
 let next=graph;const added=[];
 const known=new Set(graph.nodes.filter(n=>n.parentId===parentId).map(n=>norm(n.title)));
 for(const idea of suggestions.slice(0,limit)){
  if(next.nodes.length>=400)break;
  const title=tidy(idea?.title);
  if(!title||title.length>150||known.has(norm(title)))continue;
  const kind=IDEA_KINDS.includes(idea.kind)&&idea.kind!=='idea'?idea.kind:'direction';
  next=addIdeaBranch(next,parentId,{title,kind,description:typeof idea.description==='string'?idea.description.slice(0,4000):''});
  known.add(norm(title));added.push(next.nodes.at(-1).id);
 }
 return {graph:next,added};
}
export function brainstormPrompt(graph,nodeId,{mode='explore',locale='pl'}={}){
 assertIdeaGraph(graph);
 if(!THINK_MODES.includes(mode))throw Error('Unknown thinking mode');
 const path=branchPath(graph,nodeId),node=path.at(-1),titles=path.map(n=>n.title).join(' → ');
 const children=graph.nodes.filter(n=>n.parentId===nodeId).map(n=>n.title).join('; ')||'None';
 const json=JSON.stringify({branches:[{title:'Short concrete angle',kind:'direction',description:'Plausible reasoning and a specific test'}]});
 return ['THENVIO: develop an IDEA TREE, never a business dashboard.','Root: '+graph.title,'Focused path: '+titles,
  'Context: '+node.description,'Recorded evidence: '+(node.evidence||'None'),
  'Already considered: '+children,'Focus mode: '+mode,
  'Produce 5–7 genuinely different, useful next branches with concrete hypotheses, possible answers, counterarguments or experiments. Do not invent research or present assumptions as facts.',
  'Return ONLY a valid JSON object; do not use markdown or explanatory paragraphs.',
  'Schema example: '+json,
  'Allowed kind: direction, question, assumption, experiment, insight. Maximum title 150 chars and description 4000 chars.',
  'Use '+(locale==='en'?'English':'Polish')+' for all text.'].join('\n\n');
}
export function parseBrainstormResponse(raw){
 if(typeof raw!=='string'||raw.length>50000)throw Error('The response is too large.');
 const fence=String.fromCharCode(96).repeat(3);
 let text=raw.trim();
 if(text.startsWith(fence)){
  text=text.slice(3).replace(/^json\s*/i,'');
  if(text.endsWith(fence))text=text.slice(0,-3);
  text=text.trim();
 }
 let body;
 try{body=JSON.parse(text);}catch{throw Error('Expected JSON with a branches array.');}
 if(!body||!Array.isArray(body.branches)||body.branches.length<1||body.branches.length>15)
  throw Error('Expected 1–15 suggested branches.');
 return body.branches.map((b,i)=>{
  if(!b||typeof b.title!=='string'||!tidy(b.title)||b.title.length>150)throw Error('Invalid title at '+(i+1));
  if(!IDEA_KINDS.includes(b.kind)||b.kind==='idea')throw Error('Invalid kind at '+(i+1));
  if(typeof b.description!=='string'||b.description.length>4000)throw Error('Invalid description at '+(i+1));
  return {title:tidy(b.title),kind:b.kind,description:b.description};
 });
}
