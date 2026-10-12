import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRjOpenWeatherInternalHandler,RJ_OWM_INTERNAL_PATH,
} from '../src/rj-openweather-http.mjs';

const resp=()=>({
  statusCode:0,headers:{},data:null,
  setHeader(k,v){this.headers[k]=v;},
  end(s){this.data=JSON.parse(s);},
});
const calls=[];
const adapter={
  status:()=>({enabled:true}),
  async query(args) {
    calls.push(args);
    return {
      status:'FRESH_COMPLEMENTARY_PRODUCT',sourceId:'OPENWEATHERMAP_API',
      result:{value:28.4,unit:'°C',observedAt:'2026-10-12T17:00:00Z'},
      automaticAlertAuthorized:false,
    };
  },
};
const handler=createRjOpenWeatherInternalHandler(
  (_req,res)=>{res.statusCode=200;res.end(JSON.stringify({otherRoute:true}));},
  {adapter,verifyOperatorOidc:async token=>token==='Bearer operator',clock:()=>1000},
);

test('uncredentialed clients and wrong HTTP methods do not query paid source',async()=>{
  for(const req of [
    {method:'GET',url:RJ_OWM_INTERNAL_PATH+'?ibge=3304557&phenomenon=TEMPERATURA',headers:{}},
    {method:'POST',url:RJ_OWM_INTERNAL_PATH,headers:{authorization:'Bearer operator'}},
  ]) {
    const result=resp();
    await handler(req,result);
    assert.ok([403,405].includes(result.statusCode));
  }
  assert.equal(calls.length,0);
});

test('operator can request one validated RJ product without key or source URL',async()=>{
  const result=resp();
  await handler({
    method:'GET',
    url:RJ_OWM_INTERNAL_PATH+'?ibge=3304557&phenomenon=TEMPERATURA',
    headers:{authorization:'Bearer operator'},
  },result);
  assert.equal(result.statusCode,200);
  assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal(result.data.result.value,28.4);
  assert.equal(calls.length,1);
  assert.equal(calls[0].ibge,'3304557');
  assert.equal(calls[0].phenomenon,'TEMPERATURA');
  assert.equal(JSON.stringify(result.data).includes('appid'),false);
});

test('reject malformed queries and preserve other handlers',async()=>{
  for(const query of ['?ibge=4106902&phenomenon=TEMPERATURA',
    '?ibge=3304557&phenomenon=invalid',
    '?ibge=3304557&phenomenon=TEMPERATURA&unknown=1']) {
    const result=resp();
    await handler({
      method:'GET',url:RJ_OWM_INTERNAL_PATH+query,
      headers:{authorization:'Bearer operator'},
    },result);
    assert.equal(result.statusCode,400);
  }
  assert.equal(calls.length,1);
  const other=resp();
  await handler({method:'GET',url:'/healthz',headers:{}},other);
  assert.equal(other.data.otherRoute,true);
});

test('operator identity is mandatory even if adapter has valid data',async()=>{
  const fn=createRjOpenWeatherInternalHandler(()=>{},{
    adapter,verifyOperatorOidc:null,
  });
  const r=resp();
  await fn({method:'GET',url:RJ_OWM_INTERNAL_PATH,headers:{}},r);
  assert.equal(r.statusCode,503);
});

test('source outages do not turn into invented readings',async()=>{
  const fn=createRjOpenWeatherInternalHandler(()=>{},{
    adapter:{...adapter,async query(){throw Error('private token');}},
    verifyOperatorOidc:async()=>true,
  });
  const r=resp();
  await fn({
    method:'GET',url:RJ_OWM_INTERNAL_PATH+'?ibge=3304557&phenomenon=VENTO',
    headers:{},
  },r);
  assert.equal(r.statusCode,503);
  assert.equal(r.data.error,'source_unavailable');
  assert.equal(JSON.stringify(r.data).includes('private token'),false);
});
