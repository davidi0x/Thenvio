import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIdea,addIdeaBranch} from '../core/idea-graph.mjs';
import {thinkNext,detectIdeaDomain,THINK_MODES,applyThoughts,brainstormPrompt,parseBrainstormResponse} from '../core/brainstorm.mjs';
test('social ideas produce domain-aware hypotheses, not empty generic branches',()=>{
 const g=makeIdea('Aplikacja do poznawania znajomych w mieście');
 assert.equal(detectIdeaDomain(g.title),'social');
 const ideas=thinkNext(g,g.rootId,{locale:'pl'});
 assert.equal(ideas.length,4);
 assert.ok(ideas.some(x=>/grup|spotkan|znajom/i.test(x.title+x.answer)));
 assert.ok(ideas.every(x=>x.question&&x.answer&&x.description.includes(x.question)));
 assert.ok(ideas.every(x=>!/Rozwijany wątek|Focused on/.test(x.description)),'no filler lines pasted into notes');
 assert.ok(ideas.every(x=>x.source==='structured-heuristic'));
});
test('all modes give structured question, candidate answer, challenge and test',()=>{
 const g=makeIdea('Aplikacja do nauki języków');
 const views=THINK_MODES.map(mode=>thinkNext(g,g.rootId,{mode,locale:'pl'}));
 assert.ok(views.every(v=>v.length===4));
 assert.ok(views.flat().some(v=>v.kind==='assumption'));
 assert.ok(views.flat().some(v=>v.kind==='experiment'));
 assert.ok(views.flat().every(x=>x.title.length<=150&&x.description.length<=4000));
});
test('another round shows distinct directions',()=>{
 const g=makeIdea('Revolutionize travel booking');
 const first=thinkNext(g,g.rootId,{locale:'en',round:0});
 const next=thinkNext(g,g.rootId,{locale:'en',round:1});
 assert.equal(next.length,4);
 assert.ok(first.every(x=>!next.some(y=>x.title===y.title)));
});
test('one click adds four valid children and subsequent clicks prevent duplicates',()=>{
 const g=makeIdea('Aplikacja społecznościowa');
 const ideas=thinkNext(g,g.rootId);
 const r=applyThoughts(g,g.rootId,ideas);
 assert.equal(r.added.length,4);
 assert.equal(r.graph.nodes.length,5);
 assert.equal(g.nodes.length,1);
 const repeat=applyThoughts(r.graph,g.rootId,ideas);
 assert.equal(repeat.added.length,0);
 assert.equal(repeat.graph.nodes.length,5);
});
test('question-focused answers remain hypothetical and carry context',()=>{
 let g=makeIdea('Planowanie wycieczek');
 g=addIdeaBranch(g,g.rootId,{title:'Jak uprościć podróż?',kind:'question'});
 const cards=thinkNext(g,g.nodes.at(-1).id,{mode:'answer'});
 assert.ok(cards.every(x=>x.question.includes('Jak uprościć podróż?')));
 assert.ok(cards.every(x=>x.answer.includes('Możliwa odpowiedź')));
});
test('AI JSON import validates types, bounds, and markdown fences',()=>{
 const fence=String.fromCharCode(96).repeat(3);
 const valid=fence+'json\n'+JSON.stringify({branches:[{title:'  Test hypothesis  ',kind:'experiment',description:'Ask three users'}]})+'\n'+fence;
 assert.deepEqual(parseBrainstormResponse(valid),[{title:'Test hypothesis',kind:'experiment',description:'Ask three users'}]);
 assert.throws(()=>parseBrainstormResponse('Hello world'),/Expected JSON/);
 assert.throws(()=>parseBrainstormResponse('{"branches":[{"title":"X","kind":"admin","description":"hi"}]}'),/Invalid kind/);
 const idea=makeIdea('New social product');
 assert.match(brainstormPrompt(idea,idea.rootId),/Return ONLY a valid JSON/);
});
