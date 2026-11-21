/**
 * Cloud Shell PRIVATE read-only historical inspection of Firestore cache.
 *
 * No provider API, Secret Manager, key, reservation or write. Historic only.
 * Run: node scripts/meteoblue-free-private-history-inspect.mjs --read-historical-cache
 * Without flag, immediately exits offline with no database access.
 */
import {METEOBLUE_CACHE_COLLECTION}
 from '../src/rj-meteoblue-free-firestore-store.mjs';
import {inspectHistoricalMeteoblueCacheRecord}
 from '../src/rj-meteoblue-free-historical-audit.mjs';

const emit=x=>console.log('METEOBLUE_HISTORICAL_NUMERIC_AUDIT='+JSON.stringify(x));
if(!process.argv.includes('--read-historical-cache')){
 emit({status:'OFFLINE_NO_DATABASE_NO_PROVIDER',
   providerContacted:false,creditsReserved:0,readOnly:true});
}else{
 try{
   const {Firestore}=await import('@google-cloud/firestore');
   const db=new Firestore({projectId:'blaise-v6-rj',databaseId:'(default)'});
   const snapshot=await db.collection(METEOBLUE_CACHE_COLLECTION).doc('3304557').get();
   const report=inspectHistoricalMeteoblueCacheRecord(
      snapshot.exists?snapshot.data():null
   );
   emit(report);
   if(report.status==='HISTORICAL_RECORD_INVALID')process.exitCode=1;
 }catch{
   emit({status:'FIRESTORE_READ_UNAVAILABLE',providerContacted:false,
     creditsReserved:0,readOnly:true,shouldRetryProvider:false});
   process.exitCode=1;
 }
}
