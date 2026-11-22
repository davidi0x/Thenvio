#!/usr/bin/env node
// Deploys Thenvio cloud (site + per-brain MCP connectors) as a Cloudflare Worker with a Durable Object.
//   CLOUDFLARE_API_TOKEN=... [CLOUDFLARE_ACCOUNT_ID=...] [CLOUDFLARE_WORKER_NAME=thenvio-preview-v01] npm run deploy:cloudflare
// Token needs: Workers Scripts Edit (and Account Settings Read if the account id is not given).
import {readFile,readdir} from 'node:fs/promises';
import {buildWorkerAssets} from './build-worker.mjs';

const API='https://api.cloudflare.com/client/v4';
const name=process.env.CLOUDFLARE_WORKER_NAME||'thenvio-preview-v01';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
const headers=token?{authorization:'Bearer '+token}:{};
async function cf(path,init={}){
 const res=await fetch(API+path,{...init,headers:{...headers,...(init.headers||{})}});
 const body=await res.json().catch(()=>({success:false,errors:[{message:'HTTP '+res.status}]}));
 if(!body.success){const err=Error((body.errors||[]).map(e=>e.message).join('; ')||'HTTP '+res.status);err.body=body;throw err;}
 return body.result;
}
const root=new URL('../',import.meta.url);
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID||(await cf('/accounts'))[0]?.id;
if(!accountId)throw Error('No Cloudflare account found for this token.');
const built=await buildWorkerAssets();
const modules=['integrations/cloud/worker.mjs','integrations/cloud/assets.mjs','integrations/mcp/handler.mjs','integrations/kv-brain-store.mjs',
 ...(await readdir(new URL('core/',root))).filter(f=>f.endsWith('.mjs')).map(f=>'core/'+f)];
async function upload(withMigration){
 const form=new FormData();
 const metadata={main_module:'integrations/cloud/worker.mjs',compatibility_date:'2026-11-01',
  bindings:[{type:'durable_object_namespace',name:'BRAIN',class_name:'Brain'}],
  ...(withMigration?{migrations:{new_tag:'v1',new_sqlite_classes:['Brain']}}:{})};
 form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 for(const m of modules)form.append(m,new Blob([await readFile(new URL(m,root))],{type:'application/javascript+module'}),m);
 return cf('/accounts/'+accountId+'/workers/scripts/'+name,{method:'PUT',body:form});
}
try{await upload(true);}
catch(e){
 // A later deploy: the Durable Object class already exists, so send no migration.
 if(!/migration|tag|already|exists/i.test(e.message))throw e;
 await upload(false);
}
await cf('/accounts/'+accountId+'/workers/scripts/'+name+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})});
const sub=(await cf('/accounts/'+accountId+'/workers/subdomain')).subdomain;
const url='https://'+name+'.'+sub+'.workers.dev';
console.log('Deployed '+modules.length+' modules ('+built.routes+' site files).');
console.log('Site:       '+url);
console.log('Connector:  '+url+'/mcp/<your-brain-id>  (create yours on the site: Think → Create my connector)');
