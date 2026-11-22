import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const agent=(process.argv.find(x=>x.startsWith('--agent='))||'--agent=claude').split('=')[1];
const destinations={claude:'.claude/skills',codex:'.agents/skills',cursor:'.cursor/skills'};
if(!destinations[agent]){console.error('Expected --agent=claude|codex|cursor');process.exit(1);}
const root=resolve(process.cwd());
const folders=(await readdir(join(root,'skills'),{withFileTypes:true})).filter(x=>x.isDirectory());
for(const folder of folders){
  const content=await readFile(join(root,'skills',folder.name,'SKILL.md'),'utf8');
  const dest=join(root,destinations[agent],folder.name);
  await mkdir(dest,{recursive:true});
  await writeFile(join(dest,'SKILL.md'),content);
}
console.log('Installed '+folders.length+' skills in '+destinations[agent]);
