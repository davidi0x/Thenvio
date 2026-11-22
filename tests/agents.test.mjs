import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const canvas='# Coffee\n- [option] Counter <!-- impact=4 effort=2 -->\n  - [assumption] Baristas accept a terminal\n- [option] Order ahead <!-- impact=3 effort=3 -->\n';
function mcp(...calls){
 const input=calls.map((c,i)=>JSON.stringify({jsonrpc:'2.0',id:i+1,method:'tools/call',params:c})).join('\n')+'\n';
 const p=spawnSync(process.execPath,['integrations/mcp/server.mjs'],{input,encoding:'utf8',timeout:8000});
 assert.equal(p.status,0,p.stderr);
 return p.stdout.trim().split('\n').map(l=>JSON.parse(l).result);
}

test('agents can scan a shared-brain canvas over MCP, from Markdown or JSON',()=>{
 const [futures,moves,bad]=mcp(
  {name:'thenvio_futures',arguments:{canvas}},
  {name:'thenvio_next_moves',arguments:{canvas,locale:'pl'}},
  {name:'thenvio_futures',arguments:{canvas:42}}
 );
 assert.equal(futures.structuredContent.winner.choices[0].optionTitle,'Counter');
 assert.equal(futures.structuredContent.nextMove.code,'test');
 assert.match(futures.structuredContent.disclaimer,/not a probability/);
 assert.equal(futures.structuredContent.samples,undefined,'animation samples are not sent to agents');
 assert.ok(moves.structuredContent.moves.length>0);
 assert.match(moves.structuredContent.moves[0].title,/„/,'Polish output on request');
 assert.equal(bad.isError,true);
});

test('brain CLI creates the shared layout, keeps team files, exports and scans canvases',()=>{
 const dir=mkdtempSync(join(tmpdir(),'thenvio-brain-'));
 try{
  const run=(...a)=>spawnSync(process.execPath,['scripts/brain.mjs',...a],{encoding:'utf8',timeout:8000});
  let r=run('init',dir);
  assert.equal(r.status,0,r.stderr);
  for(const p of ['README.md','AGENTS.md','how-we-work/README.md','product-data/README.md','brand/README.md','skills/red-team/SKILL.md'])assert.ok(existsSync(join(dir,p)),p);
  writeFileSync(join(dir,'brand/README.md'),'# Our brand\nWritten by us.\n');
  r=run('init',dir);
  assert.match(r.stdout,/0 created/);
  assert.equal(readFileSync(join(dir,'brand/README.md'),'utf8'),'# Our brand\nWritten by us.\n','team files are never overwritten');
  writeFileSync(join(dir,'product-data/ideas/coffee.md'),canvas);
  r=run('scan',dir);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/# Coffee/);
  assert.match(r.stdout,/best route .*Counter/);
  assert.match(r.stdout,/weakest link: Baristas accept a terminal/);
  const exportFile=join(dir,'export.json');
  const graph=JSON.parse(spawnSync(process.execPath,['--input-type=module','-e',"import {makeIdea} from './core/idea-graph.mjs';process.stdout.write(JSON.stringify({format:'thenvio-ideas-collection-v1',graphs:[makeIdea('Exported idea')]}))"],{encoding:'utf8'}).stdout);
  writeFileSync(exportFile,JSON.stringify(graph));
  r=run('export',exportFile,dir);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/Wrote 1 canvas/);
  assert.match(run('scan',dir).stdout,/# Exported idea/);
  assert.notEqual(run('nonsense').status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
