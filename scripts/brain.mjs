#!/usr/bin/env node
// Thenvio shared brain CLI. Local files only: no network, no git commands, nothing is deleted.
//   node scripts/brain.mjs init <dir> [--lang=pl]          create the brain layout (existing files are kept)
//   node scripts/brain.mjs export <export.json> <dir>        write canvases from a Thenvio JSON export
//   node scripts/brain.mjs scan <dir> [--lang=pl]           futures and next moves for every canvas
import {mkdir,readFile,writeFile,readdir,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {readIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard} from '../core/board.mjs';
import {scaffoldFiles,brainFiles,readBrain,IDEAS_DIR} from '../core/brain.mjs';
import {analyzeFutures,confidenceLabel} from '../core/futures.mjs';
import {coachGraph} from '../core/coach.mjs';

const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const lang=(process.argv.find(a=>a.startsWith('--lang='))||'--lang=en').split('=')[1]==='pl'?'pl':'en';
const [command,...rest]=args;
const exists=p=>access(p).then(()=>true,()=>false);
function usage(){
 console.log('Usage:\n  node scripts/brain.mjs init <dir> [--lang=pl]\n  node scripts/brain.mjs export <thenvio-export.json> <dir>\n  node scripts/brain.mjs scan <dir> [--lang=pl]');
 process.exit(1);
}
async function write(dir,files){
 let created=0,updated=0,kept=0;
 for(const f of files){
  const target=resolve(dir,f.path);
  if(!target.startsWith(resolve(dir)+'/'))throw Error('Refusing to write outside the brain: '+f.path);
  const present=await exists(target);
  if(present&&f.owner!=='thenvio'){kept++;continue;}
  if(present&&await readFile(target,'utf8')===f.content){kept++;continue;}
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,f.content);
  present?updated++:created++;
 }
 return {created,updated,kept};
}
async function canvasesIn(dir){
 const folder=join(dir,IDEAS_DIR);
 const names=(await exists(folder))?(await readdir(folder)).filter(n=>n.endsWith('.md')):[];
 const files=await Promise.all(names.map(async n=>({path:IDEAS_DIR+n,content:await readFile(join(folder,n),'utf8')})));
 return readBrain(files);
}
if(command==='init'){
 const dir=rest[0];if(!dir)usage();
 const r=await write(dir,[...scaffoldFiles({locale:lang}),{path:IDEAS_DIR+'.gitkeep',content:'',owner:'team'},{path:'product-data/decisions/.gitkeep',content:'',owner:'team'}]);
 console.log('Shared brain ready in '+resolve(dir)+' — '+r.created+' created, '+r.kept+' kept.');
 console.log('Next: cd '+dir+' && git init && git add . && git commit -m "Shared brain" — then push it to a private GitHub repository.');
}else if(command==='export'){
 const [file,dir]=rest;if(!file||!dir)usage();
 const data=JSON.parse(await readFile(file,'utf8'));
 const graphs=(data?.format==='thenvio-ideas-collection-v1'?data.graphs:[data]).map(readIdeaGraph).map(prepareBoard);
 const {paths}=await canvasesIn(dir);
 const r=await write(dir,brainFiles(graphs,{locale:lang,paths}));
 console.log('Wrote '+graphs.length+' canvas(es) to '+resolve(dir)+' — '+r.created+' created, '+r.updated+' updated, '+r.kept+' unchanged or kept.');
}else if(command==='scan'){
 const dir=rest[0];if(!dir)usage();
 const {canvases,errors}=await canvasesIn(dir);
 if(!canvases.length&&!errors.length)console.log('No canvases in '+join(dir,IDEAS_DIR)+' yet.');
 for(const g of canvases){
  const f=analyzeFutures(g,{locale:lang});
  console.log('\n# '+g.title);
  console.log('  futures: '+f.total+' ('+f.viable+' viable, '+f.blocked+' blocked)');
  if(f.winner)console.log('  best route ('+f.winner.score+'/100, '+confidenceLabel(f.winner.confidence,lang)+'): '+(f.winner.choices.map(c=>c.optionTitle).join(' → ')||'—'));
  if(f.weakest)console.log('  weakest link: '+f.weakest.title);
  console.log('  next: '+f.nextMove.title);
  for(const m of coachGraph(g,{locale:lang,futures:f,limit:3}))console.log('  · '+m.title);
 }
 for(const e of errors)console.log('\n! '+e.path+': '+e.message);
 if(canvases.length)console.log('\n'+analyzeFutures(canvases[0],{locale:lang}).disclaimer);
}else usage();
