// When the canvas is served by `npm start`, it talks to the local Thenvio server (same origin only):
// canvases are saved into the shared-brain folder on every change, and changes made by Claude or
// ChatGPT through MCP arrive live over Server-Sent Events. Static hosting simply skips this.
const H={'x-thenvio':'1'};
const BRAIN_ID=/^[A-Za-z0-9_-]{22,64}$/;
const ID_KEY='thenvio-brain-id';
export const isCloud=()=>!!document.querySelector('meta[name="thenvio-cloud"]');
// The personal brain id: from a link opened from the chat (?brain=), else remembered in this browser.
export function cloudBrainId(){
 const fromLink=new URLSearchParams(location.search).get('brain');
 try{
  if(fromLink&&BRAIN_ID.test(fromLink)){localStorage.setItem(ID_KEY,fromLink);return fromLink;}
  const saved=localStorage.getItem(ID_KEY);return saved&&BRAIN_ID.test(saved)?saved:null;
 }catch{return fromLink&&BRAIN_ID.test(fromLink)?fromLink:null;}
}
export function createCloudBrainId(){
 const bytes=crypto.getRandomValues(new Uint8Array(18));
 const id=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 try{localStorage.setItem(ID_KEY,id);}catch{}
 return id;
}
export function forgetCloudBrain(){try{localStorage.removeItem(ID_KEY);}catch{}}
export function cloudInfo(id){return {dir:'Thenvio cloud',cloud:true,id,base:'/api/b/'+id,connector:location.origin+'/mcp/'+id,canvases:[]};}
export async function detectLocalBrain(){
 if(!document.querySelector('meta[name="thenvio-local"]'))return null;
 try{const r=await fetch('/api/brain',{headers:H});if(!r.ok)return null;const info=await r.json();return info&&info.dir?info:null;}catch{return null;}
}
export function createLocalBrain(info,{merge,status=()=>{}}){
 const base=info.base||'/api';
 const timers=new Map(),dirty=new Set();let source=null,lastSaved=null,error='',version=-1,poll=null;
 const emit=()=>status({mode:error?'error':dirty.size?'saving':'synced',dir:info.dir,savedAt:lastSaved,error});
 async function pull(){
  const r=await fetch(base+'/canvases',{headers:H});
  if(!r.ok)throw Error('Brain: '+r.status);
  const body=await r.json();const canvases=body.canvases;if(body.version!==undefined)version=body.version;
  merge(canvases.filter(g=>!dirty.has(g.id)));
 }
 async function push(graph){
  try{
   const r=await fetch(base+'/canvases/'+encodeURIComponent(graph.id),{method:'PUT',headers:{...H,'content-type':'application/json'},body:JSON.stringify(graph)});
   if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||String(r.status));
   lastSaved=new Date();error='';
  }catch(e){error=e.message;}
  finally{dirty.delete(graph.id);emit();}
 }
 return {
  info,
  async start(){
   await pull();
   if(info.cloud){
    // Cloud: poll a cheap version counter; pull canvases only when it changes. Paused in background tabs.
    poll=setInterval(async()=>{
     if(document.visibilityState!=='visible')return;
     try{const r=await fetch(base+'/version',{headers:H});const {version:v}=await r.json();if(v!==version)await pull();}catch(e){error=e.message;emit();}
    },3000);
   }else{
    source=new EventSource('/api/events');
    source.addEventListener('change',()=>pull().catch(e=>{error=e.message;emit();}));
   }
   emit();
  },
  schedule(graph){
   dirty.add(graph.id);emit();
   clearTimeout(timers.get(graph.id));
   timers.set(graph.id,setTimeout(()=>push(graph),500));
  },
  stop(){clearInterval(poll);source?.close();},
  async context(){if(info.cloud)return [];try{const r=await fetch('/api/context',{headers:H});return r.ok?(await r.json()).context:[];}catch{return [];}}
 };
}
