/**
 * Read-only proxy of Agent 13's verified Firestore cache. No provider API
 * request, no Firestore write, no background scheduler, no purchase tokens
 * stored in cache. Requires a Cloud Run service account with least-privilege
 * Firestore READ. Uses existing google-auth-library dependency.
 */
import {GoogleAuth} from 'google-auth-library';

const COLLECTION='blaise_rj_openweather_current_cache';
const finiteTime=v=>Number.isSafeInteger(v)&&v>=0;
function decodeField(field, depth=0) {
  if(!field || depth>12) return null;
  if('stringValue' in field) return field.stringValue;
  if('booleanValue' in field) return field.booleanValue;
  if('integerValue' in field) return Number(field.integerValue);
  if('doubleValue' in field) return Number(field.doubleValue);
  if('nullValue' in field) return null;
  if('mapValue' in field) return Object.fromEntries(
    Object.entries(field.mapValue.fields||{}).map(([key,value])=>[key,decodeField(value,depth+1)]));
  if('arrayValue' in field) return (field.arrayValue.values||[]).map(value=>decodeField(value,depth+1));
  return null;
}

export function createRjInternational92FirestoreReader({
  projectId,enabled=false,clock=()=>Date.now(),auth=null,
  cacheMs=60_000,
}={}) {
  const ready = enabled===true && typeof projectId==='string' &&
    /^[a-z][a-z0-9-]{4,60}$/.test(projectId) &&
    Number.isInteger(cacheMs) && cacheMs>=60_000 && cacheMs<=300_000;
  let lastGood=null, lastRefresh=0, flight=null;
  let googleAuth=auth;
  async function readRemote() {
    if(!googleAuth)googleAuth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/datastore']});
    const client=await googleAuth.getClient();
    const url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+
      '/databases/(default)/documents/'+COLLECTION+'?pageSize=100';
    const result=await client.request({url,method:'GET',timeout:7000});
    const docs=result?.data?.documents;
    if(!Array.isArray(docs)) return [];
    const now=clock();
    const rows=[];
    for(const doc of docs){
      const fields=doc?.fields||{};
      if(fields.sourceId?.stringValue!=='OPENWEATHER_ONECALL4_CURRENT')continue;
      const expires=decodeField(fields.expiresAtMs);
      if(!finiteTime(expires)||expires<=now)continue;
      const payload=decodeField(fields.value);
      if(payload?.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'||
        payload.sourceId!=='OPENWEATHER_ONECALL4_CURRENT')continue;
      rows.push(payload);
    }
    return rows;
  }
  return Object.freeze({
    configured:Boolean(ready),
    async read() {
      if(!ready)throw Error('INTERNATIONAL_92_NOT_CONFIGURED');
      const now=clock();
      if(lastGood!==null&&now-lastRefresh>=0&&now-lastRefresh<cacheMs)
        return lastGood;
      if(flight)return flight;
      flight=(async()=>{
        const rows=await readRemote();
        lastGood=rows;
        lastRefresh=clock();
        return rows;
      })();
      try {return await flight;}
      finally {flight=null;}
    },
    readsOnly:true,
    providerFetches:false,
  });
}
