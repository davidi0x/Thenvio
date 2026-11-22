// Freeform canvas coordinates are stored WITH the existing idea graph.
// Older graphs without x/y remain readable; no breaking schema migration.
import {assertIdeaGraph,layoutIdeaGraph,addIdeaBranch,IDEA_KINDS,IDEA_STATES,LINK_TYPES} from './idea-graph.mjs';
export const BOARD_W=5200,BOARD_H=4200;
export const CARD_W=224,CARD_H=104;
const valid=(n)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=20000;
export function prepareBoard(graph){
 assertIdeaGraph(graph);
 // Older Thenvio versions could collapse nodes, but the free canvas shows ALL notes.
 // Layout the fully expanded structure once when migrating, preventing overlaps.
 const expanded={...graph,nodes:graph.nodes.map(n=>({...n,collapsed:false}))};
 const layout=layoutIdeaGraph(expanded,{cardWidth:CARD_W,cardHeight:CARD_H,gapX:78,stepY:165});
 const coords=new Map(layout.nodes.map(n=>[n.id,{x:n.x+1500,y:n.y+850}]));
 const nodes=graph.nodes.map((n,i)=>{
  if(valid(n.x)&&valid(n.y))return n;
  const pos=coords.get(n.id)||{x:1600+(i%6)*270,y:900+Math.floor(i/6)*180};
  return {...n,x:pos.x,y:pos.y,free:n.free===true};
 });
 return assertIdeaGraph({...graph,nodes});
}
export function moveBoardNode(graph,id,x,y){
 assertIdeaGraph(graph);
 if(!valid(x)||!valid(y))throw Error('Invalid canvas position');
 if(!graph.nodes.some(n=>n.id===id))throw Error('Node not found');
 return assertIdeaGraph({...graph,nodes:graph.nodes.map(n=>n.id===id?{...n,x,y,updatedAt:new Date().toISOString()}:n),updatedAt:new Date().toISOString()});
}
export function moveBoardNodes(graph,moves){
 assertIdeaGraph(graph);
 if(!Array.isArray(moves))throw Error('Invalid moves');
 const ids=new Set(graph.nodes.map(n=>n.id)),target=new Map();
 for(const m of moves){
  if(!m||!ids.has(m.id))throw Error('Node not found');
  if(!valid(m.x)||!valid(m.y))throw Error('Invalid canvas position');
  target.set(m.id,{x:m.x,y:m.y});
 }
 const stamp=new Date().toISOString();
 return assertIdeaGraph({...graph,updatedAt:stamp,nodes:graph.nodes.map(n=>target.has(n.id)?{...n,...target.get(n.id),updatedAt:stamp}:n)});
}
export function addBoardNode(graph,{title='New thought',parentId=graph.rootId,x,y,free=true,kind='direction',description=''}={}){
 assertIdeaGraph(graph);
 if(!valid(x)||!valid(y))throw Error('Invalid canvas position');
 if(typeof description!=='string'||description.length>4000)throw Error('Notes are too long.');
 const next=addIdeaBranch(graph,parentId,{title,kind,description});
 const id=next.nodes.at(-1).id;
 return {graph:assertIdeaGraph({...next,nodes:next.nodes.map(n=>n.id===id?{...n,x,y,free:!!free}:n)}),id};
}
export function updateBoardText(graph,id,{title,description}){
 assertIdeaGraph(graph);
 if(typeof title!=='string'||!title.trim()||title.length>150)throw Error('Enter a title (up to 150 characters).');
 if(typeof description!=='string'||description.length>4000)throw Error('Notes are too long.');
 if(!graph.nodes.some(n=>n.id===id))throw Error('Node not found');
 const stamp=new Date().toISOString();
 return assertIdeaGraph({...graph,title:id===graph.rootId?title.trim():graph.title,
  nodes:graph.nodes.map(n=>n.id===id?{...n,title:title.trim(),description,updatedAt:stamp}:n),updatedAt:stamp});
}
export function visibleBoardEdges(graph){
 assertIdeaGraph(graph);
 const nodeIds=new Set(graph.nodes.map(n=>n.id));
 const edges=graph.nodes.filter(n=>n.parentId&&n.free!==true&&nodeIds.has(n.parentId))
  .map(n=>({from:n.parentId,to:n.id,type:'parent'}));
 for(const link of graph.links){
  if(nodeIds.has(link.from)&&nodeIds.has(link.to))edges.push({from:link.from,to:link.to,type:'link',relation:link.type||'relates'});
 }
 return edges;
}
// ── v0.6: placement, tidy layout, note metadata and typed connections ──
const GAP_X=88,GAP_Y=26;
const overlaps=(a,b,m=14)=>a.x<b.x+CARD_W+m&&a.x+CARD_W+m>b.x&&a.y<b.y+CARD_H+m&&a.y+CARD_H+m>b.y;
const inBoard=p=>p.x>=0&&p.y>=0&&p.x<=BOARD_W-CARD_W&&p.y<=BOARD_H-CARD_H;
// Deterministic free positions next to an anchor note (right side first, then below, then left).
export function freeSlots(graph,anchorId,count,{occupied=[]}={}){
 assertIdeaGraph(graph);
 const anchor=graph.nodes.find(n=>n.id===anchorId);
 if(!anchor)throw Error('Node not found');
 if(!Number.isInteger(count)||count<1||count>24)throw Error('Invalid slot count');
 const taken=[...graph.nodes.map(n=>({x:n.x,y:n.y})),...occupied];
 const chosen=[];
 const rows=[0,1,-1,2,-2,3,-3,4,-4];
 const columns=[1,2,3,-1,-2];
 for(const col of columns){
  for(const row of rows){
   if(chosen.length>=count)break;
   const p={x:Math.round(anchor.x+col*(CARD_W+GAP_X)),y:Math.round(anchor.y+row*(CARD_H+GAP_Y))};
   if(!inBoard(p)||taken.some(t=>overlaps(p,t))||chosen.some(t=>overlaps(p,t)))continue;
   chosen.push(p);
  }
  if(chosen.length>=count)break;
 }
 for(let i=1;chosen.length<count&&i<40;i++){
  const p={x:Math.round(anchor.x+((i%5)-2)*(CARD_W+GAP_X)),y:Math.round(anchor.y+(Math.floor(i/5)+2)*(CARD_H+GAP_Y))};
  if(inBoard(p)&&!taken.some(t=>overlaps(p,t))&&!chosen.some(t=>overlaps(p,t)))chosen.push(p);
 }
 return chosen.sort((a,b)=>a.x-b.x||a.y-b.y);
}
function subtreeIds(graph,id){
 const out=new Set([id]);let changed=true;
 while(changed){changed=false;for(const n of graph.nodes)if(n.parentId&&out.has(n.parentId)&&!out.has(n.id)&&n.free!==true){out.add(n.id);changed=true;}}
 return out;
}
function layoutGroup(graph,anchorId){
 const ids=subtreeIds(graph,anchorId);
 const anchor=graph.nodes.find(n=>n.id===anchorId);
 const sub={...graph,rootId:anchorId,links:[],
  nodes:graph.nodes.filter(n=>ids.has(n.id)).map(n=>({...n,parentId:n.id===anchorId?null:n.parentId,collapsed:false}))};
 const layout=layoutIdeaGraph(sub,{cardWidth:CARD_W,cardHeight:CARD_H,gapX:GAP_X,stepY:CARD_H+GAP_Y+8});
 const at=layout.nodes.find(n=>n.id===anchorId);
 const pos=new Map(layout.nodes.map(n=>[n.id,{x:n.x-at.x+anchor.x,y:n.y-at.y+anchor.y}]));
 const box={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
 for(const p of pos.values()){box.minX=Math.min(box.minX,p.x);box.minY=Math.min(box.minY,p.y);box.maxX=Math.max(box.maxX,p.x+CARD_W);box.maxY=Math.max(box.maxY,p.y+CARD_H);}
 return {pos,box};
}
// Re-arrange the connected tree around the main idea; loose groups move below if they collide.
export function tidyLayout(graph){
 assertIdeaGraph(graph);
 const main=layoutGroup(graph,graph.rootId);
 const all=new Map(main.pos);
 const boxes=[main.box];
 let shelfX=main.box.minX,shelfY=main.box.maxY+90;
 for(const loose of graph.nodes.filter(n=>n.free===true)){
  const group=layoutGroup(graph,loose.id);
  const hits=boxes.some(b=>group.box.minX<b.maxX+30&&group.box.maxX+30>b.minX&&group.box.minY<b.maxY+30&&group.box.maxY+30>b.minY);
  let dx=0,dy=0;
  if(hits){dx=shelfX-group.box.minX;dy=shelfY-group.box.minY;shelfX+=group.box.maxX-group.box.minX+GAP_X;}
  for(const [id,p] of group.pos)all.set(id,{x:p.x+dx,y:p.y+dy});
  boxes.push({minX:group.box.minX+dx,minY:group.box.minY+dy,maxX:group.box.maxX+dx,maxY:group.box.maxY+dy});
 }
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of all.values()){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 const shiftX=minX<40?40-minX:maxX>BOARD_W-CARD_W-40?BOARD_W-CARD_W-40-maxX:0;
 const shiftY=minY<40?40-minY:maxY>BOARD_H-CARD_H-40?BOARD_H-CARD_H-40-maxY:0;
 const stamp=new Date().toISOString();
 return assertIdeaGraph({...graph,updatedAt:stamp,nodes:graph.nodes.map(n=>{
  const p=all.get(n.id);if(!p)return n;
  return {...n,x:Math.max(0,Math.round(p.x+shiftX)),y:Math.max(0,Math.round(p.y+shiftY))};
 })});
}
export function updateBoardMeta(graph,id,patch={}){
 assertIdeaGraph(graph);
 const node=graph.nodes.find(n=>n.id===id);
 if(!node)throw Error('Node not found');
 const next={...node};
 if('kind' in patch){
  if(!IDEA_KINDS.includes(patch.kind))throw Error('Unknown kind');
  if(id===graph.rootId&&patch.kind!=='idea')throw Error('The main idea keeps its kind.');
  if(id!==graph.rootId&&patch.kind==='idea')throw Error('Only the main idea is an idea.');
  next.kind=patch.kind;
 }
 if('status' in patch){if(!IDEA_STATES.includes(patch.status))throw Error('Unknown status');next.status=patch.status;}
 if('evidence' in patch){if(typeof patch.evidence!=='string'||patch.evidence.length>4000)throw Error('Evidence is too long.');next.evidence=patch.evidence;}
 for(const key of ['impact','effort'])if(key in patch){
  if(patch[key]===null)delete next[key];
  else if(Number.isInteger(patch[key])&&patch[key]>=1&&patch[key]<=5)next[key]=patch[key];
  else throw Error('Ratings are whole numbers from 1 to 5.');
 }
 const stamp=new Date().toISOString();next.updatedAt=stamp;
 return assertIdeaGraph({...graph,updatedAt:stamp,nodes:graph.nodes.map(n=>n.id===id?next:n)});
}
export function setLinkType(graph,from,to,type){
 assertIdeaGraph(graph);
 if(!LINK_TYPES.includes(type))throw Error('Unknown connection type');
 if(!graph.links.some(l=>l.from===from&&l.to===to))throw Error('Connection not found');
 return assertIdeaGraph({...graph,updatedAt:new Date().toISOString(),links:graph.links.map(l=>l.from===from&&l.to===to?{...l,type}:l)});
}
export function isDescendant(graph,id,ancestorId){
 const byId=new Map(graph.nodes.map(n=>[n.id,n]));
 let p=byId.get(id);
 while(p&&p.parentId){if(p.parentId===ancestorId)return true;p=byId.get(p.parentId);}
 return false;
}
// Connect two notes the way people expect: a loose note joins the tree under the other one,
// otherwise the notes get an explicit cross-connection.
export function connectNotes(graph,from,to){
 assertIdeaGraph(graph);
 if(from===to)throw Error('Choose two different notes.');
 const a=graph.nodes.find(n=>n.id===from),b=graph.nodes.find(n=>n.id===to);
 if(!a||!b)throw Error('Choose two different existing notes.');
 const stamp=new Date().toISOString();
 const attach=(child,parent)=>assertIdeaGraph({...graph,updatedAt:stamp,
  nodes:graph.nodes.map(n=>n.id===child.id?{...n,parentId:parent.id,free:false,updatedAt:stamp}:n),
  links:graph.links.filter(l=>!(l.from===child.id&&l.to===parent.id)&&!(l.from===parent.id&&l.to===child.id))});
 if(b.free===true&&b.id!==graph.rootId&&!isDescendant(graph,a.id,b.id))return {graph:attach(b,a),mode:'attached'};
 if(a.free===true&&a.id!==graph.rootId&&!isDescendant(graph,b.id,a.id))return {graph:attach(a,b),mode:'attached'};
 if(graph.links.some(l=>(l.from===from&&l.to===to)||(l.from===to&&l.to===from)))return {graph,mode:'exists'};
 if(b.parentId===a.id&&b.free!==true)return {graph,mode:'exists'};
 return {graph:assertIdeaGraph({...graph,updatedAt:stamp,links:[...graph.links,{from,to,type:'relates'}]}),mode:'linked'};
}
export function detachNote(graph,id){
 assertIdeaGraph(graph);
 if(id===graph.rootId)throw Error('The main idea is the anchor of the canvas.');
 const stamp=new Date().toISOString();
 return assertIdeaGraph({...graph,updatedAt:stamp,nodes:graph.nodes.map(n=>n.id===id?{...n,parentId:graph.rootId,free:true,updatedAt:stamp}:n)});
}
