import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile initial map uses legible node scale; Fit still reveals whole map',async()=>{
 const source=await readFile(new URL('../web/idea-explorer.mjs',import.meta.url),'utf8');
 const style=await readFile(new URL('../web/ideas.css',import.meta.url),'utf8');
 assert.match(source,/function initialPosition\(\)/);
 assert.match(source,/if\(window\.innerWidth>690\)\{fit\(\);return;\}/);
 assert.match(source,/zoom=\.86/);
 assert.match(source,/requestAnimationFrame\(initialPosition\)/);
 assert.match(source,/\$\('#ideaFit'\)\.addEventListener\('click',fit\)/);
 assert.match(style,/\.ideas-toolbar-right\{flex:1;width:100%/);
 assert.match(style,/\.ideas-search\{flex:1;min-width:110px/);
});
