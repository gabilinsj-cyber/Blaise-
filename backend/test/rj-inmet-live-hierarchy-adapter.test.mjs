import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjInmetLiveAdapters,
  RJ_INMET_CATALOG_URL,
  projectRjInmetOnOwnMap,
} from '../src/rj-inmet-live-hierarchy-adapter.mjs';
import {consultRjSourcesUntilTwo} from '../src/rj-hierarchical-weather-resolution.mjs';
import {createRjWeatherSourceExecutor} from '../src/rj-agent-orchestration.mjs';

const NOW=Date.parse('2026-10-12T12:00:00.000Z');
const station=(changes={})=>({
  SG_ESTADO:'RJ',SG_ENTIDADE:'INMET',CD_SITUACAO:'Operante',DC_NOME:'RIO DE JANEIRO',
  CD_ESTACAO:'A652',VL_LATITUDE:'-22,9000',VL_LONGITUDE:'-43,2000',...changes,
});
const reading=(changes={})=>({
  CD_ESTACAO:'A652',DT_MEDICAO:'2026-10-12',HR_MEDICAO:'1159',
  TEM_INS:'28,5',UMD_INS:'77',VEN_VEL:'4.5',
  VEN_RAJ:'9',CHUVA:'5.5',...changes,
});
function fakeApi({catalog=[station()],hourly=[reading()],status=200,contentType='application/json'}={}) {
  const visited=[];
  const fetchImpl=async (url,options)=>{
    const href=String(url);
    visited.push({href,method:options.method,redirect:options.redirect});
    if(href===RJ_INMET_CATALOG_URL) return new Response(JSON.stringify(catalog),{
      status,headers:{'content-type':contentType},
    });
    if(href.startsWith('https://apitempo.inmet.gov.br/estacao/'))
      return new Response(JSON.stringify(hourly),{status,
        headers:{'content-type':contentType}});
    throw Error('unexpected network host '+href);
  };
  return {fetchImpl,visited};
}
const qualityEvidence={stationId:'A652',variable:'TEMPERATURA_C',weight:1,basis:'VERIFIED_STATION_QC_AND_LOCAL_SKILL',evidenceId:'fixture-station-qc'};
const input={ibge:'3304557',variable:'TEMPERATURA_C',now:NOW};

test('INMET adapter never contacts external network without BOTH feature and rights gate',async()=>{
  const api=fakeApi();
  for(const options of [{},{enabled:true},{usageApproved:true}]){
    const adapter=createRjInmetLiveAdapters({...options,fetchImpl:api.fetchImpl}).INMET_STATION;
    const r=await adapter(input);
    assert.equal(r.observations.length,0);
    assert.equal(r.automaticAlertAuthorized,false);
  }
  assert.equal(api.visited.length,0);
});
test('official INMET live API responses produce a real, locally matched, dated station observation',async()=>{
  const api=fakeApi();
  const adapters=createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  });
  const r=await adapters.INMET_STATION(input);
  assert.equal(r.status,'VALIDATED_RECENT_OFFICIAL_STATION_READING');
  assert.equal(r.observations.length,1);
  assert.equal(r.observations[0].sourceId,'INMET_STATION');
  assert.equal(r.observations[0].stationId,'A652');
  assert.equal(r.observations[0].value,28.5);
  assert.equal(r.observations[0].unit,'°C');
  assert.equal(r.observations[0].ibge,'3304557');
  assert.equal(r.observations[0].observedAt,'2026-10-12T11:59:00.000Z');
  assert.equal(r.observations[0].origin,'OFFICIAL_OBSERVATION');
  assert.ok(r.observations[0].sourceUrl.endsWith('/A652'));
  assert.deepEqual(api.visited.map(x=>x.href),[
    RJ_INMET_CATALOG_URL,
    'https://apitempo.inmet.gov.br/estacao/2026-10-11/2026-10-12/A652',
  ]);
  assert.ok(api.visited.every(x=>x.method==='GET'&&x.redirect==='manual'));
});
test('wind and gust speed are converted from INMET m/s to km/h; rainfall uses hourly mm',async()=>{
  const api=fakeApi();
  const adapter=createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION;
  const expected={
    VENTO_KMH:[16.2,'km/h'],
    RAJADA_KMH:[32.4,'km/h'],
    CHUVA_MM_1H:[5.5,'mm'],
    UMIDADE_PERCENTUAL:[77,'%'],
  };
  for(const [variable,[value,unit]] of Object.entries(expected)){
    const r=await adapter({...input,variable});
    assert.equal(r.observations[0].value,value);
    assert.equal(r.observations[0].unit,unit);
    assert.equal(r.observations[0].measurementWindowMinutes,
      variable==='CHUVA_MM_1H'?60:undefined);
  }
  assert.equal(api.visited.length,2); // catalog and hourly are both reused
});
test("only Rio local station is accepted; never substitute another municipality or state",async()=>{
  const api=fakeApi({catalog:[
    station({CD_ESTACAO:'A777',DC_NOME:'NITEROI'}),
    station({CD_ESTACAO:'A652',SG_ESTADO:'SP'}),
    station({CD_ESTACAO:'A666',DC_NOME:'DUQUE DE CAXIAS'}),
  ]});
  const adapter=createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION;
  const rio=await adapter(input);
  assert.equal(rio.status,'NO_EXACT_MUNICIPAL_INMET_STATION');
  const outside=await adapter({...input,ibge:'4106902'});
  assert.equal(outside.status,'INVALID_RJ_SCOPE_OR_VARIABLE');
  assert.equal(api.visited.length,1);
});
test('a catalog entry from another operator is never attributed to INMET',async()=>{
  const api=fakeApi({catalog:[station({SG_ENTIDADE:'OUTRA_REDE'})]});
  const adapter=createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  }).INMET_STATION;
  const result=await adapter(input);
  assert.equal(result.status,'NO_EXACT_MUNICIPAL_INMET_STATION');
  assert.equal(result.observations.length,0);
});
test('recent official B-series station IDs remain eligible when city and operator match',async()=>{
  const api=fakeApi({catalog:[station({CD_ESTACAO:'B652'})],
    hourly:[reading({CD_ESTACAO:'B652'})]});
  const adapter=createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  }).INMET_STATION;
  const r=await adapter(input);
  assert.equal(r.status,'VALIDATED_RECENT_OFFICIAL_STATION_READING');
  assert.equal(r.observations[0].stationId,'B652');
});
test('municipality with exact catalog station uses its own label even if accents differ',async()=>{
  const api=fakeApi({catalog:[station({DC_NOME:'NITEROI',CD_ESTACAO:'A618'})],
    hourly:[reading({CD_ESTACAO:'A618'})]});
  const adapter=createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION;
  const result=await adapter({...input,ibge:'3303302'});
  assert.equal(result.observations[0].ibge,'3303302');
  assert.equal(result.observations[0].stationId,'A618');
});
test('outdated/future dates and out-of-range values are rejected, not backfilled',async()=>{
  for(const candidate of [
    reading({DT_MEDICAO:'2026-10-11',HR_MEDICAO:'0600'}),
    reading({DT_MEDICAO:'2026-10-13',HR_MEDICAO:'0300'}),
    reading({DT_MEDICAO:'2026-10-12',HR_MEDICAO:'2460'}),
    reading({TEM_INS:'9999'}),
    reading({TEM_INS:'N/D'}),
  ]) {
    const api=fakeApi({hourly:[candidate]});
    const r=await createRjInmetLiveAdapters({
      enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
    }).INMET_STATION(input);
    assert.equal(r.status,'NO_RECENT_VALID_MEASUREMENT');
    assert.equal(r.observations.length,0);
  }
});
test('upstream redirects and malformed or oversized catalogs fail closed',async()=>{
  const api=fakeApi({status:302});
  const bad=await createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  }).INMET_STATION(input);
  assert.equal(bad.status,'INMET_FETCH_OR_PRODUCT_VALIDATION_FAILED');
  const malformed=fakeApi({catalog:[]});
  const r=await createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:malformed.fetchImpl,
  }).INMET_STATION(input);
  assert.equal(r.status,'INMET_FETCH_OR_PRODUCT_VALIDATION_FAILED');
});
test('adapter is a real data bridge into the existing prioritized two-source Blaise Fusion calculator',async()=>{
  const api=fakeApi({hourly:[reading({TEM_INS:'29'})]});
  const adapters={
    ...createRjInmetLiveAdapters({enabled:true,usageApproved:true,qualityEvidence,
      fetchImpl:api.fetchImpl}),
    DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[{
      origin:'OFFICIAL_OBSERVATION',sourceId:'DEFESA_CIVIL',
      stationId:'DC-TEST-1',ibge:'3304557',variable:'TEMPERATURA_C',
      value:28,unit:'°C',weight:1,observedAt:'2026-10-12T11:59:00.000Z',
      latitude:-22.905,longitude:-43.205,
      sourceUrl:'https://defesacivil.rj.gov.br/example-station-fixture',
    }],forecasts:[]}),
  };
  const answer=await consultRjSourcesUntilTwo({...input,adapters});
  assert.equal(answer.state,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.equal(answer.value,28.5);
  assert.deepEqual(answer.selectedSourceIds,['DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION']);
  assert.equal(answer.automaticAlertAuthorized,false);
});

test('Blaise agent executor uses live INMET adapter on demand, with Defender input independent of INMET',async()=>{
  const api=fakeApi({hourly:[reading({TEM_INS:'29'})]});
  const runCase=createRjWeatherSourceExecutor({
    inmetLive:{enabled:true,usageApproved:true,qualityEvidence,fetchImpl:api.fetchImpl},
    clock:()=>NOW,
    sourceAdapters:{
      DEFESA_CIVIL_RJ_REGIONAL:async()=>({observations:[{
        origin:'OFFICIAL_OBSERVATION',sourceId:'DEFESA_CIVIL',
        stationId:'DC-TEST-1',ibge:'3304557',variable:'TEMPERATURA_C',
        value:28,unit:'°C',weight:1,observedAt:'2026-10-12T11:59:00.000Z',
        latitude:-22.905,longitude:-43.205,
        sourceUrl:'https://defesacivil.rj.gov.br/fixture-only',
      }]}),
    },
  });
  const report=await runCase({ibge:'3304557',variable:'TEMPERATURA_C'});
  assert.equal(report.sourceStatus,'TWO_COMPATIBLE_OFFICIAL_SOURCES');
  assert.equal(report.observedOrEstimatedValue,28.5);
  assert.equal(report.calculatedValues,28.5);
  assert.equal(report.latestVerifiedResult.officialMeasurement,false);
  assert.equal(report.publishersTriggered,false);
  assert.equal(report.audibleAlert,false);
  assert.equal(api.visited.length,2);
});
test('Blaise executor defaults never activate real network or pretend active sources',async()=>{
  const api=fakeApi();
  const runCase=createRjWeatherSourceExecutor({
    inmetLive:{enabled:false,usageApproved:false,fetchImpl:api.fetchImpl},
    clock:()=>NOW,
  });
  const report=await runCase(input);
  assert.equal(report.sourceStatus,'NO_VERIFIABLE_SOURCE_VALUE');
  assert.equal(report.observedOrEstimatedValue,null);
  assert.equal(report.publishersTriggered,false);
  assert.equal(api.visited.length,0);
});

test('real INMET station reading becomes a single own-map point without borrowed radar pixels',async()=>{
  const api=fakeApi();
  const adapter=createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  }).INMET_STATION;
  const result=await adapter(input);
  const map=projectRjInmetOnOwnMap(result,{now:NOW});
  assert.equal(map.status,'AVAILABLE_STATION_POINTS');
  assert.equal(map.points.length,1);
  assert.equal(map.points[0].sourceId,'INMET_STATION');
  assert.equal(map.points[0].stationId,'A652');
  assert.equal(map.points[0].variable,'TEMPERATURE_C');
  assert.equal(map.points[0].value,28.5);
  assert.equal(map.radarFrameAvailable,false);
  assert.equal(map.thirdPartyImageCopied,false);
  assert.equal(map.estimatedMunicipalAverage,null);
  assert.equal(map.automaticWarningAuthorized,false);
});
test('own-map wind rendering preserves m/s units and missing/stale observations remain absent',async()=>{
  const api=fakeApi();
  const adapter=createRjInmetLiveAdapters({
    enabled:true,usageApproved:true,fetchImpl:api.fetchImpl,
  }).INMET_STATION;
  const wind=await adapter({...input,variable:'VENTO_KMH'});
  const map=projectRjInmetOnOwnMap(wind,{now:NOW});
  assert.equal(map.points[0].variable,'WIND_MS');
  assert.equal(map.points[0].unit,'m/s');
  assert.equal(map.points[0].value,4.5);
  assert.equal(projectRjInmetOnOwnMap(wind,{now:NOW+3*3_600_000}).points.length,0);
  assert.equal(projectRjInmetOnOwnMap({observations:[{value:90}]},{now:NOW}).points.length,0);
});

test('a live adapter cannot invent calibration weights or revive delayed observations',async()=>{
  const api=fakeApi();
  const r=await createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION(input);
  assert.equal(r.observations[0].usagePermissionStatus,'VERIFIED_FOR_APP_DATA_DISPLAY');
  assert.equal(r.observations[0].weight,undefined);
  assert.equal(r.observations[0].qualityWeight,undefined);
  const delayed=await createRjInmetLiveAdapters({enabled:true,usageApproved:true,
    fetchImpl:fakeApi({hourly:[reading({HR_MEDICAO:'1154'})]}).fetchImpl}).INMET_STATION(input);
  assert.equal(delayed.observations.length,0);
});

test('one INMET station without data does not block another actual station in the same municipality',async()=>{
  const api=fakeApi({catalog:[station({CD_ESTACAO:'A651'}),station()]});
  const fetchImpl=async(url,opts)=>String(url).endsWith('/A651')
    ?new Response(null,{status:204}):api.fetchImpl(url,opts);
  const r=await createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl}).INMET_STATION(input);
  assert.equal(r.observations[0].stationId,'A652');
});
test('quality weights are applied only to their calibrated station and variable',async()=>{
  const api=fakeApi();
  const run=createRjInmetLiveAdapters({enabled:true,usageApproved:true,qualityEvidence,fetchImpl:api.fetchImpl}).INMET_STATION;
  assert.equal((await run(input)).observations[0].qualityWeight,1);
  assert.equal((await run({...input,variable:'VENTO_KMH'})).observations[0].qualityWeight,undefined);
});

test('Rio district station labels match Android policy and prioritize A652',async()=>{
  const catalog=[
    station({CD_ESTACAO:'A602',DC_NOME:'RIO DE JANEIRO - MARAMBAIA'}),
    station({DC_NOME:'RIO DE JANEIRO - VILA MILITAR'}),
  ];
  const api=fakeApi({catalog});
  const adapter=createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION;
  const result=await adapter(input);
  assert.equal(result.observations[0].stationId,'A652');
  assert.equal(result.observations[0].stationName,'RIO DE JANEIRO - VILA MILITAR');
  assert.equal(api.visited.length,2);
});

test('district fallback keeps municipality boundaries and rejects ambiguous station names',async()=>{
  for(const [ibge,name] of [
    ['3304557','RIO DE JANEIRO EXTRA'],
    ['3303302','NITEROI - OUTRO LOCAL'],
    ['3304557','DUQUE DE CAXIAS - RIO DE JANEIRO'],
  ]) {
    const api=fakeApi({catalog:[station({DC_NOME:name})]});
    const result=await createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl:api.fetchImpl}).INMET_STATION({...input,ibge});
    assert.equal(result.status,'NO_EXACT_MUNICIPAL_INMET_STATION');
    assert.equal(api.visited.length,1);
  }
});

test('unavailable preferred Rio station falls back to a validated district station',async()=>{
  const api=fakeApi({catalog:[station({DC_NOME:'RIO DE JANEIRO - VILA MILITAR'}),
    station({CD_ESTACAO:'A602',DC_NOME:'RIO DE JANEIRO / MARAMBAIA'})],
    hourly:[reading({CD_ESTACAO:'A602'})]});
  const fetchImpl=(url,opts)=>String(url).endsWith('/A652')
    ?Promise.resolve(new Response(null,{status:204})):api.fetchImpl(url,opts);
  const result=await createRjInmetLiveAdapters({enabled:true,usageApproved:true,fetchImpl}).INMET_STATION(input);
  assert.equal(result.observations[0].stationId,'A602');
  assert.equal(result.observations[0].ibge,'3304557');
  assert.equal(result.observations[0].observedAt,'2026-10-12T11:59:00.000Z');
});
