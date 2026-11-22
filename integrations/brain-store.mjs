// File-backed shared brain for the local server and the MCP server (Node only).
// Every call reads the folder fresh, so several processes (the localhost app, a stdio MCP server
// started by Claude Desktop, a git pull) can share one folder. Nothing is ever deleted.
import {mkdir,readFile,writeFile,readdir,access,stat} from 'node:fs/promises';
import {watch} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {makeIdea,assertIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {brainFiles,readBrain,scaffoldFiles,IDEAS_DIR,canvasToMarkdown} from '../core/brain.mjs';
import {detectLocale} from '../core/coach.mjs';

const exists=p=>access(p).then(()=>true,()=>false);
export function defaultBrainDir(){return resolve(process.env.THENVIO_BRAIN||join(homedir(),'thenvio-brain'));}

export function createBrainStore(dir=defaultBrainDir()){
 const root=resolve(dir);
 const inside=p=>{const full=resolve(root,p);if(!full.startsWith(root+'/'))throw Error('Path outside the brain: '+p);return full;};
 async function writeIfChanged(path,content){
  const full=inside(path);
  if(await exists(full)&&await readFile(full,'utf8')===content)return false;
  await mkdir(dirname(full),{recursive:true});await writeFile(full,content);return true;
 }
 async function ensure(locale='en'){
  await mkdir(join(root,IDEAS_DIR),{recursive:true});
  for(const f of scaffoldFiles({locale}))if(!await exists(inside(f.path))){await mkdir(dirname(inside(f.path)),{recursive:true});await writeFile(inside(f.path),f.content);}
 }
 async function files(){
  const folder=join(root,IDEAS_DIR);
  if(!await exists(folder))return [];
  const out=[];
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('.md')).sort()){
   const full=join(folder,name);
   out.push({path:IDEAS_DIR+name,content:await readFile(full,'utf8'),lastModified:(await stat(full)).mtimeMs});
  }
  return out;
 }
 async function load(){const f=await files();return {...readBrain(f),files:f};}
 async function context(){
  const out=[];
  for(const path of ['AGENTS.md','how-we-work/README.md','brand/README.md']){const full=inside(path);if(await exists(full))out.push({path,content:await readFile(full,'utf8')});}
  return out;
 }
 async function list(){
  const {canvases,paths}=await load();
  return canvases.map(g=>({id:g.id,title:g.title,notes:g.nodes.length,updatedAt:g.updatedAt,path:paths[g.id]}));
 }
 async function find(ref){
  const {canvases,paths}=await load();
  if(!ref){
   const latest=[...canvases].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];
   if(!latest)throw Error('The brain has no canvases yet. Create one first.');
   return {graph:latest,path:paths[latest.id]};
  }
  const s=String(ref).toLowerCase().trim();
  const hit=canvases.find(g=>g.id===ref)||canvases.find(g=>g.title.toLowerCase()===s)||canvases.find(g=>g.title.toLowerCase().includes(s));
  if(!hit)throw Error('No canvas matches "'+ref+'". Available: '+(canvases.map(g=>g.title).join('; ')||'none'));
  return {graph:hit,path:paths[hit.id]};
 }
 // Save one canvas plus the generated product data; team files are only created when missing.
 async function save(graph){
  assertIdeaGraph(graph);
  const {canvases,paths}=await load();
  const all=[...canvases.filter(g=>g.id!==graph.id),graph];
  const locale=detectLocale(graph.nodes.map(n=>n.title).join(' '),'en');
  await ensure(locale);
  let changed=0;
  for(const f of brainFiles(all,{locale,paths})){
   if(f.owner==='team')continue;
   if(f.canvasId&&f.canvasId!==graph.id)continue;
   if(await writeIfChanged(f.path,f.content))changed++;
  }
  return {changed,path:paths[graph.id]||brainFiles([graph],{locale}).find(f=>f.canvasId===graph.id).path};
 }
 async function create(title){
  const g=prepareBoard(makeIdea(String(title||'Untitled idea').slice(0,150)));
  await save(g);return g;
 }
 // Notify on any change in the ideas folder (debounced); used for live updates in the browser.
 function onChange(fn){
  let timer=null,w=null;
  mkdir(join(root,IDEAS_DIR),{recursive:true}).then(()=>{
   try{w=watch(join(root,IDEAS_DIR),()=>{clearTimeout(timer);timer=setTimeout(fn,150);});}catch{}
  });
  return ()=>{clearTimeout(timer);w?.close();};
 }
 return {dir:root,ensure,load,list,find,save,create,context,onChange,markdown:canvasToMarkdown};
}
