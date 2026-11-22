import test from 'node:test';
import assert from 'node:assert/strict';
import {
 planRjThermalCadence,inspectRjThermalTime,
 RJ_THERMAL_SOURCE_CADENCES,RJ_THERMAL_CADENCE_CONTRACT
} from '../src/rj-thermal-multisource-cadence.mjs';

test('HG plans 2208 calls/day for 92 hourly locations but is not active',()=>{
 const p=planRjThermalCadence({selectedMunicipalityIbges:[3304557,3303302]});
 assert.equal(p.contract,RJ_THERMAL_CADENCE_CONTRACT);
 assert.equal(p.municipalities,92);
 assert.equal(p.hg.dailyCallsFor92AtHourlyPolling,2208);
 assert.equal(p.hg.dataUpdateUpToMinutes,60);
 assert.equal(p.hg.dailyRequestLimit,20000);
 assert.equal(p.hg.subscribed,false);
 assert.equal(p.hg.directFeelsLikeVerified,false);
 assert.deepEqual(p.thermalActiveSubscriberCollectors,[]);
 assert.equal(p.mayAutostartPolling,false);
 assert.equal(p.maySpendCredits,false);
 assert.equal(p.mayPublishToClients,false);
});

test('35-minute full-state OpenWeather fallback far exceeds approved 1/day',()=>{
 const p=planRjThermalCadence({
  selectedMunicipalityIbges:[3304557,3303302],openWeatherProviderApproved:true
 });
 assert.equal(p.openWeather.callsPerCityPerDayForFull35mCoverage,42);
 assert.equal(p.openWeather.estimatedCallsForSelectedCities,84);
 assert.equal(p.openWeather.estimatedCallsForAll92Cities,3864);
 assert.equal(p.openWeather.maxFullTimeCitiesAt35Minutes,0);
 assert.equal(p.openWeather.minUniformIntervalAcross92WithOneDailyCallMinutes,132480);
 assert.equal(p.openWeather.all92At35MinutesWithinBudget,false);
 assert.equal(p.openWeather.dailyInternalCallCeiling,1);
 assert.equal(p.guaranteedAll92CurrentThermalWithin60Minutes,false);
 assert.equal(p.guaranteedThermalUpdateEvery35Minutes,false);
 assert.equal(p.openWeather.contingencyOnlyWhenOtherAuthorizedThermalUnavailable,true);
});

test('weather satellite/radar and six-hour forecast do not become a current thermal source',()=>{
 const p=planRjThermalCadence({climatempoRadarLicensed:true});
 assert.equal(p.climatempo.radarOnly,true);
 assert.equal(p.climatempo.contributesToAirTemperature,false);
 assert.equal(p.climatempo.contributesToDirectFeelsLike,false);
 assert.equal(p.climatempo.noRadarFramesDownloaded,true);
 assert.deepEqual(p.thermalAllowedSources,
  ['HG_BRASIL_WEATHER_PRO','OPENWEATHER_ONECALL4_CURRENT','DWD_ICON_GLOBAL']);
 assert.ok(p.thermalBlockedSources.includes('CLIMATEMPO'));
 assert.ok(p.thermalBlockedSources.includes('ECMWF_IFS'));
 assert.ok(RJ_THERMAL_SOURCE_CADENCES.some(x=>
    x.id==='METEOBLUE_FREE_FORECAST'&&!x.fields.includes('temperatureC')));
});

test('reject invalid IBGE, more than two selected, duplicates, or invented positions',()=>{
 for(const candidates of [[0],[3304557,3304557],[3304557,3303302,3303906],['not-a-city']]){
  assert.throws(()=>planRjThermalCadence({
   selectedMunicipalityIbges:candidates}),/INVALID_SELECTED_RJ_MUNICIPALITIES/);
 }
});

test('freshness is tied to actual provider timestamps not smartphone polling',()=>{
 const now=Date.parse('2026-11-22T12:00:00Z');
 const p=(v,c='2026-11-22T11:59:00Z',kind='E')=>
  inspectRjThermalTime({validAt:v,checkedAt:c,nature:kind,nowMs:now});
 assert.equal(p('2026-11-22T11:30:00Z').current,true);
 assert.equal(p('2026-11-22T10:59:00Z').current,false);
 assert.equal(p('2026-11-22T11:30:00Z','2026-11-22T11:40:00Z').current,false);
 assert.equal(p('2026-11-22T12:01:00Z').current,false);
 assert.equal(p('invalid').current,false);
 assert.equal(p('2026-11-22T11:30:00Z','2026-11-22T11:59:00Z','P').kind,'P');
 assert.equal(p('2026-11-22T11:30:00Z','2026-11-22T11:59:00Z','P').current,true);
});
