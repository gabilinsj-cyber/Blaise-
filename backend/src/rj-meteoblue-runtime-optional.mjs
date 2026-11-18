/**
 * Optional meteoblue Free API runtime. OFF by default and no HTTP endpoint.
 * No calls on startup. Never consumes a credit absent a deliberate admin call.
 */
import {createBlaiseRjMeteoblueFreeCollector} from './rj-meteoblue-free-collector.mjs';
const disabled=(state)=>Object.freeze({
 state,configured:false,automaticSchedulingEnabled:false,
 publishedToSubscribers:false,publishedToAndroid:false,
 collectOne:async()=>Object.freeze({
  status:'UNAVAILABLE',reason:state,
  providerContacted:false,publishedToSubscribers:false,forecast:null
 })
});
export async function initializeOptionalMeteoblueFreeRuntime({
 env={},createDatabase=null,clock=()=>Date.now(),
 fetchImpl=globalThis.fetch
}={}){
 if(env.BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED!=='true')
  return disabled('DISABLED_BY_DEFAULT');
 if(env.BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED!=='true'||
    env.BLAISE_METEOBLUE_AUTOTOPUP_DISABLED!=='true'||
    env.BLAISE_METEOBLUE_PAID_ALLOWED==='true'||
    env.BLAISE_METEOBLUE_ALLOW_REAL_CREDIT_SPEND!=='true')
  return disabled('FREE_ONLY_APPROVAL_REQUIRED');
 if(env.BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE!=='true'&&
    !(env.BLAISE_METEOBLUE_TEMPORARY_KEY_RISK_ACCEPTED==='true'&&
      env.BLAISE_METEOBLUE_STAGING_ONESHOT_APPROVED==='true'))
  return disabled('KEY_ROTATION_OR_STAGING_ONESHOT_REQUIRED');
 if(env.BLAISE_METEOBLUE_FIRESTORE_ENABLED!=='true'||
    typeof createDatabase!=='function')
  return disabled('SHARED_ATOMIC_FIRESTORE_REQUIRED');
 const projectId=env.BLAISE_METEOBLUE_PROJECT_ID||
   env.GOOGLE_CLOUD_PROJECT||'';
 if(projectId!=='blaise-v6-rj')return disabled('WRONG_PROJECT');
 if(typeof env.BLAISE_METEOBLUE_FREE_API_KEY!=='string')
  return disabled('SECRET_BACKED_ENV_MISSING');
 try{
  const db=await createDatabase({projectId});
  const collector=createBlaiseRjMeteoblueFreeCollector({
   env,db,clock,fetchImpl
  });
  if(!collector.configured)return disabled('CREDENTIAL_OR_BUDGET_UNAVAILABLE');
  return Object.freeze({
   state:'READY_FOR_ADMIN_EXPLICIT_CALL',
   configured:true,automaticSchedulingEnabled:false,
   publishedToSubscribers:false,publishedToAndroid:false,
   collectOne:collector.collectOne
  });
 }catch{
  return disabled('FIRESTORE_INITIALIZATION_FAILED');
 }
}
