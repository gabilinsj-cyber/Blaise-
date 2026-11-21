/**
 * Blaise V6 RJ — WeatherAPI.com Free: OFFLINE ONLY rollout feasibility.
 *
 * This is not an API adapter or a collector. No key, network, scheduler,
 * Firestore writes, production calls, paid feature or customer endpoint.
 * A real rollout needs a Free account, server-side key, legal confirmation,
 * atomic shared monthly ledger, source QA and explicit operator approval.
 */
import geo from './rj-ibge-92-points.json' with {type:'json'};

export const WEATHERAPI_FREE_MONTHLY_QUOTA=100_000;
export const WEATHERAPI_INTERNAL_MONTHLY_CEILING=80_000;
export const WEATHERAPI_FREE_MAX_REQUESTS_PER_SECOND=10;
export const WEATHERAPI_FREE_FORECAST_DAYS=3;
export const WEATHERAPI_CURRENT_MAX_CACHE_MS=60*60_000;
export const WEATHERAPI_FORECAST_MAX_CACHE_MS=24*60*60_000;
export const WEATHERAPI_AUTOMATIC_COLLECTION_ENABLED=false;
const cities=Object.freeze(geo.points.map(x=>String(x.ibge)));
if(cities.length!==92||new Set(cities).size!==92)throw Error('RJ_IBGE_92_NOT_VERIFIED');

export function planWeatherApiFree92Monthly({
  year=2026,month=11,queriesPerMunicipalityPerDay=24
}={}){
 if(!Number.isInteger(year)||year<2020||year>2100||
    !Number.isInteger(month)||month<1||month>12||
    !Number.isInteger(queriesPerMunicipalityPerDay)||
    queriesPerMunicipalityPerDay<1||queriesPerMunicipalityPerDay>1440)
  throw Error('INVALID_PLANNING_INPUT');
 const days=new Date(Date.UTC(year,month,0)).getUTCDate();
 const total=cities.length*days*queriesPerMunicipalityPerDay;
 return Object.freeze({
  status:total<=WEATHERAPI_INTERNAL_MONTHLY_CEILING
     ?'OFFLINE_BUDGET_PROPOSAL':'OVER_INTERNAL_BUDGET',
  plan:'FREE_CANDIDATE_NOT_CONFIGURED',
  municipalityCount:cities.length,
  daysInUtcMonth:days,queriesPerMunicipalityPerDay,
  estimatedMonthlyProviderCalls:total,
  internalMonthlyCap:WEATHERAPI_INTERNAL_MONTHLY_CEILING,
  publishedMonthlyFreeQuota:WEATHERAPI_FREE_MONTHLY_QUOTA,
  internalRemainingMargin:WEATHERAPI_INTERNAL_MONTHLY_CEILING-total,
  providerRemainingMarginWithoutOtherUsage:
    WEATHERAPI_FREE_MONTHLY_QUOTA-total,
  maxRps:WEATHERAPI_FREE_MAX_REQUESTS_PER_SECOND,
  freeForecastDays:WEATHERAPI_FREE_FORECAST_DAYS,
  currentCacheTtlMinutes:60,forecastCacheTtlHours:24,
  operatorApproved:false,hasServerKey:false,
  billingEnabled:false,automaticProviderCollection:false,
  subscriberPublishing:false,
  weatherModelCategory:'E_AGGREGATED_CURRENT_AND_P_FORECAST',
  notSafetyCriticalOrOfficialAlert:true
 });
}
