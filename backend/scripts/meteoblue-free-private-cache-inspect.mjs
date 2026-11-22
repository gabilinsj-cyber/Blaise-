/**
 * Private, READ-ONLY inspection of the single cached real meteoblue response.
 * Purpose: verify seven numerical forecast values at the next valid 6h slot.
 * Never accesses API secrets, makes a meteoblue request, reserves credits,
 * writes to Firestore, or publishes to subscribers.
 *
 * Without --read-firestore-cache this script does nothing (offline CI safe).
 * With flag: requires Cloud Shell Firestore IAM and a valid 6h cache.
 * No provider URLs, API keys, GPS of private users or raw JSON are printed.
 */
import {createRjMeteoblueFreeFirestoreStore} from '../src/rj-meteoblue-free-firestore-store.mjs';
import {METEOBLUE_BASIC6H_FIELDS} from '../src/rj-meteoblue-basic6h-parse.mjs';

const label='METEOBLUE_PRIVATE_REAL_CACHE_AUDIT=';
const output=x=>console.log(label+JSON.stringify(x));
if(!process.argv.includes('--read-firestore-cache')){
 output({status:'OFFLINE_NO_NETWORK_NO_DATABASE',providerContacted:false,creditsReserved:0});
}else{
 try{
  const {Firestore}=await import('@google-cloud/firestore');
  const store=createRjMeteoblueFreeFirestoreStore({
   db:new Firestore({projectId:'blaise-v6-rj',databaseId:'(default)'})
  });
  const f=await store.getCached('3304557');
  if(!f){
   output({status:'PRIVATE_CACHE_UNAVAILABLE_OR_EXPIRED',
     providerContacted:false,creditsReserved:0,shouldRetryProvider:false});
  }else{
   const names=Object.values(METEOBLUE_BASIC6H_FIELDS).map(x=>x.name);
   const now=Date.now();
   const index=f.validTimes.findIndex(t=>Date.parse(t)>=now);
   const v=new Map(f.values.map(x=>[x.field,x]));
   const fields=names.map(name=>{
    const a=v.get(name),unit=METEOBLUE_BASIC6H_FIELDS[
     Object.keys(METEOBLUE_BASIC6H_FIELDS).find(k=>METEOBLUE_BASIC6H_FIELDS[k].name===name)
    ].unit;
    const raw=index>=0?a?.values?.[index]:undefined;
    return {
     field:name,unit,category:'P',
     value:typeof raw==='number'&&Number.isFinite(raw)?raw:null,
     validForecastValue:typeof raw==='number'&&Number.isFinite(raw),
     periodsWithValidNumbers:Array.isArray(a?.values)?
       a.values.filter(x=>typeof x==='number'&&Number.isFinite(x)).length:0
    };
   });
   output({
    status:'PRIVATE_CACHE_READ_ONLY',
    source:'METEOBLUE_FREE_FORECAST',providerContacted:false,
    creditsReserved:0,readOnly:true,
    resultIsCurrentObservation:false,category:'P',
    modelRunVerified:f.metadataRunVerified===true,
    unitsVerified:f.unitMetadataVerified===true,
    coordinatesVerified:f.sourceCoordinatesVerified===true,
    privateAuditReady:f.auditReadyForPrivateReview===true,
    productionHomologated:f.scientificallyHomologated===true,
    validForecastSlots:f.validTimes.length,
    nextForecastTimeUtc:index>=0?f.validTimes[index]:null,
    fields,
    publishedToSubscribers:false
   });
  }
 }catch{
  output({status:'FIRESTORE_READ_OR_DATA_INVALID',
    providerContacted:false,creditsReserved:0,shouldRetryProvider:false});
  process.exitCode=1;
 }
}
