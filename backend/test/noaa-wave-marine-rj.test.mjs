import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_OFFSHORE_WAVE_POINTS,noaaRjMarineFieldUrl,probeNoaaRjMarine
} from '../src/noaa-wave-marine-rj.mjs';
const now=Date.UTC(2026,10,18,12,32),cycle=Date.UTC(2026,10,18,12);
const fakeGrib=()=>{
 const b=Buffer.alloc(32);b.write('GRIB',0,'ascii');b[7]=2;
 b.writeBigUInt64BE(32n,8);b.write('7777',28,'ascii');return b;
};
const reader=async(_file,field)=>({
 issuedAt:new Date(cycle).toISOString(),
 validAt:new Date(cycle).toISOString(),
 values:RJ_OFFSHORE_WAVE_POINTS.map(p=>({
  id:p.id,latitude:p.latitude,longitude:p.longitude,
  field,value:field==='waveHeightM'?2.1:8.2,
  unit:field==='waveHeightM'?'m':'s'
 }))
});
test('NOAA wave product URLs use official grib filter and correct distinct variables',()=>{
 const a=new URL(noaaRjMarineFieldUrl(cycle,0,'waveHeightM'));
 const b=new URL(noaaRjMarineFieldUrl(cycle,0,'swellPeriodS'));
 assert.equal(a.hostname,'nomads.ncep.noaa.gov');
 assert.equal(a.searchParams.get('var_HTSGW'),'on');
 assert.equal(a.searchParams.has('var_SWPER'),false);
 assert.equal(b.searchParams.get('var_SWPER'),'on');
 assert.equal(b.searchParams.has('var_HTSGW'),false);
 assert.throws(()=>noaaRjMarineFieldUrl(cycle,0,'temperatureC'));
});
test('one GRIB per field covers 3 offshore points as P not station observation',async()=>{
 const urls=[];
 const snap=await probeNoaaRjMarine({
  now,downloader:async u=>{urls.push(u);return fakeGrib();},reader
 });
 assert.equal(snap.status,'FULL');
 assert.equal(snap.verifiedFieldValues,6);
 assert.equal(urls.length,2);
 assert.equal(snap.kind,'P');
 assert.equal(snap.physicalObservation,false);
 assert.equal(snap.municipalityStations,0);
 assert.equal(snap.publishedToSubscriber,false);
 assert.equal(snap.points.length,3);
 assert.ok(snap.points.every(x=>x.values.waveHeightM===2.1&&
   x.values.swellPeriodS===8.2));
});
test('one failing NOAA field must stay null, never copy height into period',async()=>{
 const snap=await probeNoaaRjMarine({
  now,downloader:async u=>{
   if(new URL(u).searchParams.has('var_SWPER'))throw Error('upstream_404');
   return fakeGrib();
  },reader
 });
 assert.equal(snap.status,'PARTIAL');
 assert.equal(snap.verifiedFieldValues,3);
 assert.ok(snap.points.every(x=>x.values.swellPeriodS===null));
});
test('upstream unavailable is not calm sea nor empty forecast value zero',async()=>{
 const snap=await probeNoaaRjMarine({
  now,downloader:async()=>{throw Error('NOAA_503');}
 });
 assert.equal(snap.status,'UNAVAILABLE');
 assert.deepEqual(snap.points,[]);
});
test('invalid GRIB and wrong forecast validity cannot be treated as live',async()=>{
 const snap=await probeNoaaRjMarine({
  now,downloader:async()=>Buffer.from('not-grib'),
  reader:async()=>{throw Error('MUST_NOT_RUN');}
 });
 assert.equal(snap.status,'UNAVAILABLE');
 assert.deepEqual(snap.points,[]);
 const wrong=await probeNoaaRjMarine({
  now,downloader:async()=>fakeGrib(),
  reader:async()=>({...await reader(null,'waveHeightM'),
   validAt:new Date(cycle+2*3600000).toISOString()})
 });
 assert.equal(wrong.status,'UNAVAILABLE');
});
