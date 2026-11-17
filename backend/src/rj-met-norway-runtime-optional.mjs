/**
 * Server-side, opt-in MET Norway global forecast service.
 * 92 municipality interior points validated against official IBGE GeoJSON.
 * Elevations remain UNKNOWN and are intentionally omitted from requests.
 * No provider polling, publication or human Terms acceptance is implied.
 */
import {createRjMetNorwayFirestoreStore} from './rj-met-norway-firestore-store.mjs';
import {createRjMetNorwayLocationforecastCollector,normalizeMetNorwayRjForecast} from './rj-met-norway-locationforecast.mjs';
import {projectMetNorwayAdminCoverageEvidence} from './rj-met-norway-admin-evidence.mjs';
import ibgePoints from './rj-ibge-92-points.json' with { type: 'json' };
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const officialCodes=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
if(ibgePoints.contract!=='BLAISE_RJ_IBGE_92_INTERIOR_POINTS_CANDIDATE_V1'||
   ibgePoints.state!=='POLYGON_GEOMETRY_VERIFIED_ALTITUDE_UNVERIFIED'||
   ibgePoints.municipalityCount!==92||!Array.isArray(ibgePoints.points)||
   ibgePoints.points.length!==92||
   !/^[0-9a-f]{64}$/.test(ibgePoints.sourceSha256)||
   new Set(ibgePoints.points.map(p=>p.ibge)).size!==92||
   !ibgePoints.points.every(p=>officialCodes.has(p.ibge)&&
     p.verifiedByBackend===true&&p.altitudeVerified===false&&
     p.altitudeM===null&&p.geometryStatus==='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'&&
     Number.isFinite(p.lat)&&p.lat>=-25&&p.lat<=-20&&
     Number.isFinite(p.lon)&&p.lon>=-46&&p.lon<=-40)){
  throw new Error('IBGE_92_GEOREGISTRY_INVALID');
}
const points=Object.freeze(Object.fromEntries(ibgePoints.points.map(p=>[
  p.ibge,Object.freeze({lat:p.lat,lon:p.lon,verifiedByBackend:true})
])));
const disabled=(state)=>Object.freeze({
  state,configured:false,automaticSchedulingEnabled:false,
  publishedToAndroid:false,productionEnabled:false,
  supportedMunicipalities:Object.freeze(Object.keys(points)),
  readCachedCity:async()=>null,
  collectCity:async()=>Object.freeze({status:'UNAVAILABLE',
    reason:'MET_NORWAY_NOT_ENABLED_OR_UNVERIFIED',forecast:null})
});
export async function initializeOptionalMetNorwayRuntime({
  env={},createDatabase=null,clock=()=>Date.now(),fetchImpl=globalThis.fetch
}={}){
  if(env.BLAISE_MET_NORWAY_ENABLED!=='true')
    return disabled('DISABLED');
  // Cannot infer assent to binding 2026-11-05 ToS from model/user text.
  // Operator must read and consciously set this environment flag.
  if(env.BLAISE_MET_NORWAY_TOS_ACCEPTED_BY_HUMAN!=='true')
    return disabled('HUMAN_TOS_ACCEPTANCE_REQUIRED');
  if(env.BLAISE_MET_NORWAY_FIRESTORE_ENABLED!=='true'||
     typeof createDatabase!=='function')
    return disabled('SHARED_FIRESTORE_REQUIRED');
  const projectId=env.GOOGLE_CLOUD_PROJECT||env.BLAISE_MET_NORWAY_PROJECT_ID||'';
  if(typeof projectId!=='string'||!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId))
    return disabled('PROJECT_ID_REQUIRED');
  try{
    const db=await createDatabase({projectId});
    const store=createRjMetNorwayFirestoreStore({db,clock});
    const collector=createRjMetNorwayLocationforecastCollector({
      enabled:true,termsAcceptedByHuman:true,userAgent:env.BLAISE_MET_NORWAY_USER_AGENT,
      store,fetchImpl,clock
    });
    if(!collector.configured)return disabled('REAL_CONTACT_USER_AGENT_REQUIRED');
    // Per-replica bound to 60 seconds. Never fetch upstream in this method.
    // Provider data remains subject to original 3h reservation and TTL.
    const local=new Map();
    async function readCachedCity(ibge){
      const code=String(ibge),point=points[code];
      if(!point)return null;
      const now=clock();
      if(!Number.isSafeInteger(now)||now<0)return null;
      const hit=local.get(code);
      if(hit&&now>=hit.checkedAtMs&&now-hit.checkedAtMs<60_000)return hit.result;
      let forecast=null;
      try{
        const row=await store.get(code);
        if(row?.payload){
          const normal=normalizeMetNorwayRjForecast(row.payload,{
            municipalityIbge:code,point,checkedAtMs:now
          });
          if(normal.status==='FORECAST_AVAILABLE')forecast=normal;
        }
      }catch{
        // Cache read failure means unavailable, not assumed clear weather.
      }
      local.set(code,{result:forecast,checkedAtMs:now});
      return forecast;
    }
    return Object.freeze({
      state:'READY_FOR_EXPLICIT_SERVER_CALL',configured:true,
      automaticSchedulingEnabled:false,publishedToAndroid:false,
      productionEnabled:false,
      supportedMunicipalities:Object.freeze(Object.keys(points)),
      readCachedCity,
      collectCity:async(ibge)=>{
        const point=points[String(ibge)];
        if(!point)return {status:'UNAVAILABLE',reason:'UNVERIFIED_CITY_COORDINATES',forecast:null};
        const result=await collector.collect({municipalityIbge:String(ibge),point});
        return result.status==='FORECAST_AVAILABLE'
          ?Object.freeze({...result,adminEvidence:projectMetNorwayAdminCoverageEvidence(result,{
            termsAcceptedByHuman:true,backendVerified:true
          })})
          :result;
      }
    });
  }catch{
    return disabled('FIRESTORE_INITIALIZATION_FAILED');
  }
}
