// Original Thenvio founder protocols. Host AI performs research; the engine does not.
const rows=[
 ['problem-framing','Problem framing','Discovery','Define a measurable human problem.','Problem, persona, current workaround, proof needed.','Ask for a specific user and event. Separate observed pain from assumed pain. Make the problem falsifiable.'],
 ['assumption-audit','Assumption audit','Evidence','Expose hidden dependencies.','Assumption register, confidence and kill criteria.','Label observed facts, estimates and unknowns. Never upgrade confidence without a source.'],
 ['customer-discovery','Customer discovery','Discovery','Design honest interviews.','Recruitment profile, interview guide and synthesis.','Ask about recent real behavior, not hypothetical buying. Include negative evidence.'],
 ['market-mapping','Market mapping','Market','Size reachable demand carefully.','Bottom-up market model and sensitivity range.','Use source-backed counts, pricing and frequency. No invented TAM statistics.'],
 ['competitor-map','Competitor map','Market','Study direct and indirect alternatives.','Alternative matrix and differentiation hypotheses.','Include the do-nothing workaround. Date and source each competitive assertion.'],
 ['pricing-lab','Pricing lab','Business','Test monetization against value.','Price hypotheses and willingness-to-pay experiments.','Define buyer and value metric. Survey intent is not proven willingness to pay.'],
 ['unit-economics','Unit economics','Business','Model cost, margin and break-even.','Formula ledger, sensitivity and cash needs.','Show each formula. Mark missing churn, CAC, taxes and refunds.'],
 ['distribution-design','Distribution design','Growth','Choose reachable acquisition channels.','Channel hypotheses and cheap tests.','Choose channels with measurable signals, spend caps and stopping rules.'],
 ['positioning','Positioning','Growth','Make the differentiated promise testable.','ICP, alternatives, positioning and proof.','Avoid superlatives. Differentiate on measurable value with evidence.'],
 ['mvp-scope','MVP scope','Product','Reduce the product to its learning loop.','Journey, in/out scope and acceptance criteria.','Exclude features that do not change near-term learning.'],
 ['journey-audit','Journey audit','Product','Find friction and dead ends.','State/action inventory and accessibility audit.','Check every interaction, empty state, error, loading and keyboard flow.'],
 ['risk-register','Risk register','Strategy','Track risks and mitigation triggers.','Risk matrix, owner, signal and mitigation.','Do not invent probabilities. Define reversibility and signals.'],
 ['scenario-builder','Scenario builder','Strategy','Find meaningfully different routes to a goal.','Paths with cost, time, upside, risk and dependencies.','Explain each estimate. Produce different approaches, not cosmetic variants.'],
 ['red-team','Red team','Strategy','Challenge the leading route.','Pre-mortem, counter-case and decisive test.','Steelman the opposite view and specify disconfirming evidence.'],
 ['decision-memo','Decision memo','Strategy','Record an auditable choice.','Options, criteria, trade-offs and revisit trigger.','State why paths lost, what remains unknown and who owns the choice.'],
 ['experiment-design','Experiment design','Evidence','Make claims falsifiable.','Hypothesis, sample, method and go/no-go rule.','Pre-register observable signals and cheap decisive experiments.'],
 ['evidence-review','Evidence review','Evidence','Grade what sources actually support.','Claim-source ledger, conflicts and freshness.','Cite each claim or mark not verified. Do not invent browsing or sources.'],
 ['roadmap','Roadmap','Execution','Sequence work by uncertainty.','Now/next/later, dependencies and checkpoints.','Validate expensive unknowns before expensive implementation.'],
 ['go-to-market','Go-to-market','Growth','Build a narrow launch motion.','Launch wedge, acquisition plan and activation event.','Define segment, test and retention evidence.'],
 ['pitch-narrative','Pitch narrative','Communication','Explain without invented traction.','One-liner, problem, why now, evidence and ask.','Never fake revenue, customer quotes or endorsements.'],
 ['sales-outreach','Sales outreach','Growth','Contact relevant prospects respectfully.','Prospect criteria, message and follow-ups.','Require lawful contact basis; do not make up personal details.'],
 ['fundraising-readiness','Fundraising readiness','Business','Audit capital requirements.','Runway, milestones and dilution trade-offs.','Compare bootstrapping with equity; distinguish forecasts and commitments.'],
 ['security-privacy','Security & privacy','Product','Reduce data risk before connecting apps.','Threat model, retention plan and safeguards.','Minimize data, map secrets and authorization. No compliance guarantee.'],
 ['skill-orchestrator','Founder orchestrator','Strategy','Select the fewest useful protocols.','Skill sequence, inputs, gates and decision points.','Start with problem and assumptions, then experiments; avoid decorative reports.']
];
export const SKILLS=rows.map(([id,name,category,summary,deliverable,instructions])=>({id,name,category,summary,deliverable,instructions}));
export const SKILL_BY_ID=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
export function getSkill(id){const s=SKILL_BY_ID[id];if(!s)throw Error('Unknown skill: '+id);return s;}
export function skillPrompt(id,project){
 const s=getSkill(id);
 const context=project?'\nGOAL: '+project.goal+'\nASSUMPTIONS:\n'+project.assumptions.map(a=>'- ['+a.status+'] '+a.claim+(a.source?' | '+a.source:' | no source')).join('\n'):'';
 return '# Thenvio / '+s.name+'\nMISSION: '+s.summary+'\nDELIVERABLE: '+s.deliverable+'\nMETHOD: '+s.instructions+'\nRULES: Clearly separate facts, assumptions, estimates and recommendations. Cite accessible sources with dates or say not verified. Never invent business metrics, interviews or market data. End with the cheapest next experiment and the go/no-go trigger.'+context;
}
