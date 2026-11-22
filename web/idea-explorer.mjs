// Thenvio idea explorer: an actual editable idea tree, not a decision dashboard.
// All writes are browser-local. AI prompts are export-only; no silent inference.
import {
  makeIdea,addIdeaBranch,updateIdeaBranch,deleteIdeaBranch,
  linkIdeaBranches,unlinkIdeaBranches,readIdeaGraph,branchStats,
  branchPath,layoutIdeaGraph,outlineIdeaGraph,developIdeaBranch,ideaContext
} from './core/idea-graph.mjs';
import {demoIdeas} from './core/demo-ideas.mjs';
import {thinkNext,applyThoughts} from './core/brainstorm.mjs';
import {initIdeaFlow} from './idea-flow.mjs';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const clone=value=>structuredClone(value);
const STORAGE='thenvio-ideas-portfolio-v1';
const MAX_GRAPHS=50;
const kindNames={idea:'MAIN IDEA',direction:'DIRECTION',question:'QUESTION',assumption:'ASSUMPTION',experiment:'EXPERIMENT',insight:'INSIGHT'};
const stateNames={open:'Open',exploring:'Exploring',supported:'Supported',refuted:'Disproved'};
function dom(tag,className='',text){
  const element=document.createElement(tag);if(className)element.className=className;
  if(text!==undefined)element.textContent=String(text);return element;
}
function svg(tag,attrs){
  const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
  return e;
}
function fetchPortfolio(){
  try{
    const raw=localStorage.getItem(STORAGE);
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed?.format!=='thenvio-ideas-collection-v1'||!Array.isArray(parsed.graphs)||parsed.graphs.length<1||parsed.graphs.length>MAX_GRAPHS)throw Error('Invalid stored portfolio');
      const graphs=parsed.graphs.map(readIdeaGraph);
      const activeId=graphs.some(g=>g.id===parsed.activeId)?parsed.activeId:graphs[0].id;
      return {format:'thenvio-ideas-collection-v1',activeId,graphs};
    }
  }catch(error){console.warn('Could not restore saved idea graphs',error);}
  return {format:'thenvio-ideas-collection-v1',activeId:demoIdeas.id,graphs:[clone(demoIdeas)]};
}
export function initIdeaExplorer({notice=()=>{}}={}){
  let portfolio=fetchPortfolio();
  let selected=portfolio.graphs.find(g=>g.id===portfolio.activeId).rootId;
  let mode='map',search='',zoom=1,pan={x:0,y:0};
  let graphLayout=null,history=[],future=[],createMode='root',createParent=null;
  let drag=null,initialFit=true;
  const viewport=$('#ideaViewport'),canvas=$('#ideaCanvas'),outline=$('#ideaOutline');
  function active(){return portfolio.graphs.find(g=>g.id===portfolio.activeId);}
  function store(){
    try{localStorage.setItem(STORAGE,JSON.stringify(portfolio));}
    catch{notice('Device storage is full or unavailable. Export your ideas to save them.');}
  }
  function overwrite(next,{focus=null,message='',fit=false}={}){
    const current=active();
    if(JSON.stringify(current)===JSON.stringify(next))return;
    history.push(clone(current));if(history.length>60)history.shift();future=[];
    portfolio.graphs=portfolio.graphs.map(g=>g.id===current.id?next:g);
    selected=focus||selected;
    if(!next.nodes.some(n=>n.id===selected))selected=next.rootId;
    store();render({fit,focus:focus||null});
    if(message)notice(message);
  }
  function replacement(snapshot,undo){
    const stack=undo?history:future;
    if(!stack.length)return;
    const before=active(),next=stack.pop();
    (undo?future:history).push(clone(before));
    portfolio.graphs=portfolio.graphs.map(g=>g.id===before.id?next:g);
    if(!next.nodes.some(n=>n.id===selected))selected=next.rootId;
    store();render();
  }
  function renderPortfolio(){
    const select=$('#ideaProjectSelect');
    select.replaceChildren();
    for(const graph of portfolio.graphs){
      const opt=dom('option','',graph.title);
      opt.value=graph.id;opt.selected=graph.id===portfolio.activeId;select.append(opt);
    }
    const s=branchStats(active());
    const container=$('#ideaStats');container.replaceChildren();
    const parts=[['Branches',s.branches],['Levels',s.depth+1],['Links',s.connections]];
    for(const [label,value] of parts){
      const span=dom('span');
      span.append(dom('strong','',value),document.createTextNode(' '+label));
      container.append(span);
    }
    $('#ideaUndo').disabled=!history.length;
    $('#ideaRedo').disabled=!future.length;
  }
  function positionCanvas(){
    canvas.style.transform='translate3d('+pan.x+'px,'+pan.y+'px,0) scale('+zoom+')';
    $('#ideaZoomLabel').textContent=Math.round(zoom*100)+'%';
    $('#ideaZoomIn').disabled=zoom>=1.8;
    $('#ideaZoomOut').disabled=zoom<=.4;
  }
  function zoomTo(next,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2){
    const newZoom=Math.min(1.8,Math.max(.4,Math.round(next*100)/100));
    const factor=newZoom/zoom;
    pan={x:cx-(cx-pan.x)*factor,y:cy-(cy-pan.y)*factor};
    zoom=newZoom;positionCanvas();
  }
  function fit(){
    if(!graphLayout||mode!=='map')return;
    const bounds=viewport.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const scale=Math.min(1.03,(bounds.width-48)/graphLayout.width,(bounds.height-56)/graphLayout.height);
    zoom=Math.max(.4,Math.min(1.4,scale));
    pan={x:(bounds.width-graphLayout.width*zoom)/2,y:(bounds.height-graphLayout.height*zoom)/2};
    positionCanvas();
  }
  function initialPosition(){
    if(!graphLayout)return;
    if(window.innerWidth>690){fit();return;}
    // A mobile viewport cannot show a 3-level tree legibly at once.
    // Open at readable card size, anchored on the root; Fit remains a full overview.
    zoom=.86;
    const root=graphLayout.nodes.find(n=>n.id===active().rootId);
    if(root){
      pan={
        x:20-(root.x+60)*zoom,
        y:viewport.clientHeight*.47-(root.y+graphLayout.cardHeight/2)*zoom
      };
    }
    positionCanvas();
  }
  function centerNode(id){
    if(mode!=='map'||!graphLayout)return;
    const branch=graphLayout.nodes.find(n=>n.id===id);
    if(!branch)return;
    if(window.innerWidth<=690)zoom=Math.max(.7,zoom);
    pan={x:viewport.clientWidth*.44-(branch.x+60+114)*zoom,
      y:viewport.clientHeight*.46-(branch.y+57)*zoom};
    positionCanvas();
  }
  function drawEdge(lines,from,to,klass){
    const startX=from.x+60+graphLayout.cardWidth;
    const startY=from.y+graphLayout.cardHeight/2;
    const endX=to.x+60,endY=to.y+graphLayout.cardHeight/2;
    const span=Math.max(40,Math.abs(endX-startX)*.53);
    const d='M '+startX+' '+startY+' C '+(startX+span)+' '+startY+' '+(endX-span)+' '+endY+' '+endX+' '+endY;
    lines.append(svg('path',{d,class:klass}));
  }
  function makeCard(n){
    const card=dom('div','ideas-node'+(n.id===selected?' is-selected':'')+(n.id===active().rootId?' is-root':''));
    card.style.left=(n.x+60)+'px';card.style.top=n.y+'px';
    card.dataset.kind=n.kind;
    card.dataset.nodeId=n.id;
    card.setAttribute('role','button');card.tabIndex=0;
    card.setAttribute('aria-label',n.title+', '+kindNames[n.kind]+', '+stateNames[n.status]+(n.hiddenChildren?', '+n.hiddenChildren+' hidden branches':''));
    card.setAttribute('aria-pressed',String(n.id===selected));
    if(search&&!((n.title+' '+n.description+' '+n.evidence).toLowerCase().includes(search)))card.classList.add('is-dim');
    const eyebrow=dom('div','ideas-node-eyebrow');
    eyebrow.append(dom('span','ideas-node-dot'),document.createTextNode(kindNames[n.kind]));
    const excerpt=(n.description||'').split('\n').find(line=>line.trim())?.trim();
    card.append(eyebrow,dom('div','ideas-node-title',n.title),
      dom('div','ideas-node-sub',n.hiddenChildren?String(n.hiddenChildren)+' branches tucked away':excerpt?excerpt.slice(0,65):n.childCount?String(n.childCount)+' branches · '+stateNames[n.status]:stateNames[n.status]+' · explore'));
    if(n.hiddenChildren){
      card.append(dom('span','ideas-node-bubble','+'+n.hiddenChildren));
    }
    card.addEventListener('click',()=>selectNode(n.id));
    card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectNode(n.id);}});
    const plus=dom('button','ideas-node-plus',n.hiddenChildren?'⌄':'+');
    plus.type='button';plus.setAttribute('aria-label',n.hiddenChildren?'Expand '+n.title:'Add a child to '+n.title);
    plus.title=n.hiddenChildren?'Show branches':'Add a branch';
    plus.addEventListener('click',e=>{
      e.stopPropagation();
      if(n.hiddenChildren)overwrite(updateIdeaBranch(active(),n.id,{collapsed:false}),{message:'Branches expanded'});
      else selectNode(n.id);
    });
    card.append(plus);
    return card;
  }
  function drawMap(){
    graphLayout=layoutIdeaGraph(active());
    canvas.style.width=graphLayout.width+'px';canvas.style.height=graphLayout.height+'px';
    const lines=$('#ideaLines');
    lines.replaceChildren();
    lines.setAttribute('viewBox','0 0 '+graphLayout.width+' '+graphLayout.height);
    lines.setAttribute('width',String(graphLayout.width));
    lines.setAttribute('height',String(graphLayout.height));
    for(const edge of graphLayout.edges)drawEdge(lines,edge.fromNode,edge.toNode,'ideas-line');
    for(const edge of graphLayout.links)drawEdge(lines,edge.fromNode,edge.toNode,'ideas-line ideas-line--cross');
    const layer=$('#ideaNodes');
    layer.replaceChildren(...graphLayout.nodes.map(makeCard));
    positionCanvas();
  }
  function drawOutline(){
    const rows=outlineIdeaGraph(active());
    const selectedRows=search?rows.filter(x=>(x.node.title+' '+x.node.description+' '+x.node.evidence).toLowerCase().includes(search)):rows;
    outline.replaceChildren();
    if(!selectedRows.length){outline.append(dom('div','ideas-empty-outline','No matching branches. Try a different phrase.'));return;}
    for(const {node:n,depth} of selectedRows){
      const row=dom('button','ideas-outline-row'+(selected===n.id?' is-selected':''));
      row.type='button';row.style.paddingLeft=(14+Math.min(depth,12)*20)+'px';
      row.setAttribute('aria-pressed',String(selected===n.id));
      if(depth)row.append(dom('span','ideas-outline-tree'));
      row.append(dom('span','ideas-outline-name',n.title),dom('span','ideas-outline-kind',kindNames[n.kind].toLowerCase()));
      row.addEventListener('click',()=>selectNode(n.id));
      outline.append(row);
    }
  }
  function drawInspector(){
    const graph=active(),node=graph.nodes.find(n=>n.id===selected)||graph.nodes[0];
    selected=node.id;
    const path=branchPath(graph,selected),root=selected===graph.rootId;
    $('#ideaDepth').textContent='LEVEL '+String(path.length).padStart(2,'0');
    const trail=$('#ideaTrail');trail.replaceChildren();
    for(const [i,n] of path.entries()){
      if(i)trail.append(dom('span','','›'));
      if(i===path.length-1)trail.append(dom('b','',n.title));
      else {const b=dom('button','',n.title);b.type='button';b.addEventListener('click',()=>selectNode(n.id));trail.append(b);}
    }
    $('#ideaTitleInput').value=node.title;
    $('#ideaKindInput').value=node.kind;
    $('#ideaKindInput').disabled=root;
    $('#ideaStatusInput').value=node.status;
    $('#ideaDescriptionInput').value=node.description;
    $('#ideaEvidenceInput').value=node.evidence;
    $('#ideaDelete').disabled=root;
    $('#ideaLinkTarget').replaceChildren();
    const placeholder=dom('option','','Select another branch');placeholder.value='';
    $('#ideaLinkTarget').append(placeholder);
    for(const candidate of graph.nodes){
      if(candidate.id===selected)continue;
      if(graph.links.some(l=>l.from===selected&&l.to===candidate.id))continue;
      const option=dom('option','',candidate.title);
      option.value=candidate.id;$('#ideaLinkTarget').append(option);
    }
    const linked=$('#ideaConnectionsList');linked.replaceChildren();
    const related=graph.links.filter(l=>l.from===selected||l.to===selected);
    if(!related.length)linked.append(dom('div','ideas-no-links','No cross-links yet. Connect ideas that influence each other.'));
    for(const connection of related){
      const other=graph.nodes.find(n=>n.id===(connection.from===selected?connection.to:connection.from));
      const row=dom('div','ideas-linked');
      const visit=dom('button','',other?.title||'Branch');
      visit.type='button';visit.style.cssText='font-size:10px;flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      visit.addEventListener('click',()=>selectNode(other.id));
      const remove=dom('button','','×');remove.type='button';remove.setAttribute('aria-label','Remove link to '+other.title);
      remove.addEventListener('click',()=>overwrite(unlinkIdeaBranches(active(),connection.from,connection.to),{message:'Connection removed'}));
      row.append(visit,remove);linked.append(row);
    }
    flow.render();
  }
  function selectNode(id){
    if(!active().nodes.some(n=>n.id===id))return;
    selected=id;drawMap();drawOutline();drawInspector();
    flow.open();
    if(mode==='map'&&!graphLayout.nodes.some(n=>n.id===id)){
      const path=branchPath(active(),id);
      for(const ancestor of path){
        if(ancestor.collapsed&&ancestor.id!==id){
          overwrite(updateIdeaBranch(active(),ancestor.id,{collapsed:false}),{focus:id});break;
        }
      }
    }
  }
  function updateModes(){
    $$('.ideas-mode-toggle [data-idea-mode]').forEach(button=>{
      const active=button.dataset.ideaMode===mode;button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    viewport.hidden=mode!=='map';outline.hidden=mode!=='outline';
    $('#ideaMapHint').textContent=mode==='map'?'Drag to explore · Select any branch to develop it further':'Outline of the entire idea, including branches folded on the map';
    const controls=['#ideaZoomIn','#ideaZoomOut','#ideaFit'];
    for(const control of controls)$(control).disabled=mode!=='map';
  }
  function render({fit:fitRequested=false,focus=null}={}){
    renderPortfolio();drawMap();drawOutline();drawInspector();updateModes();
    if(fitRequested)requestAnimationFrame(initialPosition);
    else if(focus)requestAnimationFrame(()=>centerNode(focus));
    if(initialFit){initialFit=false;requestAnimationFrame(initialPosition);}
  }
  function newIdea(){
    createMode='root';createParent=null;
    const form=$('#ideaCreateForm');form.reset();
    $('#ideaDialogEyebrow').textContent='CREATE YOUR IDEA';
    $('#ideaDialogTitle').textContent='What are you imagining?';
    $('#ideaDialogDescription').textContent='A single thought can open into dozens of possibilities.';
    $('#ideaCreateKindWrap').hidden=true;
    $('#ideaCreateSubmit').textContent='Create idea';
    $('#ideaCreateDialog').showModal();$('#ideaCreateTitle').focus();
  }
  function openCreateChild(parentId=selected){
    createMode='child';createParent=parentId;
    const parent=active().nodes.find(n=>n.id===parentId);
    if(!parent){notice('Select a branch first.');return;}
    const form=$('#ideaCreateForm');form.reset();
    $('#ideaDialogEyebrow').textContent='FOLLOW A NEW DIRECTION';
    $('#ideaDialogTitle').textContent='Branch from this idea';
    $('#ideaDialogDescription').textContent='A new thought connected to “'+parent.title+'”.';
    $('#ideaCreateKindWrap').hidden=false;
    $('#ideaCreateKind').value=parent.kind==='assumption'?'experiment':parent.kind==='question'?'direction':'direction';
    $('#ideaCreateSubmit').textContent='Add branch';
    $('#ideaCreateDialog').showModal();$('#ideaCreateTitle').focus();
  }
  function switchGraph(id){
    if(!portfolio.graphs.some(g=>g.id===id))return;
    portfolio.activeId=id;selected=active().rootId;
    history=[];future=[];search='';$('#ideaSearch').value='';
    initialFit=true;store();render({fit:true});
    notice('Switched idea');
  }
  function saveFile(filename,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=dom('a');a.href=url;a.download=filename;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportIdeas(){
    saveFile('thenvio-ideas-'+new Date().toISOString().slice(0,10)+'.json',portfolio);
    notice('All your ideas exported as JSON.');
  }
  async function importIdeas(file){
    if(!file)return;
    if(file.size>5_000_000){notice('File exceeds the 5 MB limit.');return;}
    try{
      const data=JSON.parse(await file.text());
      const incoming=data.format==='thenvio-ideas-collection-v1'&&Array.isArray(data.graphs)
        ?data.graphs.map(readIdeaGraph):[readIdeaGraph(data)];
      if(!incoming.length||incoming.length>MAX_GRAPHS)throw Error('Invalid collection size.');
      const currentIds=new Set(portfolio.graphs.map(g=>g.id));
      const merged=[...portfolio.graphs];
      for(const graph of incoming){
        const id=currentIds.has(graph.id)?'g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7):graph.id;
        merged.push({...graph,id});
        currentIds.add(id);
      }
      if(merged.length>MAX_GRAPHS)throw Error('Maximum 50 ideas in this browser.');
      portfolio={format:'thenvio-ideas-collection-v1',graphs:merged,activeId:merged.at(-1).id};
      history=[];future=[];selected=active().rootId;search='';$('#ideaSearch').value='';initialFit=true;
      store();render({fit:true});notice(incoming.length+' idea(s) imported.');
    }catch(error){notice('Cannot import idea: '+error.message);}
  }
  async function copyFocus(){
    const text=ideaContext(active(),selected);
    try{await navigator.clipboard.writeText(text);notice('Branch context copied. Paste into your AI assistant.');}
    catch{
      const box=dom('textarea');box.value=text;box.style.cssText='position:fixed;left:-9999px;top:-9999px';
      document.body.append(box);box.select();
      const ok=document.execCommand('copy');box.remove();
      notice(ok?'Branch context copied.':'Copy was blocked by the browser. Try a secure context.');
    }
  }
  const flow=initIdeaFlow({getGraph:active,getSelected:()=>selected,mutate:overwrite,notice});
  // Input wiring. Every displayed action changes state or navigates to real data.
  $('#ideaNew').addEventListener('click',newIdea);
  $('#ideaProjectSelect').addEventListener('change',e=>switchGraph(e.target.value));
  $('#ideaUndo').addEventListener('click',()=>replacement(null,true));
  $('#ideaRedo').addEventListener('click',()=>replacement(null,false));
  $('#ideaAddChild').addEventListener('click',()=>openCreateChild(selected));
  $('#ideaDevelop').addEventListener('click',()=>flow.addVisible());
  $('#ideaDelete').addEventListener('click',()=>{
    const graph=active(),node=graph.nodes.find(n=>n.id===selected);
    if(!node||node.id===graph.rootId)return;
    if(!window.confirm('Delete “'+node.title+'” and all its sub-branches? You can undo this.'))return;
    const parentId=node.parentId;
    overwrite(deleteIdeaBranch(graph,selected),{focus:parentId,message:'Branch deleted. Use Undo to restore it.'});
  });
  $('#ideaInspectorForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const g=active(),id=selected;
      overwrite(updateIdeaBranch(g,id,{
        title:$('#ideaTitleInput').value.trim(),kind:$('#ideaKindInput').value,
        status:$('#ideaStatusInput').value,description:$('#ideaDescriptionInput').value,
        evidence:$('#ideaEvidenceInput').value
      }),{message:'Branch updated.'});
    }catch(error){notice(error.message);}
  });
  $('#ideaCreateForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const title=$('#ideaCreateTitle').value.trim(),description=$('#ideaCreateDescription').value;
      if(createMode==='root'){
        if(portfolio.graphs.length>=MAX_GRAPHS)throw Error('Maximum 50 ideas. Export your work to archive it.');
        const g=makeIdea(title,description);
        const seeds=thinkNext(g,g.rootId,{mode:'explore',count:4,locale:flow.locale});
        const started=applyThoughts(g,g.rootId,seeds).graph;
        portfolio.graphs.push(started);portfolio.activeId=started.id;selected=started.rootId;
        history=[];future=[];search='';$('#ideaSearch').value='';initialFit=true;
        store();render({fit:true});flow.close();notice(flow.locale==='pl'?'Pomysł gotowy. Odkrywaj pierwsze kierunki jednym dotknięciem.':'Idea ready. Explore the first directions with one tap.');
      }else{
        const next=addIdeaBranch(active(),createParent,{title,description,kind:$('#ideaCreateKind').value});
        overwrite(next,{focus:next.nodes.at(-1).id,message:'New branch added.'});
      }
      $('#ideaCreateDialog').close();
    }catch(error){notice(error.message);}
  });
  $('#ideaLink').addEventListener('click',()=>{
    const to=$('#ideaLinkTarget').value;
    if(!to){notice('Choose a branch to connect first.');return;}
    try{overwrite(linkIdeaBranches(active(),selected,to),{message:'Branches connected.'});}
    catch(error){notice(error.message);}
  });
  $('#ideaCopy').addEventListener('click',copyFocus);
  $('#ideaSearch').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();drawMap();drawOutline();});
  $$('.ideas-mode-toggle [data-idea-mode]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.ideaMode;updateModes();if(mode==='map')requestAnimationFrame(fit);
  }));
  $('#ideaZoomIn').addEventListener('click',()=>zoomTo(zoom+.15));
  $('#ideaZoomOut').addEventListener('click',()=>zoomTo(zoom-.15));
  $('#ideaFit').addEventListener('click',fit);
  $('#ideaExpandAll').addEventListener('click',()=>{
    let next=active();
    for(const node of next.nodes)if(node.collapsed)next=updateIdeaBranch(next,node.id,{collapsed:false});
    overwrite(next,{fit:true,message:'All branches expanded.'});
  });
  $('#ideaCollapseAll').addEventListener('click',()=>{
    let next=active();
    for(const node of next.nodes)if(node.id!==next.rootId&&next.nodes.some(x=>x.parentId===node.id)&&!node.collapsed)next=updateIdeaBranch(next,node.id,{collapsed:true});
    overwrite(next,{fit:true,message:'Deep branches folded away; nothing deleted.'});
  });
  $('#ideaImportInput').addEventListener('change',event=>{
    importIdeas(event.target.files?.[0]);event.target.value='';
  });
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.ideas-node,button,input,textarea'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    pan={x:drag.panX+event.clientX-drag.x,y:drag.panY+event.clientY-drag.y};
    positionCanvas();
  });
  const stopDrag=()=>{drag=null;};
  viewport.addEventListener('pointerup',stopDrag);
  viewport.addEventListener('pointercancel',stopDrag);
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();
    if(event.ctrlKey||event.metaKey){
      const box=viewport.getBoundingClientRect();
      zoomTo(zoom*(event.deltaY<0?1.09:.91),event.clientX-box.left,event.clientY-box.top);
    }else{
      pan.x-=event.deltaX;
      pan.y-=event.deltaY;positionCanvas();
    }
  },{passive:false});
  viewport.addEventListener('keydown',event=>{
    if(event.target!==viewport)return;
    const directions={ArrowUp:[0,65],ArrowDown:[0,-65],ArrowLeft:[65,0],ArrowRight:[-65,0]};
    if(directions[event.key]){event.preventDefault();pan.x+=directions[event.key][0];pan.y+=directions[event.key][1];positionCanvas();}
    else if(event.key==='+'||event.key==='='){event.preventDefault();zoomTo(zoom+.1);}
    else if(event.key==='-'){event.preventDefault();zoomTo(zoom-.1);}
    else if(event.key==='0'){event.preventDefault();fit();}
  });
  window.addEventListener('keydown',event=>{
    const editing=event.target.closest('input,textarea,select,[contenteditable="true"]');
    if(editing||document.querySelector('dialog[open]'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();replacement(null,!event.shiftKey);
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();replacement(null,false);}
  });
  window.addEventListener('resize',()=>{if(mode==='map'&&$('#view-branches').classList.contains('active'))initialPosition();},{passive:true});
  render();
  return {
    show(){flow.close();renderPortfolio();requestAnimationFrame(()=>{if(!graphLayout)return;positionCanvas();});},
    create:newIdea,
    import(){ $('#ideaImportInput').click();},
    export:exportIdeas,
    getGraph:()=>clone(active())
  };
}
