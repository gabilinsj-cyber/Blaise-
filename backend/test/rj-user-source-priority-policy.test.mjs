import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_EVENT_SOURCE_POLICY, sourcePolicyForRjEvent, canAverageRjEvent } from '../src/rj-user-source-priority-policy.mjs';
import { rjSourceRouting } from '../src/rj-phenomenon-source-policy.mjs';

test('all 27 approved RJ phenomena have independent policy rows',()=>{
  assert.equal(Object.keys(RJ_EVENT_SOURCE_POLICY).length,27);
  assert.deepEqual(sourcePolicyForRjEvent('TSUNAMI').primary,
    ['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE']);
  assert.deepEqual(sourcePolicyForRjEvent('TEMPERATURA').primary,
    ['ALERTA_RIO','DEFESA_CIVIL_RJ']);
  assert.deepEqual(sourcePolicyForRjEvent('TEMPERATURA').tiebreak.slice(0,3),
    ['INMET','INPE_CPTEC','NOAA']);
});
test('extreme hazards cannot be averaged',()=>{
  for(const event of ['RAIOS','TSUNAMI','SISMOS','RAJADA','DESLIZAMENTO'])
    assert.equal(canAverageRjEvent(event,[]),false);
});
test('routing exposes policy without claiming live integration',()=>{
  const t=rjSourceRouting({ibge:'3304557',phenomenon:'TEMPERATURA'});
  assert.equal(t.approvedPolicyOperational,false);
  assert.deepEqual(t.approvedPrimarySources,['ALERTA_RIO','DEFESA_CIVIL_RJ']);
  const tsunami=rjSourceRouting({region:'ATLANTICO',phenomenon:'TSUNAMI'});
  assert.ok(tsunami.sources.some(s=>s.id==='NOAA'));
  assert.ok(tsunami.sources.some(s=>s.id==='MARINHA_CHM'));
});
