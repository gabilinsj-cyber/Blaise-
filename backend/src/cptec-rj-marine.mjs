import {fetchTextContract} from './source-contract.mjs';
export const CPTEC_MARINE_TASK_ID='cptec-rj-wave-forecast';
export const CPTEC_MARINE_URL='https://servicos.cptec.inpe.br/XML/cidade/241/todos/tempos/ondas.xml';
const fail=code=>{throw Object.assign(new Error(code),{code});};
function tag(xml,name){const m=xml.match(new RegExp('<'+name+'>([^<>]*)</'+name+'>','i'));return m?.[1]?.trim()??null;}
function number(xml,name,min,max){const v=tag(xml,name);if(v===null||v==='-999')return null;if(!/^\d+(\.\d+)?$/.test(v))fail('cptec_marine_invalid_number');const n=Number(v);if(n<min||n>max)fail('cptec_marine_invalid_range');return n;}
function dateOnly(raw){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw??'');if(!m)fail('cptec_marine_publication_date_missing');const iso=m[0]+'T00:00:00.000Z';if(new Date(iso).toISOString()!==iso)fail('cptec_marine_invalid_date');return m[0];}
export function parseCptecRioWaves(xml,{now=Date.now()}={}){
 if(typeof xml!=='string'||xml.length>128000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!Number.isFinite(now))fail('cptec_marine_invalid_document');
 if(tag(xml,'nome')!=='Rio de Janeiro'||tag(xml,'uf')!=='RJ')fail('cptec_marine_wrong_locality');
 const publicationDate=dateOnly(tag(xml,'atualizacao'));
 const date=Date.parse(publicationDate+'T00:00:00Z');
 if(date>now||now-date>48*3600000)fail('cptec_marine_outdated_publication');
 const directions=new Set(['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']);
 const forecasts=[...xml.matchAll(/<previsao>([\s\S]*?)<\/previsao>/gi)].map(([,row])=>{
  const m=/^(\d{2})-(\d{2})-(\d{4}) (\d{2})h Z$/.exec(tag(row,'dia')??'');
  if(!m)fail('cptec_marine_invalid_valid_time');
  const validAt=`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00:00.000Z`;
  if(!Number.isFinite(Date.parse(validAt))||new Date(validAt).toISOString()!==validAt)fail('cptec_marine_invalid_valid_time');
  const direction=tag(row,'direcao');if(direction!==null&&!directions.has(direction))fail('cptec_marine_invalid_direction');
  return Object.freeze({validAt,waveHeightM:number(row,'altura',0,30),waveDirection:direction,windKmh:number(row,'vento',0,400)});
 }).filter(f=>Date.parse(f.validAt)>=now-3*3600000&&Date.parse(f.validAt)<=now+6*86400000);
 if(!forecasts.length||forecasts.length>56||new Set(forecasts.map(f=>f.validAt)).size!==forecasts.length)fail('cptec_marine_forecast_window_missing');
 return Object.freeze({sourceId:CPTEC_MARINE_TASK_ID,sourceUrl:CPTEC_MARINE_URL,ibge:'3304557',kind:'MODEL_FORECAST_NOT_OBSERVATION',publicationDate,publicationTimeKnown:false,fetchedAt:new Date(now).toISOString(),forecasts:Object.freeze(forecasts),providesTides:false,providesCurrents:false,providesSeaTemperature:false,mayIssueWarning:false});
}
export async function probeCptecRioWaves({fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
 const xml=await fetchTextContract(CPTEC_MARINE_URL,{allowedHosts:['servicos.cptec.inpe.br'],fetchImpl,timeoutMs:8000,maxBytes:128000});
 return parseCptecRioWaves(xml,{now:now()});
}
export function createCptecMarineCache({now=()=>Date.now()}={}){
 let snapshot=null,lastErrorCode=null,lastAttemptAt=null;
 return {recordSuccess(s){snapshot=s;lastErrorCode=null;lastAttemptAt=new Date(now()).toISOString();},recordFailure(code){lastErrorCode=code;lastAttemptAt=new Date(now()).toISOString();},read(){const at=now(),stamp=Date.parse(snapshot?.fetchedAt);const usable=!!snapshot&&!lastErrorCode&&at-stamp>=0&&at-stamp<=300000&&at-Date.parse(snapshot.publicationDate+'T00:00:00Z')<=48*3600000&&snapshot.forecasts.some(f=>Date.parse(f.validAt)>=at);return {sourceId:CPTEC_MARINE_TASK_ID,state:usable?'CURRENT_FORECAST':'UNAVAILABLE',reason:lastErrorCode??(usable?'forecast_not_sensor':'no_recent_forecast'),lastErrorCode,lastAttemptAt,fetchedAt:snapshot?.fetchedAt??null,snapshot:usable?snapshot:null};}};
}
