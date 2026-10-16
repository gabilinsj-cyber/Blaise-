import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as k from '../src/blaise-scientific-kernels.mjs';
import {evaluateScientificJobs} from '../src/blaise-scientific-jobs.mjs';
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
test('approximate theta-e reduces to dry potential temperature and rejects humidity in g/kg',()=>{
  close(k.equivalentPotentialTemperatureApprox({temperatureK:300,pressurePa:100000,specificHumidityKgKg:0}).value,300);
  assert.ok(k.equivalentPotentialTemperatureApprox({temperatureK:300,pressurePa:100000,specificHumidityKgKg:0.02}).value>300);
  assert.throws(()=>k.equivalentPotentialTemperatureApprox({temperatureK:300,pressurePa:100000,specificHumidityKgKg:20}));
});
test('Clausius Clapeyron derivative agrees with centred finite difference of integrated constant-L expression',()=>{
  const T=300,L=2500000,e=3500,h=0.001;
  const es=t=>e*Math.exp(L/461.5*(1/T-1/t));
  close(k.clausiusClapeyronDerivative({temperatureK:T,saturationVaporPressurePa:e,latentHeatJkg:L}).value,(es(T+h)-es(T-h))/(2*h),1e-6);
});
test('PW integrates analytic constant and linear profiles, preserving partial-column label',()=>{
  const r=k.precipitableWater({levels:[{pressurePa:100000,specificHumidityKgKg:0.01},{pressurePa:50000,specificHumidityKgKg:0.01}]});
  close(r.value,500/9.80665);assert.equal(r.coverage,'SUPPLIED_LAYER_ONLY');
  close(k.precipitableWater({levels:[{pressurePa:100000,specificHumidityKgKg:0.02},{pressurePa:50000,specificHumidityKgKg:0}]}).value,r.value);
  assert.throws(()=>k.precipitableWater({levels:[{pressurePa:50000,specificHumidityKgKg:0.01},{pressurePa:100000,specificHumidityKgKg:0.01}]}));
});
test('FAO56 daily equation reproduces published example 18, Uccle, about 3.88 mm/day',()=>{
  const result=k.referenceEvapotranspirationDaily({temperatureC:16.9,netRadiationMJm2day:13.28,soilHeatMJm2day:0,wind2mMs:2.078,saturationVaporKpa:1.997,actualVaporKpa:1.409,slopeKpaC:0.122,psychrometricKpaC:0.0666});
  close(result.value,3.88,0.02);assert.equal(result.unit,'mm/day');
});
test('soil balance conserves specified inputs and rejects missing fluxes instead of assuming zero',()=>{
  const input={precipitationMm:30,actualEvapotranspirationMm:5,runoffMm:10,irrigationMm:2,capillaryRiseMm:1,deepDrainageMm:3};
  close(k.soilWaterBalance(input).value,15);assert.throws(()=>k.soilWaterBalance({...input,deepDrainageMm:undefined}));
});
test('wind stress has quadratic scaling, correct pressure unit and rejects km/h-scale invalid wind',()=>{
  const a=k.oceanWindStress({airDensityKgm3:1.2,dragCoefficient:0.001,wind10mMs:10});
  close(a.value,0.12);close(k.oceanWindStress({airDensityKgm3:1.2,dragCoefficient:0.001,wind10mMs:20}).value,a.value*4);assert.equal(a.unit,'Pa');
  assert.throws(()=>k.oceanWindStress({airDensityKgm3:1.2,dragCoefficient:0.001,wind10mMs:300}));
});
test('TCHP integrates linear profile to interpolated first isotherm and rejects unclosed warm profile',()=>{
  const input={densityKgm3:1025,heatCapacityJkgK:4000,levels:[{depthM:0,temperatureC:30},{depthM:100,temperatureC:22}]};
  const r=k.tropicalCycloneHeatPotential(input);close(r.z26M,50);close(r.value,410000000);
  assert.throws(()=>k.tropicalCycloneHeatPotential({...input,levels:[{depthM:0,temperatureC:30},{depthM:50,temperatureC:28}]}));
  close(k.tropicalCycloneHeatPotential({...input,levels:[{depthM:0,temperatureC:25},{depthM:50,temperatureC:24}]}).value,0);
});
test('log profile is neutral mean wind, not gust, and rejects displaced height below roughness',()=>{
  const args={frictionVelocityMs:0.4,heightM:10,roughnessM:0.1,displacementM:0,vonKarman:0.4,stability:'NEUTRAL'};
  close(k.neutralMeanWindProfile(args).value,Math.log(100));assert.match(k.neutralMeanWindProfile(args).limitation,/not gust/);
  assert.throws(()=>k.neutralMeanWindProfile({...args,stability:'UNSTABLE'}));assert.throws(()=>k.neutralMeanWindProfile({...args,displacementM:10}));
});
test('KDP relation requires supplied local band calibration and rejects negative phase/noise',()=>{
  const policy={status:'CALIBRATED',version:'TEST_ONLY',radarBand:'S',scopeId:'state:RJ',a:40,b:0.8,maxKdpDegKm:5};
  close(k.calibratedKdpRainRate({kdpDegKm:1,policy,radarBand:'S'}).value,40);
  assert.throws(()=>k.calibratedKdpRainRate({kdpDegKm:1,policy,radarBand:'C'}));assert.throws(()=>k.calibratedKdpRainRate({kdpDegKm:-1,policy,radarBand:'S'}));
});
test('MOS checks locality, lead and training domain; coefficients are test fixtures not RJ operational weights',()=>{
  const args={scopeId:'municipality:3304557',variable:'temperature',unit:'°C',leadHours:24,predictors:{model:30,elevation:100},policy:{status:'CALIBRATED',version:'TEST_ONLY',scopeId:'municipality:3304557',variable:'temperature',unit:'°C',leadHours:24,intercept:1,coefficients:{model:1,elevation:-0.006},predictorRanges:{model:[0,45],elevation:[0,500]}}};
  close(k.calibratedMos(args).value,30.4);assert.throws(()=>k.calibratedMos({...args,scopeId:'municipality:3303302'}));assert.throws(()=>k.calibratedMos({...args,predictors:{model:60,elevation:100}}));
});
test('scalar Kalman update reproduces Gaussian conjugate posterior without overstating certainty',()=>{
  const r=k.scalarKalmanUpdate({predictedMean:10,predictedVariance:4,measurement:14,measurementVariance:4});
  close(r.mean,12);close(r.variance,2);close(r.gain,0.5);assert.throws(()=>k.scalarKalmanUpdate({predictedMean:10,predictedVariance:4,measurement:14,measurementVariance:0}));
});
test('jobs fail closed per job for stale, absent, wrong-state or mismatched source input',()=>{
  const now=Date.parse('2026-10-06T21:00:00Z');
  const source={sourceId:'test',sourceUrl:'https://example.org',scopeId:'state:RJ',quality:'VALIDATED',nature:'OBSERVADO',observedAt:'2026-10-06T20:59:00Z',validAt:'2026-10-06T20:59:00Z'};
  const job={id:'stress',method:'oceanWindStress',scopeId:'state:RJ',maxAgeMs:300000,validAt:source.validAt,sources:[source],inputs:{airDensityKgm3:1.2,dragCoefficient:0.001,wind10mMs:10}};
  const results=evaluateScientificJobs([job,{...job,sources:[]},{...job,scopeId:'state:OTHER'},{...job,sources:[{...source,observedAt:'2026-10-05T20:00:00Z'}]},{...job,validAt:'2026-10-06T21:00:00Z'}],{now});
  assert.equal(results[0].status,'CALCULATED_INPUTS_ONLY');assert.equal(results[0].result.officialAlert,false);assert.ok(results.slice(1).every(r=>r.status==='UNAVAILABLE'&&r.result===null));
});
