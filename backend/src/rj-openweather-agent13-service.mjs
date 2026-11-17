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

export const RJ_AGENT13_RUNTIME_STATE='DISABLED_UNTIL_OPERATOR_APPROVAL';
export function createRjOpenWeatherAgent13Service({
  env={},database=null,clock=()=>Date.now(),fetchImpl=globalThis.fetch
}={}){
  const approved=env.BLAISE_OPENWEATHER_AGENT13_ENABLED==='true'&&
    env.BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED==='true';
  const hasSecret=typeof env.BLAISE_OPENWEATHER_API_KEY==='string'&&
    /^[a-f0-9]{32}$/i.test(env.BLAISE_OPENWEATHER_API_KEY);
  let cache=null,budget=null;
  if(approved&&hasSecret&&database){
    try {
      const store=createRjOpenWeatherFirestoreStore({db:database,clock});
      cache=store.cache;budget=store.budget;
    }catch{
      // No fallback to process-local cache or counter, which could result
      // in unbounded charges when Cloud Run scales out.
      cache=null;budget=null;
    }
  }
  const agent=createBlaiseRjOpenWeatherAgent13({
    enabled:approved,subscriptionApproved:approved,
    readSecret:hasSecret?async name=>{
      if(name!=='BLAISE_OPENWEATHER_API_KEY')
        throw new TypeError('unknown_secret_name');
      return env.BLAISE_OPENWEATHER_API_KEY;
    }:null,
    cache,budget,fetchImpl
  });
  return Object.freeze({
    agentId:agent.id,
    configured:agent.configured,
    automaticSchedulingEnabled:false,
    publishedToAndroid:false,
    collect:async({target,now=clock()}={})=>agent.collect({target,now})
  });
}
