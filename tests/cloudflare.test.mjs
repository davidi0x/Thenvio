import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkerSource} from '../scripts/cloudflare-worker.mjs';

test('Cloudflare Worker contains valid application and serves its routes',async ()=>{
 const source=await makeWorkerSource();
 const worker=(await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source))).default;
 const root=await worker.fetch(new Request('https://test.example/'));
 assert.equal(root.status,200);
 assert.match(root.headers.get('content-type'),/text\/html/);
 assert.match(await root.text(),/Thenvio/);
 const main=await worker.fetch(new Request('https://test.example/app.mjs'));
 assert.equal(main.status,200);
 assert.match(await main.text(),/renderRoutes/);
 const engine=await worker.fetch(new Request('https://test.example/core/engine.mjs'));
 assert.match(await engine.text(),/function evaluate/);
 const head=await worker.fetch(new Request('https://test.example/',{method:'HEAD'}));
 assert.equal(head.status,200);
 assert.equal((await head.text()).length,0);
 assert.equal((await worker.fetch(new Request('https://test.example/private-key'))).status,404);
 assert.equal((await worker.fetch(new Request('https://test.example/',{method:'POST'}))).status,405);
});
