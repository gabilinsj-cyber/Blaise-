import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  createRjOpenWeatherLiveAdapter,
  RJ_OWM_CONTRACT,RJ_OWM_SUPPORTED,RJ_OWM_UNSUPPORTED_CURRENT,
} from '../src/rj-openweather-live-adapter.mjs';

const NOW=Date.parse('2026-10-12T18:00:00Z');
const geo=[{name:'Rio de Janeiro',state:'Rio de Janeiro',country:'BR',
  lat:-22.9068,lon:-43.1729}];
const weather={
  cod:200,sys:{country:'BR'},coord:{lat:-22.9068,lon:-43.1729},
  dt:Math.floor((NOW-300_000)/1000),
  main:{temp:28.4,feels_like:31.1,pressure:1009,humidity:75},
  wind:{speed:5,gust:8},
  rain:{'1h':3.4},weather:[{id:201,main:'Thunderstorm'}],
};
const makeMock=(g=geo,w=weather)=>{
  let calls=[];
  const fetchImpl=async url=>{
    const u=new URL(String(url));
    calls.push({path:u.pathname,host:u.hostname,
      apiKeyPresent:u.searchParams.has('appid')});
    const value=u.pathname.includes('/geo/')?g:w;
    return new Response(JSON.stringify(value),{
      status:200,headers:{'Content-Type':'application/json'},
    });
  };
  return {fetchImpl,calls};
};
const enabled=(mock)=>createRjOpenWeatherLiveAdapter({
  enabled:true,licensedForApp:true,apiKey:'local_mock_key_123456',
  fetchImpl:mock.fetchImpl,clock:()=>NOW,
});

test('no secret/license/opt-in means no HTTPS calls and no weather invented',async()=>{
  const m=makeMock();
  for(const opt of [
    {enabled:false,licensedForApp:true,apiKey:'ABCDEFGH'},
    {enabled:true,licensedForApp:false,apiKey:'ABCDEFGH'},
    {enabled:true,licensedForApp:true,apiKey:''},
  ]){
    const a=createRjOpenWeatherLiveAdapter({...opt,fetchImpl:m.fetchImpl,clock:()=>NOW});
    const r=await a.query({ibge:'3304557',phenomenon:'TEMPERATURA'});
    assert.equal(r.status,'UNAVAILABLE');
    assert.equal(r.products.length,0);
    assert.equal(r.automaticAlertAuthorized,false);
  }
  assert.equal(m.calls.length,0);
});

test('API current product returns actual time, attribution, municipality and all supported numeric variables',async()=>{
  const m=makeMock();
  const a=enabled(m);
  for(const [phenomenon,value,unit] of [
    ['TEMPERATURA',28.4,'°C'],
    ['SENSACAO_TERMICA',31.1,'°C'],
    ['CHUVA_ATUAL',3.4,'mm/1h'],
    ['CHUVA_ACUMULADA',3.4,'mm/1h'],
    ['VENTO',18,'km/h'],
    ['RAJADA',28.8,'km/h'],
    ['PRESSAO_ATMOSFERICA',1009,'hPa'],
    ['UMIDADE',75,'%'],
  ]) {
    const r=await a.query({ibge:'3304557',phenomenon});
    assert.equal(r.contract,RJ_OWM_CONTRACT);
    assert.equal(r.status,'FRESH_COMPLEMENTARY_PRODUCT');
    assert.equal(r.result.value,value);
    assert.equal(r.result.unit,unit);
    assert.equal(r.result.observedAt,new Date(weather.dt*1000).toISOString());
    assert.equal(r.result.classification,
      'THIRD_PARTY_MULTISOURCE_PRODUCT_NOT_INMET_OR_ALERTRIO_STATION');
    assert.equal(r.result.notMunicipalMean,true);
    assert.equal(r.automaticAlertAuthorized,false);
    assert.equal(r.officialObservation,false);
    assert.equal(r.weatherMapImageIncluded,false);
    assert.equal(JSON.stringify(r).includes('local_mock_key'),false);
  }
  assert.equal(m.calls.length,2); // Geocode + weather cached, no 8x quota waste.
  assert.equal(m.calls.every(x=>x.host==='api.openweathermap.org'),true);
  assert.equal(m.calls.every(x=>x.apiKeyPresent),true);
  const snap=a.status();
  assert.equal(snap.configured,true);
  assert.equal(snap.apiKeyIncluded,false);
  assert.ok(snap.lastSuccessAt);
});

test('granizo/temporal are not inferred from OWM icon code',async()=>{
  const m=makeMock(),a=enabled(m);
  for(const phenomenon of RJ_OWM_UNSUPPORTED_CURRENT){
    const r=await a.query({ibge:'3304557',phenomenon});
    assert.equal(r.status,'UNAVAILABLE');
    assert.equal(r.reason,'NO_SUPPORTED_CURRENT_WEATHER_PRODUCT_FOR_PHENOMENON');
  }
  assert.equal(RJ_OWM_SUPPORTED.length,8);
  assert.equal(m.calls.length,0);
});

test('wrong RJ geocoding, unsafe region and unknown municipality are rejected',async()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const raw of [
    [{name:'Rio de Janeiro',country:'BR',state:'São Paulo',lat:-22.9,lon:-43.2}],
    [{name:'Rio de Janeiro',country:'BR',state:'Rio de Janeiro',lat:-12,lon:-38}],
    [{name:'São Paulo',country:'BR',state:'Rio de Janeiro',lat:-22.9,lon:-43.2}],
  ]){
    const m=makeMock(raw),a=enabled(m);
    const result=await a.query({ibge:'3304557',phenomenon:'TEMPERATURA'});
    assert.equal(result.status,'UNAVAILABLE');
    assert.equal(m.calls.length,1);
  }
  const m=makeMock(),a=enabled(m);
  const r=await a.query({ibge:'4106902',phenomenon:'TEMPERATURA'});
  assert.equal(r.status,'UNAVAILABLE');
  assert.equal(m.calls.length,0);
});

test('stale source, missing measure, out-of-bounds point and HTTP error fail closed',async()=>{
  const tests=[
    {...weather,dt:weather.dt-16_000},
    {...weather,main:{temp:999,humidity:75,pressure:1010}},
    {...weather,coord:{lat:-20.1,lon:-43.1}},
  ];
  for(const w of tests){
    const m=makeMock(geo,w),a=enabled(m);
    const result=await a.query({ibge:'3304557',phenomenon:'TEMPERATURA'});
    assert.equal(result.status,'UNAVAILABLE');
  }
  const mock=makeMock(geo,{...weather,main:{...weather.main,temp:null}});
  const a=enabled(mock);
  const result=await a.query({ibge:'3304557',phenomenon:'TEMPERATURA'});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.reason,'VALUE_NOT_PRESENT_OR_INVALID');
});

test('OWM rain 1h zero cannot be inferred if upstream rain field is absent',async()=>{
  const m=makeMock(geo,{...weather,rain:undefined});
  const a=enabled(m);
  const result=await a.query({ibge:'3304557',phenomenon:'CHUVA_ACUMULADA'});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.reason,'VALUE_NOT_PRESENT_OR_INVALID');
  assert.equal(result.automaticAlertAuthorized,false);
});
