import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {rjSourceRouting,RJ_PHENOMENA} from '../src/rj-phenomenon-source-policy.mjs';
import {
  RJ_METEO_HOMOLOGATION_ID,
  RJ_METEO_HOMOLOGATION_VERSION,
  RJ_METEO_TABLE2,
  RJ_METEO_SOURCE_STATUS,
  buildRjMeteorologicalHomologationTables,
  checkRjSourceProductEvidence,
} from '../src/rj-meteorological-homologation.mjs';

const NOW=Date.parse('2026-10-11T14:00:00Z');
test('Table 1 catalogs 28 categories including health, air and UV with canonical IDs and no INEA',()=>{
  const tables=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  assert.equal(tables.id,'BLAISE-RJ-METEO-HOMOLOG-01');
  assert.equal(tables.version,RJ_METEO_HOMOLOGATION_VERSION);
  assert.equal(tables.table1.length,28);
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
test('2026-10-11 v2 Table 1 includes Monitora RJ, MonitorAr-Rio and conditional Plataforma Clima without INEA',()=>{
  const rio=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  const other=buildRjMeteorologicalHomologationTables({ibge:'3303302'});
  const by=(tbl,id)=>tbl.table1.find(x=>x.id===id);
  assert.equal(rio.version,'2026-10-11.v2');
  assert.deepEqual(RJ_PHENOMENA.slice(-3),['EXCESSO_CALOR_SAUDE','QUALIDADE_AR','INDICE_UV']);
  assert.ok(by(rio,'EXCESSO_CALOR_SAUDE').sourceIds.includes('MONITORA_RJ_SES'));
  assert.ok(by(rio,'QUALIDADE_AR').sourceIds.includes('MONITORAR_RIO_SMAC'));
  assert.ok(by(rio,'RADAR').sourceIds.includes('PLATAFORMA_CLIMA_RIO'));
  assert.ok(!by(other,'QUALIDADE_AR').sourceIds.includes('MONITORAR_RIO_SMAC'));
  assert.ok(!by(other,'RADAR').sourceIds.includes('PLATAFORMA_CLIMA_RIO'));
  for(const row of rio.table1) {
    assert.equal(row.aggregatedOrRepublishedSourcesAreNotIndependent,true);
    assert.equal(row.observedLiveData,false);
    assert.equal(row.commercialUseAuthorized,false);
    assert.equal(row.sourceIds.some(x=>x==='INEA'),false);
  }
});
test('Table 2 is the independent, eight-step data provenance and dispute criterion',()=>{
  assert.equal(RJ_METEO_TABLE2.length,8);
  assert.deepEqual(RJ_METEO_TABLE2.map(x=>x.code),[
    'PRIMEIRAS_TRES','DUAS_OFICIAIS','OFICIAIS_DIVERGENTES',
    'INPE_PRIMEIRO','WINDY_SUBSIDIARIO','DUAS_FONTES_EXIBIDAS',
    'SEM_DADO_NOVO','CATEGORIAS_ESPECIAIS']);
  assert.equal(RJ_METEO_TABLE2[4].step,5);
  assert.match(RJ_METEO_TABLE2[3].decision,/INPE/);
  assert.match(RJ_METEO_TABLE2[4].decision,/Windy/);
  assert.equal(RJ_METEO_TABLE2.some(x=>/média mista de modelo e sensor/i.test(x.decision)),true);
});
test('each of 92 RJ municipal selections produces source routes without fake city coverage',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES){
    const table=buildRjMeteorologicalHomologationTables({ibge:city.ibge});
    assert.equal(table.table1.length,28);
    const temp=table.table1.find(x=>x.id==='TEMPERATURA');
    assert.equal(temp.sourceIds.includes('ALERTA_RIO'),city.ibge==='3304557');
    assert.ok(temp.sourceIds.indexOf('INPE_CPTEC_FORECAST')<temp.sourceIds.indexOf('WINDY_MODELO'));
    const rain=table.table1.find(x=>x.id==='CHUVA_ACUMULADA');
    assert.ok(rain.sourceIds.includes('CEMADEN_RJ'));
    const tsunami=table.table1.find(x=>x.id==='TSUNAMI');
    assert.ok(tsunami.sourceIds.includes('DEFESA_CIVIL_RJ_REGIONAL'));
    assert.ok(tsunami.sourceIds.includes('NOAA'));
    assert.ok(tsunami.sourceIds.includes('MARINHA_CHM'));
    assert.ok(tsunami.sourceIds.includes('USGS_EARTHQUAKE'));
  }
  assert.throws(()=>buildRjMeteorologicalHomologationTables({ibge:'4106902'}));
});
test('specialist tidal, seismic, cyclone, radar and lightning authorities retain their own routes',()=>{
  const tables=buildRjMeteorologicalHomologationTables({ibge:'3304557'});
  const by=id=>tables.table1.find(x=>x.id===id).sourceIds;
  assert.deepEqual(by('VAZAO_RIO'),['ANA_HIDROWEB','SGB_SACE']);
  assert.equal(by('RESSACA')[0],'MARINHA_CHM');
  assert.equal(by('CICLONE_EXTRATROPICAL')[0],'MARINHA_CHM');
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
