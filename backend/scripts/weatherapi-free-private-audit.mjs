/**
 * Explicit, one-time Free WeatherAPI.com test. OFFLINE BY DEFAULT.
 *
 * Runs with --live --one-call --private-staging only when the operator has
 * verified the account is Free, key stored in Secret Manager, quota available,
 * no automatic payment, and this single query is permitted.
 *
 * No raw response, query URL, secret, IP address or weather value is printed.
 */
import {collectWeatherApiPrivateOnce}
 from '../src/rj-weatherapi-free-private.mjs';
import {createWeatherApiPrivateBudget}
 from '../src/rj-weatherapi-free-one-shot-budget.mjs';
const args=process.argv.slice(2);
const live=['--live','--one-call','--private-staging'].every(x=>args.includes(x));
if(!live){
 console.log('WEATHERAPI_FREE_PRIVATE_AUDIT=OFFLINE_NO_NETWORK');
 process.exit(0);
}
const required={
 BLAISE_WAPI_FREE_PLAN_CONFIRMED:'true',
 BLAISE_WAPI_NO_AUTOTOPUP_CONFIRMED:'true',
 BLAISE_WAPI_PAID_ALLOWED:'false',
 BLAISE_WAPI_PRIVATE_ENABLED:'true',
 BLAISE_WAPI_ONE_SHOT_APPROVED:'true',
 BLAISE_WAPI_PUBLISH_TO_SUBSCRIBERS:'false',
 BLAISE_WAPI_PROJECT_ID:'blaise-v6-rj'
};
if(Object.entries(required).some(([k,v])=>process.env[k]!==v)||
  typeof process.env.BLAISE_WAPI_FREE_API_KEY!=='string'){
 console.log('WEATHERAPI_FREE_PRIVATE_AUDIT=BLOCKED_ACCOUNT_OR_SECRET_NOT_VERIFIED');
 process.exitCode=2;
}else{
 let budget;
 try{
  const {Firestore}=await import('@google-cloud/firestore');
  const db=new Firestore({projectId:'blaise-v6-rj',databaseId:'(default)'});
  budget=createWeatherApiPrivateBudget({db});
 }catch{
  console.log('WEATHERAPI_FREE_PRIVATE_AUDIT=FIRESTORE_COUNTER_UNAVAILABLE');
  process.exitCode=2;
 }
 if(budget){
  const result=await collectWeatherApiPrivateOnce({
   env:process.env,ibge:'3304557',reserve:budget.reserve
  });
  const tally=await budget.read().catch(()=>null);
  const numeric=result.current?.values||{};
  const summary=Object.freeze({
   status:result.status,
   reason:result.reason??null,
   providerContacted:result.providerContacted===true,
   localCallsReserved:tally?.callsReserved??null,
   providerBalanceVerified:false,
   sourceTimestampValid:typeof result.validAt==='string',
   currentAgeMinutes:result.ageMinutes??null,
   within30MinuteTarget:result.meets30MinuteTarget===true,
   validFieldNames:Object.keys(numeric).filter(k=>typeof numeric[k]==='number'),
   skyCondition:result.current?.skyCondition??null,
   futureHourlySlots:result.hourly?.length??0,
   kindCurrent:'E_AGGREGATED_NOT_INSTRUMENTAL',
   kindForecast:'P_FORECAST_NOT_OBSERVATION',
   clientPublication:false,paidUsed:false,
   rawResponseSaved:false,criticalWeatherAlertAuthorized:false
  });
  console.log('WEATHERAPI_FREE_PRIVATE_AUDIT='+JSON.stringify(summary));
  if(result.status!=='PRIVATE_REAL_SAMPLE_READY')process.exitCode=1;
 }
}
