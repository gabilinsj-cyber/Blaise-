import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPnboiaObservationProvider,normalizePnboiaRows,eligibleRjBuoy,createPnboiaHttpHandler,PNBOIA_DATA_PATH} from '../src/pnboia-observations.mjs';
const now=Date.parse('2026-10-15T12:00:00Z');
const station={id:48,name:'WATCHKEEPER CABO FRIO',local:'Cabo Frio, RJ',project:'REMOBS',mode:'FUNDEADA',latitude:-23.582,longitude:-42.1711};
const row={date_time:'2026-10-15T11:59:00',value:1.2,variable_short_name:'sig_wave_height',variable_units:'m',aggregate_flag:1,sensor_installation_id:12,depth:null};
const json=(body,headers={})=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json',...headers}});

test('PNBOIA never contacts sensors without server credential and approved display terms',async()=>{
 let calls=0;
 for(const options of [{},{token:'fixture-token'},{usageApproved:true}]){
  const r=await createPnboiaObservationProvider({...options,fetchImpl:async()=>{calls++;throw Error('no network')}})();
  assert.equal(r.observations.length,0);
 }
 assert.equal(calls,0);
});
test('qualified UTC point measurements retain station, timestamp and physical units',()=>{
 const r=normalizePnboiaRows([row],{station,now});
 assert.equal(r[0].observedAt,'2026-10-15T11:59:00.000Z');
 assert.equal(r[0].stationId,48);assert.equal(r[0].value,1.2);assert.equal(r[0].unit,'m');
 assert.equal(r[0].automaticAlertAuthorized,false);
});
test('test benches, old or suspect readings, wrong units, depth and prototype names are excluded',()=>{
 assert.equal(eligibleRjBuoy({...station,mode:'TESTES'}),false);
 assert.equal(eligibleRjBuoy({...station,id:101}),false);
 assert.equal(eligibleRjBuoy({...station,local:'Santos, SP'}),false);
 for(const change of [{aggregate_flag:3},{aggregate_flag:null},{variable_units:'cm'},{depth:10},
  {date_time:'2026-10-15T11:54:59Z'},{date_time:'2026-10-15T12:01:00Z'},
  {date_time:'2026-02-30T12:00:00Z'},{value:null},{value:NaN},{sensor_installation_id:null},
  {variable_short_name:'__proto__'},{value:9999}])
  assert.deepEqual(normalizePnboiaRows([{...row,...change}],{station,now}),[]);
});
test('conflicting simultaneous sensors are not arbitrarily averaged or chosen',()=>{
 assert.deepEqual(normalizePnboiaRows([row,{...row,value:2}],{station,now}),[]);
});
test('authenticated readings stay on official host; credential is absent from catalog requests and output',async()=>{
 const requests=[];let clock=now;
 const provider=createPnboiaObservationProvider({token:'fixture-secret',usageApproved:true,clock:()=>clock,fetchImpl:async(url,opts)=>{
  requests.push({url:String(url),opts});
  return String(url).includes('/public/')?json([station]):json([row],{'x-data-resolution':'integral'});
 }});
 const r=await provider();
 assert.equal(r.state,'CURRENT_POINT_OBSERVATIONS');assert.equal(r.observations.length,1);
 assert.equal(requests[0].opts.headers.Authorization,undefined);
 assert.equal(requests[1].opts.headers.Authorization,'Bearer fixture-secret');
 assert.equal(requests[1].opts.redirect,'manual');
 assert.equal(requests[1].url.includes('fixture-secret'),false);
 assert.equal(JSON.stringify(r).includes('fixture-secret'),false);
 await provider();assert.equal(requests.length,2);
 clock+=301_000;
 assert.equal((await provider()).observations.length,0);
});
test('synoptic or unspecified resolution cannot pretend to be a fresh sensor timestamp',async()=>{
 for(const resolution of ['synoptic',null]){
  const provider=createPnboiaObservationProvider({token:'fixture-secret',usageApproved:true,clock:()=>now,
   fetchImpl:async(url)=>String(url).includes('/public/')?json([station]):json([row],resolution?{'x-data-resolution':resolution}:{})});
  assert.equal((await provider()).observations.length,0);
 }
});
test('authorization failure and redirects never expose provider details or follow token to another host',async()=>{
 for(const status of [401,403,302]){
  const requests=[];
  const provider=createPnboiaObservationProvider({token:'fixture-secret',usageApproved:true,clock:()=>now,
   fetchImpl:async(url)=>{requests.push(String(url));return String(url).includes('/public/')?json([station]):new Response(null,{status,headers:{location:'https://example.invalid'}})}});
  const r=await provider();assert.equal(r.observations.length,0);assert.equal(requests.length,2);
  if(status!==302)assert.equal(r.state,'ACCESS_DENIED');
 }
});
test('runtime HTTP bridge routes public GETs without credentials and rejects writes',async()=>{
 const server=http.createServer(createPnboiaHttpHandler((req,res)=>{res.writeHead(404);res.end()},
  {provider:createPnboiaObservationProvider()}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}${PNBOIA_DATA_PATH}`;
  const r=await fetch(url);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await r.json()).state,'ACCESS_NOT_CONFIGURED');
  assert.equal((await fetch(url,{method:'POST'})).status,405);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
