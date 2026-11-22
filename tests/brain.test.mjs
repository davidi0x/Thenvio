import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {makeIdea,addIdeaBranch,updateIdeaBranch,validateIdeaGraph} from '../core/idea-graph.mjs';
import {prepareBoard,addBoardNode} from '../core/board.mjs';
import {canvasToMarkdown,markdownToCanvas,brainFiles,readBrain,scaffoldFiles,canvasPath,slugify,stableHash,BRAIN_FOLDERS,IDEAS_DIR} from '../core/brain.mjs';
import {zipFiles,crc32} from '../core/zip.mjs';
import {SKILLS,skillMarkdown} from '../core/skills.mjs';
import {analyzeFutures} from '../core/futures.mjs';

function sample(){
 let g=prepareBoard(makeIdea('Aplikacja do poznawania ludzi'));
 g=updateIdeaBranch(g,g.rootId,{description:'Kontekst\n\ndruga linia'});
 const add=(p,title,kind,extra)=>{g=addIdeaBranch(g,p,{title,kind});const id=g.nodes.at(-1).id;if(extra)g=updateIdeaBranch(g,id,extra);return id;};
 const a=add(g.rootId,'Małe grupy','direction',{impact:4,effort:2,description:'Dlaczego: łatwiej'});
 const b=add(g.rootId,'Duży event','direction',{impact:2,effort:4});
 const c=add(a,'Ludzie wracają co tydzień','assumption',{status:'supported',evidence:'7/10 wróciło\nźródło: pilot'});
 add(c,'Decyzja: małe grupy','insight');
 g={...g,links:[{from:a,to:b,type:'conflicts'}]};
 g=addBoardNode(g,{title:'Kto płaci?',kind:'question',x:100,y:100}).graph;
 return {g:prepareBoard(g),a,b,c};
}
// Same meaning: same notes, fields, links — ignoring order and timestamps.
const meaning=g=>JSON.stringify({id:g.id,rootId:g.rootId,title:g.title,
 nodes:g.nodes.map(n=>({id:n.id,parentId:n.parentId,title:n.title,description:n.description,kind:n.kind,status:n.status,evidence:n.evidence,
  x:n.x,y:n.y,free:n.free===true,impact:n.impact,effort:n.effort})).sort((a,b)=>a.id<b.id?-1:1),
 links:[...g.links].sort((a,b)=>(a.from+a.to)<(b.from+b.to)?-1:1)});

test('a canvas survives the trip to plain-text Markdown and back',()=>{
 const {g}=sample();
 const md=canvasToMarkdown(g);
 assert.match(md,/^---\nthenvio: canvas/);
 assert.match(md,/- \[opcja\] Małe grupy <!-- id=/,'Polish canvases use Polish kind words');
 assert.match(md,/\[założenie · potwierdzone\]/);
 assert.match(md,/> \*\*Dowód:\*\* 7\/10 wróciło/);
 assert.match(md,/## Luźne notatki/);
 assert.match(md,/· wyklucza <!-- from=/);
 const back=markdownToCanvas(md);
 assert.deepEqual(validateIdeaGraph(back),[]);
 assert.equal(meaning(back),meaning(g));
 assert.equal(canvasToMarkdown(back),md,'serialising is stable');
 assert.equal(markdownToCanvas(canvasToMarkdown(g,{locale:'en'})).nodes.length,g.nodes.length);
 assert.match(canvasToMarkdown(g,{locale:'en'}),/\[assumption · supported\]/);
});

test('hand- or agent-written Markdown becomes a canvas: kinds, nesting, ratings and links',()=>{
 const md=[
  '# Coffee payments',
  '> For small cafes.',
  '',
  '- [option] Pay at the counter <!-- impact=4 effort=2 -->',
  '  - Baristas will accept a new terminal',
  '    > **Evidence:** 2 of 6 cafes said yes',
  '  - [test · exploring] Pilot in 3 cafes; success if 2 keep it',
  '- Order ahead',
  '  - What would make this fail?',
  '',
  '## Loose notes',
  '- People want to pay by phone',
  '',
  '## Connections',
  '- Pay at the counter → Order ahead · conflicts',
  '- Nonexistent → Order ahead · supports'
 ].join('\n');
 const g=markdownToCanvas(md);
 const by=t=>g.nodes.find(n=>n.title===t);
 assert.equal(g.title,'Coffee payments');
 assert.equal(g.nodes.find(n=>n.id===g.rootId).description,'For small cafes.');
 assert.equal(by('Pay at the counter').kind,'direction');
 assert.equal(by('Pay at the counter').impact,4);
 assert.equal(by('Baristas will accept a new terminal').kind,'direction','no tag and no cue keeps the option default');
 assert.equal(by('Baristas will accept a new terminal').evidence,'2 of 6 cafes said yes');
 assert.equal(by('Pilot in 3 cafes; success if 2 keep it').kind,'experiment');
 assert.equal(by('Pilot in 3 cafes; success if 2 keep it').status,'exploring');
 assert.equal(by('What would make this fail?').kind,'question','missing kind is inferred from the words');
 assert.equal(by('What would make this fail?').parentId,by('Order ahead').id);
 assert.equal(by('People want to pay by phone').free,true);
 assert.equal(by('People want to pay by phone').kind,'assumption');
 assert.deepEqual(g.links,[{from:by('Pay at the counter').id,to:by('Order ahead').id,type:'conflicts'}],'unresolvable links are dropped');
 assert.ok(g.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)),'notes without positions are laid out');
 assert.equal(markdownToCanvas(md).id,g.id,'ids are deterministic for the same text');
 assert.ok(analyzeFutures(g).forks.length>=1,'an agent-written canvas can be scanned for futures');
});

test('broken or hostile input fails safely',()=>{
 assert.throws(()=>markdownToCanvas(null));
 const odd=markdownToCanvas('no heading at all\n- [weird-kind] Something <!-- id=../../etc x=-5 impact=99 -->');
 const n=odd.nodes.find(x=>x.title==='Something');
 assert.match(n.id,/^n_/,'unsafe ids are replaced');
 assert.equal(n.impact,undefined,'out-of-range ratings are ignored');
 assert.deepEqual(validateIdeaGraph(odd),[]);
 const dupes=markdownToCanvas('# A\n- One <!-- id=same -->\n- Two <!-- id=same -->');
 assert.equal(new Set(dupes.nodes.map(x=>x.id)).size,dupes.nodes.length);
 const huge='# Big\n'+Array.from({length:401},(_,i)=>'- Note '+i).join('\n');
 assert.throws(()=>markdownToCanvas(huge),/400/);
});

test('the brain has the shared layout: how-we-work, product-data, brand, skills',()=>{
 const {g}=sample();
 const files=brainFiles([g],{locale:'pl'});
 const paths=files.map(f=>f.path);
 for(const folder of BRAIN_FOLDERS)assert.ok(paths.some(p=>p.startsWith(folder.path)),folder.path);
 for(const p of ['README.md','AGENTS.md','CLAUDE.md','product-data/assumptions.md'])assert.ok(paths.includes(p),p);
 assert.ok(paths.includes(canvasPath(g)));
 assert.ok(canvasPath(g).startsWith(IDEAS_DIR));
 assert.equal(paths.filter(p=>/^skills\/[^/]+\/SKILL\.md$/.test(p)).length,24);
 assert.equal(new Set(paths).size,paths.length,'no duplicate paths');
 assert.ok(paths.some(p=>p.startsWith('product-data/decisions/')),'recorded decisions get their own file');
 const assumptions=files.find(f=>f.path==='product-data/assumptions.md').content;
 assert.match(assumptions,/Ludzie wracają co tydzień \| potwierdzone \| 7\/10 wróciło źródło: pilot/);
 assert.ok(files.filter(f=>f.owner==='team').every(f=>!f.canvasId),'scaffold files belong to the team');
 assert.equal(readBrain(files).canvases.length,1);
 const keep=brainFiles([g],{paths:{[g.id]:'product-data/ideas/renamed-by-team.md'}});
 assert.ok(keep.some(f=>f.path==='product-data/ideas/renamed-by-team.md'),'an existing file name is kept');
});

test('scaffold docs never invent facts and tell agents the rules',()=>{
 const files=scaffoldFiles({locale:'en'});
 const agents=files.find(f=>f.path==='AGENTS.md').content;
 assert.match(agents,/Never invent customers, quotes, metrics/);
 assert.match(agents,/without explicit human approval/);
 assert.match(files.find(f=>f.path==='brand/README.md').content,/Nothing in this folder is generated or invented/);
 assert.match(files.find(f=>f.path==='product-data/README.md').content,/Canvas file format/);
 assert.match(scaffoldFiles({locale:'pl'}).find(f=>f.path==='README.md').content,/Wspólny mózg/);
});

test('readBrain only reads canvas files and reports bad ones without failing',()=>{
 const {g}=sample();
 const r=readBrain([
  {path:canvasPath(g),content:canvasToMarkdown(g)},
  {path:'product-data/ideas/broken.md',content:'# '+'x'.repeat(10)+'\n'+Array.from({length:401},(_,i)=>'- n'+i).join('\n')},
  {path:'brand/README.md',content:'# Brand'},
  {path:'product-data/ideas/nested/deep.md',content:'# Nested'}
 ]);
 assert.equal(r.canvases.length,1);
 assert.equal(r.errors.length,1);
 assert.equal(r.paths[g.id],canvasPath(g));
});

test('every skills/*/SKILL.md equals the catalog, so folders and catalog stay in sync',()=>{
 const folders=readdirSync(new URL('../skills/',import.meta.url),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
 assert.deepEqual(folders,SKILLS.map(s=>s.id).sort());
 for(const s of SKILLS)assert.equal(readFileSync(new URL('../skills/'+s.id+'/SKILL.md',import.meta.url),'utf8'),skillMarkdown(s.id),s.id);
});

test('the brain zip is a valid archive that standard tools can open',()=>{
 const files=brainFiles([sample().g]);
 const zip=zipFiles(files,{prefix:'shared-brain/'});
 assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926,'CRC-32 check value');
 assert.deepEqual(zipFiles(files),zipFiles(files),'deterministic bytes');
 assert.throws(()=>zipFiles([{path:'../escape.txt',content:'x'}]));
 const py=spawnSync('python3',['-c','import sys,zipfile,io;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert z.testzip() is None;print(len(z.namelist()));print(z.read("shared-brain/AGENTS.md").decode()[:13])'],{input:Buffer.from(zip)});
 if(py.error||py.status===null)return; // python3 not available: CRC check above still ran
 assert.equal(py.status,0,String(py.stderr));
 const [count,head]=String(py.stdout).trim().split('\n');
 assert.equal(Number(count),files.length);
 assert.equal(head,'# Agent guide');
});

test('slugs and hashes are stable and file-system safe',()=>{
 assert.equal(slugify('Żółć — Łódź & co!'),'zolc-lodz-co');
 assert.equal(slugify('   '),'idea');
 assert.equal(stableHash('abc'),stableHash('abc'));
 assert.notEqual(stableHash('abc'),stableHash('abd'));
 assert.ok(existsSync(new URL('../core/brain.mjs',import.meta.url)));
});
