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
if(process.argv.some(x=>x.startsWith('--ibge=')&&x!=='--ibge=3304557')){
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
  observedData:false,paidApiUsed:false,
  publishedToSubscribers:false
 };
 console.log('METEOBLUE_PRIVATE_FIELD_AUDIT='+JSON.stringify(summary));
 if(!['PRIVATE_STAGING_FORECAST_READY','PRIVATE_STAGING_CACHE_HIT'].includes(r.status))
  process.exitCode=1;
}
