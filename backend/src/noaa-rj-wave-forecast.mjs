import {fetchJsonContract} from './source-contract.mjs';
export const NOAA_RJ_WAVE_TASK='noaa-pacioos-rj-wave-forecast';
export const NOAA_RJ_WAVE_URL='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json';
const columns=['time','depth','latitude','longitude','Thgt','Tper','Tdir','shgt','sper','sdir'];
const units=['UTC','m','degrees_north','degrees_east','meters','second','degrees','meters','seconds','degrees'];
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function noaaRjWaveQuery(now){
 if(!Number.isFinite(now))fail('noaa_wave_invalid_clock');
 const start=new Date(Math.floor(now/3600000)*3600000).toISOString().replace('.000Z','Z');
 const end=new Date(Math.floor(now/3600000)*3600000+6*3600000).toISOString().replace('.000Z','Z');
 const dims=`[(${start}):1:(${end})][(0.0)][(-23.5)][(317.0)]`;
 return NOAA_RJ_WAVE_URL+'?'+encodeURIComponent(columns.slice(4).map(k=>k+dims).join(','));
}
/** A dated model point. No run issuance timestamp is present in this ERDDAP subset. */
export function parseNoaaRjWaves(raw,{now=Date.now()}={}){
 if(!Number.isFinite(now))fail('noaa_wave_invalid_clock');
 const t=raw?.table;
 if(JSON.stringify(t?.columnNames)!==JSON.stringify(columns)||JSON.stringify(t?.columnUnits)!==JSON.stringify(units)
   ||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>8)fail('noaa_wave_schema_invalid');
 function quantity(v,min,max){if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('noaa_wave_quantity_invalid');return v;}
 const forecasts=t.rows.map(r=>{
  if(!Array.isArray(r)||r.length!==10||r[1]!==0||r[2]!==-23.5||r[3]!==317)fail('noaa_wave_grid_mismatch');
  const valid=Date.parse(r[0]);
  if(typeof r[0]!=='string'||!Number.isFinite(valid)||valid<now-2*3600000||valid>now+7*3600000)fail('noaa_wave_valid_time_invalid');
  return Object.freeze({validAt:new Date(valid).toISOString(),heightM:quantity(r[4],0,30),peakPeriodS:quantity(r[5],0,60),
   peakFromDegrees:quantity(r[6],0,360),swellHeightM:quantity(r[7],0,30),swellPeriodS:quantity(r[8],0,60),swellFromDegrees:quantity(r[9],0,360)});
 }).filter(r=>r.heightM!==null&&Date.parse(r.validAt)>=now-3600000);
 if(!forecasts.length||new Set(forecasts.map(f=>f.validAt)).size!==forecasts.length)fail('noaa_wave_no_usable_forecast');
 forecasts.sort((a,b)=>Date.parse(a.validAt)-Date.parse(b.validAt));
 return Object.freeze({sourceId:NOAA_RJ_WAVE_TASK,sourceUrl:NOAA_RJ_WAVE_URL,publisher:'PacIOOS / University of Hawaii via NOAA ERDDAP',
  kind:'MODEL_FORECAST_NOT_OBSERVATION',scope:'OFFSHORE_POINT_NOT_COASTAL_BEACH',latitude:-23.5,longitude:-43,gridResolutionDegrees:0.5,
  issuedAt:null,issuanceTimeKnown:false,fetchedAt:new Date(now).toISOString(),forecasts:Object.freeze(forecasts),
  providesTides:false,providesCurrents:false,mayIssueWarning:false});
}
export async function probeNoaaRjWaves({fetchImpl=globalThis.fetch,now=Date.now}={}){
 const raw=await fetchJsonContract(noaaRjWaveQuery(now()),{fetchImpl,allowedHosts:['pae-paha.pacioos.hawaii.edu'],timeoutMs:25000,maxBytes:32768});
 return parseNoaaRjWaves(raw,{now:now()});
}
export function createNoaaRjWaveCache({now=Date.now}={}){
 let snapshot=null,error=null;
 return {recordSuccess(s){snapshot=s;error=null;},recordFailure(code){error=code;},read(){const at=now(),age=at-Date.parse(snapshot?.fetchedAt);
 const valid=snapshot&&!error&&age>=0&&age<=300000&&snapshot.forecasts.some(f=>Math.abs(Date.parse(f.validAt)-at)<=3600000);
 return {sourceId:NOAA_RJ_WAVE_TASK,state:valid?'FORECAST_VALID_TIME_ISSUANCE_UNKNOWN':'UNAVAILABLE',reason:error??'model_not_sensor_issuance_unknown',fetchedAt:snapshot?.fetchedAt??null,snapshot:valid?snapshot:null};}};
}
