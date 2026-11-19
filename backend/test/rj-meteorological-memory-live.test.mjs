import test from 'node:test';
import assert from 'node:assert/strict';
import {METEOBLUE_BASIC6H_FIELDS} from '../src/rj-meteoblue-basic6h-parse.mjs';
import {evaluatePrivateMeteoblueCache,evaluatePrivateNoaaWaveReading,evaluatePrivateMetNorwayReading,createRjMeteorologicalMemoryReader}
 from '../src/rj-meteorological-memory-live.mjs';

const NOW=Date.parse('2026-11-19T13:00:00Z');
const slot=new Date(NOW+60*60_000).toISOString();
const forecast=()=>({
 status:'FORECAST_PARSED_PRIVATE_STAGING',sourceId:'METEOBLUE_FREE_FORECAST',
 ibge:'3304557',category:'P',forecastOnly:true,observational:false,
 publishedToAndroid:false,publishedToSubscribers:false,
 scientificallyHomologated:false,
 auditReadyForPrivateReview:true,metadataRunVerified:true,
 unitMetadataVerified:true,sourceCoordinatesVerified:true,
 completeFieldCoverage:true,
 issuedAt:new Date(NOW-60*60_000).toISOString(),
 validTimes:[slot],
 values:Object.values(METEOBLUE_BASIC6H_FIELDS).map(f=>({
  field:f.name,unit:f.unit,semantics:f.meaning,
  values:[f.min===800?1015:f.min]
 }))
});
test('private memory displays seven numeric forecast fields only from audited fresh cache',()=>{
 const r=evaluatePrivateMeteoblueCache(forecast(),{now:NOW});
 assert.equal(r.status,'PRIVATE_CACHE_VALID');
 assert.equal(r.privateOnly,true);
 assert.equal(r.fields.length,7);
 assert.equal(r.forecastValidAt,slot);
 assert.ok(r.fields.every(f=>f.kind==='P'));
 assert.equal(r.subscriberPublished,false);
 assert.equal(r.providerBalanceVerified,false);
});
test('expired, unverified, wrongly located and unscientific inputs never look live',()=>{
 const bad=[
  null,
  {...forecast(),ibge:'3303906'},
  {...forecast(),publishedToSubscribers:true},
  {...forecast(),auditReadyForPrivateReview:false},
  {...forecast(),sourceCoordinatesVerified:false},
  {...forecast(),completeFieldCoverage:false},
  {...forecast(),validTimes:[new Date(NOW-60*60_000).toISOString()]},
  {...forecast(),validTimes:[new Date(NOW+9*60*60_000).toISOString()]},
  {...forecast(),values:forecast().values.slice(0,6)},
  {...forecast(),values:forecast().values.map((f,i)=>i===0?{...f,values:[null]}:f)},
  {...forecast(),values:forecast().values.map((f,i)=>i===0?{...f,values:[99999]}:f)}
 ];
 for(const item of bad){
  const result=evaluatePrivateMeteoblueCache(item,{now:NOW});
  assert.equal(result.status,'INDISPONIVEL');
  assert.equal(result.fields.length,0);
 }
});
test('read-only memory never calls a provider and never pretends other providers have live evidence',async()=>{
 let cacheReads=0,ledgerReads=0;
 const reader=createRjMeteorologicalMemoryReader({
  clock:()=>NOW,
  getCached:async id=>{assert.equal(id,'3304557');cacheReads++;return forecast()},
  readLocalBudgetStatus:async()=>{
   ledgerReads++;
   return {sourceOfCounts:'LOCAL_FIRESTORE_RESERVATIONS_ONLY',
    localSpentCredits:4000,callsReservedToday:1,maxCallsPerUtcDay:1};
  }
 });
 const report=await reader();
 assert.equal(report.scope,'ADMIN_ONLY');
 assert.equal(report.pollingWeatherProviders,false);
 assert.equal(report.clientPublishingEnabled,false);
 assert.equal(report.currentObservationsClaimed,false);
 assert.equal(cacheReads,1);
 assert.equal(ledgerReads,1);
 assert.equal(report.privateMeteoblue.status,'PRIVATE_CACHE_VALID');
 assert.equal(report.quotaLedger.localSpentCredits,4000);
 assert.equal(report.quotaLedger.providerCreditBalance,'UNVERIFIED_IN_PROVIDER_DASHBOARD');
 assert.equal(report.sources.find(x=>x.id==='HG_BRASIL_WEATHER_PRO').state,'NOT_CONTRACTED');
 assert.ok(report.sources.filter(x=>x.id!=='METEOBLUE_FREE_FORECAST')
   .every(x=>x.clientPublished===false&&x.state!=='PRIVATE_CACHE_VALID'));
 assert.ok(!JSON.stringify(report).includes('apikey'));
});
test('absent cache and Firestore fail closed without assigning zeros to missing weather',async()=>{
 const reader=createRjMeteorologicalMemoryReader({
  clock:()=>NOW,getCached:async()=>{throw Error('offline')},
  readLocalBudgetStatus:async()=>{throw Error('offline')}
 });
 const r=await reader();
 assert.equal(r.privateMeteoblue.status,'INDISPONIVEL');
 assert.deepEqual(r.privateMeteoblue.fields,[]);
 assert.equal(r.quotaLedger,null);
});

test('real NOAA GFS-Wave worker cache can be read without ever fetching provider',async()=>{
 const validAt=new Date(NOW-20*60_000).toISOString();
 const checkedAt=new Date(NOW-60_000).toISOString();
 const example={state:'CURRENT',snapshot:{
  nature:'MODELO',units:'m',waveHeightM:1.45,
  sourceUrl:'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?file=test',
  issuedAt:new Date(NOW-7*60*60_000).toISOString(),
  validAt,checkedAt,expiresAt:new Date(NOW+30*60_000).toISOString(),
  latitude:-23.2,longitude:-42.1
 }};
 const result=evaluatePrivateNoaaWaveReading(example,{now:NOW});
 assert.equal(result.status,'PRIVATE_CACHE_VALID');
 assert.equal(result.waveHeightM,1.45);
 assert.equal(result.kind,'P');
 for(const invalid of [
  {...example,state:'STALE'},
  {...example,snapshot:{...example.snapshot,validAt:new Date(NOW-65*60_000).toISOString()}},
  {...example,snapshot:{...example.snapshot,waveHeightM:NaN}},
  {...example,snapshot:{...example.snapshot,units:'knots'}},
  {...example,snapshot:{...example.snapshot,sourceUrl:'https://example.org/'}},
  {...example,snapshot:{...example.snapshot,expiresAt:new Date(NOW-1).toISOString()}}
 ]){
  assert.equal(evaluatePrivateNoaaWaveReading(invalid,{now:NOW}).status,'INDISPONIVEL');
 }
 const reader=createRjMeteorologicalMemoryReader({
  clock:()=>NOW,readNoaaWave:async()=>example
 });
 const report=await reader();
 assert.equal(report.privateNoaaWave.waveHeightM,1.45);
 assert.equal(report.sources.find(x=>x.id==='NOAA_GFS_WAVE').state,'PRIVATE_CACHE_VALID');
 assert.equal(report.pollingWeatherProviders,false);
});
test('MET Norway optional cache is a licensed P forecast; no ECMWF station observation',async()=>{
 const f={status:'FORECAST_AVAILABLE',ibge:'3304557',source:'MET_NORWAY_LOCATIONFORECAST_2',
  originWeather:'ECMWF_IFS',license:'CC BY 4.0',officialObservation:false,
  officialAlert:false,
  issuedAt:new Date(NOW-2*60*60_000).toISOString(),
  validAt:new Date(NOW-30*60_000).toISOString(),
  checkedAt:new Date(NOW-2000).toISOString()};
 assert.equal(evaluatePrivateMetNorwayReading(f,{now:NOW}).status,'PRIVATE_CACHE_VALID');
 assert.equal(evaluatePrivateMetNorwayReading({...f,officialObservation:true},{now:NOW}).status,'INDISPONIVEL');
 assert.equal(evaluatePrivateMetNorwayReading({...f,checkedAt:new Date(NOW-4*60_000).toISOString()},{now:NOW}).status,'INDISPONIVEL');
 const reader=createRjMeteorologicalMemoryReader({
  clock:()=>NOW,readMetNorway:async code=>{assert.equal(code,'3304557');return f;}
 });
 const r=await reader();
 assert.equal(r.privateMetNorway.status,'PRIVATE_CACHE_VALID');
 assert.equal(r.sources.find(x=>x.id==='ECMWF_IFS').state,'PRIVATE_CACHE_VALID');
});
