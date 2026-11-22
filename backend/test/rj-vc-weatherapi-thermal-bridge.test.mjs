import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRjTwoFreeThermalSources as bridge}
 from '../src/rj-vc-weatherapi-thermal-bridge.mjs';
const NOW=Date.parse('2026-11-22T15:00:00Z');
const vc=()=>({
 ibge:'3304557',sourceId:'VISUAL_CROSSING_FREE',
 currentValidAt:'2026-11-22T14:40:00.000Z',
 checkedAt:'2026-11-22T14:59:00.000Z',
 current:{temperatureC:29,feelsLikeC:32}
});
const wa=()=>({
 ibge:'3304557',sourceId:'WEATHERAPI_FREE',
 validAt:'2026-11-22T14:48:00.000Z',
 checkedAt:'2026-11-22T14:58:00.000Z',
 temperatureC:30,feelsLikeC:33,skyCondition:'PARCIALMENTE_NUBLADO'
});
test('off by default even when fresh cache responses exist',()=>{
 const a=bridge({visualCrossing:vc(),weatherApi:wa(),now:NOW});
 assert.deepEqual(a.approvedThermal,[]);
 assert.equal(a.autoPublishEnabled,false);
 assert.equal(a.inmetDataIncluded,false);
});
test('approved cache outputs preserve both individual source times and fields',()=>{
 const a=bridge({visualCrossing:vc(),weatherApi:wa(),
  visualCrossingThermalLicenseVerified:true,
  weatherApiThermalLicenseVerified:true,now:NOW});
 assert.equal(a.approvedThermal.length,2);
 assert.equal(a.approvedThermal[0].sourceId,'VISUAL_CROSSING_FREE');
 assert.equal(a.approvedThermal[1].sourceId,'WEATHERAPI_FREE');
 assert.equal(a.approvedThermal[0].temperatureC,29);
 assert.equal(a.approvedThermal[1].feelsLikeC,33);
 assert.equal(a.approvedThermal[0].validAt,'2026-11-22T14:40:00.000Z');
 assert.equal(a.approvedThermal[1].validAt,'2026-11-22T14:48:00.000Z');
 assert.equal(a.approvedThermal[1].skyCondition,'PARCIALMENTE_NUBLADO');
 assert.equal(a.approvedThermal.every(x=>x.backendVerified===true),true);
});
test('conflicting thermometer field is withheld from both sources, sky may remain',()=>{
 const row=wa();row.temperatureC=39;row.feelsLikeC=42;
 const a=bridge({visualCrossing:vc(),weatherApi:row,
  visualCrossingThermalLicenseVerified:true,
  weatherApiThermalLicenseVerified:true,now:NOW});
 assert.deepEqual(a.conflictFieldsHeld,['temperatureC','feelsLikeC']);
 assert.equal(a.approvedThermal.length,1);
 assert.equal(a.approvedThermal[0].temperatureC,null);
 assert.equal(a.approvedThermal[0].feelsLikeC,null);
 assert.equal(a.approvedThermal[0].skyCondition,'PARCIALMENTE_NUBLADO');
});
test('newer check does not make stale provider values fresh',()=>{
 const row=wa();row.validAt='2026-11-22T14:05:00.000Z';
 const a=bridge({visualCrossing:vc(),weatherApi:row,
  visualCrossingThermalLicenseVerified:true,
  weatherApiThermalLicenseVerified:true,now:NOW});
 assert.equal(a.approvedThermal.length,1);
 assert.equal(a.approvedThermal[0].sourceId,'VISUAL_CROSSING_FREE');
});
