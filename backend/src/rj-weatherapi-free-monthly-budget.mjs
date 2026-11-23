/**
 * Atomic server-side WeatherAPI.com FREE monthly allowance guard.
 * Budget is only internal reservations. It does NOT know provider account
 * usage outside Blaise; operator must separately validate provider balance.
 * No Firestore connection on import, no TTL billable deletes, no API calls.
 */
import points from './rj-ibge-92-points.json' with {type:'json'};
import {WEATHERAPI_INTERNAL_MONTHLY_CEILING}
 from './rj-weatherapi-free-92-plan.mjs';
export const RJ_WEATHERAPI_BUDGET_COLLECTION='blaise_rj_weatherapi_free_monthly_ledger';
export const RJ_WEATHERAPI_CITY_COOLDOWN_COLLECTION='blaise_rj_weatherapi_city_cooldown';
export const RJ_WEATHERAPI_MIN_CITY_INTERVAL_MS=25*60_000;
const cities=new Set(points.points.map(p=>String(p.ibge)));
export function createRjWeatherApiFreeMonthlyBudget({db,clock=()=>Date.now()}={}){
 if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function'||
    typeof clock!=='function')throw Error('weatherapi_shared_firestore_required');
 const ledger=db.collection(RJ_WEATHERAPI_BUDGET_COLLECTION);
 const cooldown=db.collection(RJ_WEATHERAPI_CITY_COOLDOWN_COLLECTION);
 if(typeof ledger?.doc!=='function'||typeof cooldown?.doc!=='function')
  throw Error('weatherapi_invalid_firestore_contract');
 async function reserve({ibge,source,maxMonthlyCalls}={}){
  const now=clock();
  const code=String(ibge);
  if(!cities.has(code)||source!=='WEATHERAPI_FREE'||
     maxMonthlyCalls!==WEATHERAPI_INTERNAL_MONTHLY_CEILING||
     !Number.isSafeInteger(now)||now<0)
   throw Error('weatherapi_invalid_reservation');
  const month=new Date(now).toISOString().slice(0,7);
  const monthRef=ledger.doc(month),cityRef=cooldown.doc(code);
  return db.runTransaction(async tx=>{
   const [m,c]=await Promise.all([tx.get(monthRef),tx.get(cityRef)]);
   const current=m.exists?m.data():null;
   const prior=c.exists?c.data():null;
   const count=current?.reservedCalls??0;
   if(!Number.isSafeInteger(count)||count<0||
      count>WEATHERAPI_INTERNAL_MONTHLY_CEILING||
      (current&&current.source!=='WEATHERAPI_FREE')||
      (prior&&(!Number.isSafeInteger(prior.lastAtMs)||
        prior.lastAtMs>now||prior.lastAtMs<0)))
    throw Error('weatherapi_corrupt_shared_ledger');
   if(count>=WEATHERAPI_INTERNAL_MONTHLY_CEILING||
      (prior&&now-prior.lastAtMs<RJ_WEATHERAPI_MIN_CITY_INTERVAL_MS))
    return Object.freeze({approved:false,reason:'CAP_OR_CITY_COOLDOWN'});
   tx.set(monthRef,{
    source:'WEATHERAPI_FREE',monthUtc:month,
    reservedCalls:count+1,paidAllowed:false,
    lastAtMs:now
   });
   tx.set(cityRef,{source:'WEATHERAPI_FREE',lastAtMs:now});
   return Object.freeze({
    approved:true,source:'WEATHERAPI_FREE',
    monthUtc:month,localMonthlyReserved:count+1,
    externalProviderUsageVerifiedByThisLedger:false,
    paidAllowed:false
   });
  });
 }
 return Object.freeze({reserve,autoCollectionEnabled:false,
  paidOveragesAllowed:false,providerCallsOnConstruction:0});
}
