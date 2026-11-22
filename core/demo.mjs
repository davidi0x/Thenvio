// Synthetic demo, not research or actual financial estimates.
export const demoProject={
 schemaVersion:1,id:'demo',title:'Launch a decision product',
 goal:'Validate a decision-intelligence workflow for founders without paying for users’ model tokens.',
 currency:'USD',budget:12000,deadlineWeeks:12,riskTolerance:40,
 assumptions:[
  {id:'a_tools',claim:'Early adopters already work in AI assistants',status:'unknown',source:''},
  {id:'a_pain',claim:'Founders struggle to compare conflicting plans',status:'unknown',source:''},
  {id:'a_pay',claim:'Teams will pay for shared decision history',status:'unknown',source:''},
  {id:'a_scope',claim:'A lean local MVP can be tested without hosted inference',status:'supported',source:'Internal engineering hypothesis; verify with prototype'}
 ],
 paths:[
  {id:'mcp',name:'AI-native extension',description:'Let people use the AI they already have. Keep decision logic deterministic and local.',cost:1800,weeks:4,upside:76,risk:31,learning:86,dependencies:['a_tools','a_pain']},
  {id:'pilots',name:'Design-partner pilots',description:'Test with five teams using facilitated sessions and prototype workflows.',cost:4800,weeks:9,upside:73,risk:37,learning:94,dependencies:['a_pain','a_pay']},
  {id:'saas',name:'Full standalone SaaS',description:'Build accounts, hosted inference, collaboration and billing from day one.',cost:22500,weeks:20,upside:91,risk:82,learning:51,dependencies:['a_pay']},
  {id:'manual',name:'Manual concierge test',description:'Use structured sessions and scenario worksheets before writing integrations.',cost:450,weeks:2,upside:43,risk:12,learning:99,dependencies:['a_pain']}
 ]
};
