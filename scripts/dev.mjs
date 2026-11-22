import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const base=fileURLToPath(new URL('../dist/',import.meta.url));
const build=spawnSync(process.execPath,[fileURLToPath(new URL('./build.mjs',import.meta.url))],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const port=Number(process.env.PORT)||4173;
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
    if(file!==base&&!file.startsWith(base+sep))throw Error('Forbidden');
    if(!(await stat(file)).isFile())throw Error('Not found');
    const data=await readFile(file);
    res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(data);
  }catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Thenvio: http://localhost:'+port));
