import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRjInternationalForecast,RJ_FORECAST_PUBLIC_STATUS} from '../src/rj-international-forecast-public.mjs';
const now=Date.parse('2026-11-17T15:00:00Z');
const model=()=>({
  status:'FORECAST_AVAILABLE',ibge:'3304557',
  source:'MET_NORWAY_LOCATIONFORECAST_2',originWeather:'ECMWF_IFS',
  originUv:'COPERNICUS_CAMS_UV_VIA_MET_NO',
  nature:'PREVISAO_DE_MODELO_NAO_OBSERVACAO',
  issuedAt:'2026-11-17T14:30:00Z',validAt:'2026-11-17T14:00:00Z',
  checkedAt:'2026-11-17T15:00:00Z',
  values:{temperatureC:26.7,feelsLikeC:28.4,humidityPct:72,
    windKmh:16.2,uvClearSkyIndex:8,cloudPct:60},
  hourly:{precipitationNextHourMm:1.5,precipitationProbabilityNextHourPct:30},
  officialObservation:false,officialAlert:false,
  automaticAlertsAuthorized:false,uvIsMeasured:false,uvIsActualCloudAdjusted:false,
  uvIsClearSky:true,independentFromEcmwfDirect:false,
  sourceUrl:'https://api.met.no/weatherapi/locationforecast/2.0/complete',
  license:'CC BY 4.0'
});
test('publishes valid time-stamped ECMWF prediction, never measurement or real-time sensor',()=>{
  const x=projectRjInternationalForecast(model(),{now});
  assert.equal(x.kind,RJ_FORECAST_PUBLIC_STATUS);
  assert.equal(x.temperatureC,26.7);
  assert.equal(x.feelsLikeC,28.4);
  assert.equal(x.uvClearSkyIndex,8);
  assert.equal(x.modelOrigin,'ECMWF_IFS');
  assert.equal(x.license,'CC BY 4.0');
  assert.equal(Object.hasOwn(x,'officialAlert'),false);
  assert.equal(Object.hasOwn(x,'officialObservation'),false);
});
test('rejects unsupported municipalities, bogus sources, nonlicensed and stale records',()=>{
  const f=model();
  for(const overrides of [
    {ibge:'3304904'}, // 90 cities still need geographical verification
    {source:'INMET'},{officialObservation:true},{officialAlert:true},
    {automaticAlertsAuthorized:true},{license:'unknown'},
    {issuedAt:'2026-11-16T00:00:00Z'},
    {validAt:'2026-11-17T10:00:00Z'},
    {checkedAt:'2026-11-17T14:57:00Z'},
    {independentFromEcmwfDirect:true}
  ])assert.equal(projectRjInternationalForecast({...f,...overrides},{now}),null);
});
test('missing values never become numeric zero and UV actual index is not manufactured',()=>{
  const v=projectRjInternationalForecast({...model(),uvIsClearSky:false,
    values:{temperatureC:25,humidityPct:null,uvClearSkyIndex:9},hourly:{}},{now});
  assert.equal(v.humidityPct,null);
  assert.equal(v.uvClearSkyIndex,null);
  assert.equal(v.precipitationNextHourMm,null);
  assert.equal(projectRjInternationalForecast({...model(),values:{},hourly:{}},{now}),null);
});
