import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_TABLE1_THREE,RJ_TABLE2_FIVE,RJ_TABLE1_TEN_COMPLEMENT,
  RJ_SPECIALIST_MARINE_SOURCES,RJ_TABLES_VERSION,
} from '../src/rj-canonical-table-sources.mjs';
import {buildRjMeteorologicalHomologationTables} from '../src/rj-meteorological-homologation.mjs';
import {rjSourceRouting} from '../src/rj-phenomenon-source-policy.mjs';

test('single hierarchy across tables, routing and homologation in city Rio',()=>{
  assert.deepEqual(RJ_TABLE1_THREE,[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.deepEqual(RJ_TABLE2_FIVE,[
    'ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION',
    'INPE_CPTEC_FORECAST','WINDY_MODELO']);
  assert.equal(RJ_TABLE1_TEN_COMPLEMENT,'OPENWEATHERMAP_API');
  const table=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  assert.equal(table.version,RJ_TABLES_VERSION);
  assert.deepEqual(table.primaryTable1Sources,RJ_TABLE1_THREE);
  assert.deepEqual(table.disputeTable2FiveSources,RJ_TABLE2_FIVE);
  for(const code of ['TEMPERATURA','SENSACAO_TERMICA','CHUVA_ATUAL',
    'CHUVA_ACUMULADA','TEMPORAL','VENTO','RAJADA','PRESSAO_ATMOSFERICA','UMIDADE','GRANIZO']){
    const row=table.table1.find(r=>r.id===code);
    assert.equal(row.tenPhenomenaComplement,RJ_TABLE1_TEN_COMPLEMENT);
    const routed=rjSourceRouting({ibge:'3304557',phenomenon:code}).sources.map(x=>x.id);
    assert.equal(routed[0],'ALERTA_RIO');
    assert.ok(routed.indexOf('DEFESA_CIVIL_RJ_REGIONAL')<routed.indexOf('INMET_STATION'));
    assert.ok(routed.indexOf('INMET_STATION')<routed.indexOf('INPE_CPTEC_FORECAST'));
    assert.ok(routed.indexOf('INPE_CPTEC_FORECAST')<routed.indexOf('WINDY_MODELO'));
  }
});
test('all 92 RJ municipalities: never assign Alerta Rio outside Rio municipality',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge}of RJ_MUNICIPALITIES){
    const table=buildRjMeteorologicalHomologationTables({ibge});
    const temp=table.table1.find(x=>x.id==='TEMPERATURA');
    assert.equal(temp.sourceIds.includes('ALERTA_RIO'),ibge==='3304557');
    assert.equal(temp.status,'NAO_HOMOLOGADA');
    assert.equal(temp.automaticAlertAllowed,false);
  }
});
test('marine routes remain specialist and independent of temperature-source hierarchy',()=>{
  for(const phenomenon of ['RESSACA','ONDAS','SWELL','MARE','CORRENTES_MARINHAS','TEMPERATURA_MAR']){
    const route=rjSourceRouting({ibge:'3304557',phenomenon}).sources.map(x=>x.id);
    assert.equal(route[0],'MARINHA_CHM');
    assert.ok(route.includes('COPERNICUS_MARINE'));
    assert.ok(route.includes('NOAA'));
  }
  assert.deepEqual(RJ_SPECIALIST_MARINE_SOURCES,[
    'MARINHA_CHM','NOAA','COPERNICUS_MARINE','EUMETSAT_SATELLITE']);
  const cyclone=rjSourceRouting({region:'ATLANTICO',phenomenon:'CICLONE_EXTRATROPICAL'}).sources.map(x=>x.id);
  assert.equal(cyclone[0],'MARINHA_CHM');
  assert.ok(cyclone.includes('EUMETSAT_SATELLITE'));
});
