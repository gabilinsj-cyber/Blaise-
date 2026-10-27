import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNdbcStandardObservations,collectNdbcRjObservations} from '../src/rj-noaa-ndbc-collector.mjs';
const station={id:'TEST1',latitude:-23.1,longitude:-42.1,region:'RJ_LITORAL',
  rjCoverageVerified:true,licenseVerified:true};
const now=Date.parse('2026-10-27T14:00:00Z');
const body='#YY MM DD hh mm WSPD GST WVHT DPD WTMP\n2026 10 27 13 45 5.0 7.0 1.8 9.0 23.4\n2026 10 27 13 15 6.0 8.0 2.0 10.0 24.0\n';
test('NDBC parses only recent real observation rows and units',()=>{
 const records=parseNdbcStandardObservations(body,station,{now});
 assert.equal(records.length,5);
 assert.equal(records.find(x=>x.phenomenon==='ONDAS').value,1.8);
 assert.equal(records.find(x=>x.phenomenon==='TEMPERATURA_MAR').unit,'degC');
 assert.equal(records.every(x=>x.observedAt==='2026-10-27T13:45:00.000Z'),true);
});
test('NDBC rejects unverified geography and missing headers',()=>{
 assert.throws(()=>parseNdbcStandardObservations(body,{...station,rjCoverageVerified:false},{now}));
 assert.throws(()=>parseNdbcStandardObservations('bad',station,{now}));
});
test('NDBC fetches official endpoint and reports absence on stale readings',async()=>{
 const calls=[];
 const fetchImpl=async(url)=>{calls.push(url);return {ok:true,text:async()=>body};};
 const result=await collectNdbcRjObservations([station],{fetchImpl,now});
 assert.equal(calls[0],'https://www.ndbc.noaa.gov/data/realtime2/TEST1.txt');
 assert.equal(result.latestByPhenomenon.ONDAS.value,1.8);
 const expired=await collectNdbcRjObservations([station],{fetchImpl,now:now+3600000});
 assert.equal(expired.live,false);
});
