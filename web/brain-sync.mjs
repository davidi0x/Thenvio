// Shared brain sync: keeps canvases in a local folder (your clone of the brain repo) as plain text.
// Only touches a folder the person picked; never deletes; never talks to the network.
// Committing and pushing to GitHub stays the person's own action.
import {brainFiles,readBrain,IDEAS_DIR} from './core/brain.mjs';
import {zipFiles} from './core/zip.mjs';

const DB='thenvio-brain',STORE='handles';
function idb(mode,fn){
 return new Promise((resolve,reject)=>{
  let open;try{open=indexedDB.open(DB,1);}catch(e){reject(e);return;}
  open.onupgradeneeded=()=>open.result.createObjectStore(STORE);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{try{const tx=open.result.transaction(STORE,mode);const req=fn(tx.objectStore(STORE));tx.oncomplete=()=>resolve(req?.result);tx.onerror=tx.onabort=()=>reject(tx.error);}catch(e){reject(e);}};
 });
}
const remember=handle=>idb('readwrite',s=>s.put(handle,'brain')).catch(()=>{});
const recall=()=>idb('readonly',s=>s.get('brain')).catch(()=>null);
const forget=()=>idb('readwrite',s=>s.delete('brain')).catch(()=>{});

async function dirFor(root,parts,create){let d=root;for(const p of parts)d=await d.getDirectoryHandle(p,{create});return d;}
async function readText(root,path){
 const parts=path.split('/'),name=parts.pop();
 try{const file=await (await (await dirFor(root,parts,false)).getFileHandle(name)).getFile();return {content:await file.text(),lastModified:file.lastModified};}
 catch{return null;}
}
async function writeText(root,path,content){
 const parts=path.split('/'),name=parts.pop();
 const handle=await (await dirFor(root,parts,true)).getFileHandle(name,{create:true});
 const w=await handle.createWritable();await w.write(content);await w.close();
}

// getGraphs(): canvases to save; merge(canvases, meta): apply canvases read from the brain;
// status(state): UI callback. locale(): 'en' | 'pl'.
export function createBrainSync({getGraphs,merge,status=()=>{},locale=()=>'en'}){
 const state={supported:typeof window!=='undefined'&&'showDirectoryPicker' in window,handle:null,name:'',mode:'off',savedAt:null,error:'',files:0};
 const written=new Map();let paths={},timer=null,busy=null;
 const emit=()=>status({...state});
 async function load(){
  const ideas=await dirFor(state.handle,IDEAS_DIR.replace(/\/$/,'').split('/'),true);
  const files=[];
  for await (const [name,entry] of ideas.entries()){
   if(entry.kind!=='file'||!name.endsWith('.md'))continue;
   const file=await entry.getFile();
   files.push({path:IDEAS_DIR+name,content:await file.text(),lastModified:file.lastModified});
  }
  const r=readBrain(files);
  paths={...paths,...r.paths};
  const meta=Object.fromEntries(files.map(f=>[f.path,f]));
  for(const [id,path] of Object.entries(r.paths))written.set(path,meta[path].content);
  merge(r.canvases.map(g=>({graph:g,content:meta[r.paths[g.id]].content,lastModified:meta[r.paths[g.id]].lastModified})));
  return r;
 }
 async function save(){
  if(!state.handle||state.mode==='reconnect')return;
  if(busy)return busy.then(save);
  busy=(async()=>{
   state.mode='saving';emit();
   try{
    const files=brainFiles(getGraphs(),{locale:locale(),paths});
    let changed=0;
    for(const f of files){
     if(f.owner==='team'){
      if(written.has(f.path))continue;
      if(await readText(state.handle,f.path)){written.set(f.path,f.content);continue;}
     }else if(written.get(f.path)===f.content)continue;
     await writeText(state.handle,f.path,f.content);written.set(f.path,f.content);changed++;
    }
    for(const f of files)if(f.canvasId)paths[f.canvasId]=f.path;
    state.files=files.length;state.savedAt=new Date();state.mode='synced';state.error='';
    return changed;
   }catch(e){state.mode='error';state.error=e.message||String(e);}
   finally{busy=null;emit();}
  })();
  return busy;
 }
 async function attach(handle){
  state.handle=handle;state.name=handle.name;written.clear();paths={};
  try{const r=await load();await save();return r;}
  catch(e){state.mode='error';state.error=e.message||String(e);emit();throw e;}
 }
 return {
  state:()=>({...state}),
  async connect(){
   const handle=await window.showDirectoryPicker({id:'thenvio-brain',mode:'readwrite'});
   await remember(handle);
   return attach(handle);
  },
  // On start: reuse the folder picked last time if the browser still grants access.
  async restore(){
   if(!state.supported)return;
   const handle=await recall();if(!handle)return;
   state.handle=handle;state.name=handle.name;
   const perm=await handle.queryPermission?.({mode:'readwrite'});
   if(perm==='granted')await attach(handle).catch(()=>{});
   else{state.mode='reconnect';emit();}
  },
  async reconnect(){
   if(!state.handle)return this.connect();
   const perm=await state.handle.requestPermission({mode:'readwrite'});
   if(perm!=='granted')throw Error('Folder access was not granted.');
   return attach(state.handle);
  },
  async disconnect(){await forget();Object.assign(state,{handle:null,name:'',mode:'off',savedAt:null,error:'',files:0});written.clear();paths={};emit();},
  // Pick up edits made outside Thenvio (a teammate's pull, an agent's change) when the tab regains focus.
  async refresh(){if(state.handle&&state.mode==='synced'){try{await load();}catch(e){state.mode='error';state.error=e.message||String(e);emit();}}},
  schedule(){if(!state.handle||state.mode==='reconnect')return;clearTimeout(timer);timer=setTimeout(save,900);},
  save,
  files(){return brainFiles(getGraphs(),{locale:locale(),paths});},
  download(){
   const bytes=zipFiles(brainFiles(getGraphs(),{locale:locale(),paths}),{prefix:'shared-brain/'});
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
   const a=document.createElement('a');a.href=url;a.download='shared-brain-'+new Date().toISOString().slice(0,10)+'.zip';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  },
  // Fallback for browsers without folder access: read a picked folder (input webkitdirectory) once.
  async importFiles(fileList){
   const files=[];
   for(const file of fileList){
    const rel=(file.webkitRelativePath||file.name).split('/');
    const at=rel.indexOf('product-data');
    const path=at>=0?rel.slice(at).join('/'):IDEAS_DIR+file.name;
    if(path.startsWith(IDEAS_DIR)&&path.endsWith('.md')&&file.size<2_000_000)files.push({path,content:await file.text(),lastModified:file.lastModified});
   }
   const r=readBrain(files);
   const meta=Object.fromEntries(files.map(f=>[f.path,f]));
   merge(r.canvases.map(g=>({graph:g,content:meta[r.paths[g.id]].content,lastModified:meta[r.paths[g.id]].lastModified})));
   return r;
  }
 };
}
