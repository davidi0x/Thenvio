import {evaluate,stressTest,emptyProject,loadProject} from './core/engine.mjs';
import {demoProject} from './core/demo.mjs';
import {SKILLS,skillPrompt} from './core/skills.mjs';

const $=selector=>document.querySelector(selector);
const $all=selector=>[...document.querySelectorAll(selector)];
const STORAGE_KEY='thenvio-project-v1';
const clone=obj=>structuredClone(obj);
function node(tag,klass,text){
  const n=document.createElement(tag);
  if(klass)n.className=klass;
  if(text!==undefined&&text!==null)n.textContent=String(text);
  return n;
}
function append(parent,...children){children.forEach(child=>parent.append(child));return parent;}
function button(text,klass,fn){const b=node('button',klass,text);b.type='button';b.addEventListener('click',fn);return b;}
function formatMoney(value,currency='USD'){
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value);}
  catch{return '$'+Math.round(value).toLocaleString('en-US');}
}
function number(v,backup=0){const n=Number(v);return Number.isFinite(n)?n:backup;}
function getStored(){
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return loadProject(raw);}
  catch(error){console.warn('Local data unavailable',error);}
  return clone(demoProject);
}
let project=getStored();
let selectedPath=project.paths[0]?.id||null;
let activeTab='overview';
let editingProject=false;
let editingAssumption=null;
let toastTimer;
let chosenSkill='problem-framing';

function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(project));}
  catch{notice('Browser storage is unavailable. Use Export to keep your work.');}
}
function notice(message){
  const toast=$('#toast');toast.textContent=message;toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3700);
}
function setProject(next){
  project=loadProject({...next,schemaVersion:1});
  if(!project.paths.some(p=>p.id===selectedPath))selectedPath=project.paths[0]?.id||null;
  persist();render();
}
function navigate(tab){
  if(!['overview','assumptions','skills','integrations'].includes(tab))return;
  activeTab=tab;
  $all('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+tab));
  $all('.nav-item').forEach(v=>{const on=v.dataset.tab===tab;v.classList.toggle('active',on);if(on)v.setAttribute('aria-current','page');else v.removeAttribute('aria-current');});
  $('#breadcrumb').textContent={overview:'Decision lab',assumptions:'Assumptions',skills:'Founder skills',integrations:'Integrations'}[tab];
  window.scrollTo({top:0,behavior:'instant'});
  render();
}
function metric(label,value,caption,accent=false){
  const card=node('div','metric');
  append(card,node('div','metric-label',label),node('div','metric-value'+(accent?' accent':'')+(String(value).length>14?' textual':''),value),node('div','metric-caption',caption));
  return card;
}
function renderMetrics(report){
  const eligible=report.paths.filter(p=>p.feasible).length;
  const rec=report.paths.find(p=>p.id===report.winners.recommended);
  const el=$('#metricGrid');el.replaceChildren(
    metric('Paths explored',report.paths.length,'Distinct routes under consideration'),
    metric('Still feasible',eligible,'Within current constraints',true),
    metric('Evidence gaps',report.evidenceGaps.length,'Unknown or uncited claims'),
    metric('Leading path',rec?rec.name:'None yet',rec?'Heuristic winner, not a forecast':'Add a route or adjust constraints')
  );
}
function renderControls(){
  const maxBudget=Math.max(50000,Math.ceil(project.budget/5000)*5000);
  $('#budgetRange').max=String(maxBudget);
  $('#budgetRange').value=String(project.budget);
  $('#budgetMax').textContent=formatMoney(maxBudget,project.currency);
  $('#budgetLabel').textContent=formatMoney(project.budget,project.currency);
  $('#weeksRange').max=String(Math.max(52,Math.ceil(project.deadlineWeeks)));
  $('#weeksRange').value=String(project.deadlineWeeks);
  $('#weeksLabel').textContent=project.deadlineWeeks+' weeks';
  $('#riskRange').value=String(project.riskTolerance);
  $('#riskLabel').textContent=project.riskTolerance+' / 100';
}
function renderRoutes(report){
  const root=$('#routes');root.replaceChildren();
  $('#pathCount').textContent='('+report.paths.length+')';
  if(!report.paths.length){
    const empty=node('div','empty','No paths yet. Add two or more genuinely different strategies, with estimated costs, time and dependencies.');
    append(empty,button('+ Add the first path','small-button',()=>openPath()));
    root.append(empty);return;
  }
  report.paths.forEach((p,index)=>{
    const row=button('','route'+(p.id===selectedPath?' active':'')+(p.feasible?'':' blocked'),()=>{selectedPath=p.id;renderRoutes(report);renderDetail(report);});
    row.setAttribute('aria-label',p.name+', '+p.status+', score '+p.score);
    row.setAttribute('aria-pressed',String(p.id===selectedPath));
    const letter=node('div','route-letter',String.fromCharCode(65+index));
    const main=node('div','route-main');
    append(main,node('span','route-status '+p.status,p.status==='uncertain'?'NEEDS EVIDENCE':p.status==='viable'?'FEASIBLE':'BLOCKED'),node('span','route-title',p.name),node('span','route-desc',p.description));
    const facts=node('div','route-facts');
    append(facts,node('span','',formatMoney(p.cost,project.currency)),node('span','',p.weeks+' weeks'),node('span','',p.risk+'/100 risk'));
    main.append(facts);
    const progress=node('div','progress');const bar=node('span');bar.style.width=p.score+'%';progress.append(bar);main.append(progress);
    const score=node('div','route-score'+(!p.feasible?' is-blocked':''),String(Math.round(p.score)));score.append(node('small','', ' /100'));
    append(row,letter,main,score);root.append(row);
  });
}
function renderDetail(report){
  const root=$('#pathDetail');root.replaceChildren();
  const p=report.paths.find(x=>x.id===selectedPath)||report.paths[0];
  if(!p){root.append(node('p','empty','Choose a route to inspect its trade-offs.'));return;}
  append(root,node('h2','detail-title',p.name),node('span','route-status '+p.status,p.status.toUpperCase()),node('p','detail-desc',p.description));
  const scoreline=node('div','detail-scoreline');
  append(scoreline,node('span','', 'Comparative score'),node('strong','',p.score+'/100'));root.append(scoreline);
  const grid=node('div','detail-grid');
  for(const [label,value] of [['Cost',formatMoney(p.cost,project.currency)],['Time',p.weeks+' weeks'],['Upside',p.upside+' / 100'],['Learning',p.learning+' / 100'],['Risk',p.risk+' / 100'],['Budget left',formatMoney(p.headroom.budget,project.currency)]){
    append(grid,append(node('div'),node('span','',label),node('strong','',value)));
  }
  root.append(grid);
  const status=node('div','detail-block');
  status.append(node('h3','','WHY THIS RESULT'));
  if(p.blockers.length)p.blockers.forEach(b=>status.append(node('p','blocker','× '+b.message)));
  else status.append(node('p','','✓ Within your current time and budget constraints.'));
  if(p.evidenceGaps.length)status.append(node('p','','! '+p.evidenceGaps.length+' dependent claim(s) still need evidence.'));
  if(!p.evidenceGaps.length&&!p.blockers.length)status.append(node('p','','No unresolved linked claims recorded. This does not establish real-world success.'));
  root.append(status);
  const breakdown=node('div','detail-block');
  breakdown.append(node('h3','','SCORE CONTRIBUTIONS'));
  for(const [k,v] of Object.entries(p.breakdown))breakdown.append(node('p','',k.replace(/([A-Z])/g,' $1')+': '+(k==='evidencePenalty'?'-':'')+v+' points'));
  root.append(breakdown);
  const actions=node('div','detail-actions');
  append(actions,button('Edit path','small-button',()=>openPath(p.id)),button('Delete','small-button',()=>{
    if(!confirm('Delete this path? This cannot be undone.'))return;
    setProject({...project,paths:project.paths.filter(x=>x.id!==p.id)});
    notice('Path removed');
  }));
  root.append(actions);
}
function renderNext(report){
  const root=$('#nextActions');root.replaceChildren();
  if(!report.nextActions.length)root.append(node('p','empty','Add paths and assumptions to generate the next verification steps.'));
  report.nextActions.forEach((action,i)=>{
    const item=node('div','action-item');
    append(item,node('span','action-number',String(i+1).padStart(2,'0')),node('p','',action.text));root.append(item);
  });
}
function renderAssumptions(){
  const root=$('#assumptionTable');root.replaceChildren();
  if(!project.assumptions.length){root.append(node('div','empty','No assumptions recorded. Write the claims your strategy depends on.'));return;}
  const table=node('table','data-table');const head=node('thead'),hr=node('tr');
  for(const title of ['CLAIM','STATUS','LINKED PATHS','ACTION'])hr.append(node('th','',title));
  head.append(hr);table.append(head);
  const body=node('tbody');
  project.assumptions.forEach(a=>{
    const row=node('tr');
    const claimCell=node('td','claim');claimCell.append(node('div','',a.claim));
    claimCell.append(node('div','source'+(!a.source?' warning':''),a.source?'Evidence note: '+a.source:'No evidence recorded'));
    const status=node('td');status.append(node('span','status-pill '+a.status,a.status.toUpperCase()));
    const linked=project.paths.filter(p=>p.dependencies.includes(a.id));
    const linkedCell=node('td','',linked.length+' paths');
    const edit=node('td');edit.append(button('Edit','table-edit',()=>openAssumption(a.id)));
    append(row,claimCell,status,linkedCell,edit);body.append(row);
  });
  table.append(body);root.append(table);
}
function renderSkills(){
  const query=$('#skillSearch').value.toLowerCase().trim(),category=$('#skillCategory').value;
  const root=$('#skillGrid');root.replaceChildren();
  const list=SKILLS.filter(s=>(!category||s.category===category)&&(!query||(s.name+' '+s.summary+' '+s.category).toLowerCase().includes(query)));
  if(!list.length){root.append(node('div','empty','No skills match this search.'));return;}
  for(const s of list){
    const card=node('article','skill-card');
    const top=node('div','skill-top');
    append(top,node('span','skill-symbol','✳'),node('span','skill-category',s.category));
    append(card,top,node('h2','',s.name),node('p','',s.summary),button('Open protocol ↗','skill-open',()=>openSkill(s.id)));
    root.append(card);
  }
}
function render(){
  const report=evaluate(project);
  $('#projectTitle').textContent=project.title;
  $('#demoLabel').textContent=project.id==='demo'?'ILLUSTRATIVE DEMO':'LOCAL PROJECT';
  renderMetrics(report);renderControls();renderRoutes(report);renderDetail(report);renderNext(report);
  renderAssumptions();renderSkills();
}
function openDialog(id){const dialog=$('#'+id);if(!dialog.open)dialog.showModal();}
function closeDialog(id){$('#'+id).close();}
function openProject(edit=false){
  editingProject=edit;
  $('#projectDialogTitle').textContent=edit?'Edit decision':'New decision';
  const form=$('#projectForm');form.reset();
  form.elements.namedItem('title').value=edit?project.title:'';
  form.elements.namedItem('goal').value=edit?project.goal:'';
  form.elements.namedItem('budget').value=edit?String(project.budget):'10000';
  form.elements.namedItem('weeks').value=edit?String(project.deadlineWeeks):'12';
  openDialog('projectDialog');
}
function openPath(id=null){
  const p=project.paths.find(x=>x.id===id);
  $('#pathDialogTitle').textContent=p?'Edit path':'New path';
  const form=$('#pathForm');form.reset();
  for(const key of ['id','name','description','cost','weeks','upside','risk','learning'])
    form.elements.namedItem(key).value=p?String(p[key]):(key==='id'||key==='name'||key==='description'?'':key==='cost'?'1000':key==='weeks'?'4':'50');
  const root=$('#pathDependencies');root.replaceChildren();
  if(!project.assumptions.length)root.append(node('p','form-hint','No assumptions yet. Add them in the evidence register.'));
  for(const a of project.assumptions){
    const label=node('label');const input=node('input');input.type='checkbox';input.value=a.id;input.checked=!!p?.dependencies.includes(a.id);
    append(label,input,node('span','',a.claim));root.append(label);
  }
  openDialog('pathDialog');
}
function openAssumption(id=null){
  editingAssumption=id;
  const a=project.assumptions.find(x=>x.id===id);
  $('#assumptionDialogTitle').textContent=a?'Edit assumption':'New assumption';
  const form=$('#assumptionForm');form.reset();
  for(const key of ['id','claim','source'])form.elements.namedItem(key).value=a?String(a[key]||''):'';
  form.elements.namedItem('status').value=a?a.status:'unknown';
  openDialog('assumptionDialog');
}
function openSkill(id){
  chosenSkill=id;const s=SKILLS.find(x=>x.id===id);
  $('#skillDialogTitle').textContent=s.name;$('#skillDescription').textContent=s.deliverable;
  $('#skillPrompt').value=skillPrompt(id,project);openDialog('skillDialog');
}
function uniqueId(prefix){
  let id;
  do{id=prefix+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);}
  while(project.paths.some(x=>x.id===id)||project.assumptions.some(x=>x.id===id));
  return id;
}
async function copyText(value){
  try{await navigator.clipboard.writeText(value);notice('Copied to clipboard');}
  catch{const area=node('textarea');area.value=value;document.body.append(area);area.select();
    const success=document.execCommand('copy');area.remove();notice(success?'Copied to clipboard':'Clipboard unavailable — select text in the dialog');}
}
function exportProject(){
  const content=JSON.stringify({...project,schemaVersion:1},null,2);
  const blob=new Blob([content],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=node('a');
  link.href=url;link.download='thenvio-'+(project.id||'decision').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,45)+'.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  notice('Project exported');
}
async function importFile(file){
  if(!file)return;
  if(file.size>2_000_000){notice('Project file is too large (max 2 MB).');return;}
  try{const data=loadProject(await file.text());setProject(data);navigate('overview');notice('Project imported');}
  catch(error){notice('Import rejected: '+error.message);}
}
function bind(){
  $all('[data-tab]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.tab)));
  $all('[data-close]').forEach(el=>el.addEventListener('click',()=>closeDialog(el.dataset.close)));
  $('#brand').addEventListener('click',e=>{e.preventDefault();navigate('overview');});
  $('#newDecision').addEventListener('click',()=>openProject());
  $('#mobileNew').addEventListener('click',()=>openProject());
  $('#editProject').addEventListener('click',()=>openProject(true));
  $('#addPath').addEventListener('click',()=>openPath());
  $('#addAssumption').addEventListener('click',()=>openAssumption());
  $('#budgetRange').addEventListener('input',e=>setProject({...project,budget:number(e.target.value)}));
  $('#weeksRange').addEventListener('input',e=>setProject({...project,deadlineWeeks:number(e.target.value,1)}));
  $('#riskRange').addEventListener('input',e=>setProject({...project,riskTolerance:number(e.target.value)}));
  $('#projectForm').addEventListener('submit',e=>{
    e.preventDefault();const f=e.currentTarget,fields=f.elements;
    try{
      const data={title:fields.namedItem('title').value.trim(),goal:fields.namedItem('goal').value.trim(),
        budget:number(fields.namedItem('budget').value),deadlineWeeks:number(fields.namedItem('weeks').value,1)};
      const next=editingProject?{...project,...data}:emptyProject(data.title,data.goal,data.budget,data.deadlineWeeks);
      setProject(next);closeDialog('projectDialog');navigate('overview');notice(editingProject?'Decision updated':'New decision created — add your paths');
    }catch(error){notice(error.message);}
  });
  $('#pathForm').addEventListener('submit',e=>{
    e.preventDefault();const f=e.currentTarget,fields=f.elements;
    const id=fields.namedItem('id').value||uniqueId('path');
    const record={id,name:fields.namedItem('name').value.trim(),description:fields.namedItem('description').value.trim(),
      cost:number(fields.namedItem('cost').value),weeks:number(fields.namedItem('weeks').value),
      upside:number(fields.namedItem('upside').value),risk:number(fields.namedItem('risk').value),
      learning:number(fields.namedItem('learning').value),
      dependencies:[...$('#pathDependencies').querySelectorAll('input:checked')].map(x=>x.value)};
    try{
      const paths=[...project.paths.filter(x=>x.id!==id),record];
      setProject({...project,paths});selectedPath=id;closeDialog('pathDialog');render();navigate('overview');notice('Path saved');
    }catch(error){notice(error.message);}
  });
  $('#assumptionForm').addEventListener('submit',e=>{
    e.preventDefault();const f=e.currentTarget,fields=f.elements;
    const id=fields.namedItem('id').value||uniqueId('assumption');
    const record={id,claim:fields.namedItem('claim').value.trim(),status:fields.namedItem('status').value,source:fields.namedItem('source').value.trim()};
    try{setProject({...project,assumptions:[...project.assumptions.filter(a=>a.id!==id),record]});closeDialog('assumptionDialog');notice('Assumption saved');}
    catch(error){notice(error.message);}
  });
  $('#skillCategory').addEventListener('change',renderSkills);
  $('#skillSearch').addEventListener('input',renderSkills);
  const categories=[...new Set(SKILLS.map(s=>s.category))].sort();
  for(const cat of categories){const opt=node('option','',cat);opt.value=cat;$('#skillCategory').append(opt);}
  $('#copySkill').addEventListener('click',()=>copyText($('#skillPrompt').value));
  $('#copyContext').addEventListener('click',()=>copyText('Analyze this decision. Separate evidence, assumptions and estimates. Return specific ways to falsify each route. Do not invent market data.\\n\\n'+JSON.stringify(project,null,2)));
  $('#exportButton').addEventListener('click',exportProject);
  $('#exportSecondary').addEventListener('click',exportProject);
  $('#importButton').addEventListener('click',()=>$('#importInput').click());
  $('#importInput').addEventListener('change',e=>{importFile(e.target.files?.[0]);e.target.value='';});
  $all('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
}
bind();render();
