// Thenvio idea graph: branch-first thinking, not a score dashboard.
// Pure functions; no model calls, accounts, or network access.
export const IDEA_SCHEMA_VERSION=1;
export const IDEA_KINDS=Object.freeze(['idea','direction','question','assumption','experiment','insight']);
export const IDEA_STATES=Object.freeze(['open','exploring','supported','refuted']);
const MAX_NODES=400, MAX_LINKS=800;
const limits={title:150,description:4000,evidence:4000};
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const isText=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export function ideaId(){
  return 'n_'+Math.random().toString(36).slice(2,10)+'_'+Date.now().toString(36);
}
export function makeIdea(title,description='',now=new Date().toISOString()){
  if(!isText(title,limits.title))throw Error('An idea needs a title (up to 150 characters).');
  if(typeof description!=='string'||description.length>limits.description)throw Error('Description is too long.');
  const id=ideaId();
  return {schemaVersion:IDEA_SCHEMA_VERSION,id:'g_'+id,rootId:id,title:title.trim(),createdAt:now,updatedAt:now,
    nodes:[{id,parentId:null,title:title.trim(),description,kind:'idea',status:'exploring',evidence:'',collapsed:false,createdAt:now,updatedAt:now}],links:[]};
}
export function validateIdeaGraph(graph){
  const errors=[];
  if(!graph||typeof graph!=='object'||Array.isArray(graph))return ['Invalid idea graph.'];
  if(graph.schemaVersion!==IDEA_SCHEMA_VERSION)errors.push('Unsupported graph version.');
  if(!safeId(graph.id))errors.push('Invalid graph ID.');
  if(!isText(graph.title,limits.title))errors.push('Invalid graph title.');
  if(!safeId(graph.rootId))errors.push('Missing root ID.');
  if(!Array.isArray(graph.nodes)||graph.nodes.length<1||graph.nodes.length>MAX_NODES)return [...errors,'Invalid number of branches.'];
  if(!Array.isArray(graph.links)||graph.links.length>MAX_LINKS)return [...errors,'Invalid connections.'];
  const byId=new Map();
  for(const n of graph.nodes){
    if(!n||!safeId(n.id)||byId.has(n.id)){errors.push('Duplicate or invalid branch ID.');continue;}
    byId.set(n.id,n);
    if(!isText(n.title,limits.title))errors.push('Invalid branch title.');
    if(typeof n.description!=='string'||n.description.length>limits.description)errors.push('Invalid branch description.');
    if(typeof n.evidence!=='string'||n.evidence.length>limits.evidence)errors.push('Invalid branch notes.');
    if(!IDEA_KINDS.includes(n.kind))errors.push('Invalid branch kind.');
    if(!IDEA_STATES.includes(n.status))errors.push('Invalid branch state.');
    if(typeof n.collapsed!=='boolean')errors.push('Invalid branch collapsed state.');
    if(n.parentId!==null&&!safeId(n.parentId))errors.push('Invalid parent ID.');
  }
  if(!byId.has(graph.rootId))errors.push('Root does not exist.');
  const roots=graph.nodes.filter(n=>n.parentId===null);
  if(roots.length!==1||roots[0]?.id!==graph.rootId)errors.push('Exactly one root is required.');
  const children=new Map();
  for(const n of graph.nodes){
    if(n.parentId!==null){
      if(n.parentId===n.id||!byId.has(n.parentId))errors.push('Invalid parent reference.');
      const list=children.get(n.parentId)||[];list.push(n.id);children.set(n.parentId,list);
    }
  }
  const visited=new Set(), active=new Set();
  function walk(id){
    if(active.has(id)){errors.push('Branch cycle detected.');return;}
    if(visited.has(id))return;
    visited.add(id);active.add(id);
    for(const child of children.get(id)||[])walk(child);
    active.delete(id);
  }
  if(byId.has(graph.rootId))walk(graph.rootId);
  if(visited.size!==graph.nodes.length)errors.push('Disconnected branches detected.');
  const linkIds=new Set();
  for(const link of graph.links){
    if(!link||!safeId(link.from)||!safeId(link.to)||!byId.has(link.from)||!byId.has(link.to)||link.from===link.to)errors.push('Invalid cross-connection.');
    else {const key=link.from+'>'+link.to;if(linkIds.has(key))errors.push('Duplicate connection.');linkIds.add(key);}
  }
  return errors;
}
export function assertIdeaGraph(graph){const errors=validateIdeaGraph(graph);if(errors.length)throw Error(errors.join(' '));return graph;}
export function readIdeaGraph(json){
  const graph=typeof json==='string'?JSON.parse(json):json;
  return structuredClone(assertIdeaGraph(graph));
}
const bump=graph=>({...graph,updatedAt:new Date().toISOString()});
export function addIdeaBranch(graph,parentId,data){
  assertIdeaGraph(graph);
  if(graph.nodes.length>=MAX_NODES)throw Error('Maximum 400 branches per idea.');
  const parent=graph.nodes.find(n=>n.id===parentId);
  if(!parent)throw Error('Parent branch not found.');
  const now=new Date().toISOString();
  const branch={
    id:ideaId(),parentId,title:String(data?.title??'').trim(),
    description:String(data?.description??''),kind:data?.kind||'direction',
    status:'open',evidence:'',collapsed:false,createdAt:now,updatedAt:now
  };
  return assertIdeaGraph(bump({...graph,nodes:[...graph.nodes.map(n=>n.id===parentId?{...n,collapsed:false}:n),branch]}));
}
export function updateIdeaBranch(graph,id,patch){
  assertIdeaGraph(graph);
  if(!graph.nodes.some(n=>n.id===id))throw Error('Branch not found.');
  const allowed=['title','description','kind','status','evidence','collapsed'];
  const safe=Object.fromEntries(Object.entries(patch||{}).filter(([k])=>allowed.includes(k)));
  const now=new Date().toISOString();
  const nodes=graph.nodes.map(n=>n.id===id?{...n,...safe,updatedAt:now}:n);
  const title=id===graph.rootId?nodes.find(n=>n.id===id).title:graph.title;
  return assertIdeaGraph(bump({...graph,title,nodes}));
}
export function deleteIdeaBranch(graph,id){
  assertIdeaGraph(graph);
  if(id===graph.rootId)throw Error('The main idea cannot be removed. Create a new idea instead.');
  if(!graph.nodes.some(n=>n.id===id))throw Error('Branch not found.');
  const toDelete=new Set([id]);let changed=true;
  while(changed){changed=false;for(const n of graph.nodes)if(n.parentId&&toDelete.has(n.parentId)&&!toDelete.has(n.id)){toDelete.add(n.id);changed=true;}}
  return assertIdeaGraph(bump({...graph,nodes:graph.nodes.filter(n=>!toDelete.has(n.id)),links:graph.links.filter(l=>!toDelete.has(l.from)&&!toDelete.has(l.to))}));
}
export function linkIdeaBranches(graph,from,to){
  assertIdeaGraph(graph);
  if(from===to||!graph.nodes.some(n=>n.id===from)||!graph.nodes.some(n=>n.id===to))throw Error('Choose two different existing branches.');
  if(graph.links.some(l=>l.from===from&&l.to===to))return graph;
  return assertIdeaGraph(bump({...graph,links:[...graph.links,{from,to}]}));
}
export function unlinkIdeaBranches(graph,from,to){
  assertIdeaGraph(graph);
  return assertIdeaGraph(bump({...graph,links:graph.links.filter(l=>l.from!==from||l.to!==to)}));
}
export function branchPath(graph,id){
  assertIdeaGraph(graph);
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  if(!byId.has(id))throw Error('Branch not found.');
  const path=[];
  let node=byId.get(id);
  while(node){path.unshift(node);node=node.parentId?byId.get(node.parentId):null;}
  return path;
}
export function branchStats(graph){
  assertIdeaGraph(graph);
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  let maxDepth=0;
  for(const n of graph.nodes){
    let depth=0,p=n;while(p.parentId){depth++;p=byId.get(p.parentId);}
    maxDepth=Math.max(maxDepth,depth);
  }
  return {branches:graph.nodes.length-1,depth:maxDepth,questions:graph.nodes.filter(n=>n.kind==='question').length,assumptions:graph.nodes.filter(n=>n.kind==='assumption').length,connections:graph.links.length};
}
export function outlineIdeaGraph(graph){
  assertIdeaGraph(graph);
  const children=new Map();
  graph.nodes.forEach(n=>{const list=children.get(n.parentId)||[];list.push(n);children.set(n.parentId,list);});
  const result=[];
  function walk(n,depth){result.push({node:n,depth});for(const child of children.get(n.id)||[])walk(child,depth+1);}
  walk(graph.nodes.find(n=>n.id===graph.rootId),0);
  return result;
}
export function layoutIdeaGraph(graph,{cardWidth=228,cardHeight=114,gapX=81,stepY=150}={}){
  assertIdeaGraph(graph);
  const children=new Map();
  graph.nodes.forEach(n=>{const list=children.get(n.parentId)||[];list.push(n);children.set(n.parentId,list);});
  const positioned=[],edges=[];let leafIndex=0;
  function place(n,depth){
    const kids=n.collapsed?[]:children.get(n.id)||[];
    const ys=kids.map(c=>place(c,depth+1));
    const y=ys.length?(ys[0]+ys[ys.length-1])/2:leafIndex++*stepY;
    const x=depth*(cardWidth+gapX);
    positioned.push({...n,x,y,depth,hiddenChildren:n.collapsed?(children.get(n.id)||[]).length:0,childCount:(children.get(n.id)||[]).length});
    for(const child of kids)edges.push({from:n.id,to:child.id});
    return y;
  }
  place(graph.nodes.find(n=>n.id===graph.rootId),0);
  const minY=Math.min(...positioned.map(n=>n.y));
  const topPad=100;
  positioned.forEach(n=>n.y=n.y-minY+topPad);
  const coords=new Map(positioned.map(n=>[n.id,n]));
  const maxX=Math.max(...positioned.map(n=>n.x));
  const maxY=Math.max(...positioned.map(n=>n.y));
  return {nodes:positioned,edges:edges.map(e=>({...e,fromNode:coords.get(e.from),toNode:coords.get(e.to)})),
    links:graph.links.filter(l=>coords.has(l.from)&&coords.has(l.to)).map(l=>({...l,fromNode:coords.get(l.from),toNode:coords.get(l.to)})),
    width:maxX+cardWidth+140,height:maxY+cardHeight+140,cardWidth,cardHeight};
}
export const BRANCH_TEMPLATES=Object.freeze({
 idea:[
  {title:'Who is this for?',kind:'question'},
  {title:'Which directions could work?',kind:'direction'},
  {title:'What must be true?',kind:'assumption'}
 ],
 direction:[
  {title:'Simplest first version',kind:'experiment'},
  {title:'A radically different approach',kind:'direction'},
  {title:'What could make this fail?',kind:'question'}
 ],
 question:[
  {title:'Possible answer to investigate',kind:'direction'},
  {title:'What evidence would resolve this?',kind:'experiment'}
 ],
 assumption:[
  {title:'How could we disprove this?',kind:'experiment'},
  {title:'What if the opposite is true?',kind:'question'}
 ],
 experiment:[
  {title:'What result would count?',kind:'question'},
  {title:'What did we learn?',kind:'insight'}
 ],
 insight:[
  {title:'What does this change?',kind:'direction'},
  {title:'What should we test next?',kind:'experiment'}
 ]
});
export function developIdeaBranch(graph,id){
  assertIdeaGraph(graph);
  const node=graph.nodes.find(n=>n.id===id);
  if(!node)throw Error('Branch not found.');
  let current=graph;
  for(const seed of BRANCH_TEMPLATES[node.kind]){
    if(current.nodes.length>=MAX_NODES)break;
    current=addIdeaBranch(current,id,seed);
  }
  return current;
}
export function ideaContext(graph,id){
  const path=branchPath(graph,id);
  const branch=path.at(-1);
  const descendants=outlineIdeaGraph(graph).filter(item=>item.node.id!==id&&branchPath(graph,item.node.id).some(n=>n.id===id));
  const lines=[
    'THENVIO / IDEA DEVELOPMENT',
    'This is a user-authored idea graph, NOT externally verified research.',
    'Root idea: '+graph.title,
    'Focus path: '+path.map(n=>n.title).join(' → '),
    'Current branch kind: '+branch.kind+'; status: '+branch.status,
    'Description: '+(branch.description||'Not yet described'),
    'Evidence and notes: '+(branch.evidence||'Not yet provided'),
    'Existing sub-branches: '+(descendants.length?descendants.map(x=>x.node.title).join('; '):'None'),
    'Task: Help me explore alternative branches, assumptions, counterarguments and concrete next experiments. Clearly separate hypotheses from verified facts. Do not invent evidence. Suggest next branches with rationale, not a numeric success forecast.'
  ];
  return lines.join('\n');
}
