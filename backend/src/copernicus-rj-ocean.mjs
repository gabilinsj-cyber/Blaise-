import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
export const COPERNICUS_RJ_TASK='copernicus-rj-tides-currents';
export const COPERNICUS_RJ_URL='https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description';
const runFile=promisify(execFile);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
/** Separate model grids, original validity times, MSL datum and total-current vectors. */
export function parseCopernicusRjOcean(raw,{now=Date.now()}={}){
 const fetched=Date.parse(raw?.fetchedAt);
 if(!Number.isFinite(now)||raw?.productId!=='GLOBAL_ANALYSISFORECAST_PHY_001_024'||!Number.isFinite(fetched)||now-fetched<0||now-fetched>300000)fail('copernicus_clock_invalid');
 const specs={seaLevel:{id:'cmems_mod_glo_phy_anfc_merged-sl_PT1H-i',vars:['ocean_tide','total_sea_level'],unit:'m',bound:20},currents:{id:'cmems_mod_glo_phy_anfc_merged-uv_PT1H-i',vars:['utotal','vtotal'],unit:'m s-1',bound:15}};
 const products={};
 for(const [key,spec] of Object.entries(specs)){
  const p=raw.products?.[key];
  if(p?.datasetId!==spec.id||!finite(p.latitude,-23.55,-23.45)||!finite(p.longitude,-43.05,-42.95)||!Array.isArray(p.rows)||p.rows.length<1||p.rows.length>8||spec.vars.some(v=>p.units?.[v]!==spec.unit))fail('copernicus_schema_invalid');
  if(key==='currents'&&p.depthM!==null&&!finite(p.depthM,0,1))fail('copernicus_depth_invalid');
  if(key==='seaLevel'&&p.depthM!==null)fail('copernicus_depth_invalid');
  const rows=p.rows.map(r=>{
   const valid=Date.parse(r.validAt);
   if(typeof r.validAt!=='string'||!Number.isFinite(valid)||valid<now-3600000||valid>now+7*3600000)fail('copernicus_valid_time_invalid');
   const out={validAt:new Date(valid).toISOString()};
   for(const v of spec.vars){if(r[v]!==null&&!finite(r[v],-spec.bound,spec.bound))fail('copernicus_quantity_invalid');out[v]=r[v];}
   if(key==='currents'){
    const usable=out.utotal!==null&&out.vtotal!==null;
    out.speedMs=usable?Math.hypot(out.utotal,out.vtotal):null;
    out.towardsDegrees=usable&&out.speedMs>0?(Math.atan2(out.utotal,out.vtotal)*180/Math.PI+360)%360:null;
   }
   return Object.freeze(out);
  }).sort((a,b)=>Date.parse(a.validAt)-Date.parse(b.validAt));
  if(new Set(rows.map(r=>r.validAt)).size!==rows.length||!rows.some(r=>Math.abs(Date.parse(r.validAt)-now)<=3600000&&spec.vars.every(v=>r[v]!==null)))fail('copernicus_no_current_model_value');
  products[key]=Object.freeze({datasetId:spec.id,latitude:p.latitude,longitude:p.longitude,depthM:p.depthM,units:Object.freeze({...p.units}),rows:Object.freeze(rows)});
 }
 return Object.freeze({sourceId:COPERNICUS_RJ_TASK,sourceUrl:COPERNICUS_RJ_URL,productId:raw.productId,publisher:'E.U. Copernicus Marine Service / Mercator Ocean',kind:'MODEL_FORECAST_NOT_OBSERVATION',scope:'OFFSHORE_POINT_NOT_COASTAL_BEACH',verticalDatum:'MEAN_SEA_LEVEL_NOT_CHART_DATUM',issuedAt:null,issuanceTimeKnown:false,fetchedAt:new Date(fetched).toISOString(),products:Object.freeze(products),mayIssueWarning:false});
}
export async function probeCopernicusRjOcean({now=Date.now,env=process.env,run=runFile}={}){
 if(!env.COPERNICUSMARINE_SERVICE_USERNAME||!env.COPERNICUSMARINE_SERVICE_PASSWORD)fail('copernicus_credentials_missing');
 let stdout;
 try{({stdout}=await run(env.BLAISE_COPERNICUS_PYTHON||'/opt/copernicus/bin/python',[fileURLToPath(new URL('./copernicus-rj-collect.py',import.meta.url))],{env,timeout:55000,maxBuffer:65536,killSignal:'SIGKILL'}));}
 catch(error){
  // Only a bounded machine code from the child JSON; never stderr/message/token URLs.
  let code;try{code=JSON.parse(error.stdout).errorCode;}catch{}
  if(typeof code==='string'&&/^copernicus_[a-z_]{1,100}$/.test(code))fail(code);
  fail('copernicus_collection_failed');
 }
 let raw;try{raw=JSON.parse(stdout);}catch{fail('copernicus_response_invalid');}
 return parseCopernicusRjOcean(raw,{now:now()});
}
export function createCopernicusRjCache({now=Date.now}={}){
 let snapshot=null,error=null;
 return {recordSuccess(s){snapshot=parseCopernicusRjOcean({productId:s.productId,fetchedAt:s.fetchedAt,products:s.products},{now:now()});error=null;},recordFailure(code){error=code;},read(){
  let current=null;if(snapshot&&!error)try{current=parseCopernicusRjOcean(snapshot,{now:now()});}catch{}
  return {sourceId:COPERNICUS_RJ_TASK,state:current?'FORECAST_VALID_TIME_ISSUANCE_UNKNOWN':'UNAVAILABLE',reason:error??'hourly_model_not_sensor_msl_datum',fetchedAt:snapshot?.fetchedAt??null,snapshot:current};
 }};
}
