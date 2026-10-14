import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWindyLicensedPoint,validateWindyPointForecast,
  WINDY_ENDPOINT} from '../src/rj-windy-point-source.mjs';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
const now=Date.parse('2026-10-12T16:00:00Z');
const input={ibge:'3304557',latitude:-22.9,longitude:-43.2,now};
const fixture={ts:[now,now+3_600_000],units:{
  'temp-surface':'K','rh-surface':'%',
  'gust-surface':'m*s-1','past3hprecip-surface':'mm',
},'temp-surface':[302.15,300.15],
'rh-surface':[78,80],'gust-surface':[10,12],
'past3hprecip-surface':[0,3]};
const success=()=>({
  status:200,headers:{get:()=>null},
  arrayBuffer:async()=>Buffer.from(JSON.stringify(fixture)),
});
test('license and professional plan are mandatory before any Windy network request',async()=>{
  let attempted=0;
  const fetchImpl=async()=>{attempted++;return success();};
  for(const params of [
    {licenseApproved:false,keyPlan:'PROFESSIONAL',apiKey:'x'.repeat(30)},
    {licenseApproved:true,keyPlan:'TEST',apiKey:'x'.repeat(30)},
    {licenseApproved:true,keyPlan:'PROFESSIONAL',apiKey:''},
  ]) {
    const r=await fetchWindyLicensedPoint({...input,...params,fetchImpl});
    assert.equal(r.status,'UNAVAILABLE');
    assert.equal(r.measurements.length,0);
  }
  assert.equal(attempted,0);
});
test('API request includes one RJ position and receives only uncalibrated model forecast',async()=>{
  let called=0;
  const r=await fetchWindyLicensedPoint({
    ...input,keyPlan:'PROFESSIONAL',licenseApproved:true,
    apiKey:'test-only-do-not-use-as-production-key',
    fetchImpl:async(url,options)=>{
      called++;
      assert.equal(url,WINDY_ENDPOINT);
      const body=JSON.parse(options.body);
      assert.deepEqual([body.lat,body.lon],[-22.9,-43.2]);
      assert.equal(body.model,'gfs');
      assert.ok(body.parameters.includes('windGust'));
      return success();
    },
  });
  assert.equal(called,1);
  assert.equal(r.status,'FORECAST_CONTEXT_ONLY');
  assert.equal(r.measurements.find(x=>x.variable==='TEMPERATURA_C').value,29);
  assert.equal(r.measurements.find(x=>x.variable==='RAJADA_KMH').value,36);
  assert.equal(r.measurements.find(x=>x.variable==='CHUVA_MM_3H').value,0);
  assert.ok(r.measurements.every(x=>x.officialMeasurement===false&&x.mayTriggerAlert===false));
  assert.equal(r.historicalSkillValidated,false);
});
test('strange units, array drift and invalid dates never produce plausible fake readings',()=>{
  for(const mutated of [
    {...fixture,units:{...fixture.units,'temp-surface':'°C'}},
    {...fixture,'temp-surface':[300]},
    {...fixture,ts:[NaN]},
    {...fixture,ts:[now-48*3_600_000]},
  ]) {
    const r=validateWindyPointForecast(mutated,input);
    assert.equal(r.status,'UNAVAILABLE');
    assert.equal(r.measurements.length,0);
  }
});
test('off-state failure, malformed HTTP responses and oversize data all fail closed',async()=>{
  const base={...input,licenseApproved:true,keyPlan:'PROFESSIONAL',
    apiKey:'x'.repeat(24)};
  const cases=[
    async()=>({status:400}),
    async()=>({status:200,headers:{get:()=>String(600000)},arrayBuffer:async()=>Buffer.from('{}')}),
    async()=>({status:200,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from('not-json')}),
    async()=>{throw Error('mock timeout');},
  ];
  for(const fetchImpl of cases){
    const r=await fetchWindyLicensedPoint({...base,fetchImpl});
    assert.equal(r.status,'UNAVAILABLE');
  }
});
test('all 92 municipalities valid for scoped model context; no neighboring state or fabricated municipality',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const city of RJ_MUNICIPALITIES){
    const r=validateWindyPointForecast(fixture,{...input,ibge:city.ibge});
    assert.equal(r.forecastOnly,true);
  }
  for(const ibge of ['4106902','3300000']){
    assert.throws(()=>validateWindyPointForecast(fixture,{...input,ibge}),
      /windy_rj_invalid_location/);
  }
});
