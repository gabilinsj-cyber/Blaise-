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
  // NOAA is still allowed in nonthermal fields, but NEVER for air temperature.
  assert.equal(v.verifiedValueCount,0);
  assert.equal(v.rejectedRecordCount,3);
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

test('NASA and JAXA cannot supply any current numeric weather after removal',()=>{
  const sst=RJ_METEOROLOGICAL_FIELDS.find(x=>x.id==='seaSurfaceTemperatureC');
  assert.deepEqual(sst.candidates.map(x=>x.sourceId),[
    'NOAA_COASTWATCH_SST'
  ]);
  for(const id of ['EUMETSAT_OSI_SAF_SST','EUMETSAT_SAT']){
    assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES[id],undefined);
  }
  assert.ok(sst.candidates.every(x=>x.category==='E'));
  assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES.ECMWF_WAVE,'P');
  for(const id of ['NASA_GPM_IMERG','NASA_MUR_SST','NASA_SAT','JAXA_GSMAP','RAMMB_CIRA_SLIDER']){
    assert.equal(Object.hasOwn(RJ_METEOROLOGY_SOURCE_CATEGORIES,id),false);
  }
  for(const field of ['rainNowMm','rainAccumulatedMm','oceanRainMm']){
    assert.deepEqual(RJ_METEOROLOGICAL_FIELDS.find(x=>x.id===field).candidates,[]);
  }
  const impostors=[
    {...base,field:'oceanRainMm',sourceId:'NASA_GPM_IMERG',category:'E',value:1.7,datasetId:'IMERG_EARLY_V07'},
    {...base,field:'seaSurfaceTemperatureC',sourceId:'NASA_MUR_SST',category:'E',value:23,datasetId:'MUR_L4'},
    {...base,field:'cloudPct',sourceId:'RAMMB_CIRA_SLIDER',category:'O',value:70}
  ];
  const coverage=audit(impostors);
  assert.equal(coverage.verifiedValueCount,0);
  assert.equal(coverage.rejectedRecordCount,impostors.length);
  assert.equal(coverage.fields.find(x=>x.field==='rainNowMm').coveredMunicipalities,0);
});
test('meteoblue proposed raw model cannot bypass API licence and verified ingest gate',()=>{
  assert.equal(Object.hasOwn(RJ_METEOROLOGY_SOURCE_CATEGORIES,'METEOBLUE_NEMS10'),false);
  assert.ok(RJ_METEOROLOGICAL_FIELDS.every(field=>
    field.candidates.every(c=>c.sourceId!=='METEOBLUE_NEMS10')));
  const proposed={...base,field:'rainNextHourForecastMm',
    sourceId:'METEOBLUE_NEMS10',category:'P',datasetId:'NEMSSA_RAW',value:4.2};
  const result=audit([proposed]);
  assert.equal(result.verifiedValueCount,0);
  assert.equal(result.rejectedRecordCount,1);
  assert.equal(result.fields.find(x=>x.field==='rainNowMm').coveredMunicipalities,0);
});
test('JAXA excluded rainfall source is rejected even with recent authorized-looking records',()=>{
  assert.equal(Object.hasOwn(RJ_METEOROLOGY_SOURCE_CATEGORIES,'JAXA_GSMAP'),false);
  const now=Date.parse('2026-11-17T18:00:00Z');
  const record={...base,
    field:'rainAccumulatedMm',sourceId:'JAXA_GSMAP',category:'E',
    datasetId:'GSMAP_NOW_V8',
    validAt:'2026-11-17T17:45:00Z',
    issuedAt:'2026-11-17T17:45:00Z',
    checkedAt:'2026-11-17T17:59:00Z',
    value:8.2
  };
  const audit=buildInternalRjMeteorologyCoverage([record],{now});
  assert.equal(audit.verifiedValueCount,0);
  assert.equal(audit.rejectedRecordCount,1);
  assert.equal(audit.fields.find(x=>x.field==='rainNowMm').coveredMunicipalities,0);
});

test('meteoblue real basic-6h forecast is a private six-hour field, not observed or hourly rain',()=>{
 const t=new Date(now-60_000).toISOString();
 const future=new Date(now+5*60*60_000).toISOString();
 const mb={...base,sourceId:'METEOBLUE_FREE_FORECAST',
  field:'meteoblueRainForecastSixHourMm',category:'P',
  value:9.2,checkedAt:t,issuedAt:t,validAt:future,
  sourceUrl:'https://my.meteoblue.com/packages/basic-6h',
  datasetId:'METEOBLUE_MLM_BASIC_6H',modelOrigin:'METEOBLUE_MLM',
  intervalHours:6,privateScientificComparison:true,
  publishedToSubscriber:false,observational:false};
 const correct=audit([mb]);
 assert.equal(correct.verifiedValueCount,1);
 assert.equal(correct.fields.find(f=>f.field===mb.field).coveredMunicipalities,1);
 assert.equal(correct.fields.find(f=>f.field==='rainNowMm').coveredMunicipalities,0);
 assert.equal(correct.fields.find(f=>f.field==='rainNextHourForecastMm').coveredMunicipalities,0);
 const prohibited=[
  {...mb,field:'rainNowMm'},
  {...mb,field:'rainNextHourForecastMm'},
  {...mb,field:'gustKmh'},
  {...mb,field:'temperatureC'},
  {...mb,intervalHours:1},
  {...mb,publishedToSubscriber:true},
  {...mb,observational:true},
  {...mb,modelOrigin:'NEMSSA_RAW'},
  {...mb,validAt:new Date(now-60_000).toISOString()}
 ];
 const denied=audit(prohibited);
 assert.equal(denied.rejectedRecordCount,prohibited.length);
 assert.equal(denied.verifiedValueCount,0);
 const defs=RJ_METEOROLOGICAL_FIELDS
  .filter(x=>x.candidates.some(y=>y.sourceId==='METEOBLUE_FREE_FORECAST'));
 assert.equal(defs.length,7);
 assert.ok(defs.every(x=>x.id.startsWith('meteoblue')));
 assert.equal(RJ_METEOROLOGY_SOURCE_CATEGORIES.METEOBLUE_FREE_FORECAST,'P');
});
