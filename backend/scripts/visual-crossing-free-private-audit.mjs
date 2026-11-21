/**
 * One-shot private Visual Crossing Free Timeline audit.
 *
 * DEFAULT (no --live): no Firestore, no provider access, no credentials.
 * Live only after the operator has saved the existing Free account key into
 * Secret Manager in Cloud Shell and approved one weather record.
 *
 * NEVER print API key or source URL (query string contains secret).
 * No automatic scheduling, no subscriber data.
 */
import {collectVisualCrossingPrivateSample}
 from '../src/rj-visual-crossing-free-private.mjs';
import {createRjVisualCrossingFreeBudget}
 from '../src/rj-visual-crossing-free-budget.mjs';
const armed=['--live','--one-record','--private-staging']
 .every(x=>process.argv.includes(x));
if(!armed){
 console.log('VISUAL_CROSSING_FREE_PRIVATE_AUDIT=OFFLINE_NO_NETWORK');
 process.exit(0);
}
if(process.env.BLAISE_VISUAL_CROSSING_FREE_PLAN_CONFIRMED!=='true'||
   process.env.BLAISE_VISUAL_CROSSING_NO_PAYMENT_ENABLED_CONFIRMED!=='true'||
   process.env.BLAISE_VISUAL_CROSSING_PAID_ALLOWED!=='false'||
   process.env.BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED!=='true'||
   process.env.BLAISE_VISUAL_CROSSING_PROJECT_ID!=='blaise-v6-rj'||
   typeof process.env.BLAISE_VISUAL_CROSSING_FREE_API_KEY!=='string'){
 console.log('VISUAL_CROSSING_FREE_PRIVATE_AUDIT=BLOCKED_ACCOUNT_OR_SECRET_NOT_CONFIRMED');
 process.exitCode=2;
}else{
 let budget;
 try{
  const {Firestore}=await import('@google-cloud/firestore');
  const db=new Firestore({projectId:'blaise-v6-rj',databaseId:'(default)'});
  budget=createRjVisualCrossingFreeBudget({db});
 }catch{
  console.log('VISUAL_CROSSING_FREE_PRIVATE_AUDIT=SHARED_BUDGET_UNAVAILABLE');
  process.exitCode=2;
 }
 if(budget){
  const result=await collectVisualCrossingPrivateSample({
   env:process.env,
   reserve:budget.reserve,
   ibge:'3304557'
  });
  const tally=await budget.readBudget().catch(()=>null);
  const fields=result.current?.values||{};
  const summary={
   status:result.status,reason:result.reason??null,
   providerContacted:result.providerContacted===true,
   localRecordsReserved:tally?.localRecordsReserved??null,
   currentFieldsPresent:Object.entries(fields)
    .filter(([,v])=>typeof v==='number').map(([k])=>k),
   currentTimeVerified:typeof result.current?.validAt==='string',
   forecastHourlySlots:result.forecast?.length??0,
   categoryCurrent:'E_AGGREGATED_NOT_STATION_MEASUREMENT',
   categoryForecast:'P_FORECAST_ONLY',
   queryCost:result.queryCost??null,
   publishedToSubscribers:false,paidApiUsed:false
  };
  console.log('VISUAL_CROSSING_FREE_PRIVATE_AUDIT='+JSON.stringify(summary));
  if(result.status!=='PRIVATE_REAL_SAMPLE_READY')process.exitCode=1;
 }
}
