// Thenvio MCP request handler shared by stdio (Claude Desktop, Claude Code, Cursor) and Streamable HTTP
// (ChatGPT, claude.ai custom connectors). The chat model does the thinking on the person's own
// subscription; these tools keep the canvas in the shared-brain folder and render it in the chat.
// No network calls, no API keys, nothing deleted.
import {readFileSync} from 'node:fs';
import {evaluate,stressTest,validate} from '../../core/engine.mjs';
import {demoProject} from '../../core/demo.mjs';
import {SKILLS,getSkill,skillPrompt} from '../../core/skills.mjs';
import {readIdeaGraph} from '../../core/idea-graph.mjs';
import {updateBoardMeta} from '../../core/board.mjs';
import {markdownToCanvas} from '../../core/brain.mjs';
import {analyzeFutures} from '../../core/futures.mjs';
import {coachGraph,detectLocale} from '../../core/coach.mjs';
import {applyThinkResult,withGoal,readGoal,THINK_SCHEMA,THINK_GUIDE} from '../../core/think.mjs';

export const UI_URI='ui://thenvio/canvas-v1.html';
export const UI_MIME='text/html;profile=mcp-app';
const uiHtml=()=>readFileSync(new URL('../../web/mcp-app.html',import.meta.url),'utf8');
const renderMeta={ui:{resourceUri:UI_URI},'openai/outputTemplate':UI_URI,'openai/toolInvocation/invoking':'Thinking on the canvas…','openai/toolInvocation/invoked':'Canvas updated'};
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
const canvasSchema={type:'object',required:['canvas'],properties:{
  canvas:{description:'Canvas Markdown (a product-data/ideas/*.md file) or an idea-graph JSON object.',oneOf:[{type:'string'},{type:'object'}]},
  locale:{type:'string',enum:['en','pl']}}};
const baseTools=[
  {name:'thenvio_evaluate',description:'Evaluate routes under a stated budget, timeline and risk tolerance. Return feasible paths, explicit blockers, a weighted heuristic ranking, evidence gaps and next tests. Never call this a success forecast.',inputSchema:{type:'object',required:['project'],properties:{project:projectSchema}}},
  {name:'thenvio_stress_test',description:'Re-run a decision with lower budget, shorter time and extreme risk tolerances to identify fragile recommendations.',inputSchema:{type:'object',required:['project'],properties:{project:projectSchema}}},
  {name:'thenvio_what_if',description:'Change constraints without generating or paying for new AI content. Returns re-evaluated comparison.',inputSchema:{type:'object',required:['project','changes'],properties:{project:projectSchema,changes:{type:'object',additionalProperties:false,properties:{budget:{type:'number',minimum:0},deadlineWeeks:{type:'number',minimum:1},riskTolerance:{type:'number',minimum:0,maximum:100}}}}}},
  {name:'thenvio_founder_skill',description:'Get an evidence-first founder operating protocol. The host AI performs the actual reasoning and optional research; the protocol never claims to have performed it.',inputSchema:{type:'object',required:['skillId'],properties:{skillId:{type:'string',enum:SKILLS.map(s=>s.id)},project:projectSchema}}},
  {name:'thenvio_validate',description:'Validate a decision project and explain schema errors before evaluating or importing it.',inputSchema:{type:'object',required:['project'],properties:{project:{type:'object'}}}},
  {name:'thenvio_demo',description:'Return a synthetic example project (explicitly not real research) that illustrates the full input format.',inputSchema:{type:'object',properties:{}}},
  {name:'thenvio_futures',description:'Scan every combination of choices in a Thenvio canvas (Markdown from a shared brain, product-data/ideas/*.md, or an idea-graph object). Returns the strongest route, why, the weakest link, plan B and the next move. Scores rank the user\'s own notes; they are not probabilities.',inputSchema:canvasSchema},
  {name:'thenvio_next_moves',description:'Rank the next useful moves for a Thenvio canvas (Markdown or idea-graph object): name the idea, test the most foundational assumption, ask who it is for, rate options, record a decision. Deterministic rules, no research performed.',inputSchema:canvasSchema}
];

const canvasRef={type:'string',description:'Canvas id or (part of) its title. Omit for the most recently changed canvas.'};
const alt=THINK_SCHEMA.properties.alternatives;
const brainTools=[
  {name:'thenvio_canvases',description:'List the canvases in the shared brain (title, id, number of notes). Use first to find the canvas the person means.',inputSchema:{type:'object',properties:{}}},
  {name:'thenvio_canvas',description:'Read one canvas as Markdown with its goal, the current best route from the futures scan and the ranked next moves. Read it before brainstorming so you build on what exists.',inputSchema:{type:'object',properties:{canvas:canvasRef}}},
  {name:'thenvio_new_canvas',description:'Create a new canvas in the shared brain for an idea, optionally with a goal, and show it.',inputSchema:{type:'object',required:['title'],properties:{title:{type:'string'},goal:{type:'string'}}},_meta:renderMeta},
  {name:'thenvio_brainstorm',description:'Put YOUR brainstorm on the canvas, then rank every combination of choices and show the result. How to brainstorm:\n'+THINK_GUIDE,
   inputSchema:{type:'object',required:['alternatives','bestPath'],properties:{
    canvas:canvasRef,focus:{type:'string',description:'Optional title of the note to branch from.'},goal:THINK_SCHEMA.properties.goal,
    questions:THINK_SCHEMA.properties.questions,alternatives:alt,bestPath:THINK_SCHEMA.properties.bestPath}},_meta:renderMeta},
  {name:'thenvio_update_note',description:'Record what was learned on a note: status (open, exploring, supported, refuted), evidence, impact/effort 1-5 or kind. Refuted assumptions block every route that depends on them.',
   inputSchema:{type:'object',required:['note'],properties:{canvas:canvasRef,note:{type:'string',description:'Note title (or id).'},
    status:{type:'string',enum:['open','exploring','supported','refuted']},evidence:{type:'string'},impact:{type:'integer'},effort:{type:'integer'},
    kind:{type:'string',enum:['direction','question','assumption','experiment','insight']}}},_meta:renderMeta},
  {name:'thenvio_show',description:'Show the canvas with its best route in the chat.',inputSchema:{type:'object',properties:{canvas:canvasRef}},_meta:renderMeta}
];
export const toolDefinitions=[...baseTools,...brainTools];
function readCanvasArg(args){
  if(typeof args.canvas==='string')return markdownToCanvas(args.canvas);
  if(args.canvas&&typeof args.canvas==='object')return readIdeaGraph(args.canvas);
  throw Error('Provide canvas as Markdown text or an idea-graph object');
}
const lang=args=>args.locale==='pl'?'pl':'en';

function view(graph,store,extra={}){
  const locale=detectLocale(graph.nodes.map(n=>n.title).join(' '),'en');
  const f=analyzeFutures(graph,{locale});
  const moves=coachGraph(graph,{locale,futures:f,limit:4}).map(m=>m.title);
  return {canvas:{id:graph.id,title:graph.title,goal:readGoal(graph),
    nodes:graph.nodes.map(n=>({id:n.id,parentId:n.parentId,title:n.title,kind:n.kind,status:n.status,x:n.x,y:n.y,impact:n.impact,effort:n.effort,free:n.free===true})),links:graph.links},
   futures:{total:f.total,viable:f.viable,blocked:f.blocked,winner:f.winner&&{score:f.winner.score,confidence:f.winner.confidence,choices:f.winner.choices,nodes:f.winner.nodes},
    weakest:f.weakest&&{title:f.weakest.title,drop:f.weakest.drop},nextMove:f.nextMove,disclaimer:f.disclaimer},
   nextMoves:moves,openUrl:store?.url?store.url+'/?canvas='+encodeURIComponent(graph.id):null,...extra};
}
function summary(v){
  const w=v.futures.winner;
  return [v.canvas.title+(v.canvas.goal?' — goal: '+v.canvas.goal:''),
   w?'Best route ('+w.score+'/100, '+w.confidence+'): '+(w.choices.map(c=>c.optionTitle).join(' → ')||'—'):'No route yet: '+v.futures.nextMove.title,
   v.futures.weakest?'Weakest link: '+v.futures.weakest.title:'','Next: '+v.nextMoves.join(' | '),
   v.openUrl?'Open the canvas: '+v.openUrl:'',v.futures.disclaimer].filter(Boolean).join('\n');
}
function needStore(ctx){if(!ctx.store)throw Error('No shared brain folder configured. Start with --brain <folder> or set THENVIO_BRAIN.');return ctx.store;}
function findNote(graph,ref){
  const s=String(ref||'').toLowerCase().trim();
  return graph.nodes.find(n=>n.id===ref)||graph.nodes.find(n=>n.title.toLowerCase()===s)||graph.nodes.find(n=>n.title.toLowerCase().includes(s));
}
export async function callTool(name,args={},ctx={}){
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
    case 'thenvio_futures':{
      const graph=readCanvasArg(args),r=analyzeFutures(graph,{locale:lang(args)});
      const {samples,...rest}=r;
      return {canvas:graph.title,...rest};
    }
    case 'thenvio_next_moves':{
      const graph=readCanvasArg(args),locale=lang(args);
      const futures=analyzeFutures(graph,{locale});
      return {canvas:graph.title,moves:coachGraph(graph,{locale,futures,limit:8}).map(({id,title,why,action})=>({id,title,why,action})),
        disclaimer:futures.disclaimer};
    }
    case 'thenvio_canvases':return {canvases:await needStore(ctx).list(),folder:ctx.store.dir};
    case 'thenvio_canvas':{
      const store=needStore(ctx),{graph}=await store.find(args.canvas);
      return {...view(graph,store),markdown:store.markdown(graph),brainContext:(await store.context()).map(c=>c.path)};
    }
    case 'thenvio_new_canvas':{
      const store=needStore(ctx);let g=await store.create(args.title);
      if(args.goal){g=withGoal(g,args.goal,{locale:detectLocale(args.title+' '+args.goal,'en')});await store.save(g);}
      return view(g,store);
    }
    case 'thenvio_brainstorm':{
      const store=needStore(ctx),{graph}=await store.find(args.canvas);
      const locale=detectLocale(graph.nodes.map(n=>n.title).join(' ')+' '+(args.goal||''),'en');
      let g=args.goal?withGoal(graph,args.goal,{locale}):graph;
      const focus=args.focus?findNote(g,args.focus)?.id:null;
      const out=applyThinkResult(g,{goal:args.goal||readGoal(g),questions:args.questions||[],alternatives:args.alternatives,bestPath:args.bestPath},{focusId:focus,locale});
      await store.save(out.graph);
      return view(out.graph,store,{added:out.added.length,bestRoute:out.result.bestPath});
    }
    case 'thenvio_update_note':{
      const store=needStore(ctx),{graph}=await store.find(args.canvas);
      const note=findNote(graph,args.note);
      if(!note)throw Error('No note matches "'+args.note+'".');
      const patch={};
      for(const k of ['status','evidence','kind'])if(args[k]!==undefined)patch[k]=args[k];
      for(const k of ['impact','effort'])if(args[k]!==undefined)patch[k]=Math.min(5,Math.max(1,Math.round(args[k])));
      const g=updateBoardMeta(graph,note.id,patch);
      await store.save(g);
      return view(g,store,{updated:note.title});
    }
    case 'thenvio_show':{const store=needStore(ctx),{graph}=await store.find(args.canvas);return view(graph,store);}
    default:throw Error('Unknown tool: '+name);
  }
}
function toolResult(name,data){
  const text=data&&data.futures&&data.canvas?summary(data):JSON.stringify(data,null,2);
  return {content:[{type:'text',text}],structuredContent:data};
}
// Returns the JSON-RPC response object, or null for notifications.
export async function handleRequest(req,ctx={}){
  const id=req?.id;
  if(req?.jsonrpc!=='2.0'||typeof req.method!=='string')return {jsonrpc:'2.0',id:id??null,error:{code:-32600,message:'Invalid JSON-RPC request'}};
  if(id===undefined)return null;
  const ok=result=>({jsonrpc:'2.0',id,result});
  try{
    switch(req.method){
      case 'initialize':
        return ok({protocolVersion:['2025-06-18',protocol].includes(req.params?.protocolVersion)?req.params.protocolVersion:protocol,
          capabilities:{tools:{listChanged:false},prompts:{listChanged:false},resources:{listChanged:false},extensions:{'io.modelcontextprotocol/ui':{}}},
          serverInfo:{name:'thenvio',version:'0.9.0'},
          instructions:'Thenvio is the person\'s thinking canvas and shared brain. When they want to brainstorm, explore alternatives or decide: read the canvas (thenvio_canvas), think hard yourself, then put the result on the canvas with thenvio_brainstorm. Never invent facts, numbers or sources; turn unknowns into questions or tests.'});
      case 'ping':return ok({});
      case 'tools/list':return ok({tools:toolDefinitions});
      case 'tools/call':{
        const name=req.params?.name;
        try{return ok(toolResult(name,await callTool(name,req.params?.arguments||{},ctx)));}
        catch(e){return ok({content:[{type:'text',text:'Thenvio error: '+e.message}],isError:true});}
      }
      case 'resources/list':return ok({resources:[{uri:UI_URI,name:'Thenvio canvas',mimeType:UI_MIME}]});
      case 'resources/read':
        if(req.params?.uri!==UI_URI)return {jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown resource'}};
        return ok({contents:[{uri:UI_URI,mimeType:UI_MIME,text:uiHtml(),_meta:{ui:{prefersBorder:true}}}]});
      case 'prompts/list':return ok({prompts:[
        {name:'thenvio-brainstorm',description:'Brainstorm an idea on the Thenvio canvas: alternatives, questions and the best route to a goal.',arguments:[{name:'idea',description:'The idea or canvas',required:false},{name:'goal',description:'Where you want to get',required:false}]},
        ...SKILLS.map(s=>({name:s.id,description:s.summary,arguments:[{name:'goal',description:'Optional goal',required:false}]}))]});
      case 'prompts/get':{
        if(req.params?.name==='thenvio-brainstorm'){
          const a=req.params.arguments||{};
          const text='Use the Thenvio tools. '+(a.idea?'Idea: '+String(a.idea).slice(0,1000)+'. ':'')+(a.goal?'Goal: '+String(a.goal).slice(0,500)+'. ':'')+'Find or create the canvas (thenvio_canvases / thenvio_new_canvas), read it (thenvio_canvas), then brainstorm properly and save it with thenvio_brainstorm. Afterwards tell me the best route, why, and the first test to run.';
          return ok({description:'Brainstorm on the Thenvio canvas',messages:[{role:'user',content:{type:'text',text}}]});
        }
        const s=getSkill(req.params?.name);
        const prompt=skillPrompt(s.id)+(req.params?.arguments?.goal?'\nUSER GOAL: '+String(req.params.arguments.goal).slice(0,3000):'');
        return ok({description:s.summary,messages:[{role:'user',content:{type:'text',text:prompt}}]});
      }
      default:return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
    }
  }catch(e){return {jsonrpc:'2.0',id,error:{code:-32603,message:e.message}};}
}
