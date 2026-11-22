// A clearly labeled illustrative idea graph, not research or recommendations.
import {assertIdeaGraph} from './idea-graph.mjs';
const date='2026-01-01T00:00:00.000Z';
const node=(id,parentId,title,kind,description,collapsed=false)=>({id,parentId,title,kind,
  description,status:'open',evidence:'',collapsed,createdAt:date,updatedAt:date});
export const demoIdeas=assertIdeaGraph({
 schemaVersion:1,id:'g-demo-ideas',rootId:'root',title:'A product that helps ideas become real',
 createdAt:date,updatedAt:date,links:[],
 nodes:[
  node('root',null,'A product that helps ideas become real','idea','Explore how a rough thought could evolve into something useful. This is an editable example, not validated research.'),
  node('problem','root','Understand the real problem','question','Who is struggling, and what are they doing instead?'),
  node('directions','root','Explore different directions','direction','Look for paths that solve the same underlying problem in different ways.',true),
  node('assumptions','root','Challenge the assumptions','assumption','Which beliefs would make the idea fall apart if they were wrong?',true),
  node('experiments','root','Try the smallest experiment','experiment','What could you do tomorrow to learn something meaningful?',true),
  node('people','problem','Who experiences this most?','question','Identify people and situations rather than guessing an audience.'),
  node('current','problem','How is it solved today?','question','Observe workarounds and competing behaviors.'),
  node('tool','directions','A tool people can use alone','direction','What happens if the workflow is self-service?'),
  node('collab','directions','Develop ideas together','direction','What changes if friends, teams or cofounders explore branches together?'),
  node('belief','assumptions','They will return to develop ideas','assumption','A hypothesis to test, not a market fact.'),
  node('risk','assumptions','Too much structure could slow thinking','question','Could the canvas help without becoming bureaucracy?'),
  node('test','experiments','Five real idea sessions','experiment','Observe five sessions and capture specific obstacles.'),
  node('learning','experiments','What would change your mind?','question','Define a disconfirming signal before testing.')
 ]
});
