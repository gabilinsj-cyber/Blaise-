import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createRjModelPointProbeHandler,RJ_MODEL_PROBE_PATH} from '../src/rj-model-point-probe-http.mjs';

const makeReq=(data={},override={})=>Object.assign(
  Readable.from([Buffer.from(JSON.stringify(data))]),
  {method:'POST',url:RJ_MODEL_PROBE_PATH,
    headers:{authorization:'Bearer testing-operator','content-type':'application/json'},...override});
const makeRes=()=>({
  statusCode:0,headers:{},value:null,
  setHeader(key,value){this.headers[key]=value;},
  end(value){this.value=JSON.parse(value);},
});
const env={BLAISE_WINDY_POINT_OPERATOR_APPROVED:'true',
  BLAISE_WINDY_POINT_PLAN:'PROFESSIONAL',
  BLAISE_WINDY_POINT_API_KEY:'example-test-key-not-a-real-credential'};
const position={ibge:'3304557',latitude:-22.9,longitude:-43.2};
const sample={status:'FORECAST_CONTEXT_ONLY',sourceId:'WINDY_MODELO',
  mayTriggerAlert:false,measurements:[]};
function fakeService(overrides={}) {
  const calls=[];
  const handler=createRjModelPointProbeHandler(()=>{throw Error('unexpected_delegate');},{
    verifyOperatorOidc:async()=>true,env,
    fetchPoint:async args=>{calls.push(args);return sample;},
    clock:()=>Date.parse('2026-10-12T16:00:00Z'),...overrides});
  return {handler,calls};
}
test('approved operator accesses one model point, never publishes it as a weather alert',async()=>{
  const service=fakeService(),res=makeRes();
  await service.handler(makeReq(position),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.value.municipalityAttributionVerified,false);
  assert.equal(res.value.usableForMunicipalWarnings,false);
  assert.equal(service.calls.length,1);
  assert.equal(JSON.stringify(res.value).includes(env.BLAISE_WINDY_POINT_API_KEY),false);
});
test('operator identity or commercial license missing blocks source query',async()=>{
  for(const override of [
    {verifyOperatorOidc:async()=>false},
    {verifyOperatorOidc:null},
    {env:{...env,BLAISE_WINDY_POINT_OPERATOR_APPROVED:'false'}},
    {env:{...env,BLAISE_WINDY_POINT_PLAN:'TEST'}},
  ]){
    const service=fakeService(override),res=makeRes();
    await service.handler(makeReq(position),res);
    assert.notEqual(res.statusCode,200);
    assert.equal(service.calls.length,0);
  }
});
test('bad request, wrong HTTP method and unrelated routes handled safely',async()=>{
  const service=fakeService();
  let res=makeRes();
  await service.handler(makeReq({...position,unexpected:true}),res);
  assert.equal(res.statusCode,400);
  res=makeRes();
  await service.handler(makeReq(position,{method:'GET'}),res);
  assert.equal(res.statusCode,405);
  let delegated=0;
  const handler=createRjModelPointProbeHandler(()=>{delegated++;},
    {verifyOperatorOidc:async()=>true,env});
  await handler(makeReq(position,{url:'/healthz'}),makeRes());
  assert.equal(delegated,1);
});
test('failed source request returns generic 503',async()=>{
  const service=fakeService({fetchPoint:async()=>{throw Error('upstream_error');}});
  const res=makeRes();
  await service.handler(makeReq(position),res);
  assert.equal(res.statusCode,503);
  assert.deepEqual(res.value,{error:'windy_source_unavailable'});
});
