import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,validate,stressTest,emptyProject,loadProject} from '../core/engine.mjs';
import {demoProject} from '../core/demo.mjs';
import {SKILLS,skillPrompt} from '../core/skills.mjs';
import {spawnSync} from 'node:child_process';
const fresh=()=>structuredClone(demoProject);
test('demo passes validation and scores are bounded',()=>{
 const p=fresh(),r=evaluate(p);
 assert.deepEqual(validate(p),[]);
 assert.equal(r.paths.length,4);
 assert.ok(r.paths.every(x=>x.score>=0&&x.score<=100));
 assert.ok(r.paths.find(x=>x.id===r.winners.recommended).feasible);
 assert.ok(r.paths.find(x=>x.id==='saas').blockers.length);
});
test('budget and timeline cuts invalidate expensive paths immediately',()=>{
 const p=fresh();p.budget=500;p.deadlineWeeks=3;
 const r=evaluate(p);
 assert.equal(r.winners.recommended,'manual');
 assert.equal(r.paths.find(x=>x.id==='mcp').feasible,false);
 assert.equal(r.paths.find(x=>x.id==='pilots').feasible,false);
});
test('rejected hypothesis blocks every linked path',()=>{
 const p=fresh();p.assumptions.find(x=>x.id==='a_pain').status='refuted';
 const r=evaluate(p);
 assert.ok(r.paths.find(x=>x.id==='mcp').blockers.some(x=>x.code==='refuted'));
 assert.ok(r.paths.find(x=>x.id==='manual').blockers.some(x=>x.code==='refuted'));
});
test('evidence gap penalty resolves only with supported source',()=>{
 const p=fresh(),before=evaluate(p).paths.find(x=>x.id==='mcp').score;
 const a=p.assumptions.find(x=>x.id==='a_tools');a.status='supported';
 assert.equal(evaluate(p).paths.find(x=>x.id==='mcp').score,before);
 a.source='Participant interview reference';
 assert.ok(evaluate(p).paths.find(x=>x.id==='mcp').score>before);
});
test('all blocked means no winner and no phantom recommendation',()=>{
 const p=fresh();p.budget=0;p.deadlineWeeks=1;
 const r=evaluate(p);assert.equal(r.winners.recommended,null);
 assert.ok(r.nextActions.some(x=>x.kind==='constraints'));
});
test('stress analysis is repeatable and side effect free',()=>{
 const p=fresh(),before=JSON.stringify(p),result=stressTest(p);
 assert.equal(result.cases.length,5);
 assert.equal(JSON.stringify(p),before);
 assert.ok(result.cases.some(x=>x.change.budget !== undefined && x.change.budget < p.budget));
 assert.ok(result.cases.every(x=>typeof x.changed === 'boolean' && Array.isArray(x.eligible)));
});
test('untrusted imports fail closed, no fake starter routes',()=>{
 const p=emptyProject('Choice','Goal',5000,8);
 assert.equal(evaluate(p).paths.length,0);
 assert.equal(loadProject(JSON.stringify(p)).title,'Choice');
 p.paths=[{id:'p',name:'Bad',cost:-1}];
 assert.ok(validate(p).length);
 assert.throws(()=>loadProject(p));
 assert.throws(()=>loadProject('{}'));
});
test('founder skill catalog is original and accessible',()=>{
 assert.equal(SKILLS.length,24);
 assert.match(skillPrompt('assumption-audit',demoProject),/ASSUMPTIONS/);
 assert.throws(()=>skillPrompt('nonsense'));
});
test('MCP tool and prompt transports respond with actual structured results',()=>{
 const input=[
  {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},
  {jsonrpc:'2.0',method:'notifications/initialized'},
  {jsonrpc:'2.0',id:2,method:'tools/list'},
  {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'thenvio_evaluate',arguments:{project:fresh()}}},
  {jsonrpc:'2.0',id:4,method:'prompts/list'},
  {jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'thenvio_validate',arguments:{project:{}}}}
 ].map(x=>JSON.stringify(x)).join('\n')+'\n';
 const p=spawnSync(process.execPath,['integrations/mcp/server.mjs'],{input,encoding:'utf8',timeout:6000});
 assert.equal(p.status,0,p.stderr);
 const messages=p.stdout.trim().split('\n').map(x=>JSON.parse(x));
 assert.equal(messages.length,5);
 assert.equal(messages[0].result.serverInfo.name,'thenvio');
 assert.equal(messages[1].result.tools.length,8);
 assert.ok(messages[2].result.structuredContent.winners.recommended);
 assert.equal(messages[3].result.prompts.length,24);
 assert.equal(messages[4].result.structuredContent.valid,false);
});
test('static app builds with dependency-free Node script',()=>{
 const p=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',timeout:6000});
 assert.equal(p.status,0,p.stderr);
});
