import test from 'node:test';
import assert from 'node:assert/strict';
import {shallowWaterLongWaveSpeed,tsunamiConditionalPathSensitivity}
  from '../src/blaise-tsunami-science.mjs';
import {SCIENTIFIC_METHODS,evaluateScientificJobs} from '../src/blaise-scientific-jobs.mjs';

const example = {
  points:[
    {latitude:-23.0,longitude:-43.3,depthMeters:4000,minDepthMeters:3600,maxDepthMeters:4400},
    {latitude:-23.0,longitude:-43.2,depthMeters:4000,minDepthMeters:3600,maxDepthMeters:4400}
  ],
  bathymetry:{
    status:'VALIDATED',version:'FIXTURE_NOT_REAL',sourceId:'TEST_ONLY',
    sourceUrl:'https://example.org/fixture',verticalDatum:'FIXTURE_NOT_REAL',
    resolutionMeters:1000,sha256:'b'.repeat(64)
  },
  destination:{
    cityIbge:3304557,coastPointId:'TEST_ONLY',geometryStatus:'VALIDATED',
    geometryVersion:'TEST_ONLY',latitude:-23.0,longitude:-43.2
  },
  originTime:'2026-11-13T10:00:00Z',periodSeconds:3600,
  maxSegmentMeters:20000,pathValidation:{status:'VALIDATED_WATER_ONLY',version:'FIXTURE_NOT_REAL'}
};
test('long wave celerity equals sqrt(g*h), no official warning',()=>{
  const r=shallowWaterLongWaveSpeed({depthMeters:4000,periodSeconds:3600});
  assert.ok(Math.abs(r.value-Math.sqrt(9.80665*4000))<1e-7);
  assert.equal(r.officialAlert,false);assert.equal(r.coastalImpactConfirmed,false);
  assert.ok(r.wavelengthDepthRatio>20);
});
test('short-period swell cannot be reported as tsunami long wave',()=>{
  assert.throws(()=>shallowWaterLongWaveSpeed({depthMeters:4000,periodSeconds:10}),/long_wave_assumption/);
});
test('tsunami sensitivity is a conditional path computation, never proven arrival',()=>{
  const r=tsunamiConditionalPathSensitivity(example);
  assert.ok(r.fasterDepthTravelSeconds < r.value);
  assert.ok(r.value < r.shallowerDepthTravelSeconds);
  assert.equal(r.firstArrivalProven,false);
  assert.equal(r.tsunamiDetected,false);
  assert.equal(r.coastalImpactConfirmed,false);
  assert.equal(r.arrivalProbability,null);
  assert.equal(r.uncertaintyMeaning,'DEPTH_SENSITIVITY_ONLY_NO_PROBABILITY');
  assert.equal(r.destination.cityIbge,3304557);
});
test('tsunami sensitivity fails closed without defensible bathymetry, coast or path',()=>{
  for(const partial of [
    {bathymetry:null},
    {pathValidation:null},
    {points:[example.points[0],{...example.points[1],minDepthMeters:5000}]},
    {destination:{...example.destination,cityIbge:3303906}},
    {maxSegmentMeters:100},
    {periodSeconds:5}
  ]) assert.throws(()=>tsunamiConditionalPathSensitivity({...example,...partial}));
});
test('tsunami science uses the existing validated RJ scientific job dispatcher',()=>{
  assert.ok(SCIENTIFIC_METHODS.includes('shallowWaterLongWaveSpeed'));
  assert.ok(SCIENTIFIC_METHODS.includes('tsunamiConditionalPathSensitivity'));
  const validAt=example.originTime,now=Date.parse('2026-11-13T10:01:00Z');
  const source={sourceId:'TEST_ONLY',sourceUrl:'https://example.org/fixture',
    scopeId:'municipality:3304557',quality:'VALIDATED',nature:'MODELO',
    observedAt:validAt,validAt};
  const job={id:'tsunami-science-fixture',method:'tsunamiConditionalPathSensitivity',
    scopeId:source.scopeId,validAt,maxAgeMs:180000,sources:[source],inputs:example};
  const [ok,wrongScope,stale] = evaluateScientificJobs([
    job,{...job,scopeId:'municipality:3303906'},
    {...job,sources:[{...source,observedAt:'2026-11-12T10:00:00Z'}]},
  ],{now});
  assert.equal(ok.status,'CALCULATED_INPUTS_ONLY');
  assert.equal(ok.result.officialAlert,false);
  assert.equal(wrongScope.status,'UNAVAILABLE');
  assert.equal(stale.status,'UNAVAILABLE');
});
