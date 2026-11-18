/**
 * HG Brasil Weather Pro — Blaise V6 RJ (92 municipalities).
 * HG Brasil's written reply of 2026-11-17 authorizes provider data display
 * as a part of a paid subscriber application, shared cache and attribution.
 * This is NOT a license to resell raw provider data independently.
 * No purchase, HTTP, billing, secrets, scheduled collection or publication.
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
  forecastMaxDays:15,
  writtenCommercialConfirmationReceivedAt:'2026-11-17',
  writtenCommercialConfirmationScope:'PAID_SUBSCRIBER_APP_DISPLAY_ONLY_NO_RAW_RESALE',
  commercialSubscriberDisplayPermissionVerified:true,
  remainingDailyRequestsWithoutRetries:17792,
  targetCityCodes:ALL_RJ_CODES,
  // Candidate fields are catalogued, NOT operational weather observations.
  // Hourly rain is aggregated/unsourced (E), never an observed rain-gauge O.
  permittedCandidateFields:FREEZE([
    'temperatureC','humidityPct','windKmh','gustKmh','windDirectionDeg',
    'windCardinal','cloudPct','rainLastHourAggregatedMm',
    'conditionCode','conditionSlug','conditionDescription','isDaytime',
    'sunriseLocal','sunsetLocal','moonPhase',
  ]),
  forecastCandidateFields:FREEZE([
    'dailyMinC','dailyMaxC','dailyRainForecastMm','dailyRainProbabilityPct',
    'dailyHumidityPct','dailyCloudPct','dailyWindKmh',
    'dailyCondition','dailySunriseLocal','dailySunsetLocal','dailyMoonPhase',
  ]),
  candidateFieldCategories:FREEZE({
    currentConditions:'E_AGGREGATED_UNVERIFIED_SENSOR',
    lastHourRain:'E_AGGREGATED_NOT_OBSERVED_GAUGE',
    dailyForecast:'P_MODEL_FORECAST',
  }),
  providerCityLookup:'WOEID_OR_CITY_NAME_MUST_BE_MATCHED_1_TO_1_WITH_IBGE',
  rainfallObservationsLicensedAndValidated:false,
  measurementOrigin:'THIRD_PARTY_AGGREGATED_UNVERIFIED',
  stationSensorProof:false,
  forecastIsStationObservation:false,
  // Reselling/re-distributing raw data as a standalone product is NOT authorized.
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
  writtenCommercialGrantVerified=RJ_HG_BRASIL_PRO_PLAN.commercialSubscriberDisplayPermissionVerified,
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
