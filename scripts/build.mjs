import {mkdir,cp,rm,readdir} from 'node:fs/promises';
const out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(new URL('core/',out),{recursive:true});
await cp(new URL('../web/',import.meta.url),out,{recursive:true});
// Every core module is copied, so a new module can never be missing from the build.
for(const f of (await readdir(new URL('../core/',import.meta.url))).filter(f=>f.endsWith('.mjs')))await cp(new URL('../core/'+f,import.meta.url),new URL('core/'+f,out));
console.log('Built static site to dist/.');
