import {test} from 'node:test';
import assert from 'node:assert/strict';
import {significantWaveSpectrum,linearWaveDispersion,conditionalMarineTravelTime} from '../src/blaise-marine-kernels.mjs';
import {evaluateScientificJobs,SCIENTIFIC_METHODS} from '../src/blaise-scientific-jobs.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('spectral height reproduces Hm0 from analytic box spectrum, with partial frequency-band label',()=>{
 const r=significantWaveSpectrum({bins:[{lowerHz:0.05,upperHz:0.15,densityM2PerHz:10}]});close(r.value,4);close(r.meanPeriodTm01Seconds,10);assert.equal(r.coverage,'SUPPLIED_FREQUENCY_BANDS_ONLY');assert.equal(r.officialAlert,false);
 const calm=significantWaveSpectrum({bins:[{lowerHz:0.05,upperHz:0.15,densityM2PerHz:0}]});close(calm.value,0);assert.equal(calm.peakBinPeriodSeconds,null);
});
test('spectrum refuses overlapping bands, missing units and negative energy',()=>{
 assert.throws(()=>significantWaveSpectrum({bins:[{lowerHz:0.1,upperHz:0.2,densityM2PerHz:-1}]}));
 assert.throws(()=>significantWaveSpectrum({bins:[{lowerHz:0.1,upperHz:0.2,densityM2PerHz:1},{lowerHz:0.15,upperHz:0.3,densityM2PerHz:1}]}));
});
test('dispersion satisfies governing equation and deep-water group velocity limit',()=>{
 const r=linearWaveDispersion({periodSeconds:10,depthMeters:4000}),omega=2*Math.PI/10;
 close(9.80665*r.waveNumberPerMeter*Math.tanh(r.waveNumberPerMeter*4000),omega**2);
 close(r.phaseSpeedMs,9.80665*10/(2*Math.PI));close(r.groupSpeedMs,r.phaseSpeedMs/2);
});
test('dispersion converges to long-wave shallow-water speed without treating swell as a cyclone trajectory',()=>{
 const r=linearWaveDispersion({periodSeconds:3600,depthMeters:100});close(r.groupSpeedMs,Math.sqrt(9.80665*100),0.001);
 assert.throws(()=>linearWaveDispersion({periodSeconds:10,depthMeters:0}));
});
const args={points:[{latitude:-23,longitude:-43.3,depthMeters:4000},{latitude:-23,longitude:-43.2,depthMeters:4000}],bathymetry:{status:'VALIDATED',version:'TEST_ONLY',sourceId:'test',sourceUrl:'https://example.org/test',verticalDatum:'TEST_ONLY',resolutionMeters:1000,sha256:'a'.repeat(64)},destination:{cityIbge:3304557,coastPointId:'TEST_POINT_NOT_REAL_COAST',geometryStatus:'VALIDATED',geometryVersion:'TEST_ONLY',latitude:-23,longitude:-43.2},originTime:'2026-10-06T21:00:00Z',propagation:'LONG_WAVE_APPROXIMATION',periodSeconds:3600,maxSegmentMeters:20000,pathValidation:{status:'VALIDATED_WATER_ONLY',version:'TEST_ONLY'}};
test('conditional travel equals distance/c at constant depth and never claims impacted city or probability',()=>{
 const r=conditionalMarineTravelTime(args);close(r.value,r.distanceMeters/Math.sqrt(9.80665*4000));assert.equal(r.arrivalProbability,null);assert.equal(r.coastalHeightMeters,null);assert.equal(r.coastalImpactConfirmed,false);assert.equal(r.firstArrivalProven,false);assert.equal(r.destination.cityIbge,3304557);
});
test('swell arrival uses group velocity, not phase velocity or long-wave speed',()=>{
 const r=conditionalMarineTravelTime({...args,propagation:'LINEAR_SWELL_GROUP',periodSeconds:10}),wave=linearWaveDispersion({periodSeconds:10,depthMeters:4000});close(r.value,r.distanceMeters/wave.groupSpeedMs);
});
test('arrival rejects bathymetry gaps, land, bad datum metadata, coarse paths and inappropriate long-wave period',()=>{
 for(const patch of[{bathymetry:null},{pathValidation:null},{points:[args.points[0],{...args.points[1],depthMeters:-5}]},{bathymetry:{...args.bathymetry,verticalDatum:null}},{maxSegmentMeters:10},{periodSeconds:10},{destination:{...args.destination,longitude:-43.1}}])assert.throws(()=>conditionalMarineTravelTime({...args,...patch}));
});
test('coastal arrival refuses nonexistent and inland RJ municipalities rather than routing by prefix alone',()=>{
 assert.throws(()=>conditionalMarineTravelTime({...args,destination:{...args.destination,cityIbge:3399999}}));
 assert.throws(()=>conditionalMarineTravelTime({...args,destination:{...args.destination,cityIbge:3303906}}));
 assert.equal(conditionalMarineTravelTime(args).destination.cityName,'Rio de Janeiro');
});
test('marine routines enter the agent dispatcher with municipal target isolation',()=>{
 for(const name of['significantWaveSpectrum','linearWaveDispersion','conditionalMarineTravelTime'])assert.ok(SCIENTIFIC_METHODS.includes(name));
 const validAt='2026-10-06T21:00:00Z',now=Date.parse('2026-10-06T21:01:00Z');
 const source={sourceId:'test',sourceUrl:'https://example.org',scopeId:'municipality:3304557',quality:'VALIDATED',nature:'MODELO',observedAt:validAt,validAt};
 const job={id:'arrival',method:'conditionalMarineTravelTime',scopeId:source.scopeId,validAt,maxAgeMs:300000,sources:[source],inputs:args};
 const result=evaluateScientificJobs([job,{...job,inputs:{...args,destination:{...args.destination,cityIbge:3303302}}}],{now});assert.equal(result[0].status,'CALCULATED_INPUTS_ONLY');assert.equal(result[1].reason,'coastal_target_scope_mismatch');
});
