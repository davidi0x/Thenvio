// Minimal, deterministic ZIP writer (stored, no compression) for downloading a shared brain.
// Pure and dependency-free; file names and contents are UTF-8.
const TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(bytes){
 let c=0xffffffff;
 for(let i=0;i<bytes.length;i++)c=TABLE[(c^bytes[i])&0xff]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function dosTime(date){
 const d=new Date(date);
 return {time:(d.getUTCHours()<<11)|(d.getUTCMinutes()<<5)|(Math.floor(d.getUTCSeconds()/2)),
  date:((Math.max(1980,d.getUTCFullYear())-1980)<<9)|((d.getUTCMonth()+1)<<5)|d.getUTCDate()};
}
export function zipFiles(files,{date='2026-01-01T00:00:00Z',prefix=''}={}){
 const enc=new TextEncoder(),{time,date:day}=dosTime(date);
 const entries=[],chunks=[];let offset=0;
 const seen=new Set();
 for(const f of files){
  const path=prefix+String(f.path).replace(/^\/+/,'');
  if(!path||path.includes('..')||seen.has(path))throw Error('Invalid or duplicate path: '+f.path);
  seen.add(path);
  const name=enc.encode(path),data=typeof f.content==='string'?enc.encode(f.content):new Uint8Array(f.content);
  const crc=crc32(data);
  const local=new DataView(new ArrayBuffer(30));
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x0800,true);local.setUint16(8,0,true);
  local.setUint16(10,time,true);local.setUint16(12,day,true);local.setUint32(14,crc,true);
  local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);local.setUint16(26,name.length,true);local.setUint16(28,0,true);
  chunks.push(new Uint8Array(local.buffer),name,data);
  entries.push({name,crc,size:data.length,offset});
  offset+=30+name.length+data.length;
 }
 const start=offset;
 for(const e of entries){
  const c=new DataView(new ArrayBuffer(46));
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
  c.setUint16(12,time,true);c.setUint16(14,day,true);c.setUint32(16,e.crc,true);c.setUint32(20,e.size,true);c.setUint32(24,e.size,true);
  c.setUint16(28,e.name.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);
  c.setUint32(38,0,true);c.setUint32(42,e.offset,true);
  chunks.push(new Uint8Array(c.buffer),e.name);offset+=46+e.name.length;
 }
 const end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);
 end.setUint32(12,offset-start,true);end.setUint32(16,start,true);
 chunks.push(new Uint8Array(end.buffer));
 const out=new Uint8Array(chunks.reduce((s,c)=>s+c.length,0));let p=0;
 for(const c of chunks){out.set(c,p);p+=c.length;}
 return out;
}
