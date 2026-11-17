import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeNoaaOffshoreStaging,NOAA_OFFSHORE_RJ_STAGING_POINT as point
} from '../scripts/probe-noaa-wave-staging.mjs';
const now=Date.parse('2026-11-17T16:00:00Z');
const sourceUrl='https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?file=test';
test('NOAA numeric probe only claims model forecast, never official measurement or warning',async()=>{
  let calls=0;
  const report=await probeNoaaOffshoreStaging({
    clock:()=>now,
    collect:async(lat,lon,at)=>{
      calls++;assert.equal(lat,point.latitude);
      assert.equal(lon,point.longitude);assert.equal(at,now);
      return {waveHeightM:1.8,nature:'MODELO',sourceName:'NOAA GFS Wave',
        sourceUrl,issuedAt:'2026-11-17T12:00:00Z',
        validAt:'2026-11-17T16:00:00Z',
        expiresAt:'2026-11-17T17:00:00Z'};
    }
  });
  assert.equal(calls,1);
  assert.equal(report.state,'REAL_MODEL_FIELD_VALIDATED');
  assert.equal(report.value,1.8);
  assert.equal(report.unit,'m');
  assert.equal(report.kind,'P');
  assert.equal(report.publishedToClient,false);
  assert.equal(report.officialObservation,false);
  assert.equal(report.officialAlert,false);
  assert.equal(report.productionChanged,false);
});
test('stale/contradictory NOAA wave model must fail closed, never show zero',async()=>{
  for(const bad of [
    {waveHeightM:null},
    {waveHeightM:-5},
    {waveHeightM:999},
    {nature:'OBSERVACAO'},
    {sourceName:'NOT_NOAA'},
    {validAt:'2026-11-18T16:00:00Z'},
    {expiresAt:'2026-11-17T15:00:00Z'},
    {sourceUrl:'https://evil.invalid'}
  ]){
    const report=await probeNoaaOffshoreStaging({
      clock:()=>now,
      collect:async()=>({
        waveHeightM:1.5,nature:'MODELO',sourceName:'NOAA GFS Wave',
        sourceUrl,issuedAt:'2026-11-17T12:00:00Z',
        validAt:'2026-11-17T16:00:00Z',expiresAt:'2026-11-17T17:00:00Z',...bad
      })
    });
    assert.equal(report.state,'UNAVAILABLE');
    assert.equal(report.value,null);
  }
});
test('network failures are unavailable, never simulated weather',async()=>{
  const report=await probeNoaaOffshoreStaging({
    clock:()=>now,collect:async()=>{throw Error('HTTP_503');}
  });
  assert.equal(report.state,'UNAVAILABLE');
  assert.equal(report.reason,'HTTP_503');
  assert.equal(report.value,null);
});
