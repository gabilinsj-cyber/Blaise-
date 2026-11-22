/**
 * Blaise V6 RJ - temperature, feels-like and sky-condition cadence planning.
 *
 * Pure audit model: NO HTTP, secrets, scheduling, quota reservations, data
 * publishing, scientific assertions or automatic provider activation.
 * A client polling more often cannot increase provider measurement freshness.
 *
 * Operator contract from 18/11: thermal HG E (only after subscription), OWM E
 * (temperature/feels-like contingency, 900/day; 35m/city), DWD ICON P (2m
 * model forecast; not current thermometer). ECMWF/MET, NOAA, Climatempo and
 * Visual Crossing may cover other sectors but NOT temperature/feels-like.
 */
import {RJ_MUNICIPALITIES} from './rio-municipalities.mjs';
import {RJ_HG_BRASIL_PRO_PLAN} from './rj-hgbrasil-pro-plan.mjs';
import {RJ_THERMAL_PRIORITY,RJ_THERMAL_BLOCKED} from './rj-thermal-approved-policy.mjs';

const IBGES=new Set(RJ_MUNICIPALITIES.map(m=>String(m.ibge)));
const frozen=(x)=>Object.freeze(x);
export const RJ_THERMAL_CADENCE_CONTRACT='RJ_92_THERMAL_CADENCE_OFFLINE_V1';
export const RJ_THERMAL_SELECTED_CITY_TARGET_MINUTES=35;
export const RJ_THERMAL_UI_PULL_SECONDS=30;
export const RJ_THERMAL_MAX_OBSERVATION_AGE_MINUTES=60;
export const RJ_THERMAL_SOURCE_CADENCES=frozen([
 frozen({id:'HG_BRASIL_WEATHER_PRO',fields:frozen(['temperatureC','skyCondition','cloudPct']),
  nature:'E',sourceDataIntervalMinutes:60,usableMaxAgeMinutes:60,
  planned:true,active:false,directFeelsLikeVerified:false}),
 frozen({id:'OPENWEATHER_ONECALL4_CURRENT',fields:frozen(['temperatureC','feelsLikeC']),
  nature:'E',sourceDataIntervalMinutes:35,usableMaxAgeMinutes:35,
  planned:true,active:false,contingencyOnly:true}),
 frozen({id:'DWD_ICON_GLOBAL',fields:frozen(['temperatureC']),
  nature:'P',sourceDataIntervalMinutes:null,usableMaxAgeMinutes:90,
  planned:true,active:false,modelForecastOnly:true}),
 frozen({id:'METEOBLUE_FREE_FORECAST',fields:frozen(['forecastRainSixHour','forecastWindSixHour']),
  nature:'P',sourceDataIntervalMinutes:360,usableMaxAgeMinutes:null,
  planned:true,active:false,privateComparisonOnly:true}),
 frozen({id:'CLIMATEMPO_RADAR',fields:frozen(['radarReflectivity','rainNowcast']),
  nature:'O_OR_P_DEPENDING_ON_PRODUCT',sourceDataIntervalMinutes:null,
  usableMaxAgeMinutes:null,planned:true,active:false,licensePending:true}),
]);
export const RJ_SKY_AND_OTHER_SECTOR_TARGETS=frozen([
 frozen({label:'fonte potencial 12 minutos',intervalMinutes:12,thermalValidated:false}),
 frozen({label:'fonte potencial 30 minutos',intervalMinutes:30,thermalValidated:false}),
 frozen({label:'fonte potencial 45 minutos',intervalMinutes:45,thermalValidated:false}),
 frozen({label:'fonte potencial 60 minutos',intervalMinutes:60,thermalValidated:false}),
]);
const round=(v)=>Math.round(v*100)/100;
export function planRjThermalCadence({
 selectedMunicipalityIbges=[],
 hgSubscriptionActive=false,
 openWeatherProviderApproved=false,
 dwdThermalPublished=false,
 climatempoRadarLicensed=false
}={}){
 if(!Array.isArray(selectedMunicipalityIbges)||selectedMunicipalityIbges.length>2||
    selectedMunicipalityIbges.some(x=>!IBGES.has(String(x)))||
    new Set(selectedMunicipalityIbges.map(String)).size!==selectedMunicipalityIbges.length)
  throw Error('INVALID_SELECTED_RJ_MUNICIPALITIES');
 const hgPolls=24;
 const openWeatherPolls=Math.ceil(1440/RJ_THERMAL_SELECTED_CITY_TARGET_MINUTES);
 const allCityOwm=92*openWeatherPolls;
 const selectedOwm=selectedMunicipalityIbges.length*openWeatherPolls;
 const maxOwmCities=Math.floor(900/openWeatherPolls);
 // These are daily planning ceilings, NOT actual credits or actual requests.
 const allowedHg=hgSubscriptionActive===true &&
   RJ_HG_BRASIL_PRO_PLAN.subscriptionActive===true;
 const allowedOwm=openWeatherProviderApproved===true;
 return frozen({
   contract:RJ_THERMAL_CADENCE_CONTRACT,
   municipalities:92,selectedMunicipalityIbges:frozen([...selectedMunicipalityIbges].map(String)),
   displayPollSeconds:RJ_THERMAL_UI_PULL_SECONDS,
   requestedSelectedCityCadenceMinutes:RJ_THERMAL_SELECTED_CITY_TARGET_MINUTES,
   requestedMaximumCurrentDataAgeMinutes:RJ_THERMAL_MAX_OBSERVATION_AGE_MINUTES,
   // The provider update rate is neither a sensor measurement nor a guarantee.
   hg:frozen({plannedPaidMonthlyBrl:RJ_HG_BRASIL_PRO_PLAN.displayedMonthlyPriceBrl,
    subscribed:allowedHg,subscriptionConfirmed:false,
    forecastDays:RJ_HG_BRASIL_PRO_PLAN.forecastMaxDays,
    dataUpdateUpToMinutes:60,dailyCallsFor92AtHourlyPolling:92*hgPolls,
    dailyRequestLimit:RJ_HG_BRASIL_PRO_PLAN.dailyRequestLimit,
    skyConditionEligibleWhenLicensed:true,directFeelsLikeVerified:false,
    currentObservationIsStationMeasurement:false}),
   openWeather:frozen({approvedForContingency:allowedOwm,
    cacheMinimumMinutes:35,maximumEstimateAgeMinutes:35,
    dailyInternalCallCeiling:900,
    callsPerCityPerDayForFull35mCoverage:openWeatherPolls,
    estimatedCallsForSelectedCities:selectedOwm,
    estimatedCallsForAll92Cities:allCityOwm,
    all92At35MinutesWithinBudget:allCityOwm<=900,
    maxFullTimeCitiesAt35Minutes:maxOwmCities,
    minUniformIntervalAcross92With900DailyCallsMinutes:round(92*1440/900),
    requiresSharedBackendCache:true,
    contingencyOnlyWhenOtherAuthorizedThermalUnavailable:true}),
   dwd:frozen({approvedForTemperatureForecast:true,
    eligibleForCurrentMeasuredTemperature:false,
    eligibleForDirectFeelsLike:false,
    modelCycleAnd92CoverageStillRequireAudit:!dwdThermalPublished}),
   climatempo:frozen({radarOnly:true,providerRadarLicensed:climatempoRadarLicensed===true,
    contributesToAirTemperature:false,contributesToDirectFeelsLike:false,
    noRadarFramesDownloaded:true,full92AndOceanCoverageUnverified:true}),
   thermalAllowedSources:frozen([...RJ_THERMAL_PRIORITY]),
   thermalBlockedSources:frozen([...RJ_THERMAL_BLOCKED]),
   thermalActiveSubscriberCollectors:frozen([]),
   guaranteedThermalUpdateEvery35Minutes:false,
   guaranteedAll92CurrentThermalWithin60Minutes:false,
   mayAutostartPolling:false,maySpendCredits:false,
   mayPublishToClients:false,mayEscalateAlerts:false,
   explanation:'Intervals of different sectors must not be added/averaged into a thermal measurement cadence.'
 });
}
/**
 * Conservative age check after actual provider proof. Called only with
 * authenticated provider metadata. Never converts forecast P to measured O.
 */
export function inspectRjThermalTime({validAt,checkedAt,nature,nowMs=Date.now(),
 maximumAgeMinutes=60}={}){
 const empty=frozen({current:false,ageMinutes:null,kind:null});
 if(!Number.isSafeInteger(nowMs)||!Number.isInteger(maximumAgeMinutes)||
    maximumAgeMinutes<1||maximumAgeMinutes>60||
    !['E','P','O'].includes(nature))return empty;
 const valid=Date.parse(validAt),checked=Date.parse(checkedAt);
 if(!Number.isFinite(valid)||!Number.isFinite(checked)||valid>nowMs||
    checked>nowMs||checked<valid||nowMs-checked>12*60_000)return empty;
 const age=(nowMs-valid)/60_000;
 if(age<0||age>maximumAgeMinutes)return frozen({
    current:false,ageMinutes:round(age),kind:nature});
 return frozen({current:true,ageMinutes:round(age),kind:nature});
}
