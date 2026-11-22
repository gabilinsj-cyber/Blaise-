import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initializeRjWeatherApiFreeStaging,
 auditAgent13WeatherApiCache,
 RJ_AGENT13_WA_CACHE_AUDIT_INTERVAL_MS,
 RJ_WA_STAGING_SECRET_REF
} from '../src/rj-weatherapi-free-staging-wiring.mjs';
import {normalizeWeatherApiFreePrivateCache}
 from '../src/rj-weatherapi-free-private-cache.mjs';

const NOW=Date.parse('2026-11-22T17:52:24.000Z');
const validEnv=()=>({
 BLAISE_WA_STAGING_PRIVATE_READ_ENABLED:'true',
 BLAISE_WA_STAGING_OPERATOR_APPROVED:'true',
 BLAISE_WA_STAGING_ISOLATED_NO_TRAFFIC_CONFIRMED:'true',
 BLAISE_WA_STAGING_PROJECT:'blaise-v6-rj',
 BLAISE_WA_STAGING_SECRET_VERSION:'2',
 BLAISE_WA_STAGING_PROVIDER_CALLS_DISABLED:'true',
 BLAISE_WA_STAGING_CLIENT_RELEASE_DISABLED:'true',
 BLAISE_WA_STAGING_QUOTA_RESERVATION_DISABLED:'true'
});
function privateRow(){
 return normalizeWeatherApiFreePrivateCache({
  status:'PRIVATE_CACHE_VALID',sourceId:'WEATHERAPI_FREE',
  nature:'E',ibge:'3304557',providerDataVerified:true,
  municipalityGeographyVerified:true,publicReleaseEnabled:false,
  checkedAt:new Date(NOW).toISOString(),
  location:{lat:-22.9068,lon:-43.1729},
  data:{
   last_updated_epoch:Math.floor(Date.parse('2026-11-22T17:45:00Z')/1000),
   temp_c:31.1,feelslike_c:35.5,humidity:61,cloud:93,
   wind_kph:6.1,gust_kph:20.1,precip_mm:0.17,
   pressure_mb:1007,uv:8.2,condition:{code:1153,text:'NOT_STORED'}
  }
 },{now:NOW});
}
function fakeDb(){
 const data=new Map();
 const counts={factory:0,reads:0,writes:0,transactions:0,providerCalls:0};
 const db={
  collection(collection){return {doc(id){return {
   async get(){
    counts.reads+=1;
    const key=collection+'/'+id;
    return {exists:data.has(key),data:()=>structuredClone(data.get(key))};
   },
   async set(){counts.writes+=1;throw Error('QA must not write cache');}
  }}}},
  async runTransaction(){counts.transactions+=1;throw Error('QA must not reserve calls');}
 };
 return {db,data,counts,createDatabase:async()=>{
  counts.factory+=1;return db;
 }};
}
test('default and Cloud Run service remain disabled even with QA flags supplied',async()=>{
 const m=fakeDb();
 const a=await initializeRjWeatherApiFreeStaging({
  env:{},createDatabase:m.createDatabase
 });
 const b=await initializeRjWeatherApiFreeStaging({
  env:{...validEnv(),K_SERVICE:'blaise-v6-rj-backend'},
  createDatabase:m.createDatabase
 });
 const c=await initializeRjWeatherApiFreeStaging({
  env:{...validEnv(),K_REVISION:'blaise-v6-rj-backend-00058-sos'},
  createDatabase:m.createDatabase
 });
 for(const x of [a,b,c]){
  assert.equal(x.state,'DISABLED');
  assert.equal(x.readPrivateCache,null);
  assert.equal(x.configured,false);
  assert.equal(x.clientReleaseApproved,false);
 }
 assert.equal(m.counts.factory,0);
 assert.equal(RJ_WA_STAGING_SECRET_REF.version,'2');
 assert.equal(RJ_WA_STAGING_SECRET_REF.accessAtRuntimeVerified,false);
 assert.equal(RJ_AGENT13_WA_CACHE_AUDIT_INTERVAL_MS,60_000);
});
test('missing any distinct operator, isolation, quota or release lock fails closed',async()=>{
 const m=fakeDb();
 for(const key of Object.keys(validEnv())){
  const e=validEnv();delete e[key];
  const x=await initializeRjWeatherApiFreeStaging({
   env:e,createDatabase:m.createDatabase
  });
  assert.equal(x.configured,false,key);
 }
 assert.equal(m.counts.factory,0);
});
test('isolated QA wires Firestore and quota guard without reserving, polling, reading secrets or publishing',async()=>{
 const m=fakeDb();
 const x=await initializeRjWeatherApiFreeStaging({
  env:validEnv(),createDatabase:m.createDatabase,clock:()=>NOW
 });
 assert.equal(x.state,'PRIVATE_CACHE_QA_READY_NOT_RELEASED');
 assert.equal(x.sharedMonthlyBudgetGuardConfigured,true);
 assert.equal(x.maxReservedFreeCallsPerMonth,80_000);
 assert.equal(x.automaticProviderCalls,false);
 assert.equal(x.creditReservationsPerformed,0);
 assert.equal(x.automaticPollingEnabled,false);
 assert.equal(x.clientReleaseApproved,false);
 assert.equal(x.clientThermalReleaseApproved,false);
 assert.equal(x.dashboardOptions.weatherApiSubscriberReleaseApproved,false);
 assert.equal(x.dashboardOptions.weatherApiThermalRedistributionApproved,false);
 assert.equal(x.dashboardOptions.readWeatherApiPrivateCache,x.readPrivateCache);
 assert.deepEqual(m.counts,{factory:1,reads:0,writes:0,transactions:0,providerCalls:0});
});
test('Agente 13 style private freshness audits true observation age, never checkedAt as fresh observation',async()=>{
 const m=fakeDb();
 m.data.set('blaise_rj_weatherapi_free_private_current_v1/3304557',privateRow());
 const x=await initializeRjWeatherApiFreeStaging({
  env:validEnv(),createDatabase:m.createDatabase,clock:()=>NOW
 });
 const report=await x.auditSelectedCities(['3304557','3303302']);
 assert.equal(report.auditPerformed,true);
 assert.equal(report.providerCalls,0);
 assert.equal(report.creditReservations,0);
 assert.equal(report.liveMinuteSchedulerEnabled,false);
 assert.deepEqual(report.records.map(x=>x.status),[
  'CACHE_MEASUREMENT_FRESH','UNAVAILABLE_OR_EXPIRED'
 ]);
 assert.equal(report.records[0].sourceValidAt,'2026-11-22T17:45:00.000Z');
 assert.equal(report.records[0].sourceAgeMinutes,7.4);
 assert.equal(report.records[0].notAnOfficialStation,true);
 assert.equal(report.records[0].officialAlertAllowed,false);
 assert.equal(JSON.stringify(report).includes('31.1'),false);
 assert.equal(m.counts.writes,0);
 assert.equal(m.counts.transactions,0);
 assert.equal(m.counts.reads,2);
 const expired=await auditAgent13WeatherApiCache({
  municipalityIbges:['3304557'],readPrivateCache:x.readPrivateCache,
  now:NOW+36*60_000
 });
 assert.equal(expired.records[0].status,'UNAVAILABLE_OR_EXPIRED');
 assert.equal(expired.records[0].sourceValidAt,null);
});
test('monitor refuses more than two, invalid or duplicate IBGEs without a Firestore read',async()=>{
 let n=0;
 const reader=async()=>{n+=1;return privateRow();};
 for(const municipalityIbges of [
  ['3304557','3303302','3301009'],['3304557','3304557'],
  ['0000000'],[],[3304557]
 ]){
  const report=await auditAgent13WeatherApiCache({
   municipalityIbges,readPrivateCache:reader,now:NOW
  });
  assert.equal(report.status,'INVALID_AUDIT_SCOPE');
 }
 assert.equal(n,0);
});
