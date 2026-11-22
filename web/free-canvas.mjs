// Thenvio Canvas 0.5. Free nodes, spatial positions, explicit connections.
// No mandatory AI or category selection. Legacy portfolios are preserved.
import {makeIdea,readIdeaGraph,linkIdeaBranches,deleteIdeaBranch,ideaContext} from './core/idea-graph.mjs';
import {prepareBoard,moveBoardNode,addBoardNode,updateBoardText,visibleBoardEdges,BOARD_W,BOARD_H,CARD_W,CARD_H} from './core/board.mjs';
import {brainstormPrompt,parseBrainstormResponse} from './core/brainstorm.mjs';
const $=s=>document.querySelector(s);
const el=(tag,cls='',txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const KEY='thenvio-ideas-portfolio-v1',MAX=50;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function portfolioLoad(){
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const data=JSON.parse(raw);
   if(data?.format!=='thenvio-ideas-collection-v1'||!Array.isArray(data.graphs)||!data.graphs.length||data.graphs.length>MAX)throw Error('Invalid collection');
   const graphs=data.graphs.map(readIdeaGraph).map(prepareBoard);
   return {format:data.format,graphs,activeId:graphs.some(g=>g.id===data.activeId)?data.activeId:graphs[0].id};
  }
 }catch(error){console.warn('Previous canvas data cannot be restored:',error);}
 const initial=prepareBoard(makeIdea('Untitled idea'));
 return {format:'thenvio-ideas-collection-v1',graphs:[initial],activeId:initial.id};
}
export function initFreeCanvas({notice=()=>{}}={}){
 let portfolio=portfolioLoad(),selected=null,linkSource=null,history=[],future=[];
 let scale=1,pan={x:0,y:0},initPos=true,pointer=null;
 let positioning=false,editing=false;
 const viewport=$('#boardViewport'),surface=$('#boardSurface'),nodes=$('#boardNodes'),lines=$('#boardEdges');
 const editor=$('#boardPanel'),ai=$('#boardAiPanel');
 const graph=()=>portfolio.graphs.find(g=>g.id===portfolio.activeId);
 const selectedNode=()=>graph().nodes.find(n=>n.id===selected)||null;
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(portfolio));}catch{notice('Unable to save. Export your canvas as JSON.');}};
 function commit(next,{select=null,focus=false,open=false}={}){
  const before=graph();
  if(JSON.stringify(before)===JSON.stringify(next))return;
  history.push(structuredClone(before));if(history.length>60)history.shift();future=[];
  portfolio.graphs=portfolio.graphs.map(g=>g.id===before.id?next:g);
  if(select!==null)selected=select;
  persist();render();
  if(focus)requestAnimationFrame(()=>center(selected));
  if(open)showEditor();
 }
 function restore(isUndo){
  const source=isUndo?history:future;
  if(!source.length)return;
  const before=graph(),next=source.pop();
  (isUndo?future:history).push(structuredClone(before));
  portfolio.graphs=portfolio.graphs.map(g=>g.id===before.id?next:g);
  if(selected&&!next.nodes.some(n=>n.id===selected))selected=null;
  persist();render();if(selected)showEditor();
 }
 function coordsFromScreen(clientX,clientY){
  const b=viewport.getBoundingClientRect();
  return {x:clamp(Math.round((clientX-b.left-pan.x)/scale),0,BOARD_W-CARD_W),
   y:clamp(Math.round((clientY-b.top-pan.y)/scale),0,BOARD_H-CARD_H)};
 }
 function visibleCenter(){
  const b=viewport.getBoundingClientRect();
  return coordsFromScreen(b.left+b.width*.5,b.top+b.height*.46);
 }
 function position(){
  surface.style.transform='translate3d('+pan.x+'px,'+pan.y+'px,0) scale('+scale+')';
  $('#boardZoomValue').textContent=Math.round(scale*100)+'%';
  $('#boardZoomOut').disabled=scale<=.39;
  $('#boardZoomIn').disabled=scale>=1.8;
 }
 function center(id){
  const n=graph().nodes.find(x=>x.id===id);
  if(!n)return;
  pan={x:viewport.clientWidth*.5-(n.x+CARD_W/2)*scale,y:viewport.clientHeight*.46-(n.y+CARD_H/2)*scale};
  position();
 }
 function fit(){
  const list=graph().nodes;
  if(!list.length)return;
  const minX=Math.min(...list.map(n=>n.x)),maxX=Math.max(...list.map(n=>n.x+CARD_W));
  const minY=Math.min(...list.map(n=>n.y)),maxY=Math.max(...list.map(n=>n.y+CARD_H));
  scale=clamp(Math.min((viewport.clientWidth-70)/(maxX-minX+60),(viewport.clientHeight-100)/(maxY-minY+70),1.2),.42,1.3);
  pan={x:(viewport.clientWidth-(minX+maxX)*scale)/2,y:(viewport.clientHeight-(minY+maxY)*scale)/2};
  position();
 }
 function zoom(mult,x=viewport.clientWidth/2,y=viewport.clientHeight/2){
  const target=clamp(Number((scale*mult).toFixed(2)),.38,1.85);
  const ratio=target/scale;
  pan={x:x-(x-pan.x)*ratio,y:y-(y-pan.y)*ratio};scale=target;position();
 }
 function edges(){
  const list=graph().nodes,byId=new Map(list.map(n=>[n.id,n]));
  lines.replaceChildren();
  lines.setAttribute('viewBox','0 0 '+BOARD_W+' '+BOARD_H);
  for(const edge of visibleBoardEdges(graph())){
   const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;
   const sx=a.x+CARD_W/2,sy=a.y+CARD_H/2,tx=b.x+CARD_W/2,ty=b.y+CARD_H/2;
   const bend=Math.max(56,Math.min(190,Math.abs(tx-sx)*.43));
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d','M '+sx+' '+sy+' C '+(sx+(tx>=sx?bend:-bend))+' '+sy+' '+(tx-(tx>=sx?bend:-bend))+' '+ty+' '+tx+' '+ty);
   path.setAttribute('class','board-edge'+(edge.type==='link'?' link':''));
   lines.append(path);
  }
 }
 function renderNotes(){
  nodes.replaceChildren();
  for(const note of graph().nodes){
   const card=el('div','board-note'+(note.id===selected?' is-selected':'')+(note.id===graph().rootId?' root':'')+(note.id===linkSource?' is-link-source':''));
   card.style.left=note.x+'px';card.style.top=note.y+'px';
   card.dataset.id=note.id;card.tabIndex=0;
   card.setAttribute('role','button');card.setAttribute('aria-label',note.title);
   card.append(el('div','board-note-title',note.title),el('div','board-note-body',note.description?.trim()||''));
   const add=el('button','board-note-plus','+');add.type='button';add.title='Connected note';add.setAttribute('aria-label','Add connected note to '+note.title);
   add.addEventListener('pointerdown',e=>e.stopPropagation());
   add.addEventListener('click',e=>{e.stopPropagation();makeNode(note.id,true);});
   card.append(add);
   card.addEventListener('keydown',e=>{
    if(e.target!==card)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select(note.id);}
    if(e.key==='F2'){e.preventDefault();select(note.id);$('#boardEditTitle').focus();$('#boardEditTitle').select();}
   });
   card.addEventListener('dblclick',e=>{e.stopPropagation();select(note.id);$('#boardEditTitle').focus();$('#boardEditTitle').select();});
   card.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button'))return;
    e.stopPropagation();
    const startX=note.x,startY=note.y;
    let moved=false;
    const originX=e.clientX,originY=e.clientY;
    card.setPointerCapture(e.pointerId);
    const move=ev=>{
     if(ev.pointerId!==e.pointerId)return;
     const dx=(ev.clientX-originX)/scale,dy=(ev.clientY-originY)/scale;
     if(!moved&&Math.hypot(dx,dy)>5){moved=true;card.classList.add('is-dragging');}
     if(moved){
      card.style.left=clamp(Math.round(startX+dx),0,BOARD_W-CARD_W)+'px';
      card.style.top=clamp(Math.round(startY+dy),0,BOARD_H-CARD_H)+'px';
      if(!positioning){positioning=true;requestAnimationFrame(()=>{positioning=false;edgesLive(card.dataset.id,Number.parseInt(card.style.left),Number.parseInt(card.style.top));});}
     }
    };
    const stop=ev=>{
     if(ev.pointerId!==e.pointerId)return;
     card.removeEventListener('pointermove',move);card.removeEventListener('pointerup',stop);card.removeEventListener('pointercancel',stop);
     card.classList.remove('is-dragging');
     if(moved){
      const x=Number.parseInt(card.style.left),y=Number.parseInt(card.style.top);
      commit(moveBoardNode(graph(),note.id,x,y)); 
     }else select(note.id);
    };
    card.addEventListener('pointermove',move);
    card.addEventListener('pointerup',stop);card.addEventListener('pointercancel',stop);
   });
   nodes.append(card);
  }
 }
 function edgesLive(id,x,y){
  const list=graph().nodes,original=list.find(n=>n.id===id);
  if(!original)return;
  const modified={...graph(),nodes:list.map(n=>n.id===id?{...n,x,y}:n)};
  const originalGraph=portfolio.graphs.findIndex(g=>g.id===modified.id);
  const old=portfolio.graphs[originalGraph];portfolio.graphs[originalGraph]=modified;
  edges();portfolio.graphs[originalGraph]=old;
 }
 function populateProjects(){
  const select=$('#boardSelect');select.replaceChildren();
  for(const g of portfolio.graphs){const o=el('option','',g.title);o.value=g.id;select.append(o);}
  select.value=portfolio.activeId;
  $('#boardUndo').disabled=!history.length;$('#boardRedo').disabled=!future.length;
 }
 function populateEditor(){
  const n=selectedNode();
  if(!n){editor.hidden=true;return;}
  $('#boardEditTitle').value=n.title;
  $('#boardEditBody').value=n.description||'';
  $('#boardDelete').disabled=n.id===graph().rootId;
 }
 function render(){
  populateProjects();renderNotes();edges();populateEditor();position();
  $('#boardLink').classList.toggle('is-active',!!linkSource);
  viewport.classList.toggle('is-linking',!!linkSource);
  if(initPos){initPos=false;requestAnimationFrame(()=>center(graph().rootId));}
 }
 function showEditor(){
  if(!selectedNode())return;
  ai.hidden=true;$('#boardAi').setAttribute('aria-expanded','false');
  editor.hidden=false;populateEditor();
 }
 function select(id){
  if(linkSource==='__await_source__'){
   linkSource=id;selected=id;renderNotes();notice('Now choose a second note to connect.');
   return;
  }
  if(linkSource){
   if(id!==linkSource){
    try{commit(linkIdeaBranches(graph(),linkSource,id),{select:id});notice('Notes connected.');}
    catch(e){notice(e.message);}
   }
   linkSource=null;render();return;
  }
  selected=id;renderNotes();showEditor();
 }
 function closeEditor(){editor.hidden=true;selected=null;renderNotes();}
 function makeNode(parent=null,linked=false,at=null){
  const pos=at||visibleCenter();
  const base=linked&&parent?graph().nodes.find(n=>n.id===parent):null;
  const x=base?clamp(base.x+CARD_W+80,0,BOARD_W-CARD_W):clamp(pos.x-CARD_W/2,0,BOARD_W-CARD_W);
  const y=base?clamp(base.y+Math.round(Math.random()*90-45),0,BOARD_H-CARD_H):clamp(pos.y-CARD_H/2,0,BOARD_H-CARD_H);
  const made=addBoardNode(graph(),{title:'New thought',parentId:base?.id||graph().rootId,x,y,free:!linked});
  commit(made.graph,{select:made.id,focus:linked});
  showEditor();$('#boardEditTitle').focus();$('#boardEditTitle').select();
 }
 function switchGraph(id){
  if(!portfolio.graphs.some(g=>g.id===id))return;
  portfolio.activeId=id;selected=null;linkSource=null;history=[];future=[];
  editor.hidden=true;ai.hidden=true;initPos=true;persist();render();
 }
 function saveExport(){
  const blob=new Blob([JSON.stringify(portfolio,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=el('a');
  a.href=url;a.download='thenvio-canvas-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  notice('Canvas exported.');
 }
 async function importFile(file){
  if(!file)return;
  if(file.size>5_000_000){notice('File is too large.');return;}
  try{
   const body=JSON.parse(await file.text());
   const incoming=(body?.format==='thenvio-ideas-collection-v1'?body.graphs:[body]);
   if(!Array.isArray(incoming)||!incoming.length||incoming.length>MAX)throw Error('Invalid file.');
   const imported=incoming.map(readIdeaGraph).map(prepareBoard);
   if(portfolio.graphs.length+imported.length>MAX)throw Error('Maximum 50 canvases.');
   for(const g of imported){
    const unique=portfolio.graphs.some(x=>x.id===g.id);
    portfolio.graphs.push({...g,id:unique?'g_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6):g.id});
   }
   switchGraph(portfolio.graphs.at(-1).id);notice('Canvas imported.');
  }catch(e){notice('Import failed: '+e.message);}
 }
 function newCanvas(){
  $('#boardCreateTitle').value='';$('#boardCreateDialog').showModal();$('#boardCreateTitle').focus();
 }
 function toggleAi(){
  const next=ai.hidden;
  ai.hidden=!next;editor.hidden=true;
  $('#boardAi').setAttribute('aria-expanded',String(next));
 }
 async function copy(text){
  try{await navigator.clipboard.writeText(text);notice('Copied.');}
  catch{
   const t=el('textarea');t.value=text;t.style.cssText='position:fixed;left:-9999px';document.body.append(t);t.select();
   const ok=document.execCommand('copy');t.remove();notice(ok?'Copied.':'Clipboard blocked.');}
 }
 // Controls and keyboard.
 $('#boardSelect').addEventListener('change',e=>switchGraph(e.target.value));
 $('#boardNew').addEventListener('click',newCanvas);
 $('#boardCreateForm').addEventListener('submit',e=>{
  e.preventDefault();
  const title=$('#boardCreateTitle').value.trim();
  if(!title)return;
  if(portfolio.graphs.length>=MAX){notice('Maximum 50 canvases. Export your work to archive.');return;}
  const g=prepareBoard(makeIdea(title));
  portfolio.graphs.push(g);portfolio.activeId=g.id;history=[];future=[];selected=null;linkSource=null;initPos=true;
  persist();$('#boardCreateDialog').close();editor.hidden=true;ai.hidden=true;render();
 });
 $('#boardAdd').addEventListener('click',()=>makeNode());
 $('#boardChild').addEventListener('click',()=>{if(selected)makeNode(selected,true);});
 $('#boardLink').addEventListener('click',()=>{
  linkSource=linkSource?null:(selected||'__await_source__');
  // With no selection, the next note chooses the connection source.
  editor.hidden=true;renderNotes();
  $('#boardLink').classList.toggle('is-active',!!linkSource);
  viewport.classList.toggle('is-linking',!!linkSource);
  notice(linkSource?'Choose the first note, then the second.':'Connection cancelled.');
 });
 $('#boardPanelClose').addEventListener('click',closeEditor);
 $('#boardEditForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(!selected)return;
  try{commit(updateBoardText(graph(),selected,{title:$('#boardEditTitle').value,description:$('#boardEditBody').value}));notice('Note saved.');}
  catch(err){notice(err.message);}
 });
 $('#boardDelete').addEventListener('click',()=>{
  const n=selectedNode();if(!n||n.id===graph().rootId)return;
  if(!window.confirm('Delete this note and attached notes? You can undo.'))return;
  commit(deleteIdeaBranch(graph(),n.id));closeEditor();
 });
 $('#boardCopyContext').addEventListener('click',()=>{if(selected)copy(ideaContext(graph(),selected));});
 $('#boardUndo').addEventListener('click',()=>restore(true));
 $('#boardRedo').addEventListener('click',()=>restore(false));
 $('#boardZoomIn').addEventListener('click',()=>zoom(1.2));
 $('#boardZoomOut').addEventListener('click',()=>zoom(1/1.2));
 $('#boardFit').addEventListener('click',fit);
 $('#boardAi').addEventListener('click',toggleAi);
 $('#boardAiClose').addEventListener('click',()=>{ai.hidden=true;$('#boardAi').setAttribute('aria-expanded','false');});
 $('#boardCopyPrompt').addEventListener('click',()=>copy(brainstormPrompt(graph(),selected||graph().rootId,{mode:'explore',locale:navigator.language?.startsWith('pl')?'pl':'en'})));
 $('#boardImportAi').addEventListener('click',()=>{
  try{
   const seeds=parseBrainstormResponse($('#boardAiJson').value),parent=selected||graph().rootId;
   let current=graph(),added=[];
   const p=current.nodes.find(n=>n.id===parent);
   for(const [i,s] of seeds.entries()){
    if(current.nodes.length>=400)break;
    const made=addBoardNode(current,{title:s.title,parentId:parent,kind:s.kind,free:false,
     x:clamp(p.x+310+Math.floor(i/6)*270,0,BOARD_W-CARD_W),
     y:clamp(p.y+Math.floor(i%6)*145-220,0,BOARD_H-CARD_H)});
    current=made.graph;
    current={...current,nodes:current.nodes.map(n=>n.id===made.id?{...n,description:s.description}:n)};
    added.push(made.id);
   }
   if(!added.length){notice('Nothing to import.');return;}
   commit(current,{select:added[0],focus:true});
   $('#boardAiJson').value='';ai.hidden=true;notice('Ideas added to canvas.');
  }catch(err){notice('Invalid AI response: '+err.message);}
 });
 // Pan empty canvas. Drag notes with separate pointer capture (above).
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('.board-note,.board-dock,button,input,textarea'))return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};
  viewport.setPointerCapture(e.pointerId);
 });
 viewport.addEventListener('pointermove',e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  pan={x:pointer.panX+e.clientX-pointer.x,y:pointer.panY+e.clientY-pointer.y};position();
 });
 viewport.addEventListener('pointerup',()=>{pointer=null;});
 viewport.addEventListener('pointercancel',()=>{pointer=null;});
 viewport.addEventListener('dblclick',e=>{
  if(e.target.closest('.board-note,.board-dock,button'))return;
  makeNode(null,false,coordsFromScreen(e.clientX,e.clientY));
 });
 viewport.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=viewport.getBoundingClientRect();
  if(e.ctrlKey||e.metaKey)zoom(e.deltaY<0?1.09:1/1.09,e.clientX-rect.left,e.clientY-rect.top);
  else {pan.x-=e.deltaX;pan.y-=e.deltaY;position();}
 },{passive:false});
 document.addEventListener('keydown',e=>{
  if(!$('#view-branches').classList.contains('active'))return;
  if(e.target.closest('input,textarea,select,dialog')||e.metaKey&&e.key!=='z'||e.ctrlKey&&e.key!=='z'&&e.key!=='y')return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(!e.shiftKey);return;}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(false);return;}
  if(e.key==='Escape'){editor.hidden=true;ai.hidden=true;selected=null;linkSource=null;render();return;}
  if(e.key==='Delete'||e.key==='Backspace'){
   const n=selectedNode();if(n&&n.id!==graph().rootId){e.preventDefault();commit(deleteIdeaBranch(graph(),n.id));selected=null;editor.hidden=true;render();}
  }
 });
 const resizeObserver=new ResizeObserver(()=>{if(initPos)return;position();});
 resizeObserver.observe(viewport);
 render();
 return {
  show(){position();},
  create:newCanvas,
  import(){const picker=$('#importInput');picker.click();},
  importFile,
  export:saveExport,
  getGraph:()=>structuredClone(graph())
 };
}
