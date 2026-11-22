// Calls Claude with the person's OWN API key, straight from the browser, only on an explicit click.
// The key lives in this tab's memory only (never stored, never in the bundle, never sent anywhere else).
// Raw fetch instead of the Anthropic SDK: this app is a dependency-free static client with a
// script-src 'self' policy, so no SDK bundle can be loaded.
import {thinkRequest,parseThinkResult} from './core/think.mjs';

let apiKey='';
export const hasKey=()=>!!apiKey;
export function setKey(value){apiKey=String(value||'').trim();}
export function forgetKey(){apiKey='';}

export async function runThink(graph,options,{signal}={}){
 if(!apiKey)throw Error('NO_KEY');
 const body={...thinkRequest(graph,options),fallbacks:'default'};
 const res=await fetch('https://api.anthropic.com/v1/messages',{
  method:'POST',signal,
  headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2026-10-21',
   'anthropic-beta':'server-side-fallback-2026-07-01','anthropic-dangerous-direct-browser-access':'true'},
  body:JSON.stringify(body)
 });
 let data=null;try{data=await res.json();}catch{}
 if(!res.ok){
  const msg=data?.error?.message||res.statusText;
  const err=Error(res.status===401?'BAD_KEY':res.status===429?'RATE_LIMIT':msg);err.status=res.status;throw err;
 }
 if(data.stop_reason==='refusal')throw Error('REFUSAL');
 if(data.stop_reason==='max_tokens')throw Error('TOO_LONG');
 const text=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
 return {result:parseThinkResult(text),model:data.model,usage:data.usage};
}
