import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_PHENOMENA, RJ_SOURCE_CLASS, rjSourceRouting} from '../src/rj-phenomenon-source-policy.mjs';
import {buildRjMeteorologicalHomologationTables, RJ_METEO_HOMOLOGATION_VERSION} from '../src/rj-meteorological-homologation.mjs';

// Some UI rows (current and accumulated rain) intentionally share the
// same backend precipitation route; no unsupported live feed is claimed.
const atmosphericPhenomena = [
  'TEMPERATURA', 'SENSACAO_TERMICA', 'CHUVA_ACUMULADA',
  'TEMPORAL', 'TEMPESTADE', 'VENTO', 'RAJADA',
  'PRESSAO_ATMOSFERICA', 'UMIDADE', 'GRANIZO',
];
test('OpenWeatherMap is supplementary comparison only after official RJ channels', () => {
  for(const phenomenon of atmosphericPhenomena) {
    const rio=rjSourceRouting({ibge:'3304557',phenomenon});
    const other=rjSourceRouting({ibge:'3303302',phenomenon});
    for(const route of [rio,other]) {
      const ids=route.sources.map(x=>x.id);
      const api=route.sources.find(x=>x.id==='OPENWEATHERMAP_API');
      assert.ok(api, phenomenon);
      assert.equal(api.role,RJ_SOURCE_CLASS.COMPARISON);
      assert.equal(api.automaticAlertAuthority,false);
      assert.equal(api.dataAvailability,'REQUIRES_LIVE_VALIDATION');
      assert.ok(ids.indexOf('INMET_STATION') < ids.indexOf('OPENWEATHERMAP_API'));
      assert.ok(ids.indexOf('DEFESA_CIVIL_RJ_REGIONAL') < ids.indexOf('OPENWEATHERMAP_API'));
      assert.equal(route.liveData,'NOT_CONFIRMED');
    }
    assert.equal(rio.sources[0].id,'ALERTA_RIO');
    assert.ok(!other.sources.some(x=>x.id==='ALERTA_RIO'));
  }
});
test('Copernicus and EUMETSAT supplement ocean analyses, not tsunami warnings', () => {
  const waves=rjSourceRouting({region:'ATLANTICO',phenomenon:'ONDAS'});
  const cyclone=rjSourceRouting({region:'ATLANTICO',phenomenon:'CICLONE_EXTRATROPICAL'});
  const rain=rjSourceRouting({region:'ATLANTICO',phenomenon:'CHUVA_ATLANTICO'});
  assert.equal(waves.sources[0].id,'MARINHA_CHM');
  assert.ok(waves.sources.some(x=>x.id==='COPERNICUS_MARINE'));
  for(const route of [cyclone,rain]) {
    assert.ok(route.sources.some(x=>x.id==='EUMETSAT_SATELLITE'));
    assert.ok(route.sources.some(x=>x.id==='COPERNICUS_MARINE'));
    assert.ok(route.sources.every(x=>x.automaticAlertAuthority===false));
  }
  const tsunami=rjSourceRouting({ibge:'3304557',phenomenon:'TSUNAMI'});
  assert.ok(tsunami.sources.some(x=>x.id==='MARINHA_CHM'));
  assert.ok(tsunami.sources.some(x=>x.id==='NOAA'));
  assert.ok(tsunami.sources.some(x=>x.id==='DEFESA_CIVIL_RJ_REGIONAL'));
  assert.ok(!tsunami.sources.some(x=>['COPERNICUS_MARINE','EUMETSAT_SATELLITE','OPENWEATHERMAP_API'].includes(x.id)));
});
test('original 25 phenomena and protected homologation status remain intact', () => {
  const tables=buildRjMeteorologicalHomologationTables();
  assert.equal(RJ_PHENOMENA.length,25);
  assert.equal(tables.table1.length,25);
  assert.equal(tables.table2.length,8);
  assert.equal(RJ_METEO_HOMOLOGATION_VERSION,'2026-10-11.v2');
  assert.equal(tables.operatorVerified,false);
  assert.equal(tables.automaticPublication,false);
  assert.ok(tables.table1.every(x=>x.automaticAlertAllowed===false && x.observedLiveData===false));
});
