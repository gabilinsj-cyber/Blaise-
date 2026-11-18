import assert from 'node:assert/strict';
import test from 'node:test';
import {projectMetNorwayAdminCoverageEvidence} from '../src/rj-met-norway-admin-evidence.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
import {initializeOptionalMetNorwayRuntime} from '../src/rj-met-norway-runtime-optional.mjs';

const now=Date.parse('2026-11-17T15:00:00Z');
const stamp=new Date(now-60_000).toISOString();
const model={
  status:'FORECAST_AVAILABLE',source:'MET_NORWAY_LOCATIONFORECAST_2',
  ibge:'3304557',originWeather:'ECMWF_IFS',originUv:'COPERNICUS_CAMS_UV_VIA_MET_NO',
  uvIsActualCloudAdjusted:false,uvIsClearSky:true,officialObservation:false,
  issuedAt:new Date(now-2*60*60_000).toISOString(),validAt:stamp,checkedAt:stamp,
  values:{temperatureC:27.8,feelsLikeC:30.2,humidityPct:70,
    uvClearSkyIndex:9.1,windKmh:16.5},
  hourly:{precipitationNextHourMm:1.4,precipitationProbabilityNextHourPct:46}
};
test('user-authorized CAMS via MET Norway is clear-sky UV, not actual UV',()=>{
  const records=projectMetNorwayAdminCoverageEvidence(model,{
    termsAcceptedByHuman:true,backendVerified:true
  });
  assert.ok(records.length>=5);
  assert.ok(records.some(x=>x.field==='uvClearSkyIndex'&&
    x.sourceId==='COPERNICUS_CAMS_UV_VIA_MET_NO'&&x.value===9.1));
  assert.ok(records.every(x=>x.field!=='uvIndex'));
  assert.ok(records.every(x=>x.field!=='temperatureC'&&x.field!=='feelsLikeC'));
  const coverage=buildInternalRjMeteorologyCoverage(records,{now});
  assert.equal(coverage.fields.find(x=>x.field==='temperatureC').coveredMunicipalities,0);
  assert.equal(coverage.fields.find(x=>x.field==='uvClearSkyIndex').coveredMunicipalities,1);
  assert.equal(coverage.fields.find(x=>x.field==='uvIndex').coveredMunicipalities,0);
  assert.equal(coverage.publishedToSubscriber,false);
});
test('no terms assent, client report, or unverified forecast cannot become coverage evidence',()=>{
  assert.deepEqual(projectMetNorwayAdminCoverageEvidence(model,{backendVerified:true}),[]);
  assert.deepEqual(projectMetNorwayAdminCoverageEvidence(model,{termsAcceptedByHuman:true}),[]);
  assert.deepEqual(projectMetNorwayAdminCoverageEvidence({...model,officialObservation:true},{
    termsAcceptedByHuman:true,backendVerified:true}),[]);
});
test('MET Norway cannot be called automatically or for unknown city and no legal assent',async()=>{
  let called=0;
  const init=()=>initializeOptionalMetNorwayRuntime({
    env:{BLAISE_MET_NORWAY_ENABLED:'true',BLAISE_MET_NORWAY_FIRESTORE_ENABLED:'true'},
    createDatabase:async()=>{called++;return {}}
  });
  const disabled=await init();
  assert.equal(disabled.configured,false);
  assert.equal(disabled.state,'HUMAN_TOS_ACCEPTANCE_REQUIRED');
  assert.equal(disabled.automaticSchedulingEnabled,false);
  assert.equal(disabled.publishedToAndroid,false);
  assert.equal(called,0);
});
