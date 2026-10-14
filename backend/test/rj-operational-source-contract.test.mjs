import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {
  rjOperationalSources,RJ_PRIMARY_OFFICIAL,RJ_MODEL_DISPUTE,
} from '../src/rj-operational-source-contract.mjs';

test('operational first three are Alerta Rio / Defesa Civil / INMET, without replacing them with OWM',()=>{
  assert.deepEqual(RJ_PRIMARY_OFFICIAL,[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.deepEqual(RJ_MODEL_DISPUTE,['INPE_CPTEC_FORECAST','WINDY_MODELO']);
  for(const phenomenon of ['TEMPERATURA','CHUVA_ATUAL','CHUVA_ACUMULADA','VENTO','RAJADA']) {
    const rio=rjOperationalSources({ibge:'3304557',phenomenon});
    assert.deepEqual(rio.primaryOfficialSources,RJ_PRIMARY_OFFICIAL);
    assert.deepEqual(rio.modelTieBreakSources,RJ_MODEL_DISPUTE);
    assert.equal(rio.supplementaryIsNotOfficialPriority,true);
    assert.equal(rio.primaryOfficialSources.includes('OPENWEATHERMAP_API'),false);
    assert.equal(rio.extraComplementaryProducts.includes('OPENWEATHERMAP_API'),true);
    assert.equal(rio.sourceDataVerified,false);
    assert.equal(rio.automaticWeatherAlertAllowed,false);
  }
});
test('all 92 RJ municipalities use available authorities, Alerta Rio only municipality of Rio',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES) {
    for(const phenomenon of ['TEMPERATURA','CHUVA_ATUAL','VENTO','TEMPORAL']) {
      const row=rjOperationalSources({ibge,phenomenon});
      assert.equal(row.primaryOfficialSources.includes('ALERTA_RIO'),ibge==='3304557');
      assert.ok(row.primaryOfficialSources.includes('DEFESA_CIVIL_RJ_REGIONAL'));
      assert.ok(row.primaryOfficialSources.includes('INMET_STATION'));
      assert.deepEqual(row.modelTieBreakSources,['INPE_CPTEC_FORECAST','WINDY_MODELO']);
      assert.equal(row.availableMunicipalities,92);
      assert.equal(row.doNotAverageModelWithMeasurement,true);
    }
  }
});
test('specialized marine and seismic phenomena are never forced into generic 3+2 station consensus',()=>{
  for(const phenomenon of ['SISMO','TSUNAMI','RESSACA','ONDAS','RISCO_HIDROLOGICO']) {
    const row=rjOperationalSources({ibge:'3304557',phenomenon});
    assert.equal(row.specializedRouting,true);
    assert.deepEqual(row.modelTieBreakSources,[]);
    assert.equal(row.sourceDataVerified,false);
  }
  assert.throws(()=>rjOperationalSources({ibge:'4106902',phenomenon:'TEMPERATURA'}),TypeError);
});
