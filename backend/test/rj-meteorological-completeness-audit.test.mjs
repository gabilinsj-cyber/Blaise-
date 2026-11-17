import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_METEOROLOGICAL_FIELDS,
  RJ_METEOROLOGY_SOURCE_CATEGORIES,
  buildInternalRjMeteorologyCoverage,
} from '../src/rj-meteorological-completeness-audit.mjs';

const now=Date.parse('2026-11-17T14:00:00Z');
const t=new Date(now-60_000).toISOString();
const base=Object.freeze({
  ibge:'3304557',field:'temperatureC',sourceId:'DWD_ICON_GLOBAL',
  category:'P',value:29.1,validAt:t,checkedAt:t,issuedAt:t,datasetId:'ICON_GLOBAL_2M',
  verifiedByBackend:true,commercialUseAuthorized:true,
  municipalityGeoVerified:true,sourceUrl:'https://opendata.dwd.de/weather/nwp/icon/'
});
const audit=(records)=>buildInternalRjMeteorologyCoverage(records,{now});

test('no record means every category/phenomenon is unavailable for all 92 municipalities',()=>{
  const v=audit([]);
  assert.equal(v.scope,'ADMIN_ONLY');
  assert.equal(v.publishedToSubscriber,false);
  assert.equal(v.automaticProviderCalls,false);
  assert.equal(v.municipalityCount,92);
  assert.ok(v.fieldCount>=20);
  assert.equal(v.verifiedValueCount,0);
  assert.ok(v.fields.every(f=>f.coveredMunicipalities===0&&f.state==='UNAVAILABLE'));
  assert.equal(v.fields.find(f=>f.field==='uvIndex').unavailableMunicipalities,92);
  assert.equal(v.fields.find(f=>f.field==='temperatureC').unavailableMunicipalities,92);
});

test('audited international model covers only its own municipality and field',()=>{
  const v=audit([base]);
  assert.equal(v.verifiedValueCount,1);
  const thermal=v.fields.find(f=>f.field==='temperatureC');
  assert.equal(thermal.coveredMunicipalities,1);
  assert.equal(thermal.unavailableMunicipalities,91);
  assert.equal(v.fields.find(f=>f.field==='feelsLikeC').coveredMunicipalities,0);
});

test('rejects stale, future, invented, unlicensed, unverified, unknown place and excluded source',()=>{
  const records=[
    {...base,verifiedByBackend:false},
    {...base,commercialUseAuthorized:false},
    {...base,municipalityGeoVerified:false},
    {...base,validAt:new Date(now-13*60*60_000).toISOString()},
    {...base,validAt:new Date(now+1000).toISOString()},
    {...base,ibge:'0000000'},
    {...base,sourceId:'ALERTA_RIO'},
    {...base,sourceId:'INMET_STATION',category:'O'},
    {...base,sourceId:'CEMADEN_PRECIP',category:'O'},
    {...base,sourceId:'COPERNICUS'},
    {...base,value:9999},
    {...base,value:null},
    {...base,sourceUrl:'http://example.org'},
  ];
  const v=audit(records);
  assert.equal(v.rejectedRecordCount,records.length);
  assert.equal(v.verifiedValueCount,0);
});

test('the same model via Meteologix or Earth Nullschool is not another independent source',()=>{
  const validModel={...base,sourceId:'NOAA_GFS',category:'P',
    validAt:t,issuedAt:new Date(now-6*60*60_000).toISOString(),
    datasetId:'NOAA_GFS_0P25'};
  const v=audit([
    validModel,
    {...validModel,sourceId:'METEOLOGIX'},
    {...validModel,sourceId:'EARTH_NULLSCHOOL'}
  ]);
  assert.equal(v.verifiedValueCount,1);
  assert.equal(v.rejectedRecordCount,2);
});

test('forecast is not accepted as a station observation, and no weather phenomena inherit OpenWeather thermal exception',()=>{
  const entry={...base,sourceId:'DWD_ICON_GLOBAL',category:'O'};
  const tooOld={...base,sourceId:'NOAA_GFS',category:'P',datasetId:'NOAA_GFS_0P25',
    validAt:new Date(now-13*60*60_000).toISOString(),issuedAt:t};
  const openweatherUv={...base,field:'uvIndex',sourceId:'OPENWEATHER_ONECALL4',category:'E',value:6.1};
  const v=audit([entry,tooOld,openweatherUv]);
  assert.equal(v.verifiedValueCount,0);
  assert.equal(v.rejectedRecordCount,3);
  assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES.DWD_ICON_GLOBAL,'P');
  assert.equal(RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='uvIndex').unit,'index');
});

test('CEMADEN hydrological risk is not a temperature measurement',()=>{
  const a={...base,field:'temperatureC',sourceId:'CEMADEN_HYDRO_RISK',category:'E',datasetId:'CEMADEN_HYDRO'};
  const b={...base,field:'hydrologicalRiskLevel',sourceId:'CEMADEN_HYDRO_RISK',category:'E',
    value:4,datasetId:'CEMADEN_HYDRO',issuedAt:t};
  const result=audit([a,b]);
  assert.equal(result.rejectedRecordCount,2);
  assert.equal(result.fields.find(x=>x.field==='temperatureC').coveredMunicipalities,0);
  assert.equal(result.fields.find(x=>x.field==='hydrologicalRiskLevel').coveredMunicipalities,0);
});

test('satellite SST and IMERG remain estimated products, never direct thermometers or gauges',()=>{
  const sst=RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='seaSurfaceTemperatureC');
  assert.equal(sst.unit,'°C');
  assert.deepEqual(sst.candidates.map(x=>x.sourceId),[
    'EUMETSAT_OSI_SAF_SST','NOAA_COASTWATCH_SST','NASA_MUR_SST'
  ]);
  assert.ok(sst.candidates.every(x=>x.category==='E'));
  assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES.NASA_GPM_IMERG,'E');
  assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES.ECMWF_WAVE,'P');
  const payload={...base,
    field:'oceanRainMm',sourceId:'NASA_GPM_IMERG',category:'E',
    value:1.7,datasetId:'IMERG_EARLY_V07',sourceUrl:'https://gpm.nasa.gov/data/imerg'};
  const coverage=audit([payload]);
  assert.equal(coverage.verifiedValueCount,1);
  assert.equal(coverage.fields.find(x=>x.field==='oceanRainMm').coveredMunicipalities,1);
  assert.equal(coverage.fields.find(x=>x.field==='rainNowMm').coveredMunicipalities,0);
  const falseStation={...payload,field:'rainNowMm',category:'O'};
  assert.equal(audit([falseStation]).rejectedRecordCount,1);
});
