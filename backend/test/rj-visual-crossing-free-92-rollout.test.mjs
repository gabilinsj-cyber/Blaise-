import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualCrossing92DryRunPlan,createVisualCrossing92Budget,
 VC_RJ_BUDGET_COLLECTION,VC_RJ_INTERNAL_DAY_CAP,VC_RJ_PER_CITY_MIN_INTERVAL_MS}
 from '../src/rj-visual-crossing-free-92-rollout.mjs';

const now=Date.parse('2026-11-20T01:00:00Z');
const accepted={collectionEnabled:true,keyReplacedAfterExposure:true,
 freePlanConfirmed:true,noPaymentMethodConfirmed:true,
 extraCreditIndicatorReviewed:true,providerDailyQuotaConfirmed:true,
 forecastQueryCostConfirmed:1,operatorApproved92Rollout:true,
 billingAllowed:false,clientPublishingEnabled:false,
 accountUsageDayUtc:'2026-11-20',providerUsageAlreadyToday:0,
 providerUsageConfirmedAt:new Date(now-30_000).toISOString()
};
function mockDb(){
 const m=new Map();
 const db={
  collection:name=>{
   assert.equal(name,VC_RJ_BUDGET_COLLECTION);
   return {doc:key=>({id:key})};
  },
  runTransaction:async fn=>{
   const pending=[];
   const tx={
    get:async ref=>({exists:m.has(ref.id),data:()=>m.get(ref.id)}),
    set:(ref,value)=>pending.push([ref.id,value])
   };
   const result=await fn(tx);
   for(const [id,v] of pending)m.set(id,v);
   return result;
  }
 };
 return {db,m};
}
test('92 municipality dry-run has exactly 8 three-hour rounds and reserves no records',()=>{
 const plan=createVisualCrossing92DryRunPlan({dayUtc:'2026-11-20'});
 assert.equal(plan.mode,'PREVIEW_ONLY_NO_PROVIDER_CALLS');
 assert.equal(plan.municipalityCount,92);
 assert.equal(plan.rounds,8);
 assert.equal(plan.expectedDailyRecords,736);
 assert.equal(plan.maximumInternalRecords,800);
 assert.equal(plan.internalBudgetHeadroom,64);
 assert.equal(plan.providerQuotaHeadroomIfNoOtherCalls,264);
 assert.equal(plan.roundPlans[0].cities.length,92);
 assert.equal(new Set(plan.roundPlans[1].cities).size,92);
 assert.equal(plan.automaticEnabled,false);
 assert.equal(plan.customerPublishingEnabled,false);
});
test('cannot spend with unrotated key, unknown zero-bonus indicator or missing account review',async()=>{
 const {db,m}=mockDb();
 for(const p of [
  null,{...accepted,keyReplacedAfterExposure:false},
  {...accepted,extraCreditIndicatorReviewed:false},
  {...accepted,providerDailyQuotaConfirmed:false},
  {...accepted,forecastQueryCostConfirmed:2},
  {...accepted,noPaymentMethodConfirmed:false},
  {...accepted,operatorApproved92Rollout:false},
  {...accepted,billingAllowed:true},
  {...accepted,providerUsageConfirmedAt:new Date(now-2*3600_000).toISOString()},
  {...accepted,accountUsageDayUtc:'2026-11-19'}
 ]){
  const b=createVisualCrossing92Budget({db,clock:()=>now,policy:p});
  assert.equal((await b.reserve('3304557')).approved,false);
 }
 assert.equal(m.size,0);
});
test('per-city three-hour cooldown and cross-UTC-day persistence are enforced',async()=>{
 const {db,m}=mockDb();
 let time=now;
 const policy={...accepted};
 const b=createVisualCrossing92Budget({db,clock:()=>time,policy});
 assert.equal((await b.reserve('3304557')).approved,true);
 assert.equal((await b.reserve('3304557')).reason,'CITY_THREE_HOUR_COOLDOWN');
 time+=VC_RJ_PER_CITY_MIN_INTERVAL_MS;
 // Review expires after an hour, so a real scheduler must reconcile provider
 // usage again; no implicit refresh and no backdoor to spend.
 assert.equal((await b.reserve('3304557')).approved,false);
 assert.equal(m.get('day_2026-11-20').recordsReserved,1);
});
test('global cap counts other provider usage; invalid municipality cannot reserve',async()=>{
 const {db,m}=mockDb();
 const b=createVisualCrossing92Budget({
  db,clock:()=>now,policy:{...accepted,providerUsageAlreadyToday:VC_RJ_INTERNAL_DAY_CAP}
 });
 assert.equal((await b.reserve('3304557')).reason,'INTERNAL_DAILY_CAP');
 assert.equal((await b.reserve('9999999')).reason,'CITY_OR_CLOCK_INVALID');
 assert.equal(m.size,0);
});
