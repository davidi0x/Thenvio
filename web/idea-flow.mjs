// Thenvio Flow: one-tap branch creation and contextual thinking cards.
// Works offline. Hypotheses here are deterministic; external AI is user-supplied.
import {thinkNext,applyThoughts,brainstormPrompt,parseBrainstormResponse} from './core/brainstorm.mjs';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const kindLabels={
  en:{direction:'DIRECTION',question:'QUESTION',assumption:'ASSUMPTION',experiment:'EXPERIMENT',insight:'INSIGHT'},
  pl:{direction:'KIERUNEK',question:'PYTANIE',assumption:'ZAŁOŻENIE',experiment:'EKSPERYMENT',insight:'WNIOSEK'}
};
const TEXT={
 en:{
  title:'Where could this go?',description:'Select a suggestion to grow your idea instantly. Every answer is an unverified hypothesis.',
  empty:'No fresh suggestions in this mode. Try another approach or write your own.',
  added:'Branch added. Keep exploring this thought.',allAdded:'New directions added to the map.',
  duplicate:'This branch already exists. Try another direction.',
  ownAdded:'Your thought is now part of the map.',
  copied:'AI brief copied. Paste it into your own assistant.',
  copiedNo:'Copy is not available in this browser.',
  imported:'AI suggestions added as editable branches.',bad:'Could not import ideas: ',
  titleThinking:'Explore the next possibility',
  titleQuestion:'What are the possible answers?',titleAssumption:'What could prove this wrong?',titleExperiment:'What can we actually try?',
  manualLabel:'YOUR OWN THOUGHT',manualPlaceholder:'An answer, idea, question…',
  other:'Other angles',addAll:'Add all',expand:'Explore this thought',save:'Add your thought',
  why:'A possible explanation',question:'A question to consider'
 },
 pl:{
  title:'Dokąd może prowadzić ta myśl?',description:'Wybierz propozycję — jedna czynność dodaje ją do drzewa. Odpowiedzi są hipotezami, nie zweryfikowanymi faktami.',
  empty:'Brak nowych propozycji w tym trybie. Wybierz inny sposób myślenia lub wpisz własny wątek.',
  added:'Nowa gałąź dodana. Możesz ją od razu dalej rozwijać.',allAdded:'Kolejne kierunki są na mapie.',
  duplicate:'Taka gałąź już istnieje. Wybierz inny kierunek.',
  ownAdded:'Twoja myśl jest już na mapie.',
  copied:'Instrukcja skopiowana. Wklej ją do swojego asystenta AI.',
  copiedNo:'Przeglądarka zablokowała kopiowanie.',
  imported:'Propozycje AI dodane jako edytowalne gałęzie.',bad:'Nie udało się dodać propozycji: ',
  titleThinking:'W którą stronę to rozwinąć?',
  titleQuestion:'Jakie są możliwe odpowiedzi?',titleAssumption:'Co może obalić to założenie?',titleExperiment:'Jak to szybko sprawdzić?',
  manualLabel:'TWOJA MYŚL',manualPlaceholder:'Wpisz odpowiedź, pytanie lub nowy pomysł…',
  other:'Inne kierunki',addAll:'Dodaj wszystkie',expand:'Rozwiń tę myśl',save:'Dodaj własną myśl',
  why:'Możliwa odpowiedź',question:'Pytanie do rozważenia'
 }
};
const el=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e;};
const lang=()=>navigator.language?.toLowerCase().startsWith('pl')?'pl':'en';
const mobile=()=>window.matchMedia('(max-width: 690px)').matches;

export function initIdeaFlow({getGraph,getSelected,mutate,notice}){
 const locale=lang(),T=TEXT[locale];
 let mode='explore',round=0,focus=null,kind='direction',suggestions=[];
 let visible=false;
 const panel=$('.ideas-inspector'),backdrop=$('#ideaSheetBackdrop');
 function translateUI(){
  if(locale!=='pl')return;
  const title=$('.ideas-heading h1');
  title.replaceChildren(document.createTextNode('Jedna myśl. '),el('span','','Wiele kierunków.'));
  $('.ideas-heading>div>p').textContent='Pytania, możliwe odpowiedzi, nowe pomysły. Wybierz kierunek — każda decyzja rozwija drzewo.';
  $('#ideaNew').lastChild.textContent=' Nowy pomysł';
  $('#ideaOpenFlow').firstChild.textContent='Rozwiń tę myśl ';
  $$('.navigation [data-tab]').forEach(button=>{
   const label={branches:'Pomysły',overview:'Analiza',assumptions:'Założenia',skills:'Founder skills',integrations:'Integracje'}[button.dataset.tab];
   if(label){const t=[...button.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(t)t.textContent=' '+label+' ';}
  });
  const labels=[['#ideaMapHint','Przeciągnij, aby odkrywać · Kliknij dowolną gałąź'],['#ideaFlowTitle',T.title],
   ['.idea-flow-description',T.description],['.idea-inspector-eyebrow','ROZWIJAJ TĘ MYŚL'],
   ['.idea-quick-form>label',T.manualLabel],['#ideaMore','↻ '+T.other],
   ['#ideaAddAll',T.addAll+' ↗'],['#ideaOwnInput',null]];
  for(const [selector,value] of labels){if(value!==null)$(selector).textContent=value;}
  $('#ideaOwnInput').placeholder=T.manualPlaceholder;
  $('#ideaOpenFlow').lastElementChild.textContent='↗';
  const modes={explore:'Odkrywaj',answer:'Odpowiadaj',challenge:'Podważaj',test:'Sprawdzaj'};
  $$('.idea-thinking-modes [data-think]').forEach(b=>b.textContent=modes[b.dataset.think]);
  const quick={direction:'Pomysł',question:'Pytanie',assumption:'Założenie',experiment:'Test'};
  $$('.idea-kind-quick [data-quick-kind]').forEach(b=>b.textContent=quick[b.dataset.quickKind]);
  const summary=$('#ideaAdvanced>summary');
  summary.firstChild.textContent='Edytuj gałąź ';
  $('#ideaSheetClose').setAttribute('aria-label','Zamknij');
  const copy=$('#ideaCopyPrompt');copy.textContent='Skopiuj instrukcję dla AI ↗';
  $('#ideaImportAi').textContent='Dodaj odpowiedzi AI do mapy';
  $('#ideaAiResponse').placeholder='Wklej JSON z asystenta AI…';
  $('#ideaAiTools>summary').firstChild.textContent='Rozwiń z własnym AI ';
 }
 function sheetOpen(){
  if(!mobile())return;
  panel.classList.add('is-open');backdrop.hidden=false;
  document.body.classList.add('idea-sheet-locked');
  visible=true;panel.scrollTop=0;
 }
 function sheetClose(){
  panel.classList.remove('is-open');backdrop.hidden=true;
  document.body.classList.remove('idea-sheet-locked');visible=false;
 }
 function guessedMode(node){
  if(node.kind==='question')return 'answer';
  if(node.kind==='assumption')return 'challenge';
  if(node.kind==='experiment')return 'test';
  return 'explore';
 }
 function sendSuggestion(card){
  const graph=getGraph(),parent=getSelected();
  try{
   const next=applyThoughts(graph,parent,[card]);
   if(!next.added.length){notice(T.duplicate);render();return;}
   mutate(next.graph,{focus:next.added[0],message:T.added});
   if(mobile())sheetClose();
  }catch(error){notice(error.message);}
 }
 function addVisible(){
  try{
   const graph=getGraph(),parent=getSelected();
   const result=applyThoughts(graph,parent,suggestions);
   if(!result.added.length){notice(T.duplicate);round++;render();return;}
   mutate(result.graph,{focus:parent,message:T.allAdded});
   if(mobile())sheetClose();
  }catch(error){notice(error.message);}
 }
 function render(){
  const graph=getGraph(),node=graph.nodes.find(n=>n.id===getSelected())||graph.nodes[0];
  if(focus!==node.id){focus=node.id;mode=guessedMode(node);round=0;kind='direction';$('#ideaOwnInput').value='';}
  const header=node.kind==='question'?T.titleQuestion:node.kind==='assumption'?T.titleAssumption:node.kind==='experiment'?T.titleExperiment:T.titleThinking;
  $('#ideaFlowTitle').textContent=header;
  $('.idea-flow-description').textContent=T.description;
  $$('.idea-thinking-modes [data-think]').forEach(b=>{
   const selected=b.dataset.think===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
  });
  $$('.idea-kind-quick [data-quick-kind]').forEach(b=>{
   const active=b.dataset.quickKind===kind;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  suggestions=thinkNext(graph,node.id,{mode,round,count:4,locale});
  const container=$('#ideaSuggestList');container.replaceChildren();
  if(!suggestions.length){
   container.append(el('div','idea-suggestions-empty',T.empty));$('#ideaAddAll').disabled=true;return;
  }
  $('#ideaAddAll').disabled=false;
  for(const card of suggestions){
   const b=el('button','idea-suggestion');
   b.type='button';
   b.setAttribute('aria-label',card.title+'. '+card.question+'. '+T.expand);
   const inner=el('span','idea-suggestion-copy');
   inner.append(el('span','idea-suggestion-category',kindLabels[locale][card.kind]),
    el('span','idea-suggestion-title',card.title),
    el('span','idea-suggestion-question',card.question),
    el('span','idea-suggestion-answer',card.answer));
   const plus=el('span','idea-suggestion-plus','+');plus.setAttribute('aria-hidden','true');
   b.append(inner,plus);
   b.addEventListener('click',()=>sendSuggestion(card));
   container.append(b);
  }
 }
 function more(){
  round++;render();
 }
 async function copyAi(){
  const text=brainstormPrompt(getGraph(),getSelected(),{mode,locale});
  try{await navigator.clipboard.writeText(text);notice(T.copied);}
  catch{
   const textarea=el('textarea');textarea.value=text;textarea.style.cssText='position:fixed;left:-9999px;top:-9999px';
   document.body.append(textarea);textarea.select();
   const ok=document.execCommand('copy');textarea.remove();
   notice(ok?T.copied:T.copiedNo);
  }
 }
 function importAi(){
  try{
   const proposals=parseBrainstormResponse($('#ideaAiResponse').value);
   const result=applyThoughts(getGraph(),getSelected(),proposals,{limit:12});
   if(!result.added.length){notice(T.duplicate);return;}
   $('#ideaAiResponse').value='';
   mutate(result.graph,{focus:getSelected(),message:T.imported});
   if(mobile())sheetClose();
  }catch(error){notice(T.bad+error.message);}
 }
 translateUI();
 $$('.idea-thinking-modes [data-think]').forEach(b=>b.addEventListener('click',()=>{
  mode=b.dataset.think;round=0;render();
 }));
 $$('.idea-kind-quick [data-quick-kind]').forEach(b=>b.addEventListener('click',()=>{
  kind=b.dataset.quickKind;
  $$('.idea-kind-quick [data-quick-kind]').forEach(item=>{
   const on=item===b;item.classList.toggle('active',on);item.setAttribute('aria-pressed',String(on));
  });
 }));
 $('#ideaMore').addEventListener('click',more);
 $('#ideaAddAll').addEventListener('click',addVisible);
 $('#ideaQuickForm').addEventListener('submit',e=>{
  e.preventDefault();
  const input=$('#ideaOwnInput'),title=input.value.trim();
  if(!title)return;
  try{
   const result=applyThoughts(getGraph(),getSelected(),[{title,kind,description:''}]);
   if(!result.added.length){notice(T.duplicate);return;}
   input.value='';
   mutate(result.graph,{focus:result.added[0],message:T.ownAdded});
   if(mobile())sheetClose();
  }catch(error){notice(error.message);}
 });
 $('#ideaOpenFlow').addEventListener('click',sheetOpen);
 $('#ideaSheetClose').addEventListener('click',sheetClose);
 backdrop.addEventListener('click',sheetClose);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&visible)sheetClose();});
 $('#ideaCopyPrompt').addEventListener('click',copyAi);
 $('#ideaImportAi').addEventListener('click',importAi);
 return {render,open:sheetOpen,close:sheetClose,addVisible,locale};
}
