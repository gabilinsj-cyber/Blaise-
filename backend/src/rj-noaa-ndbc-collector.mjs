/** NOAA NDBC observational adapter; never confuses model forecasts with buoy readings.
 * Stations must be explicitly configured and geographically verified for RJ.
 * NDBC may publish hourly: lack of a <=30-minute sample means absence.
 */
import { selectCurrentRjMarineObservation } from './rj-phenomenon-source-policy.mjs';

const URL_ROOT='https://www.ndbc.noaa.gov/data/realtime2/';
const VARIABLES=Object.freeze({
  WVHT:['ONDAS','m'], WSPD:['VENTO','m/s'], GST:['RAJADA','m/s'],
  WTMP:['TEMPERATURA_MAR','degC'], DPD:['PERIODO_ONDA','s'],
});
export function parseNdbcStandardObservations(body,station,{now=Date.now()}={}) {
  if(typeof body!=='string'||!station||!/^[A-Za-z0-9]{4,8}$/.test(station.id)||
     station.rjCoverageVerified!==true||station.licenseVerified!==true||
     !Number.isFinite(station.latitude)||!Number.isFinite(station.longitude))
    throw new TypeError('ndbc_station_or_response_invalid');
  const lines=body.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const header=lines.find(l=>l.startsWith('#YY')||l.startsWith('# YYYY'));
  if(!header)throw new TypeError('ndbc_header_missing');
  const fields=header.replace(/^#\s*/,'').split(/\s+/);
  const idx=k=>fields.indexOf(k);
  const year=idx('YY')>=0?idx('YY'):idx('YYYY');
  const month=idx('MM'),day=idx('DD'),hour=idx('hh'),minute=idx('mm');
  if([year,month,day,hour].some(i=>i<0))throw new TypeError('ndbc_date_columns_missing');
  const output=[];
  for(const line of lines.filter(l=>!l.startsWith('#')).slice(0,300)) {
    const cols=line.split(/\s+/);
    const yr=Number(cols[year]),y=yr<100?(yr>=70?1900+yr:2000+yr):yr;
    const m=Number(cols[month]),d=Number(cols[day]),h=Number(cols[hour]);
    const min=minute>=0?Number(cols[minute]):0;
    const observed=Date.UTC(y,m-1,d,h,min);
    if(!Number.isFinite(observed)||new Date(observed).getUTCFullYear()!==y||
       new Date(observed).getUTCMonth()!==m-1||observed>now||now-observed>30*60_000)continue;
    for(const [field,[phenomenon,unit]] of Object.entries(VARIABLES)){
      const i=idx(field);if(i<0)continue;
      const raw=cols[i],value=Number(raw);
      if(!Number.isFinite(value)||/^9{2,}(?:\.0+)?$/.test(raw))continue;
      output.push({kind:'OBSERVATION',phenomenon,region:station.region,
        source:'NOAA_NDBC',stationId:station.id,latitude:station.latitude,
        longitude:station.longitude,unit,value,observedAt:new Date(observed).toISOString(),
        collectedAt:new Date(now).toISOString(),verified:true,
        coverageVerified:true,licenseVerified:true});
    }
  }
  return output;
}
export async function collectNdbcRjObservations(stations,{fetchImpl=fetch,now=Date.now()}={}){
  const records=[],errors=[];
  for(const station of Array.isArray(stations)?stations:[]){
    if(!station?.rjCoverageVerified||!station?.licenseVerified||!/^[A-Za-z0-9]{4,8}$/.test(station.id||''))continue;
    try {
      const response=await fetchImpl(URL_ROOT+station.id+'.txt',{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('HTTP_'+response.status);
      const body=await response.text();
      if(body.length>2_000_000)throw new Error('RESPONSE_TOO_LARGE');
      records.push(...parseNdbcStandardObservations(body,station,{now}));
    }catch(e){errors.push({stationId:station.id,reason:String(e.message||e)});}
  }
  return Object.freeze({checkedAt:new Date(now).toISOString(),records,
    errors,live:records.length>0,
    latestByPhenomenon:Object.fromEntries([...new Set(records.map(x=>x.phenomenon))].map(p=>
      [p,selectCurrentRjMarineObservation(records,now,{phenomenon:p})]))});
}
