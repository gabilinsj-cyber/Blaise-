import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibratedTurbulentGust,bulkWindShear,stormRelativeHelicity,horizontalWindDiagnostics,stationPressureTendency} from '../src/blaise-scientific-kernels.mjs';
import {evaluateScientificJobs,SCIENTIFIC_METHODS} from '../src/blaise-scientific-jobs.mjs';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const gust={meanWindMs:10,alongWindStdMs:2,heightM:10,averagingSeconds:3,windowSeconds:600,stationarity:'VALIDATED_STATIONARY',policy:{status:'CALIBRATED',version:'TEST_ONLY',scopeId:'municipality:3304557',method:'mean_plus_peak_sigma',heightM:10,averagingSeconds:3,windowSeconds:600,peakFactor:3,maxMeanWindMs:20,maxStdMs:5}};
test('gust estimate distinguishes turbulent peak from neutral mean wind and keeps calibration provenance',()=>{
 const r=calibratedTurbulentGust(gust);close(r.value,16);assert.equal(r.unit,'m/s');assert.equal(r.officialAlert,false);assert.match(r.limitation,/not observed gust/);
 close(calibratedTurbulentGust({...gust,alongWindStdMs:0}).value,10);
});
test('gust refuses unsupported nonstationary storms, wrong averaging/height, absent or out-of-domain calibration',()=>{
 for(const patch of[{stationarity:'DOWNBURST'},{heightM:20},{averagingSeconds:1},{policy:null},{meanWindMs:25},{alongWindStdMs:6},{windowSeconds:3}])assert.throws(()=>calibratedTurbulentGust({...gust,...patch}));
});
const levels=[{heightAglM:0,eastMs:0,northMs:0},{heightAglM:1000,eastMs:3,northMs:4},{heightAglM:6000,eastMs:18,northMs:24}];
test('bulk shear reproduces 3-4-5 vector and deep layer, with exact interpolation',()=>{
 close(bulkWindShear({levels,bottomM:0,topM:1000,maxGapM:5000}).value,5);
 close(bulkWindShear({levels,bottomM:0,topM:6000,maxGapM:5000}).value,30);
 close(bulkWindShear({levels,bottomM:500,topM:1500,maxGapM:5000}).value,5);
});
test('wind layer rejects absent ground coverage, duplicate height, large gap and wrong component units',()=>{
 for(const args of[{levels:levels.slice(1),bottomM:0,topM:1000,maxGapM:5000},{levels,bottomM:0,topM:7000,maxGapM:5000},{levels,bottomM:0,topM:6000,maxGapM:1000},{levels:[levels[0],levels[0]],bottomM:0,topM:1000,maxGapM:1000},{levels:[levels[0],{...levels[1],eastMs:300}],bottomM:0,topM:1000,maxGapM:1000}])assert.throws(()=>bulkWindShear(args));
});
test('SRH integrates signed hodograph rotation and reverses sign without changing hazard classification',()=>{
 const profile=[{heightAglM:0,eastMs:10,northMs:0},{heightAglM:500,eastMs:0,northMs:10},{heightAglM:1000,eastMs:10,northMs:0}];
 const args={levels:profile,bottomM:0,topM:1000,maxGapM:500,stormEastMs:0,stormNorthMs:0};
 const r=stormRelativeHelicity(args);close(r.value,0);close(r.positiveHelicity,100);close(r.negativeHelicity,-100);assert.equal(r.officialAlert,false);
 const one=stormRelativeHelicity({...args,topM:500});close(one.value,-100);
 close(stormRelativeHelicity({...args,levels:profile.map(l=>({...l,northMs:-l.northMs})),topM:500}).value,100);
 assert.throws(()=>stormRelativeHelicity({...args,stormEastMs:undefined}));
});
test('SRH is invariant under common Galilean translation of storm and environmental wind',()=>{
 const args={levels,bottomM:0,topM:6000,maxGapM:5000,stormEastMs:5,stormNorthMs:-2};
 close(stormRelativeHelicity(args).value,stormRelativeHelicity({...args,levels:levels.map(l=>({...l,eastMs:l.eastMs+20,northMs:l.northMs+10})),stormEastMs:25,stormNorthMs:8}).value);
});
test('horizontal diagnostics recover solid body rotation and convergent analytic flow',()=>{
 const base={coordinateSystem:'LOCAL_CARTESIAN_EAST_NORTH_METERS',duDxPerSecond:0,duDyPerSecond:-0.01,dvDxPerSecond:0.01,dvDyPerSecond:0};
 const r=horizontalWindDiagnostics(base);close(r.vorticityPerSecond,0.02);close(r.divergencePerSecond,0);
 const c=horizontalWindDiagnostics({...base,duDyPerSecond:0,dvDxPerSecond:0,duDxPerSecond:-0.001,dvDyPerSecond:-0.001});close(c.convergencePerSecond,0.002);close(c.vorticityPerSecond,0);
 assert.throws(()=>horizontalWindDiagnostics({...base,coordinateSystem:'DEGREES'}));
});
test('pressure tendency refuses mismatched stations/reference and retains the actual averaging interval',()=>{
 const earlier={stationId:'test',heightM:10,pressureKind:'STATION',pressurePa:101000,observedAt:'2026-10-06T20:00:00Z'},later={...earlier,pressurePa:100700,observedAt:'2026-10-06T21:00:00Z'};
 close(stationPressureTendency({earlier,later}).value,-3);
 for(const patch of[{stationId:'other'},{pressureKind:'SEA_LEVEL'},{heightM:20},{observedAt:earlier.observedAt}])assert.throws(()=>stationPressureTendency({earlier,later:{...later,...patch}}));
});
test('new wind diagnostics are exposed to the agent dispatcher; gust calibration cannot cross municipalities',()=>{
 for(const method of['calibratedTurbulentGust','bulkWindShear','stormRelativeHelicity','horizontalWindDiagnostics','stationPressureTendency'])assert.ok(SCIENTIFIC_METHODS.includes(method));
 const now=Date.parse('2026-10-06T21:00:00Z'),validAt='2026-10-06T20:59:00Z';
 const job={id:'gust',method:'calibratedTurbulentGust',scopeId:'municipality:3304557',validAt,maxAgeMs:300000,sources:[{sourceId:'test',sourceUrl:'https://example.org',scopeId:'municipality:3304557',quality:'VALIDATED',nature:'OBSERVADO',observedAt:validAt,validAt}],inputs:gust};
 const r=evaluateScientificJobs([job,{...job,inputs:{...gust,policy:{...gust.policy,scopeId:'municipality:3303302'}}}],{now});
 assert.equal(r[0].status,'CALCULATED_INPUTS_ONLY');assert.equal(r[1].status,'UNAVAILABLE');assert.equal(r[1].reason,'calibration_scope_mismatch');
});
