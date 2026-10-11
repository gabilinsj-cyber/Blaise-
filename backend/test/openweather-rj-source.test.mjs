import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENWEATHER_RJ_SOURCE_ID,OPENWEATHER_RJ_SOURCE_URL,
  normalizeOpenWeatherRjCurrent,createOpenWeatherRjAdapter,
} from '../src/openweather-rj-source.mjs';

const NOW=Date.parse('2026-10-11T12:00:00Z');
const city=Object.freeze({latitude:-22.9068,longitude:-43.1729});
const response=Object.freeze({
  cod:200,dt:Math.trunc(NOW/1000)-600,
  coord:{lat:city.latitude,lon:city.longitude},
  main:{temp:29.5,feels_like:32.2,humidity:65},
  wind:{speed:4.0,gust:9.0},
  rain:{'1h':3.4},
  weather:[{id:201,description:'thunderstorm with rain'}],
});

test('third source is always estimate, never an independent authoritative station or risk warning',()=>{
  const out=normalizeOpenWeatherRjCurrent({
    payload:response,ibge:'3304557',variable:'TEMPERATURA_C',
    ...city,termsApproved:true,now:NOW,
  });
  assert.equal(out.status,'THIRD_PARTY_CURRENT_ESTIMATE_READY_NOT_OFFICIAL_MEASUREMENT');
  assert.equal(out.observations.length,0);
  assert.equal(out.forecasts.length,1);
  const estimate=out.forecasts[0];
  assert.equal(estimate.sourceId,OPENWEATHER_RJ_SOURCE_ID);
  assert.equal(estimate.kind,'THIRD_PARTY_CURRENT_ESTIMATE');
  assert.equal(estimate.origin,'THIRD_PARTY_AGGREGATE_NOT_OFFICIAL_OBSERVATION');
  assert.equal(estimate.officialObservation,false);
  assert.equal(estimate.automaticallyConfirmAlert,false);
  assert.equal(estimate.value,29.5);
  assert.equal(estimate.unit,'°C');
  assert.equal(estimate.attribution,'Weather data provided by OpenWeather');
  assert.equal(estimate.sourceUrl,OPENWEATHER_RJ_SOURCE_URL);
});
test('provider values are normalized only for actual fields, no fake zero rainfall or gust',()=>{
  const variables=new Map([
    ['TEMPERATURA_C',29.5],['SENSACAO_TERMICA_C',32.2],
    ['UMIDADE_PERCENTUAL',65],['VENTO_KMH',14.4],
    ['RAJADA_KMH',32.4],['CHUVA_MM_1H',3.4],
  ]);
  for(const [variable,value] of variables) {
    const result=normalizeOpenWeatherRjCurrent({
      payload:response,ibge:'3304557',variable,...city,termsApproved:true,now:NOW,
    });
    assert.ok(Math.abs(result.forecasts[0].value-value)<0.000001);
  }
  const withoutRain=normalizeOpenWeatherRjCurrent({
    payload:{...response,rain:undefined},ibge:'3304557',
    variable:'CHUVA_MM_1H',...city,termsApproved:true,now:NOW,
  });
  assert.equal(withoutRain.forecasts.length,0);
});
test('terms, municipality, coordinates, time, response status and outliers are strict',()=>{
  const basic={payload:response,ibge:'3304557',variable:'TEMPERATURA_C',...city,now:NOW};
  const invalid=[
    {...basic,termsApproved:false},
    {...basic,termsApproved:true,ibge:'4106902'},
    {...basic,termsApproved:true,latitude:0},
    {...basic,termsApproved:true,payload:{...response,dt:Math.trunc(NOW/1000)-10_000}},
    {...basic,termsApproved:true,payload:{...response,dt:Math.trunc(NOW/1000)+5}},
    {...basic,termsApproved:true,payload:{...response,coord:{lat:-21.2,lon:-42.1}}},
    {...basic,termsApproved:true,payload:{...response,cod:401}},
    {...basic,termsApproved:true,payload:{...response,main:{temp:9999}}},
  ];
  for(const params of invalid){
    assert.equal(normalizeOpenWeatherRjCurrent(params).forecasts.length,0);
  }
});
test('disabled adapter and missing license perform no paid network call',async()=>{
  let calls=0,keys=0;
  const opts={
    coordinatesForIbge:()=>city,
    apiKeyProvider:()=>{keys++;return 'testing-fake-token-mock-not-real'},
    fetchImpl:async()=>{calls++;return {ok:true,json:async()=>response}},
  };
  const disabled=createOpenWeatherRjAdapter({...opts,enabled:false,termsApproved:true});
  const unlicensed=createOpenWeatherRjAdapter({...opts,enabled:true,termsApproved:false});
  assert.equal((await disabled({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW})).forecasts.length,0);
  assert.equal((await unlicensed({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW})).forecasts.length,0);
  assert.equal(calls,0);
  assert.equal(keys,0);
});
test('validated backend lookup is limited to fixed OpenWeather host and caches repeated requests',async()=>{
  const urls=[];
  const adapter=createOpenWeatherRjAdapter({
    enabled:true,termsApproved:true,
    coordinatesForIbge:ibge=>ibge==='3304557'?city:null,
    apiKeyProvider:()=> 'test-fake-token-12345678',
    fetchImpl:async url=>{
      urls.push(url);
      return {ok:true,json:async()=>response};
    },
  });
  const first=await adapter({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW});
  const second=await adapter({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW+60_000});
  assert.equal(urls.length,1);
  assert.equal(first.forecasts.length,1);
  assert.deepEqual(first,second);
  const req=new URL(urls[0]);
  assert.equal(req.origin,'https://api.openweathermap.org');
  assert.equal(req.pathname,'/data/2.5/weather');
  assert.equal(req.searchParams.get('units'),'metric');
  assert.equal(req.searchParams.get('lat'),city.latitude.toFixed(5));
  assert.equal(req.searchParams.get('lon'),city.longitude.toFixed(5));
  assert.equal(JSON.stringify(first).includes('test-fake-token'),false);
  assert.equal((await adapter({ibge:'3303302',variable:'TEMPERATURA_C',now:NOW})).forecasts.length,0);
});
test('network errors or HTTP failures never expose a secret or convert to weather values',async()=>{
  for(const fetchImpl of [
    async()=>{throw Error('test-fake-token-12345678 leaked in request');},
    async()=>({ok:false,status:401}),
  ]){
    const adapter=createOpenWeatherRjAdapter({
      enabled:true,termsApproved:true,
      apiKeyProvider:()=> 'test-fake-token-12345678',
      coordinatesForIbge:()=>city,fetchImpl,
    });
    const out=await adapter({ibge:'3304557',variable:'TEMPERATURA_C',now:NOW});
    assert.equal(out.forecasts.length,0);
    assert.equal(out.observations.length,0);
    assert.equal(JSON.stringify(out).includes('test-fake-token'),false);
  }
});
