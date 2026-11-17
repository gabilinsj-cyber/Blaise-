/**
 * HG Brasil Weather Pro — approved planning option for Blaise V6 RJ.
 * Research/configuration ONLY. No HTTP requests, registration, billing,
 * background work, keys, storage or subscriber publication.
 *
 * Important legal gate: HG Brasil's published Terms section 11.5
 * prohibits commercialization of returned API data through other sites or
 * means. A paid plan alone is NOT a redistribution grant to our paid app.
 * https://console.hgbrasil.com/terms
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';

const ALL_RJ_CODES=Object.freeze(RJ_MUNICIPALITIES.map(m=>m.ibge));
if(ALL_RJ_CODES.length!==92||new Set(ALL_RJ_CODES).size!==92){
  throw new Error('HG_PLAN_MUNICIPALITY_INVENTORY_INVALID');
}
const FREEZE=(x)=>Object.freeze(x);
export const RJ_HG_BRASIL_PRO_PLAN=FREEZE({
  id:'HG_BRASIL_WEATHER_PRO',
  provider:'HG Brasil Weather',
  plan:'Pro',
  displayedMonthlyPriceBrl:49.90,
  publishedPricingUrl:'https://hgbrasil.com/pricing/?origin=weather',
  termsUrl:'https://console.hgbrasil.com/terms',
  apiDocumentationUrl:'https://hgbrasil.com/docs/weather/',
  municipalityCount:92,
  cityLimit:100,
  dailyRequestLimit:20_000,
  pollingIntervalMinutes:60,
  pollsPerCityPerDay:24,
  plannedCallsPerDay:2208,
  plannedCallsPer30Days:66240,
  remainingDailyRequestsWithoutRetries:17792,
  targetCityCodes:ALL_RJ_CODES,
  permittedCandidateFields:FREEZE([
    'temperatureC','humidityPct','windKmh','gustKmh','cloudPct'
  ]),
  forecastCandidateFields:FREEZE(['dailyMinC','dailyMaxC','dailyRainForecastMm']),
  rainfallObservationsLicensedAndValidated:false,
  measurementOrigin:'THIRD_PARTY_AGGREGATED_UNVERIFIED',
  stationSensorProof:false,
  forecastIsStationObservation:false,
  commercialRedistributionPermissionVerified:false,
  subscriptionActive:false,
  appReleaseReady:false,
  keyInstalledServerSide:false,
  scheduledPollingEnabled:false,
  liveIngestionConfirmed:false,
  publishedToAndroid:false,
  secretsEmbeddedInAndroid:false,
  useIpGeolocation:false,
  retryBudgetReserved:true,
  noDataStatus:'UNAVAILABLE',
});

/**
 * Checks prerequisites before any future separately reviewed collector may
 * be activated. Does not accept or produce key bytes, perform network I/O or
 * write to disk. All 92 place IDs must have been provider-matched one-to-one.
 */
export function checkRjHgBrasilProReadiness({
  subscriptionActive=false,
  writtenCommercialGrantVerified=false,
  termsAcceptedByOperator=false,
  serverSecretConfigured=false,
  providerCityMapValidated=false,
  municipalityCount=0,
  preparedForRelease=false,
}={}){
  const missing=[];
  if(subscriptionActive!==true)missing.push('PAID_PLAN_NOT_ACTIVE');
  if(writtenCommercialGrantVerified!==true)missing.push('WRITTEN_COMMERCIAL_GRANT_REQUIRED');
  if(termsAcceptedByOperator!==true)missing.push('TERMS_ACCEPTANCE_REQUIRED');
  if(serverSecretConfigured!==true)missing.push('SERVER_SECRET_REQUIRED');
  if(providerCityMapValidated!==true||municipalityCount!==92)
    missing.push('CITY_MAPPING_NOT_VALIDATED_FOR_92');
  if(preparedForRelease!==true)missing.push('RELEASE_GATE_NOT_APPROVED');
  return FREEZE({
    sourceId:RJ_HG_BRASIL_PRO_PLAN.id,
    readyForManuallyReviewedCollector:missing.length===0,
    reasons:FREEZE(missing),
    automaticCollection:false,
    customerPublication:false,
    independentStationMeasurementsConfirmed:false,
  });
}
