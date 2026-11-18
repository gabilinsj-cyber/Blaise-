import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rjGfsPoint,noaaGfsAtmosUrl,gfsRecentCandidates,
  validateNoaaGfsPoint,probeNoaaGfsAtmosphericPoint
} from '../src/noaa-gfs-atmos-collector.mjs';

test('NOAA GFS filter uses fixed 2m TMP subset and bounded RJ region',()=>{
  const issued=Date.UTC(2026,10,18,6);
  const u=new URL(noaaGfsAtmosUrl(issued,3));
  assert.equal(u.hostname,'nomads.ncep.noaa.gov');
  assert.equal(u.searchParams.get('file'),'gfs.t06z.pgrb2.0p25.f003');
  assert.equal(u.searchParams.get('dir'),'/gfs.20261118/06/atmos');
  assert.equal(u.searchParams.get('var_TMP'),'on');
  assert.equal(u.searchParams.get('lev_2_m_above_ground'),'on');
  assert.equal(u.searchParams.get('leftlon'),'-46');
  assert.throws(()=>noaaGfsAtmosUrl(issued,2));
});
test('one city ID must be from the IBGE 92 polygon registry',()=>{
  assert.equal(rjGfsPoint('3304557')?.ibge,'3304557');
  assert.equal(rjGfsPoint('3303302')?.ibge,'3303302');
  assert.equal(rjGfsPoint('not-a-city'),null);
});
test('GFS model sample requires exact cycle/lead and fresh valid time',()=>{
  const issued=Date.UTC(2026,10,18,6),now=Date.UTC(2026,10,18,10);
  const point=rjGfsPoint('3304557'),forecastHour=3;
  const sourceUrl=noaaGfsAtmosUrl(issued,forecastHour);
  const inData={issued,valid:issued+forecastHour*3600000,kelvin:300};
  const good=validateNoaaGfsPoint(inData,{point,issued,forecastHour,now,sourceUrl});
  assert.equal(good.status,'REAL_MODEL_POINT_VALIDATED');
  assert.equal(good.kind,'P');
  assert.equal(good.temperatureC,26.85);
  assert.equal(good.officialObservation,false);
  assert.equal(good.publishedToAndroid,false);
  assert.equal(validateNoaaGfsPoint({...inData,valid:issued},{point,issued,forecastHour,now,sourceUrl}).status,'UNAVAILABLE');
  assert.equal(validateNoaaGfsPoint(inData,{point,issued,forecastHour,now:Date.UTC(2026,10,18,13),sourceUrl}).status,'UNAVAILABLE');
});
test('probe fails closed when upstream returns an error without inventing temperature',async()=>{
  const now=Date.UTC(2026,10,18,10);
  const result=await probeNoaaGfsAtmosphericPoint({
    ibge:'3304557',now,fetchImpl:async()=>({ok:false,status:503,body:null})
  });
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.temperatureC,null);
  assert.equal(result.publishedToAndroid,false);
});
test('model value alone is insufficient when GRIB and provenance are not verified',async()=>{
  const now=Date.UTC(2026,10,18,10);
  const result=await probeNoaaGfsAtmosphericPoint({
    ibge:'3304557',now,fetchImpl:async()=>({ok:true,status:200,body:[Buffer.from('not a GRIB2 file')]}),
    decode:async()=>{throw new Error('must never decode invalid GRIB')}
  });
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.temperatureC,null);
});
