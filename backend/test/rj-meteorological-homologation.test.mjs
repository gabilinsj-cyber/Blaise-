import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {rjSourceRouting,RJ_PHENOMENA} from '../src/rj-phenomenon-source-policy.mjs';
import {
  RJ_METEO_HOMOLOGATION_ID,
  RJ_METEO_HOMOLOGATION_VERSION,
  RJ_METEO_TABLE2,
  RJ_METEO_MARINE_TABLE,
  linkedRjDisputeSteps,
  RJ_METEO_SOURCE_STATUS,
  buildRjMeteorologicalHomologationTables,
  checkRjSourceProductEvidence,
} from '../src/rj-meteorological-homologation.mjs';

const NOW=Date.parse('2026-10-11T14:00:00Z');
test('Table 1 catalogs exactly 30 phenomena with canonical IDs and no INEA',()=>{
  const tables=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  assert.equal(tables.id,'BLAISE-RJ-METEO-HOMOLOG-01');
  assert.equal(tables.version,RJ_METEO_HOMOLOGATION_VERSION);
  assert.equal(tables.table1.length,30);
  assert.deepEqual(tables.table1.map(r=>r.id),RJ_PHENOMENA);
  assert.equal(tables.excludedSource,'INEA');
  assert.equal(tables.operatorVerified,false);
  assert.equal(tables.automaticPublication,false);
  for(const row of tables.table1){
    assert.ok(row.label&&row.coverage&&row.criteria);
    assert.equal(row.sourceIds.length,row.sourceClasses.length);
    assert.ok(row.sourceIds.length>=1);
    assert.equal(row.sourceIds.some(id=>id.includes('INEA')),false);
    assert.equal(row.status,RJ_METEO_SOURCE_STATUS.NOT_HOMOLOGATED);
    assert.equal(row.observedLiveData,false);
    assert.equal(row.commercialUseAuthorized,false);
    assert.equal(row.automaticAlertAllowed,false);
  }
});
test('Table 2 is the independent, thirteen-step data provenance and dispute criterion',()=>{
  assert.equal(RJ_METEO_TABLE2.length,13);
  assert.deepEqual(RJ_METEO_TABLE2.map(x=>x.code),[
    'PRIMEIRAS_TRES','DUAS_OFICIAIS','OFICIAIS_DIVERGENTES',
    'INPE_PRIMEIRO','WINDY_SUBSIDIARIO','DUAS_FONTES_EXIBIDAS',
    'SEM_DADO_NOVO','CATEGORIAS_ESPECIAIS',
    'P1_CONJUNTA','OPENWEATHER_COMPLEMENTAR','PONDERACAO_COMPATIVEL',
    'MAR_SATELITE_ESPECIALIZADO','AUTORIZACAO_E_FRESCOR']);
  assert.equal(RJ_METEO_TABLE2[4].step,5);
  assert.match(RJ_METEO_TABLE2[3].decision,/INPE/);
  assert.match(RJ_METEO_TABLE2[4].decision,/Windy/);
  assert.equal(RJ_METEO_TABLE2.some(x=>/média mista de modelo e sensor/i.test(x.decision)),true);
});
test('Table 1 is linked to the applicable Table 2 steps for every phenomenon',()=>{
  const t=buildRjMeteorologicalHomologationTables();
  const stepCodes=new Set(t.table2.map(x=>x.code));
  assert.equal(t.table1.length,30);
  for(const item of t.table1) {
    const matching=linkedRjDisputeSteps(item.id);
    assert.deepEqual(item.disputeStepCodes,matching.map(x=>x.code));
    assert.ok(item.disputeStepCodes.length>=4);
    assert.ok(item.disputeStepCodes.every(x=>stepCodes.has(x)));
    assert.equal(item.automaticAlertAllowed,false);
  }
  assert.throws(()=>linkedRjDisputeSteps('INEA'),/rj_unknown_linked_phenomenon/);
});
test('only compatible numeric station variables are eligible for an observed weighted average',()=>{
  const t=buildRjMeteorologicalHomologationTables();
  const by=Object.fromEntries(t.table1.map(row=>[row.id,row]));
  for(const key of ['TEMPERATURA','VENTO','RAJADA','UMIDADE','CHUVA_ATUAL',
    'CHUVA_ACUMULADA','PRESSAO_ATMOSFERICA']) {
    assert.equal(by[key].applicableToWeightedObservation,true);
    assert.ok(by[key].disputeStepCodes.includes('PONDERACAO_COMPATIVEL'));
  }
  for(const key of ['SENSACAO_TERMICA','TEMPORAL','TEMPESTADE','GRANIZO',
    'SISMO','TSUNAMI','RESSACA','CICLONE_EXTRATROPICAL']) {
    assert.equal(by[key].applicableToWeightedObservation,false);
  }
  assert.equal(by.SENSACAO_TERMICA.calculatedOnlyWithValidInputs,true);
});
test('five maritime source categories link the relevant Table 1 ocean phenomena and keep tsunami as official alert only',()=>{
  const t=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  assert.equal(t.marineTable.length,5);
  assert.equal(t.marineTable,RJ_METEO_MARINE_TABLE);
  const by=Object.fromEntries(t.table1.map(row=>[row.id,row]));
  for(const category of t.marineTable) {
    assert.ok(category.phenomena.length>0);
    for(const name of category.phenomena)
      assert.ok(by[name].linkedMarineCategories.includes(category.code));
  }
  const sea=t.marineTable.find(x=>x.code==='ONDAS_SWELL');
  assert.deepEqual(sea.sources,['NOAA','COPERNICUS_MARINE']);
  const storm=t.marineTable.find(x=>x.code==='TEMPESTADES_ATLANTICO');
  assert.ok(storm.sources.includes('EUMETSAT_SATELLITE'));
  const tsunami=t.marineTable.find(x=>x.code==='TSUNAMI');
  assert.deepEqual(tsunami.sources,['NOAA','AUTORIDADES_BRASILEIRAS']);
  assert.equal(by.TSUNAMI.applicableToWeightedObservation,false);
  assert.ok(by.TSUNAMI.disputeStepCodes.includes('MAR_SATELITE_ESPECIALIZADO'));
});
test('each of 92 RJ municipal selections produces source routes without fake city coverage',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES){
    const table=buildRjMeteorologicalHomologationTables({ibge:city.ibge});
    assert.equal(table.table1.length,30);
    const temp=table.table1.find(x=>x.id==='TEMPERATURA');
    assert.equal(temp.sourceIds.includes('ALERTA_RIO'),city.ibge==='3304557');
    assert.ok(temp.sourceIds.indexOf('INPE_CPTEC_FORECAST')<temp.sourceIds.indexOf('WINDY_MODELO'));
    const rain=table.table1.find(x=>x.id==='CHUVA_ACUMULADA');
    assert.ok(rain.sourceIds.includes('CEMADEN_RJ'));
    const tsunami=table.table1.find(x=>x.id==='TSUNAMI');
    assert.ok(tsunami.sourceIds.includes('DEFESA_CIVIL_RJ_REGIONAL'));
    assert.ok(tsunami.sourceIds.includes('NOAA'));
    assert.equal(tsunami.sourceIds.includes('MARINHA_CHM'),false);
    assert.ok(tsunami.sourceIds.includes('USGS_EARTHQUAKE'));
  }
  assert.throws(()=>buildRjMeteorologicalHomologationTables({ibge:'4106902'}));
});
test('specialist tidal, seismic, cyclone, radar and lightning authorities retain their own routes',()=>{
  const tables=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  const by=id=>tables.table1.find(x=>x.id===id).sourceIds;
  assert.deepEqual(by('VAZAO_RIO'),['ANA_HIDROWEB','SGB_SACE']);
  assert.equal(by('RESSACA')[0],'NOAA');
  assert.equal(by('RESSACA').includes('MARINHA_CHM'),false);
  assert.equal(by('CICLONE_EXTRATROPICAL')[0],'NOAA');
  assert.equal(by('SISMO')[0],'USGS_EARTHQUAKE');
  assert.equal(by('RAIOS')[0],'REDE_RAIOS_AUTORIZADA');
  assert.equal(by('RADAR')[0],'ALERTA_RIO');
  assert.equal(by('PRESSAO_ATMOSFERICA').includes('INPE_CPTEC_FORECAST'),true);
});
test('homologation cannot be self-attested with synthetic or otherwise unverifiable API evidence',()=>{
  const row={
    sourceId:'INMET_STATION',productId:'A652_HOURLY',
    sourceUrl:'https://apitempo.inmet.gov.br/estacao/A652',
    licenseProofId:'approved_product_terms_ticket',
    lastObservedAt:'2026-10-11T13:57:00Z',
    checkedAt:'2026-10-11T13:58:00Z',
    approvedByOperator:true,observedSourceResponse:true,now:NOW,
  };
  assert.deepEqual(checkRjSourceProductEvidence(row).verified,false);
  assert.equal(checkRjSourceProductEvidence(row).state,RJ_METEO_SOURCE_STATUS.LIVE_PROOF_PENDING);
  assert.equal(checkRjSourceProductEvidence({...row,sourceId:'INEA'}).reason,'SOURCE_NOT_ELIGIBLE');
  assert.equal(checkRjSourceProductEvidence({...row,sourceId:'UNRECOGNIZED_PROVIDER'}).reason,'SOURCE_NOT_ELIGIBLE');
  assert.equal(checkRjSourceProductEvidence({...row,licenseProofId:null}).reason,'PRODUCT_RIGHTS_NOT_PROVEN');
  assert.equal(checkRjSourceProductEvidence({...row,observedSourceResponse:false}).verified,false);
  assert.equal(checkRjSourceProductEvidence({...row,approvedByOperator:false}).mayPublish,false);
  assert.equal(checkRjSourceProductEvidence({...row,lastObservedAt:'2026-10-10T13:57:00Z'}).reason,'OBSERVATION_OR_REVIEW_TOO_OLD');
  assert.equal(checkRjSourceProductEvidence({...row,sourceUrl:'http://example.com/feed'}).reason,'SOURCE_URL_NOT_SECURE');
});
test('source routing and Table 1 cannot be treated as real-time measurements or permission to issue warnings',()=>{
  const table=buildRjMeteorologicalHomologationTables();
  for(const r of table.table1){
    assert.equal(r.observedLiveData,false);
    assert.equal(r.evidenceRequired,true);
    assert.equal(r.automaticAlertAllowed,false);
  }
  assert.equal(RJ_METEO_HOMOLOGATION_ID,'BLAISE-RJ-METEO-HOMOLOG-01');
  const live=rjSourceRouting({ibge:'3304557',phenomenon:'TEMPERATURA'});
  assert.equal(live.liveData,'NOT_CONFIRMED');
});
