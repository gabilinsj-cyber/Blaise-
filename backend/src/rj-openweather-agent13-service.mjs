/**
 * Server-side glue for Agent 13. No polling, HTTP route, secret logging,
 * mobile data, production deployment or automatic activation.
 *
 * The Cloud Run service must inject its Secret Manager value as a secret-backed
 * environment variable BLAISE_OPENWEATHER_API_KEY, never as a plain-text env.
 * Production must supply a credentialed Firestore server client pointed at
 * the default database. Nothing is requested unless the two explicit gates
 * are true and all dependencies are provided.
 */
import {createBlaiseRjOpenWeatherAgent13} from './rj-openweather-agent13.mjs';
import {createRjOpenWeatherFirestoreStore} from './rj-openweather-firestore-store.mjs';
import {createRjAgent13TemperatureContingencyCollector} from './rj-agent13-temperature-fallback-collector.mjs';

export const RJ_AGENT13_RUNTIME_STATE='DISABLED_UNTIL_OPERATOR_APPROVAL';
export function createRjOpenWeatherAgent13Service({
  env={},database=null,clock=()=>Date.now(),fetchImpl=globalThis.fetch
}={}){
  const approved=env.BLAISE_OPENWEATHER_AGENT13_ENABLED==='true'&&
    env.BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED==='true';
  const hasSecret=typeof env.BLAISE_OPENWEATHER_API_KEY==='string'&&
    /^[a-f0-9]{32}$/i.test(env.BLAISE_OPENWEATHER_API_KEY);
  let cache=null,budget=null,store=null;
  if(approved&&hasSecret&&database){
    try {
      store=createRjOpenWeatherFirestoreStore({db:database,clock});
      cache=store.cache;budget=store.budget;
    }catch{
      // No fallback to process-local cache or counter, which could result
      // in unbounded charges when Cloud Run scales out.
      cache=null;budget=null;store=null;
    }
  }
  const readSecret=hasSecret?async name=>{
    if(name!=='BLAISE_OPENWEATHER_API_KEY')
      throw new TypeError('unknown_secret_name');
    return env.BLAISE_OPENWEATHER_API_KEY;
  }:null;
  const contingency=createRjAgent13TemperatureContingencyCollector({
    // An independent feature switch prevents the new 35-minute mode from
    // changing the legacy 12-minute data endpoint after code deployment.
    enabled:approved&&env.BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED==='true',
    subscriptionApproved:approved,
    readSecret,store,clock,fetchImpl
  });
  const agent=createBlaiseRjOpenWeatherAgent13({
    enabled:approved,subscriptionApproved:approved,
    readSecret,
    cache,budget,fetchImpl,clock
  });
  return Object.freeze({
    agentId:agent.id,
    configured:agent.configured,
    automaticSchedulingEnabled:false,
    publishedToAndroid:false,
    collect:async({target,now}={})=>agent.collect({target,now}),
    temperatureContingencyConfigured:contingency.configured,
    collectTemperatureContingency:async({municipalityIbge,prioritySources}={})=>
      contingency.collect({municipalityIbge,prioritySources})
  });
}
