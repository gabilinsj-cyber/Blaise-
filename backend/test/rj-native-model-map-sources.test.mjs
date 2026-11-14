import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_NULLSCHOOL_VISUAL_REFERENCE,RJ_NATIVE_MODEL_SOURCES,
  prepareRjNativeModelForecastPoint
} from '../src/rj-native-model-map-sources.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const grant=(sourceId,productId)=>({
  sourceId,productId,status:'VERIFIED',
  permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  evidenceId:'SYNTHETIC_TEST_GRANT_20261113',
  attribution:'SYNTHETIC TEST ONLY — not a real license confirmation',
  validUntil:'2027-01-01T00:00:00Z'
});
const model=(sourceId='NOAA_GFS')=>({
  kind:'DECODED_GRIB2_MODEL_GRID_POINT',dataType:'MODEL_FORECAST',
  sourceId,productId:sourceId+'-2m-temp',metric:'TEMPERATURE_2M_C',
  unit:'°C',value:26.7,ibge:'3304557',latitude:-22.91,longitude:-43.22,
  modelRunId:sourceId+'-run-2026111312',
  cycleAt:'2026-11-13T12:00:00Z',validAt:'2026-11-13T21:00:00Z',
  sourceUrl:sourceId==='NOAA_GFS'?
    'https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.20261113/12/atmos/gfs.t12z.pgrb2.0p25.f009':
    'https://opendata.dwd.de/weather/nwp/icon/grib/12/t_2m/icon_global_icosahedral_single-level_2026111312_009_T_2M.grib2.bz2'
});
const prepare=(s,grants=[grant(s.sourceId,s.productId)])=>
  prepareRjNativeModelForecastPoint({sample:s,rights:grants,now:NOW});

test('NOAA official numeric GFS forecast is separate from viewer and observations',()=>{
  const s=model(),x=prepare(s);
  assert.equal(x.status,'AVAILABLE_MODEL_FORECAST');
  assert.equal(x.originalMapPreserved,true);
  assert.equal(x.points[0].kind,'FORECAST_NOT_STATION_OBSERVATION');
  assert.equal(x.points[0].forecastLeadHours,9);
  assert.equal(x.isObservation,false);
  assert.equal(x.radarAvailable,false);
  assert.equal(x.officialAlert,false);
  assert.equal(x.automaticIngestion,false);
  assert.equal(x.nullschoolIsIndependentSource,false);
});
test('DWD ICON data source is distinct numerical forecast but has same map renderer',()=>{
  const x=prepare(model('DWD_ICON_GLOBAL'));
  assert.equal(x.status,'AVAILABLE_MODEL_FORECAST');
  assert.equal(x.points[0].model,'ICON_GLOBAL');
  assert.equal(x.points[0].nativeRenderer,'BLAISE_V6_RJ_NATIVE_GEOGRAPHIC_CANVAS');
  assert.equal(RJ_NATIVE_MODEL_SOURCES.DWD_ICON_GLOBAL.allowedHost,'opendata.dwd.de');
});
test('Nullschool is external visual consultation, never downloaded or counted as third provider',()=>{
  assert.equal(RJ_NULLSCHOOL_VISUAL_REFERENCE.numericalSource,false);
  assert.equal(RJ_NULLSCHOOL_VISUAL_REFERENCE.independentFromNoaaGfs,false);
  assert.equal(RJ_NULLSCHOOL_VISUAL_REFERENCE.role,'ADMIN_EXTERNAL_VISUAL_COMPARISON_ONLY');
  assert.equal(RJ_NULLSCHOOL_VISUAL_REFERENCE.url,'https://earth.nullschool.net/');
  assert.equal(prepare({...model(),sourceId:'EARTH_NULLSCHOOL'}).status,'UNAVAILABLE');
});
test('public browsing or MIT code license does not authorize republishing model datasets',()=>{
  const s=model();
  assert.equal(prepare(s,[]).reason,'COMMERCIAL_PRODUCT_RIGHTS_NOT_VERIFIED');
  const denied=grant(s.sourceId,s.productId);
  denied.permission='NON_COMMERCIAL_ONLY';
  assert.equal(prepare(s,[denied]).status,'UNAVAILABLE');
});
test('reject copied viewer URL, unapproved host, false observed data and other states',()=>{
  const bad=[
    {...model(),sourceUrl:'https://earth.nullschool.net/'},
    {...model(),sourceUrl:'http://nomads.ncep.noaa.gov/model'},
    {...model(),sourceUrl:'https://nomads.ncep.noaa.gov.evil.example/grib'},
    {...model(),sourceUrl:'https://nomads.ncep.noaa.gov:8080/grib'},
    {...model(),kind:'OBSERVED_STATION_TEMPERATURE'},
    {...model(),dataType:'OFFICIAL_OBSERVATION'},
    {...model(),ibge:'3509502'},
    {...model(),value:NaN}
  ];
  for(const s of bad)assert.equal(prepare(s).status,'UNAVAILABLE');
});
test('reject stale or future model run; rainfall must include numeric accumulation period',()=>{
  const s=model();
  for(const change of [
    {cycleAt:'2026-11-12T12:00:00Z'},
    {cycleAt:'2026-11-13T19:00:00Z'},
    {validAt:'2026-12-05T12:00:00Z'},
    {validAt:'2026-11-13T12:30:00Z'},
  ])assert.equal(prepare({...s,...change}).status,'UNAVAILABLE');
  const rain={...s,metric:'RAIN_ACCUMULATION_MM',unit:'mm',value:7.2};
  const rights=[grant(rain.sourceId,rain.productId)];
  assert.equal(prepare(rain,rights).reason,'RAIN_ACCUMULATION_WINDOW_MISSING');
  const valid={...rain,accumulationStart:'2026-11-13T18:00:00Z',
    accumulationEnd:'2026-11-13T21:00:00Z'};
  assert.equal(prepare(valid,rights).status,'AVAILABLE_MODEL_FORECAST');
});
