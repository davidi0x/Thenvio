import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Studio starts with a real decision prompt and prioritizes the live chart',async ()=>{
  const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../web/app.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../web/styles.css',import.meta.url),'utf8');
  assert.match(html,/id="quickGoal"/);
  assert.match(html,/id="newDecision"/);
  assert.ok(html.indexOf('class="visual-panel"')<html.indexOf('class="controls-panel"'));
  assert.match(app,/function openQuickDecision/);
  assert.match(app,/if\(initial\)/);
  assert.match(app,/previousChartCoordinates/);
  assert.match(css,/quick-entry:focus-within/);
  assert.match(css,/max-width:690px/);
});
