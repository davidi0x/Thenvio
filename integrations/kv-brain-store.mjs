// Shared brain on any async key-value storage (a Cloudflare Durable Object's storage, or a Map in tests).
// Same interface as the file-backed brain-store, so the MCP handler does not care where it runs.
// Keys: "canvas:<id>" -> canvas Markdown, "version" -> change counter for live sync.
import {makeIdea,assertIdeaGraph,readIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {canvasToMarkdown,markdownToCanvas,IDEAS_DIR} from '../core/brain.mjs';

export const KV_LIMITS=Object.freeze({canvases:50,bytes:1_500_000});
export function mapStorage(map=new Map()){
 return {async get(k){return map.get(k);},async put(k,v){map.set(k,v);},
  async list({prefix=''}={}){return new Map([...map].filter(([k])=>k.startsWith(prefix)));},map};
}
export function createKvBrainStore(storage,{url='',label='Thenvio cloud brain'}={}){
 async function load(){
  const entries=await storage.list({prefix:'canvas:'});
  const canvases=[],errors=[],paths={};
  for(const [key,md] of entries){
   try{const g=markdownToCanvas(md);canvases.push(g);paths[g.id]=IDEAS_DIR+key.slice(7)+'.md';}
   catch(e){errors.push({path:key,message:e.message});}
  }
  return {canvases,errors,paths};
 }
 async function version(){return (await storage.get('version'))||0;}
 async function save(graph){
  assertIdeaGraph(graph);
  const md=canvasToMarkdown(graph);
  if(md.length>KV_LIMITS.bytes)throw Error('Canvas is too large.');
  const key='canvas:'+graph.id;
  if(!(await storage.get(key))&&(await storage.list({prefix:'canvas:'})).size>=KV_LIMITS.canvases)throw Error('Maximum '+KV_LIMITS.canvases+' canvases per brain.');
  if(await storage.get(key)===md)return {changed:0,path:IDEAS_DIR+graph.id+'.md'};
  await storage.put(key,md);
  await storage.put('version',(await version())+1);
  return {changed:1,path:IDEAS_DIR+graph.id+'.md'};
 }
 const store={
  dir:label,url,load,save,version,
  async list(){const {canvases,paths}=await load();return canvases.map(g=>({id:g.id,title:g.title,notes:g.nodes.length,updatedAt:g.updatedAt,path:paths[g.id]}));},
  async find(ref){
   const {canvases,paths}=await load();
   if(!ref){
    const latest=[...canvases].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
    if(!latest)throw Error('The brain has no canvases yet. Create one with thenvio_new_canvas.');
    return {graph:latest,path:paths[latest.id]};
   }
   const s=String(ref).toLowerCase().trim();
   const hit=canvases.find(g=>g.id===ref)||canvases.find(g=>g.title.toLowerCase()===s)||canvases.find(g=>g.title.toLowerCase().includes(s));
   if(!hit)throw Error('No canvas matches "'+ref+'". Available: '+(canvases.map(g=>g.title).join('; ')||'none'));
   return {graph:hit,path:paths[hit.id]};
  },
  async create(title){const g=prepareBoard(makeIdea(String(title||'Untitled idea').slice(0,150)));await save(g);return g;},
  async context(){return [];},
  markdown:canvasToMarkdown,
  // Used by the web app: accepts a JSON idea graph.
  async putJson(text){const g=prepareBoard(readIdeaGraph(text));await save(g);return g;}
 };
 return store;
}
