import test from 'node:test';
import {strict as a} from 'node:assert';
import {createScientificHttpHandler as make} from '../src/blaise-scientific-http.mjs';
test('negado nao le relatorios',async()=>{
let n=0;
const h=make(()=>{},{
canReadReports:async()=>false,
store:{read(){n++;return [];}}
});
const r={setHeader(){},writeHead(c){this.c=c},end(){}};
await h({
url:'/v1/admin/scientific-reports',
method:'GET',headers:{}
},r);
a.equal(r.c,403);
a.equal(n,0);
});

test('only allowlisted admin can read cached meteorological memory',async()=>{
 let memoryCalls=0,verificationCalls=0,forwarded=0;
 const memory={contract:'RJ_ADMIN_METEOROLOGICAL_MEMORY_V1',scope:'ADMIN_ONLY',
  clientPublishingEnabled:false,privateMeteoblue:{status:'INDISPONIVEL'}};
 const h=make(()=>{forwarded++},{
  canReadReports:async token=>{verificationCalls++;return token==='Bearer ADMIN'},
  store:{read:()=>[]},readMeteorologicalMemory:async()=>{memoryCalls++;return memory}
 });
 const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},
   writeHead(code){this.c=code},end(body){this.body=body}});
 const denied=res();await h({url:'/v1/admin/meteorological-memory',
  method:'GET',headers:{authorization:'Bearer visitor'}},denied);
 a.equal(denied.c,403);a.equal(memoryCalls,0);
 const invalidMethod=res();await h({url:'/v1/admin/meteorological-memory',
  method:'POST',headers:{authorization:'Bearer ADMIN'}},invalidMethod);
 a.equal(invalidMethod.c,405);a.equal(memoryCalls,0);
 const allowed=res();await h({url:'/v1/admin/meteorological-memory',
  method:'GET',headers:{authorization:'Bearer ADMIN'}},allowed);
 a.equal(allowed.c,200);a.equal(memoryCalls,1);a.equal(forwarded,0);
 a.deepEqual(JSON.parse(allowed.body),memory);
 a.equal(allowed.headers['Cache-Control'],'no-store');
 const other=res();await h({url:'/other',method:'GET',headers:{}},other);
 a.equal(forwarded,1);
});
test('admin memory reader unavailable or invalid never leaks details',async()=>{
 const h=make(()=>{},{
  canReadReports:async()=>true,store:{read:()=>[]},
  readMeteorologicalMemory:async()=>{throw Error('SECRET_SHOULD_NEVER_BE_PRINTED')}
 });
 const r={setHeader(){},writeHead(c){this.c=c},end(x){this.body=x}};
 await h({url:'/v1/admin/meteorological-memory',method:'GET',headers:{}},r);
 a.equal(r.c,503);
 a.equal(r.body.includes('SECRET_SHOULD_NEVER_BE_PRINTED'),false);
});

test('admin 92-city IBGE query allows only pre-verified codes; authorization always first',async()=>{
 let calls=0;
 const h=make(()=>{},{
  canReadReports:async token=>token==='Bearer ADMIN',
  store:{read:()=>[]},
  readMeteorologicalMemory:async ({ibge})=>{
   calls++;
   return {contract:'RJ_ADMIN_METEOROLOGICAL_MEMORY_V1',
    scope:'ADMIN_ONLY',clientPublishingEnabled:false,selectedIbge:ibge};
  }
 });
 const res=()=>({setHeader(){},writeHead(n){this.c=n},end(b){this.body=b}});
 const denied=res();
 await h({url:'/v1/admin/meteorological-memory?ibge=3304557',
  method:'GET',headers:{authorization:'Bearer VISITOR'}},denied);
 a.equal(denied.c,403);a.equal(calls,0);
 const allowed=res();
 await h({url:'/v1/admin/meteorological-memory?ibge=3304557',
  method:'GET',headers:{authorization:'Bearer ADMIN'}},allowed);
 a.equal(allowed.c,200);
 a.equal(JSON.parse(allowed.body).selectedIbge,'3304557');
 for(const bad of [
  '/v1/admin/meteorological-memory?ibge=9999999',
  '/v1/admin/meteorological-memory?ibge=3304557&other=1',
  '/v1/admin/meteorological-memory?ibge=3304557%26x',
  '/v1/admin/meteorological-memory?ibge=3304557/../../../'
 ]){
  const r=res();
  await h({url:bad,method:'GET',
   headers:{authorization:'Bearer ADMIN'}},r);
  a.equal(r.c,400);
 }
 a.equal(calls,1);
});
