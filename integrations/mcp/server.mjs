#!/usr/bin/env node
// Thenvio MCP over stdio — for Claude Desktop, Claude Code, Cursor and other local MCP clients.
//   node integrations/mcp/server.mjs [--brain <folder>]   (default folder: $THENVIO_BRAIN or ~/thenvio-brain)
// The chat model does the thinking on the person's own subscription; no API keys, no network.
import readline from 'node:readline';
import {readFileSync} from 'node:fs';
import {handleRequest} from './handler.mjs';
import {createBrainStore,defaultBrainDir} from '../brain-store.mjs';

const at=process.argv.indexOf('--brain');
const store=createBrainStore(at>0?process.argv[at+1]:defaultBrainDir());
store.url=process.env.THENVIO_URL||'http://localhost:4173';
const ctx={store,uiHtml:readFileSync(new URL('../../web/mcp-app.html',import.meta.url),'utf8')};
const out=msg=>{if(msg)process.stdout.write(JSON.stringify(msg)+'\n');};
let queue=Promise.resolve();
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{
  if(line.length>2_000_000){out({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Request too large'}});return;}
  let req;try{req=JSON.parse(line);}catch{out({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});return;}
  queue=queue.then(()=>handleRequest(req,ctx)).then(out,e=>out({jsonrpc:'2.0',id:req?.id??null,error:{code:-32603,message:e.message}}));
});
