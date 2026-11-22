// Read-only connection to a shared brain on GitHub. GET requests to api.github.com only,
// on explicit connect / refresh. Public repos need no token; for a private repo the person may
// paste a read-only fine-grained token, which stays in this tab's memory and is never stored.
import {readBrain,IDEAS_DIR} from './core/brain.mjs';

const CONTEXT=['AGENTS.md','how-we-work/README.md','brand/README.md','product-data/README.md'];
let token='';
const api=(path)=>fetch('https://api.github.com'+path,{headers:{accept:'application/vnd.github+json',...(token?{authorization:'Bearer '+token}:{})}});
const raw=(o,r,ref,path)=>fetch('https://api.github.com/repos/'+o+'/'+r+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(ref),
 {headers:{accept:'application/vnd.github.raw+json',...(token?{authorization:'Bearer '+token}:{})}});

export function parseRepo(input){
 const m=String(input||'').trim().replace(/\.git$/,'').match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w./-]+))?\/?$/);
 if(!m)throw Error('Use owner/repository, e.g. acme/brain');
 return {owner:m[1],repo:m[2],branch:m[3]||''};
}
export function setToken(v){token=String(v||'').trim();}
export async function readGithubBrain(repoInput){
 const {owner,repo,branch:wanted}=parseRepo(repoInput);
 const meta=await api('/repos/'+owner+'/'+repo);
 if(meta.status===404)throw Error(token?'Repository not found or the token cannot read it.':'Repository not found. A private repository needs a read-only token.');
 if(meta.status===403)throw Error('GitHub refused (rate limit or permissions). Try again later or add a token.');
 if(!meta.ok)throw Error('GitHub error '+meta.status);
 const info=await meta.json();
 const branch=wanted||info.default_branch;
 const treeRes=await api('/repos/'+owner+'/'+repo+'/git/trees/'+encodeURIComponent(branch)+'?recursive=1');
 if(!treeRes.ok)throw Error('Cannot list files on branch '+branch+'.');
 const tree=(await treeRes.json()).tree||[];
 const paths=tree.filter(t=>t.type==='blob').map(t=>t.path);
 const ideaPaths=paths.filter(p=>p.startsWith(IDEAS_DIR)&&p.endsWith('.md')&&!p.slice(IDEAS_DIR.length).includes('/')).slice(0,50);
 const want=[...ideaPaths,...CONTEXT.filter(p=>paths.includes(p))];
 const files=[];
 for(const path of want){
  const r=await raw(owner,repo,branch,path);
  if(r.ok)files.push({path,content:await r.text(),lastModified:Date.parse(info.pushed_at)||Date.now()});
 }
 const brain=readBrain(files);
 return {repo:owner+'/'+repo,branch,private:!!info.private,files,
  context:files.filter(f=>CONTEXT.includes(f.path)),...brain,total:paths.length};
}
