/**
 * Optional Firestore-backed cache and atomic provider quota for Agent 13.
 *
 * This module does not connect to Firestore or invoke the provider on import.
 * The production runtime MUST inject an authenticated @google-cloud/firestore
 * server DB instance (default database), with narrowly scoped IAM.
 * The browser/mobile Firebase SDK is NOT appropriate for this backend.
 *
 * We intentionally never use managed TTL deletes (which are billable).
 * Data retention for old quota documents needs a separately reviewed,
 * rate-limited cleanup policy. Cache docs reuse deterministic IDs.
 */
import {createHash} from 'node:crypto';
import {RJ_OPENWEATHER_SOURCE_ID} from './rj-openweather-onecall4.mjs';
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS} from './rj-agent13-temperature-fallback-policy.mjs';

export const RJ_AGENT13_CACHE_COLLECTION='blaise_rj_openweather_current_cache';
export const RJ_AGENT13_QUOTA_COLLECTION='blaise_rj_openweather_daily_quota';
export const RJ_AGENT13_CITY_COOLDOWN_COLLECTION='blaise_rj_openweather_temp_fallback_cooldown';
const RJ_IBGE=new Set(RJ_MUNICIPALITIES.map(m=>m.ibge));
const MAX_CACHE_DOCUMENT_BYTES=32*1024;
const CACHE_MAX_MS=60_000;
const validDay=value=>typeof value==='string'&&
  /^\d{4}-\d{2}-\d{2}$/.test(value)&&
  !Number.isNaN(Date.parse(value+'T00:00:00.000Z'))&&
  new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
const fail=reason=>new Error('rj_agent13_firestore_'+reason);

export function createRjOpenWeatherFirestoreStore({db,clock=()=>Date.now()}={}){
  if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function'||
    typeof clock!=='function')throw fail('server_database_required');
  const cacheCollection=db.collection(RJ_AGENT13_CACHE_COLLECTION);
  const quotaCollection=db.collection(RJ_AGENT13_QUOTA_COLLECTION);
  const cityCooldownCollection=db.collection(RJ_AGENT13_CITY_COOLDOWN_COLLECTION);
  if(!cacheCollection||!quotaCollection||!cityCooldownCollection||
    typeof cacheCollection.doc!=='function'||typeof quotaCollection.doc!=='function'||
    typeof cityCooldownCollection.doc!=='function')
    throw fail('invalid_database_contract');
  const refForCache=key=>{
    if(typeof key!=='string'||!/^openweather:v4:current:[0-9]{7}:-?[0-9.]+:-?[0-9.]+$/.test(key)||
      key.length>128)throw fail('invalid_cache_key');
    return cacheCollection.doc(createHash('sha256').update(key).digest('hex'));
  };

  const cache=Object.freeze({
    async get(key){
      const ref=refForCache(key);
      const now=clock();
      if(!Number.isSafeInteger(now)||now<0)throw fail('invalid_clock');
      const doc=await ref.get();
      if(!doc?.exists)return null;
      const data=doc.data();
      if(!data||!Number.isSafeInteger(data.expiresAtMs)||data.expiresAtMs<=now||
        data.expiresAtMs>now+CACHE_MAX_MS)return null;
      if(data.sourceId!==RJ_OPENWEATHER_SOURCE_ID||
        data.value?.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'||
        data.value?.sourceId!==RJ_OPENWEATHER_SOURCE_ID)return null;
      return data.value;
    },
    async set(key,value,ttlMs){
      const ref=refForCache(key);
      const now=clock();
      if(!Number.isSafeInteger(now)||now<0||
        !Number.isSafeInteger(ttlMs)||ttlMs<60_000||ttlMs>CACHE_MAX_MS||
        value?.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'||
        value?.sourceId!==RJ_OPENWEATHER_SOURCE_ID)
        throw fail('invalid_cache_write');
      const serialized=JSON.stringify(value);
      if(typeof serialized!=='string'||
        Buffer.byteLength(serialized,'utf8')>MAX_CACHE_DOCUMENT_BYTES)
        throw fail('cache_document_too_large');
      // No raw request body, URL with appid, key, or credentials are stored.
      await ref.set({
        sourceId:RJ_OPENWEATHER_SOURCE_ID,
        value:JSON.parse(serialized),
        writtenAtMs:now,
        expiresAtMs:now+ttlMs,
      });
    }
  });

  const budget=Object.freeze({
    /**
     * Shared, fail-closed 35-minute city cooldown AND the existing 900/day
     * quota in a single Firestore transaction. This never calls OpenWeather.
     * The city key survives the UTC-day rollover, so midnight cannot allow
     * a second provider call inside the 35-minute interval.
     */
    async tryReserveMunicipalFallback({provider,utcDay,maximum,ibge,nowMs}={}){
      if(provider!==RJ_OPENWEATHER_SOURCE_ID||!validDay(utcDay)||
        !Number.isInteger(maximum)||maximum<1||maximum>900||
        !RJ_IBGE.has(String(ibge))||!Number.isSafeInteger(nowMs)||nowMs<0||
        new Date(nowMs).toISOString().slice(0,10)!==utcDay)
        throw fail('invalid_municipal_reservation');
      const dayRef=quotaCollection.doc(utcDay);
      const cityRef=cityCooldownCollection.doc(String(ibge));
      return db.runTransaction(async tx=>{
        const day=await tx.get(dayRef);
        const city=await tx.get(cityRef);
        const quota=day.exists?day.data():null;
        const count=quota===null?0:quota?.count;
        if(!Number.isSafeInteger(count)||count<0||
          (quota!==null&&quota.provider!==provider))
          throw fail('corrupt_quota_record');
        const prior=city.exists?city.data():null;
        if(prior!==null&&(!Number.isSafeInteger(prior.lastReservedAtMs)||
          prior.lastReservedAtMs>nowMs||prior.lastReservedAtMs<0))
          throw fail('corrupt_municipal_cooldown');
        if(count>=maximum)return false;
        if(prior!==null&&
          nowMs-prior.lastReservedAtMs<RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS)
          return false;
        tx.set(dayRef,{
          provider,utcDay,count:count+1,maximum,updatedAtMs:nowMs
        });
        tx.set(cityRef,{
          sourceId:provider,ibge:String(ibge),lastReservedAtMs:nowMs,
          nextAllowedAtMs:nowMs+RJ_AGENT13_TEMPERATURE_FALLBACK_INTERVAL_MS
        });
        return true;
      });
    },
    async tryReserve({provider,utcDay,maximum}={}){
      if(provider!==RJ_OPENWEATHER_SOURCE_ID||
        !validDay(utcDay)||
        !Number.isInteger(maximum)||maximum<1||maximum>900)
        throw fail('invalid_quota_reservation');
      const docRef=quotaCollection.doc(utcDay);
      // Firestore's server transaction retries on contention and commits
      // a single increment atomically across all Cloud Run instances.
      // If Firestore errors or the transaction cannot commit, reject:
      // the caller MUST NOT request the provider.
      return db.runTransaction(async transaction=>{
        const snap=await transaction.get(docRef);
        const data=snap.exists?snap.data():null;
        const count=data===null?0:data?.count;
        if(!Number.isSafeInteger(count)||count<0||
          (data!==null&&data.provider!==provider))
          throw fail('corrupt_quota_record');
        if(count>=maximum)return false;
        transaction.set(docRef,{
          provider,utcDay,count:count+1,
          maximum,updatedAtMs:clock()
        });
        return true;
      });
    }
  });
  return Object.freeze({cache,budget,
    cacheCollection:RJ_AGENT13_CACHE_COLLECTION,
    quotaCollection:RJ_AGENT13_QUOTA_COLLECTION,
    cityCooldownCollection:RJ_AGENT13_CITY_COOLDOWN_COLLECTION,
    automaticPolling:false,
    automaticTtlDeletion:false});
}
