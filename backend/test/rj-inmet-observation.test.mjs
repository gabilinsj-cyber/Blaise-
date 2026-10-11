import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjInmetStationAdapter, projectRjInmetStationRows,
  validateRjInmetStationCatalog,RJ_INMET_STATION_CATALOG_URL,
} from '../src/rj-inmet-observation.mjs';
import {
  RJ_METEOROLOGY_PATH,RJ_METEOROLOGY_CONTRACT,
  createRjMeteorologicalHandler,createRjMeteorologicalService,
  parseRjMeteorologyQuery,
} from '../src/rj-meteorological-http.mjs';

const NOW=Date.parse('2026-10-10T18:00:00Z');
const station={SG_ESTADO:'RJ',CD_SITUACAO:'Operante',
  CD_ESTACAO:'A652',DC_NOME:'RIO DE JANEIRO',
  VL_LATITUDE:'-22,9',VL_LONGITUDE:'-43,2'};
const hourly={DT_MEDICAO:'2026-10-10',HR_MEDICAO:'1700',
  TEM_INS:'28,5',UMD_INS:'70',VEN_VEL:'3,0',VEN_RAJ:'6.5',CHUVA:'5,2'};
function fakeFetch(history) {
  return async url=>{
    history.push(url);
    // The test catalog deliberately contains no Niterói station.
    // This does not assert that Niterói has no station in the real INMET API.
    const result=url===RJ_INMET_STATION_CATALOG_URL?[station,
      {...station,SG_ESTADO:'PR',DC_NOME:'CURITIBA',CD_ESTACAO:'A999'}]:
      [hourly,{...hourly,DT_MEDICAO:'2026-10-07'}];
    return {status:200,text:async()=>JSON.stringify(result)};
  };
}
function response(){
  return {
    statusCode:null,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v},
    end(v){this.body=JSON.parse(v)},
  };
}
test('INMET catalog admits only real operating RJ city station with coordinates',()=>{
  const grouped=validateRjInmetStationCatalog([station,
    {...station,SG_ESTADO:'PR'},
    {...station,CD_SITUACAO:'Desativada'},
    {...station,DC_NOME:'RIO DE JANEIRO',VL_LATITUDE:'0'},
    {...station,DC_NOME:'RIO DE JANEIRO'}]);
  assert.equal(grouped.get('3304557').length,1);
  assert.equal(grouped.get('3304557')[0].stationId,'A652');
  assert.equal(grouped.has('4106902'),false);
});
test('INMET real hourly readings preserve UTC observation, station and typed physical units',()=>{
  const all=validateRjInmetStationCatalog([station]);
  const found=all.get('3304557')[0];
  for(const [variable,expected,unit] of [
    ['TEMPERATURA_C',28.5,'°C'],
    ['UMIDADE_PERCENTUAL',70,'%'],
    ['VENTO_KMH',10.8,'km/h'],
    ['RAJADA_KMH',23.4,'km/h'],
    ['CHUVA_MM_1H',5.2,'mm'],
  ]){
    const rows=projectRjInmetStationRows([hourly],found,{
      ibge:'3304557',variable,now:NOW});
    assert.equal(rows.length,1);
    assert.ok(Math.abs(rows[0].value-expected)<0.00001);
    assert.equal(rows[0].unit,unit);
    assert.equal(rows[0].stationId,'A652');
    assert.equal(rows[0].ibge,'3304557');
    assert.equal(rows[0].observedAt,'2026-10-10T17:00:00.000Z');
    assert.equal(rows[0].notMunicipalAverage,true);
    assert.equal(rows[0].origin,'OFFICIAL_OBSERVATION');
  }
  const rain=projectRjInmetStationRows([hourly],found,{
    ibge:'3304557',variable:'CHUVA_MM_1H',now:NOW});
  assert.equal(rain[0].measurementWindowMinutes,60);
});
test('source disabled by default performs zero network calls',async()=>{
  const urls=[];const adapter=createRjInmetStationAdapter({fetchImpl:fakeFetch(urls),now:()=>NOW});
  const result=await adapter.read({ibge:'3304557',variable:'TEMPERATURA_C'});
  assert.equal(result.state,'DISABLED_AWAITING_ACCESS_AND_TERMS');
  assert.equal(result.observations.length,0);
  assert.deepEqual(urls,[]);
});
test('enabled adapter runs first actual HTTPS catalog and station calls once, then caches them',async()=>{
  const urls=[];
  const adapter=createRjInmetStationAdapter({
    enabled:true,termsApproved:true,fetchImpl:fakeFetch(urls),now:()=>NOW});
  const [one,two]=await Promise.all([
    adapter.read({ibge:'3304557',variable:'TEMPERATURA_C'}),
    adapter.read({ibge:'3304557',variable:'TEMPERATURA_C'}),
  ]);
  assert.equal(one.state,'CURRENT_STATION_OBSERVATION');
  assert.equal(two.observations[0].value,28.5);
  assert.equal(urls.length,2);
  assert.equal(urls[0],RJ_INMET_STATION_CATALOG_URL);
  const cached=await adapter.read({ibge:'3304557',variable:'TEMPERATURA_C'});
  assert.equal(cached.observations[0].value,28.5);
  assert.equal(urls.length,2);
  const noStation=await adapter.read({ibge:'3303302',variable:'TEMPERATURA_C'});
  assert.equal(noStation.state,'NO_OPERATING_STATION_NAMED_FOR_CITY');
  assert.equal(noStation.observations.length,0);
  assert.equal(urls.length,2);
});
test('no old data, bad values, wrong dates or other states can become official readings',()=>{
  const st=validateRjInmetStationCatalog([station]).get('3304557')[0];
  for(const bad of [
    {...hourly,DT_MEDICAO:'2026-10-02'},
    {...hourly,HR_MEDICAO:'9999'},
    {...hourly,TEM_INS:'9999'},
    {...hourly,TEM_INS:'Não informado'},
    {...hourly,DT_MEDICAO:'2026-10-11'},
  ])assert.equal(projectRjInmetStationRows([bad],st,{
    ibge:'3304557',variable:'TEMPERATURA_C',now:NOW}).length,0);
});
test('weather GET endpoint is gated, validates scope and exposes one actual station rather than a city mean',async()=>{
  const urls=[];
  const stationAdapter=createRjInmetStationAdapter({
    enabled:true,termsApproved:true,fetchImpl:fakeFetch(urls),now:()=>NOW});
  const service=createRjMeteorologicalService({inmetAdapter:stationAdapter,now:()=>NOW});
  let delegated=0;
  const delegate=()=>{delegated++};
  const disabled=createRjMeteorologicalHandler(delegate,{
    enabled:true,termsApproved:false,service,
  });
  await disabled({url:RJ_METEOROLOGY_PATH,method:'GET'},response());
  assert.equal(delegated,1);
  assert.equal(urls.length,0);
  const allowed=createRjMeteorologicalHandler(delegate,{
    enabled:true,termsApproved:true,service,
  });
  const query=`${RJ_METEOROLOGY_PATH}?ibge=3304557&variable=TEMPERATURA_C`;
  const res=response();
  await allowed({url:query,method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.contract,RJ_METEOROLOGY_CONTRACT);
  assert.equal(res.body.state,'ONE_VERIFIED_OFFICIAL_SOURCE');
  assert.equal(res.body.value,28.5);
  assert.equal(res.body.sourceRows.length,1);
  assert.equal(res.body.sourceRows[0].sourceId,'INMET_STATION');
  assert.equal(res.body.sourceRows[0].stationId,'A652');
  assert.equal(res.body.isMunicipalAverage,false);
  assert.equal(res.body.warnsAutomatically,false);
  assert.ok(urls.length>0);
  const other=response();
  await allowed({url:query.replace('3304557','4106902'),method:'GET'},other);
  assert.equal(other.statusCode,400);
  const invalid=response();
  await allowed({url:query+'&unauthorized=1',method:'GET'},invalid);
  assert.equal(invalid.statusCode,400);
  const noCityStation=response();
  await allowed({url:query.replace('3304557','3303302'),method:'GET'},noCityStation);
  assert.equal(noCityStation.statusCode,503);
  const post=response();
  await allowed({url:query,method:'POST'},post);
  assert.equal(post.statusCode,405);
});
test('query does not accept extra fields, invalid IBGE, outside-RJ or missing variables',()=>{
  for(const url of [
    `${RJ_METEOROLOGY_PATH}?ibge=4106902&variable=TEMPERATURA_C`,
    `${RJ_METEOROLOGY_PATH}?ibge=3304557&variable=TSUNAMI`,
    `${RJ_METEOROLOGY_PATH}?ibge=3304557&variable=TEMPERATURA_C&token=secret`,
    `${RJ_METEOROLOGY_PATH}?ibge=3304557&ibge=3304557`,
  ])assert.throws(()=>parseRjMeteorologyQuery(url));
});
