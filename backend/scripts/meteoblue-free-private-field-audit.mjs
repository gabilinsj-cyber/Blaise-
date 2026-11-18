/**
 * Manual PRIVATE field-audit script. Offline unless --live + --one-credit.
 * Uses 4,000 trial credits for exactly one basic-6h package if Firestore
 * reservation succeeds, or zero provider calls when blocked/cached.
 * NEVER prints a key, upstream URL, forecast values or personal data.
 * Run only inside trusted Cloud Shell with a secret-backed environment.
 */
import {initializeOptionalMeteoblueFreeRuntime}
 from '../src/rj-meteoblue-runtime-optional.mjs';
const armed=process.argv.includes('--live')&&
  process.argv.includes('--one-credit')&&
  process.argv.includes('--private-staging');
if(!armed){
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT=OFFLINE_NO_NETWORK');
 process.exit(0);
}
// The account dashboard showed one 4,000-credit basic-6h call on
// 18 Nov 2026. After the operator changed the external daily cap to 4,000,
// another attempt before the UTC day changes can be refused upstream but
// still consume a LOCAL Firestore reservation. Fail before touching Firestore.
const earliestSafeNextUtcDay=Date.parse('2026-11-19T00:00:00.000Z');
if(Date.now()<earliestSafeNextUtcDay){
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT=BLOCKED_TODAY_PROVIDER_4000_ALREADY_USED');
 process.exitCode=2;
}else if(process.env.BLAISE_METEOBLUE_PROVIDER_ZERO_USAGE_TODAY_CONFIRMED!=='true'){
 // Dashboard usage may lag; explicit day-scoped confirmation prevents
 // a second upstream request, even when our own Firestore counter is zero.
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT=PROVIDER_DAILY_USAGE_NOT_CONFIRMED');
 process.exitCode=2;
}else if(process.argv.some(x=>x.startsWith('--ibge=')&&x!=='--ibge=3304557')){
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT=ONLY_FIRST_RIO_POINT_ALLOWED');
 process.exitCode=1;
}else{
 const env=process.env;
 const runtime=await initializeOptionalMeteoblueFreeRuntime({
  env,
  createDatabase:async({projectId})=>{
    const {Firestore}=await import('@google-cloud/firestore');
    return new Firestore({projectId,databaseId:'(default)'});
  }
 });
 const r=await runtime.collectOne({ibge:'3304557'});
 const f=r?.forecast;
 const summary={
  status:r.status,
  reason:r.reason??null,
  runtimeState:runtime.state,
  providerContacted:r.providerContacted??false,
  reservedCreditsThisInvocation:r.creditsReservedThisInvocation??0,
  modelRunVerified:f?.metadataRunVerified??false,
  unitMetadataVerified:f?.unitMetadataVerified??false,
  sourceCoordinatesVerified:f?.sourceCoordinatesVerified??false,
  sixHourForecastSlots:f?.validTimes?.length??0,
  fieldCoverage:f?.coverage??null,
  completeSevenFieldCoverage:f?.completeFieldCoverage??false,
  privateAuditReady:f?.auditReadyForPrivateReview===true,
  // These are names of missing validation checks, never provider values.
  auditBlockers:f?.auditBlockers??['NO_VALID_PRIVATE_FORECAST'],
  observedData:false,paidApiUsed:false,
  publishedToSubscribers:false
 };
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT='+JSON.stringify(summary));
 if(!['PRIVATE_STAGING_FORECAST_READY','PRIVATE_STAGING_CACHE_HIT'].includes(r.status)||
    f?.auditReadyForPrivateReview!==true)
  process.exitCode=1;
}
