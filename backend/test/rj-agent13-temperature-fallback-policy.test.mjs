import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideRjAgent13TemperatureFallback,
  RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS as INTERVAL,
  RJ_AGENT13_TEMPERATURE_FALLBACK_MAX_AGE_MS as MAX_AGE
} from '../src/rj-agent13-temperature-fallback-policy.mjs';

const NOW=Date.parse('2026-11-17T12:00:00Z');
const ibge='3304557';
const baseline=()=>[1,2,3].map(rank=>({
  rank,sourceId:['DWD_ICON_GLOBAL','NOAA_GFS','ECMWF_IFS'][rank-1],
  verifiedByBackend:true,status:'UNAVAILABLE',
  checkedAt:new Date(NOW).toISOString(),
  values:{temperatureC:null,feelsLikeC:null}
}));
const candidate=(age=10*60_000)=>({
  status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
  sourceId:'OPENWEATHER_ONECALL4_CURRENT',ibge,
  type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
  officialObservation:false,officialAlert:false,
  validAt:new Date(NOW-age).toISOString(),
  retrievedAt:new Date(NOW-1000).toISOString(),
  values:{temperatureC:27.1,providerFeelsLikeC:30.2,
    rainMm1h:60,windKmh:70,gustKmh:130}
});
test('35-minute policy never schedules or calls a provider without audited three source records',()=>{
  const o=decideRjAgent13TemperatureFallback({municipalityIbge:ibge,now:NOW});
  assert.equal(o.status,'BLOCKED');
  assert.equal(o.reason,'PRIMARY_SOURCE_AUDIT_INCOMPLETE');
  assert.equal(INTERVAL,35*60_000);
  assert.equal(MAX_AGE,35*60_000);
});
test('only explicitly audited missing primary values may use provider temperature and feels-like',()=>{
  const o=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:baseline(),
    providerEstimate:candidate(20*60_000),now:NOW
  });
  assert.equal(o.status,'FALLBACK_ESTIMATE');
  assert.equal(o.fields.temperatureC,27.1);
  assert.equal(o.fields.feelsLikeC,30.2);
  assert.deepEqual(Object.keys(o.fields),['temperatureC','feelsLikeC']);
  assert.equal(o.otherWeatherFieldsUsed,false);
  assert.equal(o.ageSeconds,1200);
  assert.equal(o.maximumAgeSeconds,2100);
  assert.equal(o.minimumCallIntervalSeconds,2100);
  assert.equal(o.officialAlert,false);
  assert.equal(o.officialObservation,false);
  assert.equal(JSON.stringify(o).includes('rainMm1h'),false);
  assert.equal(JSON.stringify(o).includes('windKmh'),false);
});
test('per-field priority: if official temperature exists, fallback only fills feels-like',()=>{
  const readings=baseline();
  readings[0]={...readings[0],status:'CURRENT',
    validAt:new Date(NOW-60_000).toISOString(),
    values:{temperatureC:25.2,feelsLikeC:null}
  };
  const o=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:readings,providerEstimate:candidate(),now:NOW
  });
  assert.equal(o.status,'FALLBACK_ESTIMATE');
  assert.equal(o.fields.temperatureC,null);
  assert.equal(o.fields.feelsLikeC,30.2);
});
test('all primary fields valid means never replace official values',()=>{
  const readings=baseline();
  readings[1]={...readings[1],status:'CURRENT',
    validAt:new Date(NOW-120_000).toISOString(),
    values:{temperatureC:25,feelsLikeC:28}
  };
  const o=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:readings,providerEstimate:candidate(),now:NOW
  });
  assert.equal(o.status,'BLOCKED');
  assert.equal(o.reason,'PRIORITY_VALUES_PRESENT');
});
test('provider model timestamps expire strictly at 35 minutes; future dates fail closed',()=>{
  for(const [age,expected] of [[35*60_000,'FALLBACK_ESTIMATE'],[35*60_000+1000,'BLOCKED'],[-1000,'BLOCKED']]){
    const o=decideRjAgent13TemperatureFallback({
      municipalityIbge:ibge,prioritySources:baseline(),
      providerEstimate:candidate(age),now:NOW
    });
    assert.equal(o.status,expected);
  }
});
test('missing audit or unverified status is not treated as primary failure',()=>{
  const variants=[
    x=>{delete x[0].verifiedByBackend;},
    x=>{x[2].checkedAt=new Date(NOW-13*60_000).toISOString();},
    x=>{x[1].sourceId=x[0].sourceId;},
    x=>{x[1].rank=1;},
    x=>{x[1].status='UNKNOWN';},
    x=>{x[0].status='CURRENT';delete x[0].validAt;},
  ];
  for(const change of variants){
    const sources=baseline();change(sources);
    const o=decideRjAgent13TemperatureFallback({
      municipalityIbge:ibge,prioritySources:sources,providerEstimate:candidate(),now:NOW
    });
    assert.equal(o.reason,'PRIMARY_SOURCE_AUDIT_INCOMPLETE');
  }
});
test('available but missing provider thermal field remains null, never fabricated',()=>{
  const sources=baseline();
  const model=candidate();
  delete model.values.providerFeelsLikeC;
  const o=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:sources,providerEstimate:model,now:NOW
  });
  assert.equal(o.status,'FALLBACK_ESTIMATE');
  assert.equal(o.fields.feelsLikeC,null);
  assert.equal(o.fields.temperatureC,27.1);
});
test('invalid municipality, wrong provider, and unverified official-label claims fail closed',()=>{
  for(const x of [
    {municipalityIbge:'9999999',providerEstimate:candidate()},
    {municipalityIbge:ibge,providerEstimate:{...candidate(),sourceId:'UNKNOWN'}},
    {municipalityIbge:ibge,providerEstimate:{...candidate(),officialObservation:true}},
    {municipalityIbge:ibge,providerEstimate:{...candidate(),ibge:'3303302'}}
  ]){
    const o=decideRjAgent13TemperatureFallback({
      prioritySources:baseline(),now:NOW,...x
    });
    assert.equal(o.status,'BLOCKED');
  }
});
test('eligible policy without actual provider value is not a fabricated temperature',()=>{
  const o=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:baseline(),now:NOW
  });
  assert.equal(o.status,'FALLBACK_ELIGIBLE');
  assert.equal('fields' in o,false);
});

test('excluded alert-link-only sources cannot be counted as valid temperature instruments',()=>{
  const sources=baseline();
  sources[0].sourceId='ALERTA_RIO';
  const result=decideRjAgent13TemperatureFallback({
    municipalityIbge:ibge,prioritySources:sources,providerEstimate:candidate(),now:NOW
  });
  assert.equal(result.reason,'PRIMARY_SOURCE_AUDIT_INCOMPLETE');
});
