import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {RJ_PHENOMENA,rjSourceRouting} from '../src/rj-phenomenon-source-policy.mjs';
import {RJ_TABLE1_THREE,RJ_TABLE2_FIVE} from '../src/rj-table12-five-source-dispute.mjs';
import {
  buildRjMeteorologicalHomologationTables,RJ_METEO_MARINE_TABLE,RJ_METEO_TABLE2,
} from '../src/rj-meteorological-homologation.mjs';

test('operational Table 1 official precedence and Table 2 model fallback never regress to old order',()=>{
  assert.deepEqual(RJ_TABLE1_THREE,['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.deepEqual(RJ_TABLE2_FIVE.slice(0,2),['INPE_CPTEC_FORECAST','WINDY_MODELO']);
  assert.equal(RJ_TABLE1_THREE.some(x=>x==='OPENWEATHERMAP_API'),false);
  assert.equal(RJ_TABLE2_FIVE.includes('OPENWEATHERMAP_API'),true);
  assert.equal(RJ_TABLE2_FIVE.includes('CEMADEN_RJ'),true);
});
test('all 92 RJ municipalities reflect exact Alerta Rio geographic limit and five-source ordering',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES){
    const table=buildRjMeteorologicalHomologationTables({ibge:city.ibge});
    assert.equal(table.table1.length,30);
    assert.deepEqual(table.primaryTable1Sources,
      RJ_TABLE1_THREE.filter(id=>id!=='ALERTA_RIO'||String(city.ibge)==='3304557'));
    assert.deepEqual(table.disputeTable2FiveSources,RJ_TABLE2_FIVE);
    const route=rjSourceRouting({ibge:city.ibge,phenomenon:'TEMPERATURA'});
    const ids=route.sources.map(x=>x.id);
    assert.equal(ids.includes('ALERTA_RIO'),String(city.ibge)==='3304557');
    assert.ok(ids.indexOf('DEFESA_CIVIL_RJ_REGIONAL')<ids.indexOf('INMET_STATION'));
    assert.ok(ids.indexOf('INMET_STATION')<ids.indexOf('INPE_CPTEC_FORECAST'));
    assert.ok(ids.indexOf('INPE_CPTEC_FORECAST')<ids.indexOf('WINDY_MODELO'));
    assert.equal(route.liveData,'NOT_CONFIRMED');
    assert.equal(route.ineaPolicy,'EXCLUDED');
  }
});
test('marine entries remain specialist guidance with official authority rather than modeled tsunami proof',()=>{
  const by=Object.fromEntries(RJ_METEO_MARINE_TABLE.map(row=>[row.code,row]));
  assert.equal(RJ_METEO_MARINE_TABLE.length,5);
  assert.ok(by.CICLONES_OCEANICOS.sources.includes('EUMETSAT_SATELLITE'));
  assert.ok(by.TEMPESTADES_ATLANTICO.sources.includes('NOAA'));
  assert.ok(by.ONDAS_SWELL.sources.includes('COPERNICUS_MARINE'));
  assert.equal(by.RESSACA_LITORAL.alertAuthority,'MARINHA_CHM');
  assert.deepEqual(by.TSUNAMI.sources,['NOAA','MARINHA_CHM','AUTORIDADES_BRASILEIRAS']);
  assert.equal(RJ_METEO_TABLE2.some(step=>step.code==='MAR_SATELITE_ESPECIALIZADO'),true);
});
test('numerical fusion never extends to storms, tsunami or outdated municipal observation claims',()=>{
  const table=buildRjMeteorologicalHomologationTables();
  assert.deepEqual(table.table1.map(x=>x.id),RJ_PHENOMENA);
  for(const id of ['TEMPESTADE','TEMPORAL','TSUNAMI','SISMO','RESSACA']){
    const row=table.table1.find(x=>x.id===id);
    assert.equal(row.applicableToWeightedObservation,false);
    assert.equal(row.automaticAlertAllowed,false);
  }
  assert.equal(table.operatorVerified,false);
  assert.equal(table.automaticPublication,false);
  assert.equal(table.excludedSource,'INEA');
});
