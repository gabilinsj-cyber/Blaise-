import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjWeatherApiFreeMonthlyBudget}
 from '../src/rj-weatherapi-free-monthly-budget.mjs';
const NOW=Date.parse('2026-11-22T15:00:00Z');
function fakeDb(){
 const data=new Map();
 const snapshot=k=>({exists:data.has(k),data:()=>structuredClone(data.get(k))});
 return {data,db:{
  collection(collection){return {doc(id){return {key:collection+'/'+id}}}},
  async runTransaction(fn){
   const writes=[];
   const tx={get:async ref=>snapshot(ref.key),
    set:(ref,value)=>writes.push([ref.key,structuredClone(value)])};
   const v=await fn(tx);
   for(const [k,row] of writes)data.set(k,row);
   return v;
  }
 }};
}
test('one monthly reservation is atomic through transaction and 25-minute city cooldown',async()=>{
 const {db,data}=fakeDb();
 const o=createRjWeatherApiFreeMonthlyBudget({db,clock:()=>NOW});
 const params={ibge:'3304557',source:'WEATHERAPI_FREE',maxMonthlyCalls:80000};
 const a=await o.reserve(params);
 const b=await o.reserve(params);
 assert.equal(a.approved,true);
 assert.equal(a.paidAllowed,false);
 assert.equal(b.approved,false);
 assert.equal(data.get('blaise_rj_weatherapi_free_monthly_ledger/2026-11').reservedCalls,1);
 assert.equal(o.autoCollectionEnabled,false);
});
test('monthly ceiling 80k cannot roll to paid overage or ignore other city budget',async()=>{
 const {db,data}=fakeDb();
 data.set('blaise_rj_weatherapi_free_monthly_ledger/2026-11',{
  reservedCalls:79999,source:'WEATHERAPI_FREE',paidAllowed:false
 });
 const o=createRjWeatherApiFreeMonthlyBudget({db,clock:()=>NOW});
 const first=await o.reserve({ibge:'3304557',source:'WEATHERAPI_FREE',maxMonthlyCalls:80000});
 const second=await o.reserve({ibge:'3303302',source:'WEATHERAPI_FREE',maxMonthlyCalls:80000});
 assert.equal(first.approved,true);
 assert.equal(second.approved,false);
 assert.equal(data.get('blaise_rj_weatherapi_free_monthly_ledger/2026-11').reservedCalls,80000);
 assert.equal(o.paidOveragesAllowed,false);
});
test('invalid city, source or elevated maximum cannot override budget policy',async()=>{
 const {db}=fakeDb();
 const o=createRjWeatherApiFreeMonthlyBudget({db,clock:()=>NOW});
 for(const inputs of [
  {ibge:'0',source:'WEATHERAPI_FREE',maxMonthlyCalls:80000},
  {ibge:'3304557',source:'OPENWEATHER',maxMonthlyCalls:80000},
  {ibge:'3304557',source:'WEATHERAPI_FREE',maxMonthlyCalls:100000}
 ])await assert.rejects(()=>o.reserve(inputs),/weatherapi_invalid_reservation/);
});
