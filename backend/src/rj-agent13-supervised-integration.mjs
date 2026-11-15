/**
 * Blaise V6 RJ — Agent 13 isolated, fail-closed supervisor bridge.
 * Does not schedule, publish, connect to Cloud Run or query a provider on import.
 * The application must inject its existing service and supervisor factories.
 */
export const RJ_AGENT13_BRIDGE_VERSION = '1.1.1-rj-20261115';
const GATES = Object.freeze([
  'BLAISE_OPENWEATHER_ENABLED',
  'BLAISE_OPENWEATHER_USAGE_APPROVED',
  'BLAISE_PUBLIC_OPENWEATHER_APPROVED',
  'BLAISE_OPENWEATHER_AGENT13_ENABLED',
  'BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED',
  'BLAISE_AGENT13_EXCLUSIVE_RUNNER_CONFIRMED',
]);
function validTarget(t) {
  return t && /^33\d{5}$/.test(String(t.ibge)) &&
    typeof t.latitude === 'number' && Number.isFinite(t.latitude) &&
    typeof t.longitude === 'number' && Number.isFinite(t.longitude) &&
    t.latitude >= -23.37 && t.latitude <= -20.75 &&
    t.longitude >= -44.9 && t.longitude <= -40.9;
}
const unavailable=(reason)=>Object.freeze({status:'UNAVAILABLE',reason,weather:null,
  officialAlert:false,officialObservation:false});
/**
 * Requires *all* deployment and Agent 13-specific flags, an actual server-side
 * Firestore client and secret injection. Does NOT read any subscriber locations.
 * A server-owned targetProvider must choose a municipality from a verified catalog.
 * Only an authenticated internal trigger may invoke onDemand().
 */
export function createRjAgent13SupervisedIntegration({
  env={}, database=null, serviceFactory, supervisorFactory,
  targetProvider, now=Date.now, fetchImpl=globalThis.fetch, onEvent=()=>{},
}={}) {
  if (typeof serviceFactory!=='function'||typeof supervisorFactory!=='function'||
      typeof targetProvider!=='function'||typeof now!=='function'||
      typeof fetchImpl!=='function'||typeof onEvent!=='function')
    throw TypeError('INVALID_INTEGRATION_DEPENDENCY');
  const gatesApproved=GATES.every(key=>env?.[key]==='true');
  const keyReady=typeof env?.BLAISE_OPENWEATHER_API_KEY==='string' &&
    /^[a-f0-9]{32}$/i.test(env.BLAISE_OPENWEATHER_API_KEY);
  const firestoreReady=database && typeof database.collection==='function' &&
    typeof database.runTransaction==='function';
  const canConfigure=Boolean(gatesApproved && keyReady && firestoreReady);
  // Ensure that missing policy gates never accidentally activate the original
  // Agent 13 service even if the deployment has legacy permissive flags.
  const service=serviceFactory({
    env:canConfigure ? env : {}, database:canConfigure ? database : null,
    clock:now, fetchImpl,
  });
  const configured=Boolean(canConfigure && service?.configured===true &&
    typeof service.collect==='function');
  let running=false, onDemandActive=false, lastExecution=null;
  const capture=result=>{lastExecution=result;return result;};
  async function run({now:requestedAt}={}) {
    if(!configured) return capture(unavailable('NOT_CONFIGURED'));
    if(running) return capture(unavailable('ALREADY_RUNNING'));
    running=true;
    try {
      const target=await targetProvider();
      if(!validTarget(target)) return capture(unavailable('NO_VERIFIED_SERVER_TARGET'));
      const at=Number.isSafeInteger(requestedAt) && requestedAt>=0 ? requestedAt : now();
      if(!Number.isSafeInteger(at)||at<0) return capture(unavailable('INVALID_CLOCK'));
      const result=await service.collect({target,now:at});
      return capture(result && typeof result==='object' ? result : unavailable('INVALID_SERVICE_RESULT'));
    } catch {
      return capture(unavailable('SERVICE_OR_FIRESTORE_UNAVAILABLE'));
    } finally { running=false; }
  }
  const supervisor=supervisorFactory({
    enabled:configured, now, onEvent,
    handlers:configured ? {'openweather-rj':{sourceId:'openweather',run}} : {},
  });
  if(!supervisor || typeof supervisor.onDemandOpenWeather!=='function'||
     typeof supervisor.snapshot!=='function'||typeof supervisor.stop!=='function')
     throw TypeError('INVALID_SUPERVISOR_CONTRACT');
  return Object.freeze({
    version:RJ_AGENT13_BRIDGE_VERSION,
    configured,
    automaticSchedulingEnabled:false,
    publishedToAndroid:false,
    onDemand:async({adminAuthorized=false}={})=>{
      if(adminAuthorized!==true) return Object.freeze({status:'BLOCKED',reason:'ADMIN_AUTH_REQUIRED'});
      if(!configured) return Object.freeze({status:'DISABLED',reason:'NOT_CONFIGURED'});
      if(onDemandActive) return Object.freeze({status:'BUSY',reason:'ALREADY_RUNNING'});
      onDemandActive=true;
      lastExecution=null;
      try {
        const outcome=await supervisor.onDemandOpenWeather();
        if(outcome?.status==='DISABLED') return outcome;
        // Supervisor intentionally returns status only, discarding the
        // dispatch payload. Capture the real Agent 13 result in the handler.
        if(outcome?.status!=='COMPLETED')
          return unavailable('SUPERVISOR_DID_NOT_COMPLETE');
        const result=lastExecution ?? outcome.result;
        if(result?.status==='UNAVAILABLE')
          return unavailable(result.reason || 'NO_CURRENT_VALID_DATA');
        // A successful dispatch is not proof of valid weather. Reject missing
        // or unclassified provider data, rather than publishing fake success.
        if(result?.status!=='CURRENT_ESTIMATE_AVAILABLE' ||
           result.weather?.status!=='AVAILABLE_PROVIDER_CURRENT_ESTIMATE' ||
           result.weather.sourceId!=='OPENWEATHER_ONECALL4_CURRENT' ||
           result.weather.officialObservation!==false ||
           result.weather.officialAlert!==false)
          return unavailable('VERIFIED_WEATHER_RESULT_REQUIRED');
        return Object.freeze({id:'openweather-rj',status:'COMPLETED',result});
      } catch {
        return unavailable('SUPERVISOR_EXECUTION_FAILED');
      } finally {
        lastExecution=null;
        onDemandActive=false;
      }
    },
    snapshot:()=>supervisor.snapshot(),
    stop:()=>supervisor.stop(),
  });
}
