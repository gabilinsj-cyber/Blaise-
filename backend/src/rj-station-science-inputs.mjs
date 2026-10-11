/**
 * Converts qualified ALERTRIO *station* meteorology into scientifically
 * provenanced jobs. Does not scrape sources, invent a regional mean, reuse
 * a refresh time as observation time, or classify extreme alerts.
 *
 * This is scoped ONLY to Rio city (3304557), never all RJ municipalities.
 */
export const RJ_STATION_SCIENCE_INPUT_VERSION='blaise-rj-alertrio-station-science-v1';
export const RJ_STATION_SCIENCE_SCOPE='municipality:3304557';
const isNumber=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const validStamp=(v,now)=>{
  const t=typeof v==='string'?Date.parse(v):NaN;
  return Number.isFinite(t)&&t<=now&&now-t<=30*60_000;
};
export function buildAlertaRioStationScienceJobs({
  stations=[],sourceUrl,now=Date.now(),maxJobs=24,
}={}) {
  if(!Array.isArray(stations)||stations.length>200
    ||!Number.isFinite(now)||!Number.isInteger(maxJobs)
    ||maxJobs<1||maxJobs>48||typeof sourceUrl!=='string'
    ||!sourceUrl.startsWith('https://'))throw TypeError('invalid_station_science_inputs');
  const jobs=[];
  const seen=new Set();
  for(const station of stations){
    if(jobs.length>=maxJobs)break;
    const code=String(station?.code??'');
    if(!/^\d{1,6}$/.test(code)||seen.has(code)
      ||station?.municipalityIbge!==3304557
      ||station.freshness!=='recent'
      ||!validStamp(station.observedAt,now))continue;
    seen.add(code);
    const temp=station.temperatureC;
    const dew=station.dewPointC;
    const rh=station.relativeHumidityPercent;
    const base={
      scopeId:RJ_STATION_SCIENCE_SCOPE,
      validAt:station.observedAt,
      maxAgeMs:30*60_000,
      sources:Object.freeze([Object.freeze({
        sourceId:'ALERTA_RIO_METEOROLOGY_STATION',
        sourceUrl,scopeId:RJ_STATION_SCIENCE_SCOPE,
        observedAt:station.observedAt,validAt:station.observedAt,
        nature:'OBSERVADO',quality:'VALIDATED',
      })]),
    };
    if(isNumber(dew,-60,60)&&isNumber(temp,-30,60)&&dew<=temp+0.2){
      jobs.push(Object.freeze({...base,id:`alertrio:${code}:vapor-pressure`,
        method:'vaporPressureFromDewPoint',inputs:Object.freeze({dewPointC:dew})}));
      if(jobs.length>=maxJobs)break;
      jobs.push(Object.freeze({...base,id:`alertrio:${code}:relative-humidity`,
        method:'relativeHumidityFromDewPoint',
        inputs:Object.freeze({temperatureC:temp,dewPointC:dew})}));
      if(jobs.length>=maxJobs)break;
    }
    if(isNumber(temp,-20,50)&&isNumber(rh,5,99)){
      jobs.push(Object.freeze({...base,id:`alertrio:${code}:wet-bulb`,
        method:'wetBulbStullApprox',
        inputs:Object.freeze({temperatureC:temp,relativeHumidityPercent:rh})}));
    }
  }
  return Object.freeze(jobs.slice(0,maxJobs));
}
