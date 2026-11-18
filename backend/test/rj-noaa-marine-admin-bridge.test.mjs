import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRjMarineAdminCoverage} from '../src/rj-noaa-marine-admin-bridge.mjs';
import {RJ_OFFSHORE_WAVE_POINTS,noaaRjMarineFieldUrl} from '../src/noaa-wave-marine-rj.mjs';
const issued=Date.UTC(2026,10,18,12),now=issued+32*60_000;
const proof=()=>({
 contract:'BLAISE_NOAA_RJ_MARINE_3_OFFSHORE_V1',
 status:'FULL',checkedAt:new Date(now-60_000).toISOString(),
 issuedAt:new Date(issued).toISOString(),
 validAt:new Date(issued).toISOString(),
 sourceId:'NOAA_GFS_WAVE',datasetId:'GFS_WAVE_GLOBAL_0P25',
 kind:'P',physicalObservation:false,municipalityStations:0,
 publishedToAndroid:false,publishedToSubscriber:false,
 automaticCollection:false,verifiedFieldValues:6,
 points:RJ_OFFSHORE_WAVE_POINTS.map(p=>({...p,
  values:{waveHeightM:2.4,swellPeriodS:8.7}
 })),
 sourceProducts:{
  waveHeightM:{sourceUrl:noaaRjMarineFieldUrl(issued,0,'waveHeightM'),
   issuedAt:new Date(issued).toISOString(),validAt:new Date(issued).toISOString(),
   values:RJ_OFFSHORE_WAVE_POINTS.map(p=>({...p,field:'waveHeightM',value:2.4,unit:'m'}))},
  swellPeriodS:{sourceUrl:noaaRjMarineFieldUrl(issued,0,'swellPeriodS'),
   issuedAt:new Date(issued).toISOString(),validAt:new Date(issued).toISOString(),
   values:RJ_OFFSHORE_WAVE_POINTS.map(p=>({...p,field:'swellPeriodS',value:8.7,unit:'s'}))}
 }
});
test('scientific P-only offshore fields enter private audit with no city observations',()=>{
 const x=verifyRjMarineAdminCoverage(proof(),{
  now,noaaPublicDataLicenseReviewed:true
 });
 assert.equal(x.status,'FULL');
 assert.equal(x.records.length,6);
 assert.equal(x.verifiedWaveHeightPoints,3);
 assert.equal(x.verifiedSwellPeriodPoints,3);
 assert.equal(x.publishedToSubscribers,false);
 assert.equal(x.physicalObservation,false);
});
test('a single unavailable NOAA period field stays blank',()=>{
 const p=proof();p.status='PARTIAL';p.verifiedFieldValues=3;
 for(const pt of p.points)pt.values.swellPeriodS=null;
 p.sourceProducts.swellPeriodS={sourceUrl:noaaRjMarineFieldUrl(issued,0,'swellPeriodS'),
  state:'UNAVAILABLE',reason:'NOT_VALID',values:[]};
 const a=verifyRjMarineAdminCoverage(p,{now,noaaPublicDataLicenseReviewed:true});
 assert.equal(a.status,'PARTIAL');
 assert.equal(a.verifiedWaveHeightPoints,3);
 assert.equal(a.verifiedSwellPeriodPoints,0);
});
test('no approval, obsolete timestamp, invented point or bogus NOAA source',()=>{
 const opts={now,noaaPublicDataLicenseReviewed:true};
 assert.equal(verifyRjMarineAdminCoverage(proof(),{now}).status,'UNAVAILABLE');
 const old=proof();old.checkedAt=new Date(now-13*60_000).toISOString();
 assert.equal(verifyRjMarineAdminCoverage(old,opts).status,'UNAVAILABLE');
 const inland=proof();inland.points[0].latitude=-20;
 assert.equal(verifyRjMarineAdminCoverage(inland,opts).status,'UNAVAILABLE');
 const wrong=proof();
 wrong.sourceProducts.waveHeightM.sourceUrl='https://example.com/waves';
 assert.equal(verifyRjMarineAdminCoverage(wrong,opts).status,'UNAVAILABLE');
});
