// Thenvio: pure, deterministic, explainable decisions. Scores are NOT probabilities.
export const VERSION = 1;
const clamp = (x, a=0, b=100) => Math.min(b,Math.max(a,x));
const round = x => Math.round(x*10)/10;
const number = x => typeof x === 'number' && Number.isFinite(x);
export function validate(project) {
  const err=[];
  if (!project || typeof project!=='object' || Array.isArray(project)) return ['Project must be an object'];
  if (typeof project.title!=='string' || !project.title.trim() || project.title.length>180) err.push('Invalid title');
  if (typeof project.goal!=='string' || !project.goal.trim() || project.goal.length>3000) err.push('Invalid goal');
  for(const [key,min,max] of [['budget',0,1e9],['deadlineWeeks',1,520],['riskTolerance',0,100]]) {
    if(!number(project[key]) || project[key]<min || project[key]>max) err.push('Invalid '+key);
  }
  if(!Array.isArray(project.assumptions) || project.assumptions.length>200) err.push('Invalid assumptions');
  if(!Array.isArray(project.paths) || project.paths.length>100) err.push('Invalid paths');
  const ids=new Set(), pathIds=new Set();
  for(const a of Array.isArray(project.assumptions)?project.assumptions:[]) {
    if(!a || typeof a.id!=='string' || !/^[\w-]{1,60}$/.test(a.id) || ids.has(a.id)) {err.push('Invalid assumption ID');continue;}
    ids.add(a.id);
    if(typeof a.claim!=='string'||!a.claim.trim()||a.claim.length>1000) err.push('Invalid assumption claim');
    if(!['unknown','supported','refuted'].includes(a.status)) err.push('Invalid assumption status');
    if(a.source!==undefined && (typeof a.source!=='string'||a.source.length>2000)) err.push('Invalid source');
  }
  for(const p of Array.isArray(project.paths)?project.paths:[]) {
    if(!p||typeof p.id!=='string'||!/^[\w-]{1,60}$/.test(p.id)||pathIds.has(p.id)){err.push('Invalid path ID');continue;}
    pathIds.add(p.id);
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>180) err.push('Invalid path name');
    if(typeof p.description!=='string'||p.description.length>1500) err.push('Invalid description');
    for(const [key,max] of [['cost',1e9],['weeks',520],['upside',100],['risk',100],['learning',100]]) {
      if(!number(p[key])||p[key]<0||p[key]>max) err.push('Invalid '+p.id+'.'+key);
    }
    if(!Array.isArray(p.dependencies)||p.dependencies.length>100) err.push('Invalid path dependencies');
    else for(const id of p.dependencies) if(!ids.has(id)) err.push('Missing dependency '+id);
  }
  return err;
}
export function assertProject(p){const e=validate(p);if(e.length)throw Error(e.join('; '));return p;}
export function emptyProject(title,goal,budget=10000,deadlineWeeks=12) {
  return assertProject({schemaVersion:VERSION,id:'p-'+Date.now(),title,goal,currency:'USD',budget,deadlineWeeks,riskTolerance:45,assumptions:[],paths:[]});
}
export function loadProject(input) {
  const p=typeof input==='string'?JSON.parse(input):input;
  if(p?.schemaVersion!==VERSION) throw Error('Unsupported project version');
  return structuredClone(assertProject(p));
}
function scorePath(project,p,byId){
  const blockers=[];
  if(p.cost>project.budget)blockers.push({code:'budget',message:'Exceeds budget by '+round(p.cost-project.budget)});
  if(p.weeks>project.deadlineWeeks)blockers.push({code:'time',message:'Exceeds timeline by '+round(p.weeks-project.deadlineWeeks)+' weeks'});
  const dependencies=p.dependencies.map(id=>byId.get(id));
  for(const a of dependencies)if(a.status==='refuted')blockers.push({code:'refuted',message:a.claim,assumptionId:a.id});
  const evidenceGaps=dependencies.filter(a=>a.status==='unknown'||(a.status==='supported'&&!a.source?.trim()));
  const costFit=project.budget===0?(p.cost===0?100:0):clamp(100*(1-p.cost/(project.budget*1.25)));
  const speedFit=clamp(100*(1-p.weeks/(project.deadlineWeeks*1.25)));
  const riskFit=clamp(100-p.risk*(1-project.riskTolerance/200));
  const breakdown={
    upside:round(p.upside*.38), learning:round(p.learning*.20),
    risk:round(riskFit*.24), cost:round(costFit*.10), speed:round(speedFit*.08),
    evidencePenalty:Math.min(30,evidenceGaps.length*6)
  };
  const score=round(clamp(breakdown.upside+breakdown.learning+breakdown.risk+breakdown.cost+breakdown.speed-breakdown.evidencePenalty));
  return {...p,score,breakdown,blockers,feasible:!blockers.length,status:blockers.length?'blocked':evidenceGaps.length?'uncertain':'viable',
    evidenceGaps:evidenceGaps.map(a=>({id:a.id,claim:a.claim})),
    headroom:{budget:round(project.budget-p.cost),weeks:round(project.deadlineWeeks-p.weeks)}};
}
export function evaluate(project){
  assertProject(project);
  const byId=new Map(project.assumptions.map(a=>[a.id,a]));
  const paths=project.paths.map(p=>scorePath(project,p,byId)).sort((a,b)=>b.score-a.score||a.cost-b.cost||a.name.localeCompare(b.name));
  const eligible=paths.filter(p=>p.feasible);
  const top=eligible[0]||null;
  const cheapest=[...eligible].sort((a,b)=>a.cost-b.cost||a.risk-b.risk)[0]||null;
  const ambitious=[...eligible].sort((a,b)=>b.upside-a.upside||b.score-a.score)[0]||null;
  const evidenceGaps=project.assumptions.filter(a=>a.status==='unknown'||(a.status==='supported'&&!a.source?.trim()));
  const nextActions=evidenceGaps.filter(a=>project.paths.some(p=>p.dependencies.includes(a.id))).slice(0,4)
    .map(a=>({kind:'test',assumptionId:a.id,text:'Find disconfirming evidence for: '+a.claim}));
  if(paths.length&&!eligible.length)nextActions.push({kind:'constraints',text:'Increase the budget, extend the timeline, or design a cheaper path.'});
  if(top)nextActions.push({kind:'checkpoint',pathId:top.id,text:'Define a measurable go/no-go checkpoint for '+top.name+'.'});
  return {version:VERSION,projectId:project.id||null,
    inputs:{budget:project.budget,deadlineWeeks:project.deadlineWeeks,riskTolerance:project.riskTolerance,currency:project.currency||'USD'},
    paths,winners:{recommended:top?.id||null,leastCost:cheapest?.id||null,highestUpside:ambitious?.id||null},
    evidenceGaps:evidenceGaps.map(a=>({id:a.id,claim:a.claim,status:a.status})),nextActions,
    methodology:'Heuristic comparison, not a probability: upside 38%, learning 20%, risk-fit 24%, cost-fit 10%, speed 8%; -6 per unresolved or uncited dependency (max -30). Blocked paths cannot win.'};
}
export function stressTest(project){
  assertProject(project);
  const original=evaluate(project).winners.recommended;
  const cases=[
    ['Budget -25%',{budget:round(project.budget*.75)}],
    ['Budget -50%',{budget:round(project.budget*.5)}],
    ['Time -25%',{deadlineWeeks:Math.max(1,round(project.deadlineWeeks*.75))}],
    ['Risk tolerance 0',{riskTolerance:0}],
    ['Risk tolerance 100',{riskTolerance:100}]
  ];
  return {baseline:original,cases:cases.map(([label,change])=>{
    const report=evaluate({...project,...change});
    return {label,change,recommended:report.winners.recommended,eligible:report.paths.filter(p=>p.feasible).map(p=>p.id),changed:original!==report.winners.recommended};
  })};
}
