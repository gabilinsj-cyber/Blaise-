import test from 'node:test';
import assert from 'node:assert/strict';
import {
 planWeatherApiFree92Monthly,WEATHERAPI_FREE_MONTHLY_QUOTA,
 WEATHERAPI_INTERNAL_MONTHLY_CEILING,WEATHERAPI_AUTOMATIC_COLLECTION_ENABLED,
 WEATHERAPI_CURRENT_MAX_CACHE_MS,WEATHERAPI_FORECAST_MAX_CACHE_MS
} from '../src/rj-weatherapi-free-92-plan.mjs';

test('92 municipalities once hourly in 31 day UTC month stay below free and internal budgets',()=>{
 const p=planWeatherApiFree92Monthly({year:2026,month:12});
 assert.equal(p.municipalityCount,92);
 assert.equal(p.daysInUtcMonth,31);
 assert.equal(p.queriesPerMunicipalityPerDay,24);
 assert.equal(p.estimatedMonthlyProviderCalls,68448);
 assert.equal(p.status,'OFFLINE_BUDGET_PROPOSAL');
 assert.equal(p.internalMonthlyCap,80000);
 assert.equal(p.publishedMonthlyFreeQuota,100000);
 assert.equal(p.currentCacheTtlMinutes,60);
 assert.equal(p.forecastCacheTtlHours,24);
 assert.equal(p.automaticProviderCollection,false);
 assert.equal(p.hasServerKey,false);
 assert.equal(p.subscriberPublishing,false);
 assert.equal(WEATHERAPI_AUTOMATIC_COLLECTION_ENABLED,false);
 assert.equal(WEATHERAPI_CURRENT_MAX_CACHE_MS,3600000);
 assert.equal(WEATHERAPI_FORECAST_MAX_CACHE_MS,86400000);
});
test('twice hourly would exceed internal budget and must not auto-enable',()=>{
 const p=planWeatherApiFree92Monthly({
  year:2026,month:12,queriesPerMunicipalityPerDay:48
 });
 assert.equal(p.estimatedMonthlyProviderCalls,136896);
 assert.equal(p.status,'OVER_INTERNAL_BUDGET');
 assert.ok(p.internalRemainingMargin<0);
 assert.equal(p.operatorApproved,false);
});
test('monthly math handles February and rejects invalid configuration',()=>{
 const p=planWeatherApiFree92Monthly({year:2028,month:2});
 assert.equal(p.daysInUtcMonth,29);
 assert.equal(p.estimatedMonthlyProviderCalls,92*24*29);
 for(const params of [{month:13},{month:0},{year:1999},
   {queriesPerMunicipalityPerDay:0},{queriesPerMunicipalityPerDay:1.5}]){
  assert.throws(()=>planWeatherApiFree92Monthly(params));
 }
 assert.equal(WEATHERAPI_INTERNAL_MONTHLY_CEILING,80000);
 assert.equal(WEATHERAPI_FREE_MONTHLY_QUOTA,100000);
});
