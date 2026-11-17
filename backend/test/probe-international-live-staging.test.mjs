import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROBE_TARGETS,inspectLiveProductCatalog,probePublicCatalogs
} from '../scripts/probe-international-live-staging.mjs';
const now=Date.parse('2026-11-17T14:00:00Z');
test('real provider catalog probe is explicit, bounded and excludes MET Norway',()=>{
  assert.deepEqual(PROBE_TARGETS.map(x=>x.id),[
    'NOAA_GFS_WAVE','DWD_ICON_GLOBAL_T2M','EUMETSAT_OSI_SAF_SST'
  ]);
  assert.ok(PROBE_TARGETS.every(x=>!x.url.includes('met.no')));
  assert.ok(PROBE_TARGETS.every(x=>new URL(x.url).protocol==='https:'));
  assert.ok(PROBE_TARGETS.every(x=>x.kind==='P'||x.kind==='E'));
});
test('timestamps are metadata, never surface weather values',()=>{
  const noaa=inspectLiveProductCatalog(PROBE_TARGETS[0],
    '<p>gfs.20261117 gfs.20261116</p>',{now});
  assert.equal(noaa.state,'RECENT_CATALOG');
  assert.equal(noaa.value,null);
  assert.equal(noaa.observation,false);
  const dwd=inspectLiveProductCatalog(PROBE_TARGETS[1],
    'icon_global_icosahedral_single-level_2026111700_file.grib2',{now});
  assert.equal(dwd.state,'RECENT_CATALOG');
  const osi=inspectLiveProductCatalog(PROBE_TARGETS[2],
    'OSI-207-c | GOES-East SST | operational | 20261115 07:00 | 20261115 08:00',{now});
  assert.equal(osi.state,'STALE_CATALOG');
});
test('mocked network never reports real validated weather observations',async()=>{
  let calls=0;
  const fakeFetch=async(url)=>{
    calls++;
    if(url.includes('nomads'))return new Response('gfs.20261117',{status:200});
    if(url.includes('dwd.de'))return new Response('icon_global_icosahedral_single-level_2026111700',{status:200});
    return new Response('OSI-207-c | GOES-East SST | operational | 20261117 12:00',{status:200});
  };
  const evidence=await probePublicCatalogs({clock:()=>now,fetchImpl:fakeFetch});
  assert.equal(calls,3);
  assert.equal(evidence.metNorwayCalled,false);
  assert.equal(evidence.modelValuesDecoded,false);
  assert.equal(evidence.publishedToAndroid,false);
  assert.ok(evidence.results.every(row=>row.value===null&&row.observation===false));
  assert.ok(evidence.results.every(row=>row.state==='RECENT_CATALOG'));
});
test('unreachable external sites fail unavailable, not no rain or zero',async()=>{
  const report=await probePublicCatalogs({
    clock:()=>now,
    fetchImpl:async()=>{throw Error('CONNECTION_UNAVAILABLE');}
  });
  assert.ok(report.results.every(x=>x.state==='UNAVAILABLE'&&x.value===null));
  assert.ok(report.results.every(x=>x.reason==='CONNECTION_UNAVAILABLE'));
});
