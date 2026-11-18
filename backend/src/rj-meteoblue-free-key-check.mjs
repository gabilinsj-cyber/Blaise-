/**
 * Single explicit Meteoblue FREE credit test, server/Cloud Shell only.
 * Never log, persist or print a password, secret or full upstream URL.
 * One request requires all operator gates, no automatic polling.
 */
import {prepareMeteoblueFreeRjProbe,inspectMeteoblueFreeProbeResponse}
  from './rj-meteoblue-free-connection.mjs';
const blocked=(reason)=>Object.freeze({
  contract:'BLAISE_METEOBLUE_FREE_SINGLE_AUTH_TEST_V1',
  state:reason,providerContacted:false,credentialsPrinted:false,
  billingEnabled:false,automaticPollingEnabled:false,
  publishedToSubscribers:false
});
const keyValid=s=>typeof s==='string'&&s.length>=8&&s.length<=180&&
  /^[A-Za-z0-9_-]+$/.test(s);
export async function checkMeteoblueFreeKeyOnce({
  env={},municipalityIbge='3304557',fetchImpl=globalThis.fetch
}={}){
  if(env.BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED!=='true'||
     // The previously pictured API key is exposed: a rotated new key is required.
     env.BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE!=='true'||
     env.BLAISE_METEOBLUE_AUTOTOPUP_DISABLED!=='true'||
     env.BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED!=='true'||
     env.BLAISE_METEOBLUE_PAID_ALLOWED==='true')
    return blocked('OPERATOR_GATES_NOT_APPROVED');
  const key=env.BLAISE_METEOBLUE_FREE_API_KEY;
  if(!keyValid(key))return blocked('API_KEY_NOT_INSTALLED_OR_INVALID_FORMAT');
  const prepared=prepareMeteoblueFreeRjProbe({
    ibge:municipalityIbge,
    freeTrialConfirmed:true,autoTopUpDisabled:true,
    operatorApprovedSingleCreditUse:true,serverEnvironment:true
  });
  if(!prepared.mayContactProvider)return blocked('IBGE_OR_PROBE_NOT_APPROVED');
  const url=new URL(prepared.expectedEndpoint);
  for(const [name,value] of new URLSearchParams(prepared.query))
    url.searchParams.set(name,value);
  url.searchParams.set('apikey',key);
  let response;
  try{
    response=await fetchImpl(url.href,{
      method:'GET',redirect:'error',
      signal:AbortSignal.timeout(15000),
      headers:{Accept:'application/json'},
    });
  }catch{
    return Object.freeze({...blocked('PROVIDER_CONNECTION_UNAVAILABLE'),
      providerContacted:true});
  }
  const httpStatus=Number.isInteger(response?.status)?response.status:null;
  if(httpStatus!==200)
    return Object.freeze({...blocked('PROVIDER_REFUSED_OR_FREE_PACKAGE_NOT_ALLOWED'),
      httpStatus,providerContacted:true});
  const ct=response.headers?.get?.('content-type')??'';
  let body;
  try{
    const size=response.headers?.get?.('content-length');
    if(size&&Number(size)>600000)throw Error('TOO_LARGE');
    const txt=await response.text();
    if(txt.length>600000)throw Error('TOO_LARGE');
    body=JSON.parse(txt);
  }catch{
    return Object.freeze({...blocked('INVALID_PROVIDER_JSON'),
      httpStatus,providerContacted:true});
  }
  const verified=inspectMeteoblueFreeProbeResponse({
    status:httpStatus,contentType:ct,data:body,ibge:municipalityIbge
  });
  return Object.freeze({
    ...blocked(verified.apiKeyAuthorized?
      'KEY_ACCEPTED_BY_PROVIDER_SAMPLE_RECEIVED':
      'RESPONSE_SCHEMA_UNVERIFIED'),
    httpStatus,providerContacted:true,
    apiKeyAcceptedForBasic6h:verified.apiKeyAuthorized,
    forecastTimestampsCount:verified.validForecastTimestamps??0,
    // A validated key is NOT evidence of local weather quality,
    // remaining credits, contract entitlement or pay-as-you-go permission.
    remainingCreditsVerified:false,
    freeTrialExpiryVerified:false,
    numericalForecastPublished:false
  });
}
