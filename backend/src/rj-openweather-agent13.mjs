/**
 * Agent 13 — Blaise OpenWeather RJ.
 *
 * An explicit server-side executor. Obtains a rotated API key only from an
 * operator-provided secret reader (e.g., Google Secret Manager with narrowly
 * scoped IAM). The secret is never stored in the repo, APK, returned data,
 * logs or telemetry. Does not create a polling loop or activate itself.
 *
 * Caller must supply a production shared cache and durable, atomic daily
 * quota counter. See rj-openweather-onecall4.mjs for guarded fetch contract.
 */
import {
  createRjOpenWeatherOneCall4Connector,
  RJ_OPENWEATHER_DAILY_INTERNAL_MAX,
  RJ_OPENWEATHER_SOURCE_ID
} from './rj-openweather-onecall4.mjs';

export const RJ_OPENWEATHER_AGENT13_ID='blaise-rj-agent-13';
export const RJ_OPENWEATHER_AGENT13_NAME='Blaise OpenWeather RJ — Dados Meteorológicos';
export const RJ_OPENWEATHER_SECRET_NAME='BLAISE_OPENWEATHER_API_KEY';
const unconfigured=(reason)=>Object.freeze({
  agentId:RJ_OPENWEATHER_AGENT13_ID,
  status:'UNAVAILABLE',reason,
  weather:null,
  secretExposed:false,officialObservation:false,officialAlert:false,
  automaticAlertAuthorized:false,networkAttempted:false
});

/**
 * readSecret(secretName): Promise<string> is trusted server-only injection.
 * Never use mobile client, request body, URL, or GitHub config as a secret source.
 * All other dependencies must be shared across backend replicas.
 */
export function createBlaiseRjOpenWeatherAgent13({
  enabled=false,subscriptionApproved=false,
  readSecret=null,cache=null,budget=null,fetchImpl=globalThis.fetch
}={}){
  const ready=enabled===true&&subscriptionApproved===true&&
    typeof readSecret==='function'&&
    cache&&typeof cache.get==='function'&&typeof cache.set==='function'&&
    budget&&typeof budget.tryReserve==='function'&&
    typeof fetchImpl==='function';
  async function collect({target,now=Date.now()}={}){
    if(!ready)return unconfigured('AGENT13_REQUIRES_SERVER_SECRET_AND_BUDGET');
    let apiKey;
    try{
      apiKey=await readSecret(RJ_OPENWEATHER_SECRET_NAME);
    }catch{
      return unconfigured('AGENT13_SECRET_MANAGER_UNAVAILABLE');
    }
    const connector=createRjOpenWeatherOneCall4Connector({
      enabled:true,subscriptionApproved:true,apiKey,cache,budget,fetchImpl
    });
    if(!connector.configured)return unconfigured('AGENT13_KEY_NOT_CONFIGURED');
    const weather=await connector.getCurrent({target,now});
    return Object.freeze({
      agentId:RJ_OPENWEATHER_AGENT13_ID,
      status:weather.status==='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'?
        'CURRENT_ESTIMATE_AVAILABLE':'UNAVAILABLE',
      reason:weather.status==='UNAVAILABLE'?weather.reason:null,
      weather:weather.status==='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'?weather:null,
      secretExposed:false,officialObservation:false,officialAlert:false,
      automaticAlertAuthorized:false,networkAttempted:
        weather.status==='AVAILABLE_PROVIDER_CURRENT_ESTIMATE'?
          true:null, // "null" means not confirmed, not a fabricated negative.
    });
  }
  return Object.freeze({
    id:RJ_OPENWEATHER_AGENT13_ID,name:RJ_OPENWEATHER_AGENT13_NAME,
    configured:Boolean(ready),collect,
    sourceId:RJ_OPENWEATHER_SOURCE_ID,
    maximumDailyProviderCalls:RJ_OPENWEATHER_DAILY_INTERNAL_MAX,
    automaticSchedulingEnabled:false,
    publishedToAndroid:false,
    deploymentVerified:false
  });
}
