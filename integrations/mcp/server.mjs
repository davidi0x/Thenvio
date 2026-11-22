#!/usr/bin/env node
/**
 * Thenvio MCP over stdio (2025-11-25).
 * No dependencies, network calls, credentials, implicit persistence or paid inference.
 */
import readline from 'node:readline';
import {evaluate,stressTest,validate,VERSION} from '../../core/engine.mjs';
import {demoProject} from '../../core/demo.mjs';
import {SKILLS,getSkill,skillPrompt} from '../../core/skills.mjs';

const protocol='2025-11-25';
const projectSchema={
  type:'object',additionalProperties:true,
  required:['title','goal','budget','deadlineWeeks','riskTolerance','assumptions','paths'],
  properties:{
    title:{type:'string'},goal:{type:'string'},currency:{type:'string'},
    budget:{type:'number',minimum:0},deadlineWeeks:{type:'number',minimum:1},riskTolerance:{type:'number',minimum:0,maximum:100},
    assumptions:{type:'array',items:{type:'object',required:['id','claim','status'],properties:{id:{type:'string'},claim:{type:'string'},status:{enum:['unknown','supported','refuted']},source:{type:'string'}}}},
    paths:{type:'array',items:{type:'object',required:['id','name','description','cost','weeks','upside','risk','learning','dependencies'],properties:{id:{type:'string'},name:{type:'string'},description:{type:'string'},cost:{type:'number'},weeks:{type:'number'},upside:{type:'number'},risk:{type:'number'},learning:{type:'number'},dependencies:{type:'array',items:{type:'string'}}}}}
  }
};
const toolDefinitions=[
  {name:'thenvio_evaluate',description:'Evaluate routes under a stated budget, timeline and risk tolerance. Return feasible paths, explicit blockers, a weighted heuristic ranking, evidence gaps and next tests. Never call this a success forecast.',inputSchema:{type:'object',required:['project'],properties:{project:projectSchema}}},
  {name:'thenvio_stress_test',description:'Re-run a decision with lower budget, shorter time and extreme risk tolerances to identify fragile recommendations.',inputSchema:{type:'object',required:['project'],properties:{project:projectSchema}}},
  {name:'thenvio_what_if',description:'Change constraints without generating or paying for new AI content. Returns re-evaluated comparison.',inputSchema:{type:'object',required:['project','changes'],properties:{project:projectSchema,changes:{type:'object',additionalProperties:false,properties:{budget:{type:'number',minimum:0},deadlineWeeks:{type:'number',minimum:1},riskTolerance:{type:'number',minimum:0,maximum:100}}}}}},
  {name:'thenvio_founder_skill',description:'Get an evidence-first founder operating protocol. The host AI performs the actual reasoning and optional research; the protocol never claims to have performed it.',inputSchema:{type:'object',required:['skillId'],properties:{skillId:{type:'string',enum:SKILLS.map(s=>s.id)},project:projectSchema}}},
  {name:'thenvio_validate',description:'Validate a decision project and explain schema errors before evaluating or importing it.',inputSchema:{type:'object',required:['project'],properties:{project:{type:'object'}}}},
  {name:'thenvio_demo',description:'Return a synthetic example project (explicitly not real research) that illustrates the full input format.',inputSchema:{type:'object',properties:{}}}
];
function reply(id,result){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');}
function error(id,code,message){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');}
function result(data){return {content:[{type:'text',text:JSON.stringify(data,null,2)}],structuredContent:data};}
function call(name,args={}){
  switch(name){
    case 'thenvio_evaluate':return evaluate(args.project);
    case 'thenvio_stress_test':return stressTest(args.project);
    case 'thenvio_what_if':{
      const changes=args.changes;
      if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length)throw Error('Provide at least one numeric constraint change');
      for(const key of Object.keys(changes))if(!['budget','deadlineWeeks','riskTolerance'].includes(key))throw Error('Unknown constraint: '+key);
      return evaluate({...args.project,...changes});
    }
    case 'thenvio_founder_skill':{
      const skill=getSkill(args.skillId);
      if(args.project && validate(args.project).length)throw Error('Invalid project context');
      return {skill,prompt:skillPrompt(skill.id,args.project)};
    }
    case 'thenvio_validate':return {valid:validate(args.project).length===0,errors:validate(args.project)};
    case 'thenvio_demo':return {warning:'SYNTHETIC EXAMPLE; NO VERIFIED MARKET FACTS',project:demoProject};
    default:throw Error('Unknown tool: '+name);
  }
}
function handle(req){
  const id=req?.id;
  if(req?.jsonrpc!=='2.0'||typeof req.method!=='string'){error(id??null,-32600,'Invalid JSON-RPC request');return;}
  if(id===undefined)return; // Client notifications do not require a response.
  try{
    switch(req.method){
      case 'initialize':
        reply(id,{protocolVersion:['2025-06-18',protocol].includes(req.params?.protocolVersion)?req.params.protocolVersion:protocol,
          capabilities:{tools:{listChanged:false},prompts:{listChanged:false}},
          serverInfo:{name:'thenvio',version:'0.1.0'},
          instructions:'Pure deterministic decision tools. No external research is performed. Always mark sources and estimates clearly.'});
        break;
      case 'ping':reply(id,{});break;
      case 'tools/list':reply(id,{tools:toolDefinitions});break;
      case 'tools/call':{
        const args=req.params?.arguments||{};
        try{reply(id,result(call(req.params?.name,args)));}
        catch(e){reply(id,{content:[{type:'text',text:'Thenvio error: '+e.message}],isError:true});}
        break;
      }
      case 'prompts/list':reply(id,{prompts:SKILLS.map(s=>({name:s.id,description:s.summary,arguments:[{name:'goal',description:'Optional goal',required:false}]}))});break;
      case 'prompts/get':{
        const s=getSkill(req.params?.name);
        const prompt=skillPrompt(s.id)+(req.params?.arguments?.goal?'\nUSER GOAL: '+String(req.params.arguments.goal).slice(0,3000):'');
        reply(id,{description:s.summary,messages:[{role:'user',content:{type:'text',text:prompt}}]});
        break;
      }
      default:error(id,-32601,'Method not found');
    }
  }catch(e){error(id,-32603,e.message);}
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{
  if(line.length>2_000_000){error(null,-32700,'Request too large');return;}
  try{handle(JSON.parse(line));}
  catch{error(null,-32700,'Invalid JSON');}
});
