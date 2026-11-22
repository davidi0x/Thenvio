// Freeform canvas coordinates are stored WITH the existing idea graph.
// Older graphs without x/y remain readable; no breaking schema migration.
import {assertIdeaGraph,layoutIdeaGraph,addIdeaBranch} from './idea-graph.mjs';
export const BOARD_W=5200,BOARD_H=4200;
export const CARD_W=224,CARD_H=104;
const valid=(n)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=20000;
export function prepareBoard(graph){
 assertIdeaGraph(graph);
 const layout=layoutIdeaGraph(graph,{cardWidth:CARD_W,cardHeight:CARD_H,gapX:78,stepY:165});
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
export function addBoardNode(graph,{title='New thought',parentId=graph.rootId,x,y,free=true,kind='direction'}={}){
 assertIdeaGraph(graph);
 if(!valid(x)||!valid(y))throw Error('Invalid canvas position');
 const next=addIdeaBranch(graph,parentId,{title,kind,description:''});
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
  if(nodeIds.has(link.from)&&nodeIds.has(link.to))edges.push({...link,type:'link'});
 }
 return edges;
}
