#!/usr/bin/env node
// Explicit operator-only Cloudflare deployment; never logs tokens.
import {makeWorkerSource} from './cloudflare-worker.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const worker=process.env.CLOUDFLARE_WORKER_NAME||'thenvio-preview-v01';
if(!account||!/^[a-f0-9]{32}$/i.test(account)){console.error('Set CLOUDFLARE_ACCOUNT_ID.');process.exit(1);}
if(!token){console.error('Set CLOUDFLARE_API_TOKEN with Workers Edit permission.');process.exit(1);}
if(!/^[a-z0-9_][a-z0-9-_]{0,62}$/.test(worker)){console.error('Invalid worker name.');process.exit(1);}
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
const auth={Authorization:'Bearer '+token};
async function ok(response,label){
 const data=await response.json().catch(()=>({success:false,errors:[]}));
 if(!response.ok||!data.success)throw Error(label+' failed with status '+response.status+': '+(data.errors||[]).map(x=>x.message).join('; '));
 return data.result;
}
try{
 const source=await makeWorkerSource();
 const multipart=new FormData();
 multipart.append('metadata',new Blob([JSON.stringify({main_module:'worker.js',compatibility_date:'2026-11-22',bindings:[]})],{type:'application/json'}));
 multipart.append('worker.js',new Blob([source],{type:'application/javascript+module'}),'worker.js');
 await ok(await fetch(endpoint,{method:'PUT',headers:auth,body:multipart}),'Upload');
 await ok(await fetch(endpoint+'/subdomain',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})}),'Enable workers.dev');
 const domain=await ok(await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/subdomain',{headers:auth}),'Read subdomain');
 console.log('Published: https://'+worker+'.'+domain.subdomain+'.workers.dev/');
}catch(e){console.error(e.message);process.exitCode=1;}
