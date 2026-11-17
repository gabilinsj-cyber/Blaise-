/**
 * Server-side, opt-in MET Norway global forecast service.
 * Two verified municipal points only; additional 90 locations require a
 * separately reviewed canonical coordinate/altitude catalogue.
 * Never automatically polls or publishes customer-visible values.
 */
import {createRjMetNorwayFirestoreStore} from './rj-met-norway-firestore-store.mjs';
import {createRjMetNorwayLocationforecastCollector} from './rj-met-norway-locationforecast.mjs';

const points=Object.freeze({
  '3304557':Object.freeze({lat:-22.9068,lon:-43.1729,verifiedByBackend:true}),
  '3303302':Object.freeze({lat:-22.8833,lon:-43.1036,verifiedByBackend:true})
});
const disabled=(state)=>Object.freeze({
  state,configured:false,automaticSchedulingEnabled:false,
  publishedToAndroid:false,productionEnabled:false,
  supportedMunicipalities:Object.freeze(Object.keys(points)),
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
    return Object.freeze({
      state:'READY_FOR_EXPLICIT_SERVER_CALL',configured:true,
      automaticSchedulingEnabled:false,publishedToAndroid:false,
      productionEnabled:false,
      supportedMunicipalities:Object.freeze(Object.keys(points)),
      collectCity:async(ibge)=>{
        const point=points[String(ibge)];
        if(!point)return {status:'UNAVAILABLE',reason:'UNVERIFIED_CITY_COORDINATES',forecast:null};
        return collector.collect({municipalityIbge:String(ibge),point});
      }
    });
  }catch{
    return disabled('FIRESTORE_INITIALIZATION_FAILED');
  }
}
