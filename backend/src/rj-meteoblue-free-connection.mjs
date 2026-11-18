/**
 * Blaise V6 RJ — meteoblue FREE API connection preparation.
 *
 * Nothing in this module makes a network request or reads a key. A successful
 * meteoblue account login is not proof of an active Free Weather API entitlement.
 * No automatic scheduler, key in APK, paid extension or 92-city loop.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};
const CODES=new Map(geo.points.map(x=>[x.ibge,x]));
export const METEOBLUE_FREE_RJ_POLICY=Object.freeze({
  contract:'BLAISE_RJ_METEOBLUE_FREE_EVALUATION_V1',
  sourceId:'METEOBLUE_FREE_FORECAST',
  sourceNature:'P',independentRawModelProven:false,
  package:'basic-6h',maximumPeriodMonths:12,
  promotionalCreditsTotal:10_000_000,
  approximateFullTermCalls:2_500,
  allowanceIsRequests:false,creditUseVariesByPackage:true,
  costEuro:0,paidPlanAuthorized:false,
  billingAutoTopUpAllowed:false,
  accountValidated:false,apiKeyValidated:false,
  automaticCollection:false,publishedToAndroid:false,
  publishedToSubscribers:false,mayReplaceAirTemperature:false,
  mayReplaceFeelsLike:false,mayReplaceObservedRain:false,
  mayReplaceOfficialWarnings:false,
  sourceUrl:'https://business.meteoblue.com/products/weather-apis/free-weather-api'
});
export const METEOBLUE_TEST_IBGE=Object.freeze([
  '3304557', // Rio de Janeiro
  '3303906', // Petrópolis
  '3305802', // Teresópolis
  '3303401', // Nova Friburgo
]);
export function prepareMeteoblueFreeRjProbe({
  ibge='3304557',packageName='basic-6h',
  freeTrialConfirmed=false,autoTopUpDisabled=false,
  operatorApprovedSingleCreditUse=false,serverEnvironment=false,
  requestsAlreadyMadeInThisInvocation=0
}={}){
  const target=CODES.get(String(ibge));
  const missing=Object.freeze({
    contract:'RJ_METEOBLUE_FREE_ONE_SHOT_PREPARE_V1',
    state:'NOT_AUTHORIZED_OR_NOT_CONFIGURED',ibge:String(ibge),
    query:null,mayContactProvider:false,
    usedCredits:0,publishedToSubscribers:false
  });
  if(!target||packageName!=='basic-6h'||
     freeTrialConfirmed!==true||autoTopUpDisabled!==true||
     operatorApprovedSingleCreditUse!==true||
     serverEnvironment!==true||requestsAlreadyMadeInThisInvocation!==0)
    return missing;
  const lat=target.lat,lon=target.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||
     target.geometryStatus!=='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'||
     target.verifiedByBackend!==true||target.altitudeVerified===true)
    return missing;
  // Terrain elevation is deliberately omitted, meteoblue determines it by DEM.
  // The key must be supplied by Secret Manager to the trusted server only.
  const query=new URLSearchParams({
    // Pin documented Forecast API units instead of relying on account defaults.
    // This changes representation, not the requested package/credit cost.
    lat:String(lat),lon:String(lon),tz:'utc',format:'json',
    windSpeedUnit:'km/h',precipitationUnit:'metric'
  }).toString();
  return Object.freeze({
    ...missing,state:'READY_FOR_ONE_EXPLICIT_FREE_CREDIT_TEST',
    query,mayContactProvider:true,
    packageName,targetCoordinates:Object.freeze({lat,lon}),
    expectedEndpoint:'https://my.meteoblue.com/packages/basic-6h'
  });
}
export function inspectMeteoblueFreeProbeResponse({
  status,contentType,data,ibge='3304557'
}={}){
  const rejected=Object.freeze({
    contract:'BLAISE_METEOBLUE_FREE_AUTH_PROBE_V1',
    status:'NOT_VALIDATED',httpStatus:Number.isInteger(status)?status:null,
    apiKeyAuthorized:false,forecastSampleValidated:false,
    observationsCount:0,paidUse:false,publishedToSubscribers:false
  });
  if(!CODES.has(String(ibge))||status!==200||
     typeof contentType!=='string'||!contentType.toLowerCase().includes('json')||
     !data||typeof data!=='object'||Array.isArray(data)||
     data.error||data.error_message||!data.metadata||
     typeof data.metadata!=='object'||
     !(data.data_6h&&typeof data.data_6h==='object'&&
       Array.isArray(data.data_6h.time)))
    return rejected;
  return Object.freeze({
    ...rejected,status:'API_KEY_ACCEPTED_FORECAST_SCHEMA_PLAUSIBLE',
    apiKeyAuthorized:true,
    // Schema plausibility is not yet meteorological/financial homologation.
    forecastSampleValidated:false,
    validForecastTimestamps:data.data_6h.time.length,
    packageName:'basic-6h'
  });
}
