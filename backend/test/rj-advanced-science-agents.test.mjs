import test from 'node:test';
import assert from 'node:assert/strict';
import {liftingCondensationLevel,environmentalLapseRate,hypsometricThickness,suppliedParcelCapeCin}
  from '../src/blaise-scientific-advanced.mjs';
import {RJ_AGENT_DEFINITIONS,rjAgentCatalog,dispatchRjAgent,validateRjAgentSource}
  from '../src/blaise-rj-agent-registry.mjs';

test('LCL saturated parcel starts at zero lift, with finite pressure',()=>{
  const v=liftingCondensationLevel({temperatureK:300,dewPointK:300,pressurePa:100000});
  assert.ok(Math.abs(v.value)<1e-6);
  assert.ok(Math.abs(v.pressureLclPa-100000)<1e-6);
  assert.equal(v.officialAlert,false);
});
test('LCL rejects supersaturation',()=>{
  assert.throws(()=>liftingCondensationLevel({temperatureK:280,dewPointK:290,pressurePa:100000}));
});
test('environmental lapse and hydrostatic thickness cross-check',()=>{
  const v=environmentalLapseRate({lower:{heightAglM:0,temperatureK:300},upper:{heightAglM:1000,temperatureK:293.5}});
  assert.ok(Math.abs(v.value-6.5)<1e-9);
  const h=hypsometricThickness({bottomPressurePa:100000,topPressurePa:90000,meanVirtualTemperatureK:290});
  assert.ok(h.value>800&&h.value<1000);
});
test('CAPE/CIN signed integration splits zero crossing',()=>{
  const v=suppliedParcelCapeCin({levels:[
    {heightAglM:0,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:299},
    {heightAglM:500,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:301},
    {heightAglM:1000,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:302},
  ]});
  assert.ok(v.capeJkg>0);
  assert.ok(v.cinJkg<0);
  assert.equal(v.officialAlert,false);
});
test('CAPE/CIN rejects missing or excessively gapped vertical profile',()=>{
  assert.throws(()=>suppliedParcelCapeCin({levels:[{heightAglM:0,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:301}]}));
  assert.throws(()=>suppliedParcelCapeCin({levels:[
    {heightAglM:0,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:301},
    {heightAglM:2000,environmentVirtualTemperatureK:300,parcelVirtualTemperatureK:302},
  ]}));
});
test('twelve RJ agents registered but NOT auto enabled',()=>{
  assert.equal(RJ_AGENT_DEFINITIONS.length,12);
  assert.equal(new Set(RJ_AGENT_DEFINITIONS.map(x=>x.id)).size,12);
  assert.equal(RJ_AGENT_DEFINITIONS.at(-2).id,'blaise-ia-pesquisa');
  assert.equal(RJ_AGENT_DEFINITIONS.at(-1).id,'geodados-fusao-licenciada');
  assert.ok(rjAgentCatalog().every(x=>!x.operational));
});
test('excluded sources rejected even with executable callbacks',async()=>{
  for(const id of ['inea','chm','marinha-do-brasil','windy','copernicus']){
    assert.equal(validateRjAgentSource(id),false);
    let called=false;
    const x=await dispatchRjAgent('checagem-horaria',{enabled:true,sourceId:id,executor:()=>{called=true;}});
    assert.equal(x.status,'BLOCKED');assert.equal(called,false);
  }
  assert.equal(validateRjAgentSource('noaa'),true);
  assert.equal((await dispatchRjAgent('checagem-horaria')).status,'NOT_CONFIGURED');
});
