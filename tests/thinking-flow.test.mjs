import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('core idea UX is a one-tap contextual thinking flow',async()=>{
 const html=await load('web/index.html');
 const flow=await load('web/idea-flow.mjs');
 const explorer=await load('web/idea-explorer.mjs');
 const first=html.indexOf('id="view-branches"'),analysis=html.indexOf('id="view-overview"');
 assert.ok(first>0&&first<analysis);
 for(const id of ['ideaSuggestList','ideaFlowTitle','ideaMore','ideaAddAll','ideaQuickForm','ideaOwnInput','ideaAiResponse','ideaCopyPrompt','ideaImportAi','ideaOpenFlow','ideaSheetBackdrop','ideaSheetClose'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const mode of ['explore','answer','challenge','test'])
  assert.match(html,new RegExp('data-think="'+mode+'"'));
 assert.match(flow,/function sendSuggestion/);
 assert.match(flow,/function addVisible/);
 assert.match(flow,/applyThoughts/);
 assert.match(flow,/parseBrainstormResponse/);
 assert.match(flow,/brainstormPrompt/);
 assert.match(explorer,/const seeds=thinkNext/);
 assert.match(explorer,/initIdeaFlow/);
 assert.match(explorer,/flow\.render\(\)/);
});

test('one-tap mobile drawer remains accessible and does not interfere with panning',async()=>{
 const html=await load('web/index.html');
 const css=await load('web/ideas.css');
 const explorer=await load('web/idea-explorer.mjs');
 const flow=await load('web/idea-flow.mjs');
 assert.match(html,/id="ideaSheetClose"/);
 assert.match(flow,/function sheetOpen/);
 assert.match(flow,/function sheetClose/);
 assert.match(flow,/body\.classList\.add\('idea-sheet-locked'\)/);
 assert.match(explorer,/target\.closest\('\.ideas-node,button,input,textarea'\)/);
 assert.match(css,/\.ideas-inspector\.is-open/);
 assert.match(css,/@media\(max-width:690px\)/);
});

test('core and flow are bundled for CDN, local development and Cloudflare',async()=>{
 const build=await load('scripts/build.mjs');
 const worker=await load('scripts/cloudflare-worker.mjs');
 const html=await load('web/index.html');
 assert.match(build,/brainstorm\.mjs/);
 assert.match(worker,/core\/brainstorm\.mjs/);
 assert.match(worker,/idea-flow\.mjs/);
 const explorer=await load('web/idea-explorer.mjs');
 assert.match(explorer,/from '\.\/idea-flow\.mjs'/);
});
