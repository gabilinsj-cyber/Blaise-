import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlertaRioStationScienceJobs } from '../src/rj-station-science-inputs.mjs';
import { evaluateScientificJobs } from '../src/blaise-scientific-jobs.mjs';

const now=Date.parse('2026-10-11T03:00:00Z');
const stamp=new Date(now-60_000).toISOString();
const sourceUrl='https://www.sistema-alerta-rio.com.br/';
const station={
  code:101,name:'Rio station fixture',municipalityIbge:3304557,
  observedAt:stamp,freshness:'recent',
  temperatureC:29,dewPointC:23,relativeHumidityPercent:73,
};
test('actual eligible Rio city station yields separately attributable scientific calculations',()=>{
  const jobs=buildAlertaRioStationScienceJobs({stations:[station],sourceUrl,now});
  assert.deepEqual(jobs.map(x=>x.method),[
    'vaporPressureFromDewPoint','relativeHumidityFromDewPoint','wetBulbStullApprox',
  ]);
  assert.ok(jobs.every(j=>j.scopeId==='municipality:3304557'
    &&j.sources.every(s=>s.sourceUrl===sourceUrl&&s.validAt===stamp
      &&s.nature==='OBSERVADO'&&s.quality==='VALIDATED')));
  const r=evaluateScientificJobs(jobs,{now});
  assert.equal(r.length,3);
  assert.ok(r.every(item=>item.status==='CALCULATED_INPUTS_ONLY'
    &&item.result.officialAlert===false));
});
test('stale, future, wrong state, wrong municipality, or physically inconsistent dewpoint never create source-derived jobs',()=>{
  const rejected=[
    {...station,freshness:'stale'},
    {...station,observedAt:new Date(now-10*60_60_000).toISOString()},
    {...station,observedAt:new Date(now+60_000).toISOString()},
    {...station,municipalityIbge:3303302},
    {...station,code:'abc'},
  ];
  for(const s of rejected){
    const jobs=buildAlertaRioStationScienceJobs({stations:[s],sourceUrl,now});
    assert.equal(jobs.length,0);
  }
  const inconsistent=buildAlertaRioStationScienceJobs({
    stations:[{...station,dewPointC:50,relativeHumidityPercent:null}],
    sourceUrl,now,
  });
  assert.equal(inconsistent.length,0);
});
test('duplicate station codes and large station inventories are bounded, not multiplied into independent evidence',()=>{
  const jobs=buildAlertaRioStationScienceJobs({
    stations:[station,station,{...station,code:102}],sourceUrl,now,maxJobs:4,
  });
  assert.equal(jobs.length,4);
  assert.equal(new Set(jobs.map(j=>j.id)).size,4);
  assert.ok(jobs.every(j=>j.sources.length===1));
});
test('two groups of scientific jobs from the SAME station remain just one station provenance, never an official warning',()=>{
  const jobs=buildAlertaRioStationScienceJobs({stations:[station],sourceUrl,now});
  const ids=new Set(jobs.flatMap(j=>j.sources.map(s=>s.sourceId)));
  assert.equal(ids.size,1);
  assert.equal(ids.has('ALERTA_RIO_METEOROLOGY_STATION'),true);
  assert.ok(evaluateScientificJobs(jobs,{now}).every(x=>x.result.officialAlert===false));
});
