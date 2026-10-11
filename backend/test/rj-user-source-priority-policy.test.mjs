import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_EVENT_SOURCE_POLICY, sourcePolicyForRjEvent, canAverageRjEvent } from '../src/rj-user-source-priority-policy.mjs';
import { rjSourceRouting } from '../src/rj-phenomenon-source-policy.mjs';

test('all 28 approved RJ phenomena have independent policy rows',()=>{
  assert.equal(Object.keys(RJ_EVENT_SOURCE_POLICY).length,28);
  assert.deepEqual(sourcePolicyForRjEvent('TSUNAMI').primary,
    ['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE']);
  assert.deepEqual(sourcePolicyForRjEvent('TEMPERATURA').primary,
    ['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET']);
  assert.deepEqual(sourcePolicyForRjEvent('TEMPERATURA').tiebreak.slice(0,2),
    ['INPE_CPTEC','WINDY_MODELO']);
  assert.deepEqual(sourcePolicyForRjEvent('EXCESSO_CALOR_SAUDE').primary,['MONITORA_RJ_SES']);
});
test('five situational weather sources follow the latest approved municipal consultation hierarchy',()=>{
  const primary=['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET'];
  for(const event of ['TEMPERATURA','SENSACAO_TERMICA','CHUVA_ATUAL',
    'CHUVA_ACUMULADA','TEMPORAL','VENTO','RAJADA','UMIDADE','GRANIZO']) {
    const p=sourcePolicyForRjEvent(event);
    assert.deepEqual(p.primary,primary,event);
    assert.deepEqual(p.tiebreak.slice(0,2),['INPE_CPTEC','WINDY_MODELO'],event);
  }
  // Specialist hazards keep specialist leads, not artificial Alerta Rio coverage.
  assert.deepEqual(sourcePolicyForRjEvent('SISMOS').primary.slice(0,1),['USGS']);
  assert.deepEqual(sourcePolicyForRjEvent('TSUNAMI').primary,
    ['NOAA_TSUNAMI','MARINHA_CHM','AUTORIDADE_BRASILEIRA_COMPETENTE']);
  assert.deepEqual(sourcePolicyForRjEvent('QUALIDADE_AR').primary,['MONITORAR_RIO_SMAC']);
  assert.deepEqual(sourcePolicyForRjEvent('EXCESSO_CALOR_SAUDE').primary,['MONITORA_RJ_SES']);
});

test('extreme hazards cannot be averaged',()=>{
  for(const event of ['RAIOS','TSUNAMI','SISMOS','RAJADA','DESLIZAMENTO'])
    assert.equal(canAverageRjEvent(event,[]),false);
});
test('routing exposes policy without claiming live integration',()=>{
  const t=rjSourceRouting({ibge:'3304557',phenomenon:'TEMPERATURA'});
  assert.equal(t.approvedPolicyOperational,false);
  assert.deepEqual(t.approvedPrimarySources,['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET']);
  const tsunami=rjSourceRouting({region:'ATLANTICO',phenomenon:'TSUNAMI'});
  assert.ok(tsunami.sources.some(s=>s.id==='NOAA'));
  assert.ok(tsunami.sources.some(s=>s.id==='MARINHA_CHM'));
});

test('Monitora SES and municipal MonitorAr are distinct, not assumed live',()=>{
  const rio=rjSourceRouting({ibge:'3304557',phenomenon:'EXCESSO_CALOR_SAUDE'});
  assert.ok(rio.sources.some(s=>s.id==='MONITORA_RJ_SES'));
  assert.ok(rio.sources.some(s=>s.id==='MONITORAR_RIO_SMAC'));
  assert.equal(rio.liveData,'NOT_CONFIRMED');
  const niteroi=rjSourceRouting({ibge:'3303302',phenomenon:'EXCESSO_CALOR_SAUDE'});
  assert.ok(niteroi.sources.some(s=>s.id==='MONITORA_RJ_SES'));
  assert.ok(!niteroi.sources.some(s=>s.id==='MONITORAR_RIO_SMAC'));
});
