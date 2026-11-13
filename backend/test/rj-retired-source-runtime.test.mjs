import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('retired maritime tide route is absent from the live Cloud Run server graph', () => {
  const runtime=readFileSync(new URL('../src/runtime.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(runtime,/createChmTideHttpHandler|createChmTideValuesCache/);
  assert.match(runtime,/createPaidDashboardDataHttpHandler\(coreHandler,/);
});

test('statewide public data catalog contains only approved RJ source IDs',async()=>{
  const {STATEWIDE_SOURCE_RESPONSIBILITIES}=await import('../src/statewide-dashboard.mjs');
  const banned=new Set(['chm','ww3','pnboia','windy','inea','copernicus']);
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.every(s=>!banned.has(s.id)));
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.some(s=>s.id==='noaa'));
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.some(s=>s.id==='inpe-cptec'));
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.some(s=>s.id==='eumetsat'));
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.some(s=>s.id==='jaxa-gsmap'));
});
