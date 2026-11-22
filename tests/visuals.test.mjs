import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../core/engine.mjs';
import {demoProject} from '../core/demo.mjs';
import {chartModel,CHART_MODES,DRIVER_KEYS} from '../core/visuals.mjs';
const project=structuredClone(demoProject);
const report=evaluate(project);

test('all chart modes are distinct and immutable input remains untouched',()=>{
  const before=JSON.stringify(project);
  const models=CHART_MODES.map(mode=>chartModel(project,report,mode));
  assert.deepEqual(models.map(x=>x.mode),['map','drivers','resilience']);
  assert.equal(JSON.stringify(project),before);
});

test('landscape uses real evaluated route scores and correct feasible state',()=>{
  const model=chartModel(project,report,'map');
  assert.equal(model.points.length,project.paths.length);
  assert.ok(model.maxCost>=Math.max(...project.paths.map(x=>x.cost)));
  for(const p of model.points){
    const fromReport=report.paths.find(x=>x.id===p.id);
    assert.equal(p.score,fromReport.score);
    assert.equal(p.blocked,!fromReport.feasible);
  }
  assert.equal(model.points.filter(x=>x.leading).length,1);
});

test('score drivers correspond to actual score breakdown',()=>{
  const model=chartModel(project,report,'drivers');
  assert.deepEqual(model.keys,[...DRIVER_KEYS]);
  for(const row of model.rows){
    const fromReport=report.paths.find(p=>p.id===row.id);
    assert.deepEqual(row.contributions.map(x=>x.value),DRIVER_KEYS.map(k=>fromReport.breakdown[k]));
    assert.equal(row.penalty,fromReport.breakdown.evidencePenalty);
  }
});

test('stress chart includes baseline and actual re-evaluations',()=>{
  const model=chartModel(project,report,'resilience');
  assert.equal(model.rows.length,6);
  assert.equal(model.rows[0].pathId,report.winners.recommended);
  assert.ok(model.rows.every(x=>Number.isFinite(x.score) && x.score>=0 && x.score<=100));
});

test('charts explain decisions with no possible routes',()=>{
  const blank={...project,paths:[]};
  const r=evaluate(blank);
  assert.deepEqual(chartModel(blank,r,'map').points,[]);
  assert.deepEqual(chartModel(blank,r,'drivers').rows,[]);
  assert.ok(chartModel(blank,r,'resilience').rows.every(x=>x.pathId===null));
  assert.throws(()=>chartModel(blank,r,'imaginary'));
});
