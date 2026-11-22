import {mkdir,cp,rm,writeFile} from 'node:fs/promises';
const out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(new URL('core/',out),{recursive:true});
await cp(new URL('../web/',import.meta.url),out,{recursive:true});
for(const f of ['engine.mjs','demo.mjs','skills.mjs','visuals.mjs','idea-graph.mjs','demo-ideas.mjs','brainstorm.mjs','board.mjs','futures.mjs','coach.mjs','brain.mjs','zip.mjs'])await cp(new URL('../core/'+f,import.meta.url),new URL('core/'+f,out));
console.log('Built static site to dist/.');
