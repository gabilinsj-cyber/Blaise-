import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgent13OperatorHttpHandler as create, RJ_AGENT13_OPERATOR_PATH as PATH} from '../src/rj-agent13-operator-http.mjs';
const BEARER='Bearer synthetic-unit-test-not-a-real-token';
const success={status:'COMPLETED',result:{status:'CURRENT_ESTIMATE_AVAILABLE',weather:{sourceId:'OPENWEATHER_ONECALL4_CURRENT',officialObservation:false,officialAlert:false,temperatureC:27}}};
function prepare({agent13={configured:true,onDemand:async()=>success},verifyOperatorOidc=async()=>true,delegate=async(_,res)=>res.end('delegate')}={}){
 const handler=create(delegate,{agent13,verifyOperatorOidc});
 return async({method='POST',url=PATH,headers={authorization:BEARER}}={})=>{
  let body='',code=null;
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){body=String(s);code=this.statusCode;}};
  await handler({method,url,headers},res);
  return {code,body,headers:res.headers};
 };
}
test('unmatched routes delegate without invoking collection',async()=>{
 let calls=0;
 const go=prepare({agent13:{configured:true,onDemand:async()=>{calls++;return success;}}});
 const r=await go({url:'/healthz'});assert.equal(r.body,'delegate');assert.equal(calls,0);
});
test('GET is blocked with no collection',async()=>{
 let calls=0; const go=prepare({agent13:{configured:true,onDemand:async()=>{calls++;return success;}}});
 const r=await go({method:'GET'});assert.equal(r.code,405);assert.equal(calls,0);
});
test('queries and request bodies are blocked',async()=>{
 let calls=0;const go=prepare({agent13:{configured:true,onDemand:async()=>{calls++;return success;}}});
 assert.equal((await go({url:PATH+'?city=Rio'})).code,400);
 assert.equal((await go({headers:{authorization:BEARER,'content-length':'1'}})).code,413);
 assert.equal((await go({headers:{authorization:BEARER,'transfer-encoding':'chunked'}})).code,413);
 assert.equal(calls,0);
});
test('no OIDC verifier fails closed',async()=>{
 const go=prepare({verifyOperatorOidc:null}); assert.equal((await go()).code,503);
});
test('missing and malformed Bearer deny without contacting verifier',async()=>{
 let calls=0;const go=prepare({verifyOperatorOidc:async()=>{calls++;return true;}});
 assert.equal((await go({headers:{}})).code,403);
 assert.equal((await go({headers:{authorization:'Basic x'}})).code,403);
 assert.equal(calls,0);
});
test('OIDC denial and verifier exception block collection',async()=>{
 let calls=0;const agent13={configured:true,onDemand:async()=>{calls++;return success;}};
 assert.equal((await prepare({agent13,verifyOperatorOidc:async()=>false})()).code,403);
 assert.equal((await prepare({agent13,verifyOperatorOidc:async()=>{throw Error('AUTH_OFFLINE');}})()).code,403);
 assert.equal(calls,0);
});
test('unconfigured Agent13 cannot run even when OIDC permits',async()=>{
 let calls=0;
 const go=prepare({agent13:{configured:false,onDemand:async()=>{calls++;return success;}}});
 const r=await go();assert.equal(r.code,503);assert.equal(calls,0);
});
test('valid operator obtains redacted confirmation only',async()=>{
 let calls=0;const go=prepare({agent13:{configured:true,onDemand:async()=>{calls++;return success;}}});
 const r=await go();assert.equal(r.code,200);assert.equal(calls,1);
 assert.equal(JSON.parse(r.body).status,'CURRENT_PROVIDER_ESTIMATE_RETRIEVED');
 assert.equal(r.body.includes('temperatureC'),false);
 assert.equal(r.headers['Cache-Control'],'no-store');
});
test('failed and incomplete source result never looks successful',async()=>{
 for(const result of [
  {status:'UNAVAILABLE',reason:'ATOMIC_QUOTA_UNAVAILABLE'},
  {status:'COMPLETED'},
  {status:'COMPLETED',result:{status:'CURRENT_ESTIMATE_AVAILABLE'}},
  {status:'COMPLETED',result:{status:'CURRENT_ESTIMATE_AVAILABLE',weather:{...success.result.weather,officialAlert:true}}},
 ]){
  const r=await prepare({agent13:{configured:true,onDemand:async()=>result}})();
  assert.equal(r.code,503);
  assert.equal(r.body.includes('ATOMIC_QUOTA_UNAVAILABLE'),false);
 }
});
test('busy and thrown executor are normalized without leaking errors',async()=>{
 assert.equal((await prepare({agent13:{configured:true,onDemand:async()=>({status:'BUSY'})}})()).code,409);
 const r=await prepare({agent13:{configured:true,onDemand:async()=>{throw Error('MY_SECRET');}}})();
 assert.equal(r.code,503);assert.equal(r.body.includes('MY_SECRET'),false);
});
