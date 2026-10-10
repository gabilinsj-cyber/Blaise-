import test from 'node:test';
import assert from 'node:assert/strict';
import * as science from '../src/blaise-rj-advanced-physics.mjs';
import { SCIENTIFIC_METHODS, evaluateScientificJobs } from '../src/blaise-scientific-jobs.mjs';

const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const neverAlert=result=>{assert.equal(result.officialAlert,false);assert.equal(result.mayTriggerAlert,false);};
test('local advection preserves distance, direction, velocity and bounds lead time',()=>{
  const out=science.linearFeatureAdvection({initialEastM:200,initialNorthM:500,eastVelocityMs:10,northVelocityMs:-5,leadSeconds:60});
  assert.equal(out.eastM,800);assert.equal(out.northM,200);
  close(out.speedMs,Math.sqrt(125));neverAlert(out);
  assert.throws(()=>science.linearFeatureAdvection({initialEastM:0,initialNorthM:0,eastVelocityMs:10,northVelocityMs:0,leadSeconds:100000}),RangeError);
});
test('Magnus humidity and mixing-ratio chain checks units',()=>{
  const e=science.vaporPressureFromDewPoint({dewPointC:20});
  assert.ok(e.value>20&&e.value<25);neverAlert(e);
  const rh=science.relativeHumidityFromDewPoint({temperatureC:25,dewPointC:25});
  close(rh.value,100);neverAlert(rh);
  assert.throws(()=>science.relativeHumidityFromDewPoint({temperatureC:20,dewPointC:40}),RangeError);
  const r=science.mixingRatio({vaporPressurePa:2000,ambientPressurePa:100000});
  close(r.value,0.622*2000/98000);neverAlert(r);
  const q=science.specificHumidityFromMixingRatio({mixingRatioKgKg:r.value});
  close(q.value,r.value/(1+r.value));neverAlert(q);
  assert.throws(()=>science.mixingRatio({vaporPressurePa:101000,ambientPressurePa:100000}));
});
test('environmental lapse, sea-level pressure and bounded empirical wetbulb',()=>{
  const lapse=science.observedEnvironmentalLapseRate({
    temperatureAtBottomC:30,temperatureAtTopC:24,bottomHeightM:0,topHeightM:1000});
  close(lapse.value,6);neverAlert(lapse);
  const p=science.meanVirtualTemperatureSeaLevelPressure({stationPressurePa:95000,stationHeightM:500,meanVirtualTemperatureK:290});
  assert.ok(p.value>100000&&p.value<102000);neverAlert(p);
  const tw=science.wetBulbStullApprox({temperatureC:30,relativeHumidityPercent:70});
  assert.ok(tw.value>20&&tw.value<30);neverAlert(tw);
  assert.throws(()=>science.wetBulbStullApprox({temperatureC:65,relativeHumidityPercent:70}),RangeError);
});
const start='2026-10-10T10:00:00.000Z';
const plus=ms=>new Date(Date.parse(start)+ms).toISOString();
test('rain accumulation requires complete verified windows and never fills missing data',()=>{
  const sample=[
    {stationId:'RJ-A',start:plus(0),end:plus(300000),rainfallMm:2.5,verified:true},
    {stationId:'RJ-A',start:plus(300000),end:plus(600000),rainfallMm:0,verified:true},
    {stationId:'RJ-A',start:plus(600000),end:plus(900000),rainfallMm:4.1,verified:true},
  ];
  const sum=science.verifiedRainfallAccumulation({observations:sample,windowStart:start,windowEnd:plus(900000)});
  close(sum.value,6.6);neverAlert(sum);
  assert.equal(sum.intervalCount,3);
  for(const bad of [
    sample.slice(0,2),[sample[0],sample[2]], [sample[0],{...sample[1],verified:false},sample[2]],
    [sample[0],{...sample[1],stationId:'RJ-B'},sample[2]],
  ])assert.throws(()=>science.verifiedRainfallAccumulation({observations:bad,windowStart:start,windowEnd:plus(900000)}));
});
test('Z-R radar refuses uncalibrated arbitrary coefficients',()=>{
  const data={reflectivityDbz:40,scopeId:'municipality:3304557',calibration:{
    scopeId:'municipality:3304557',status:'CALIBRATED',version:'test-fixture-not-operational',radarBand:'S',a:200,b:1.6}};
  const rate=science.calibratedZrRainRate(data);
  close(rate.value,(10000/200)**(1/1.6));neverAlert(rate);
  assert.throws(()=>science.calibratedZrRainRate({...data,calibration:{...data.calibration,status:'UNKNOWN'}}));
  assert.throws(()=>science.calibratedZrRainRate({...data,scopeId:'municipality:3303302'}));
});
const make=(z,parcel,ambient)=>({heightM:z,parcelVirtualTemperatureK:parcel,environmentVirtualTemperatureK:ambient});
test('CAPE/CIN explicitly require two valid virtual-temperature vertical profiles',()=>{
  const layer=[make(0,300,301),make(250,300,300),make(500,301,300)];
  assert.throws(()=>science.parcelBuoyancyEnergy({levels:layer,minimumTopHeightM:5000}),RangeError);
});
test('buoyancy profile integrates positive and negative energies when full profile provided',()=>{
  const levels=Array.from({length:15},(_,i)=>make(i*500,300+(i%3===0?-1:1),300));
  const result=science.parcelBuoyancyEnergy({levels,minimumTopHeightM:6000});
  assert.ok(result.capeJkg>0);assert.ok(result.cinJkg<0);neverAlert(result);
  assert.throws(()=>science.parcelBuoyancyEnergy({levels:levels.slice(0,3)}),RangeError);
  assert.throws(()=>science.parcelBuoyancyEnergy({levels:[levels[0],levels[2],...levels.slice(3)]}),RangeError);
});
test('moisture convergence measures gradient field only, not rainfall/alert',()=>{
  const r=science.moistureFluxConvergence({
    specificHumidityKgKg:0.015,eastWindMs:5,northWindMs:0,
    dqDxPerM:0.000001,dqDyPerM:0,duDxPerSec:-0.0001,dvDyPerSec:0});
  close(r.value,-0.0000035,1e-10);neverAlert(r);
});
test('new kernels are available to provenance-gated scientific jobs, not claimed to be operational feeds',()=>{
  assert.ok(SCIENTIFIC_METHODS.includes('verifiedRainfallAccumulation'));
  assert.ok(SCIENTIFIC_METHODS.includes('linearFeatureAdvection'));
  const job=evaluateScientificJobs([{id:'a',scopeId:'municipality:3304557',method:'vaporPressureFromDewPoint',
    maxAgeMs:3600000,validAt:'2026-10-10T17:55:00Z',
    sources:[{sourceId:'INMET',scopeId:'municipality:3304557',quality:'VALIDATED',
      nature:'OBSERVADO',sourceUrl:'https://apitempo.inmet.gov.br/estacao/',
      observedAt:'2026-10-10T17:55:00Z',validAt:'2026-10-10T17:55:00Z'}],
    inputs:{dewPointC:21}}],{now:Date.parse('2026-10-10T18:00:00Z')});
  assert.equal(job[0].status,'CALCULATED_INPUTS_ONLY');
  neverAlert(job[0].result);
});
