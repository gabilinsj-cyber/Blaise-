/**
 * Server-only, shared Firestore cache and atomic minimum 3h MET Norway request
 * cooldown for Brazilian locations. No network call occurs here.
 * No per-user data, personal GPS, auto-TTL billing or background polling.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {MET_NORWAY_MIN_CACHE_MS} from './rj-met-norway-locationforecast.mjs';

export const MET_NORWAY_SHARED_COLLECTION='blaise_rj_met_norway_locationforecast_v1';
const ibges=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
const fail=(cause)=>new Error('rj_met_norway_store_'+cause);
export function createRjMetNorwayFirestoreStore({db,clock=()=>Date.now()}={}){
  if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function'||
     typeof clock!=='function')throw fail('invalid_shared_database');
  const collection=db.collection(MET_NORWAY_SHARED_COLLECTION);
  if(typeof collection?.doc!=='function')throw fail('invalid_collection');
  const docFor=(ibge)=>{
    const code=String(ibge);
    if(!ibges.has(code))throw fail('unknown_municipality');
    return collection.doc(code);
  };
  return Object.freeze({
    async get(ibge){
      const record=await docFor(ibge).get();
      if(!record?.exists)return null;
      const data=record.data();
      const now=clock();
      if(!Number.isSafeInteger(now)||now<0||
         !Number.isSafeInteger(data?.nextAllowedAtMs)||
         data.nextAllowedAtMs<0||data.nextAllowedAtMs>now+30*24*60*60_000||
         data?.ibge!==String(ibge)||data?.provider!=='MET_NORWAY_LOCATIONFORECAST_2')
        throw fail('invalid_shared_record');
      return Object.freeze({
        payload:data.payload??null,
        lastModified:typeof data.lastModified==='string'?data.lastModified:null,
        nextAllowedAtMs:data.nextAllowedAtMs
      });
    },
    async reserve(ibge,nowMs,minIntervalMs){
      const ref=docFor(ibge);
      if(!Number.isSafeInteger(nowMs)||nowMs<0||
         minIntervalMs!==MET_NORWAY_MIN_CACHE_MS)throw fail('invalid_reservation');
      return db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        const data=snap.exists?snap.data():null;
        const prior=data?.lastReservedAtMs??null;
        if(prior!==null&&(!Number.isSafeInteger(prior)||prior<0||prior>nowMs))
          throw fail('corrupt_prior_reservation');
        if(prior!==null&&nowMs-prior<minIntervalMs)return false;
        // Never re-fetch before a later-than-3h provider Expires timestamp.
        if(data!==null&&(!Number.isSafeInteger(data.nextAllowedAtMs)||
          data.nextAllowedAtMs<0))throw fail('corrupt_next_allowed');
        if(data?.nextAllowedAtMs>nowMs)return false;
        tx.set(ref,{
          provider:'MET_NORWAY_LOCATIONFORECAST_2',ibge:String(ibge),
          lastReservedAtMs:nowMs,nextAllowedAtMs:nowMs+minIntervalMs,
          // Preserve the previous payload and Last-Modified for conditional GET.
          payload:data?.payload??null,
          lastModified:data?.lastModified??null
        });
        return true;
      });
    },
    async set(ibge,{payload,lastModified=null,nextAllowedAtMs}={}){
      const ref=docFor(ibge);
      const now=clock();
      if(!Number.isSafeInteger(now)||now<0||
         !Number.isSafeInteger(nextAllowedAtMs)||nextAllowedAtMs<now||
         nextAllowedAtMs>now+30*24*60*60_000||
         !Array.isArray(payload?.properties?.timeseries)||
         typeof payload?.properties?.meta?.updated_at!=='string'||
         (lastModified!==null&&typeof lastModified!=='string'))
        throw fail('invalid_cache_write');
      const body=JSON.stringify(payload);
      if(Buffer.byteLength(body,'utf8')>350*1024)throw fail('cache_too_large');
      // Keep the original atomic lastReservedAtMs and prohibit stale writes
      // from overwriting the reservation of a concurrent replica.
      await db.runTransaction(async tx=>{
        const snapshot=await tx.get(ref);
        const data=snapshot.exists?snapshot.data():null;
        if(!data||!Number.isSafeInteger(data.lastReservedAtMs)||
           data.lastReservedAtMs>now||now-data.lastReservedAtMs>=MET_NORWAY_MIN_CACHE_MS||
           data.nextAllowedAtMs>nextAllowedAtMs)
          throw fail('reservation_missing_or_superseded');
        tx.set(ref,{
          provider:'MET_NORWAY_LOCATIONFORECAST_2',ibge:String(ibge),
          lastReservedAtMs:data.lastReservedAtMs,nextAllowedAtMs,
          lastModified,payload
        });
      });
    },
    automaticPolling:false,
    persistentCoordinatesStored:false,
    automaticTtlDeletion:false
  });
}
