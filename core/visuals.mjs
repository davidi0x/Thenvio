// Pure models for Thenvio Studio charts; no DOM and no artificial market metrics.
import {evaluate,stressTest,assertProject} from './engine.mjs';

export const CHART_MODES=Object.freeze(['map','drivers','resilience']);
export const DRIVER_KEYS=Object.freeze(['upside','learning','risk','cost','speed']);

export function chartModel(project,report,mode='map'){
  assertProject(project);
  if(!CHART_MODES.includes(mode))throw Error('Unknown chart mode: '+mode);
  if(!report || !Array.isArray(report.paths) || !report.winners)throw Error('Invalid evaluation report');
  const paths=report.paths;
  if(mode==='map'){
    const maxCost=Math.max(1,project.budget,...paths.map(p=>p.cost));
    const max=Math.ceil(maxCost*1.1/100)*100||100;
    return {
      mode,
      maxCost:max,
      budget:project.budget,
      points:paths.map(p=>({
        id:p.id,name:p.name,cost:p.cost,score:p.score,upside:p.upside,
        blocked:!p.feasible,leading:p.id===report.winners.recommended,
        gaps:p.evidenceGaps.length
      }))
    };
  }
  if(mode==='drivers'){
    return {
      mode,
      keys:[...DRIVER_KEYS],
      rows:paths.map(p=>({
        id:p.id,name:p.name,score:p.score,blocked:!p.feasible,
        penalty:p.breakdown.evidencePenalty,
        contributions:DRIVER_KEYS.map(k=>({key:k,value:p.breakdown[k]}))
      }))
    };
  }
  const stress=stressTest(project);
  const items=[
    {label:'Current conditions',change:{},baseline:true},
    ...stress.cases.map(item=>({label:item.label,change:item.change,baseline:false}))
  ];
  return {
    mode,
    rows:items.map(item=>{
      const caseReport=item.baseline?report:evaluate({...project,...item.change});
      const recommended=caseReport.paths.find(p=>p.id===caseReport.winners.recommended)||null;
      return {
        label:item.label,
        baseline:item.baseline,
        changed:caseReport.winners.recommended!==stress.baseline,
        pathId:recommended?.id||null,
        pathName:recommended?.name||'No feasible path',
        score:recommended?.score||0,
        eligible:caseReport.paths.filter(p=>p.feasible).length
      };
    })
  };
}
