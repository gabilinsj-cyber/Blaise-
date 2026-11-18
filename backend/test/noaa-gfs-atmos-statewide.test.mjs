import test from 'node:test';
import assert from 'node:assert/strict';
import {rjNoaaModelMunicipalityCodes,probeNoaaGfsRj92} from '../src/noaa-gfs-atmos-statewide.mjs';
const now=Date.UTC(2026,10,18,10);
const issued=Date.UTC(2026,10,18,6);
const fakeDecode=async(_bytes,point)=>({
  issued,valid:issued+3*3600000,kelvin:point.ibge==='3304557'?300:299
});
test('GFS statewide registry covers 92 unique official IBGE ids',()=>{
  const codes=rjNoaaModelMunicipalityCodes();
  assert.equal(codes.length,92);
  assert.equal(new Set(codes).size,92);
  assert.ok(codes.includes('3304557'));
});
test('one GRIB download may yield 92 independently geolocated forecast cells',async()=>{
  let calls=0,decoded=0;
  const snapshot=await probeNoaaGfsRj92({
    now,
    download:async()=>{calls++;return Buffer.from('validated-by-downloader');},
    decode:async(bytes,p)=>{assert.ok(Buffer.isBuffer(bytes));decoded++;return fakeDecode(bytes,p);}
  });
  assert.equal(calls,1);
  assert.equal(decoded,92);
  assert.equal(snapshot.state,'FULL');
  assert.equal(snapshot.verifiedMunicipalities,92);
  assert.equal(snapshot.records.length,92);
  assert.ok(snapshot.records.every(row=>row.kind==='P'&&Number.isFinite(row.temperatureC)));
  assert.equal(snapshot.modelNotStation,true);
  assert.equal(snapshot.publishedToAndroid,false);
});
test('bad per-city data must be unavailable, not silently filled',async()=>{
  let downloads=0;
  const snapshot=await probeNoaaGfsRj92({
    now,download:async()=>{downloads++;return Buffer.from('sample');},
    decode:async(bytes,p)=>p.ibge==='3304557'?{issued,valid:issued,kelvin:290}:fakeDecode(bytes,p)
  });
  assert.equal(downloads,1);
  assert.equal(snapshot.state,'PARTIAL');
  assert.equal(snapshot.verifiedMunicipalities,91);
  assert.equal(snapshot.missingMunicipalities,1);
  assert.ok(!snapshot.records.some(row=>row.ibge==='3304557'));
});
test('server outage never manufactures a meteorological reading',async()=>{
  const snapshot=await probeNoaaGfsRj92({
    now,download:async()=>{throw Error('NOAA_UNAVAILABLE');},
  });
  assert.equal(snapshot.state,'UNAVAILABLE');
  assert.equal(snapshot.records.length,0);
  assert.equal(snapshot.verifiedMunicipalities,0);
});
