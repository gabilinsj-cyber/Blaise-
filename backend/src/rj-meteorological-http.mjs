/**
 * Blaise V6 RJ — bounded public READ-ONLY weather endpoint.
 * Source observations are checked against the hierarchical Fusion resolver.
 * No Google Play purchase token is required for public source metadata.
 *
 * IMPORTANT: This is wired but DISABLED unless both the endpoint and the
 * applicable source terms were explicitly approved by the operator.
 */
import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { consultRjSourcesUntilTwo } from './rj-hierarchical-weather-resolution.mjs';

export const RJ_METEOROLOGY_PATH = '/v1/public/rj-meteorology';
export const RJ_METEOROLOGY_CONTRACT = 'BLAISE_RJ_OFFICIAL_METEOROLOGY_V1';
export const RJ_METEOROLOGY_MAX_BYTES = 16*1024;
const RJ_IBGES = new Set(RJ_MUNICIPALITIES.map(city=>city.ibge));
const VARIABLES = new Set([
  'TEMPERATURA_C','UMIDADE_PERCENTUAL','VENTO_KMH','RAJADA_KMH','CHUVA_MM_1H',
]);
const keys=['ibge','variable'];
export function parseRjMeteorologyQuery(url) {
  if(typeof url!=='string'||url.length>400)throw TypeError('invalid_rj_meteorology_request');
  const parsed=new URL(url,'https://blaise.invalid');
  if(parsed.pathname!==RJ_METEOROLOGY_PATH || parsed.searchParams.size!==2
    ||[...parsed.searchParams.keys()].some(x=>!keys.includes(x))
    ||new Set(parsed.searchParams.keys()).size!==2
    ||parsed.hash)throw TypeError('invalid_rj_meteorology_query');
  const ibge=parsed.searchParams.get('ibge'),variable=parsed.searchParams.get('variable');
  if(!RJ_IBGES.has(ibge)||!VARIABLES.has(variable))
    throw TypeError('invalid_rj_meteorology_city_or_variable');
  return Object.freeze({ibge,variable});
}
function sourceForDisplay(result) {
  const seen=new Set();
  const rows=[
    ...(result.sourcePairForDisplay||[]),
    ...(result.officialReadings||[]),
    ...(result.state==='ONE_VERIFIED_OFFICIAL_SOURCE'||result.state==='ONE_OFFICIAL_PLUS_FORECAST_CONTEXT'
      ? (result.sourcePairForDisplay||[]) : []),
  ];
  // The SOURCE type is required. Do not accidentally treat forecasts as a
  // second measured source during serialization.
  return Object.freeze(rows.filter(row=>{
    const id=`${row.sourceId}:${row.stationId||row.productId||'noid'}:${row.observedAt||row.validAt}`;
    if(seen.has(id))return false;seen.add(id);return true;
  }).slice(0,12).map(row=>Object.freeze({
    sourceId:row.sourceId, dataType:row.dataType||row.readingType||'OFFICIAL_STATION_OBSERVATION',
    stationId:row.stationId||null, productId:row.productId||null,
    value:row.value,unit:row.unit, observedAt:row.observedAt||null,
    forecastValidAt:row.validAt||null,sourceUrl:row.sourceUrl||null,
  })));
}
export function createRjMeteorologicalService({
  inmetAdapter, otherAdapters={},now=()=>Date.now(),
}={}) {
  if(!inmetAdapter || typeof inmetAdapter.read!=='function'
    ||typeof now!=='function'||!otherAdapters||typeof otherAdapters!=='object')
    throw TypeError('invalid_rj_weather_service');
  const adapters={
    INMET_STATION:({ibge,variable})=>inmetAdapter.read({ibge,variable}),
    ...otherAdapters,
  };
  return Object.freeze({
    async read({ibge,variable}) {
      if(!RJ_IBGES.has(String(ibge))||!VARIABLES.has(variable))
        throw TypeError('invalid_rj_meteorology_city_or_variable');
      const timestamp=now();
      const result=await consultRjSourcesUntilTwo({
        ibge:String(ibge),variable,adapters,now:timestamp,
      });
      const sourceRows=sourceForDisplay(result);
      if(result.state==='ONE_VERIFIED_OFFICIAL_SOURCE' && result.value!==null
        && sourceRows.length===0) {
        // The resolver's single-source response has no sourcePairForDisplay.
        // Project its own provenanced single-station record, never a city mean.
        sourceRows.push?.(); // no-op: preserve frozen projection below
      }
      const observedSources=result.state==='ONE_VERIFIED_OFFICIAL_SOURCE'
        ? Object.freeze([Object.freeze({
          sourceId:result.selectedSourceIds[0],dataType:'OFFICIAL_STATION_OBSERVATION',
          stationId:result.selectedStationIds?.[0]||null,productId:null,
          value:result.value,unit:result.unit,observedAt:result.observedAt||null,
          forecastValidAt:null,sourceUrl:result.sourceUrl||null,
        })]):sourceRows;
      return Object.freeze({
        contract:RJ_METEOROLOGY_CONTRACT,
        scope:'RJ_MUNICIPAL_STATION_OR_MODEL_NOT_CITYWIDE_AVERAGE',
        ibge:String(ibge),variable,generatedAt:new Date(timestamp).toISOString(),
        state:result.state,resultKind:result.resultKind,
        value:result.value,unit:result.unit,
        sourceRows:observedSources,
        sourceIds:result.selectedSourceIds,
        searchedSourceIds:result.examinedSourceIds||[],
        hasConfirmedPair:result.state==='TWO_COMPATIBLE_OFFICIAL_SOURCES',
        isMunicipalAverage:false,
        warnsAutomatically:false,
        warningsPublished:0,
        weatherDataHasNotBeenSynthesized:true,
        sourceAccess:'CONFIGURATION_AND_PRODUCTS_MUST_BE_APPROVED',
      });
    },
  });
}
function send(res,code,payload) {
  const body=JSON.stringify(payload);
  if(Buffer.byteLength(body,'utf8')>RJ_METEOROLOGY_MAX_BYTES)
    throw TypeError('rj_meteorology_response_too_large');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Referrer-Policy','no-referrer');
  res.statusCode=code;
  res.end(body);
}
export function createRjMeteorologicalHandler(delegate, {
  service,enabled=false,termsApproved=false,
}={}) {
  if(typeof delegate!=='function'||!service||typeof service.read!=='function'
    ||typeof enabled!=='boolean'||typeof termsApproved!=='boolean')
    throw TypeError('rj_meteorology_invalid_configuration');
  return async (req,res)=>{
    const path=String(req?.url||'').split('?',1)[0];
    if(path!==RJ_METEOROLOGY_PATH ||!enabled||!termsApproved)
      return delegate(req,res);
    if(req.method!=='GET'){
      send(res,405,{error:'method_not_allowed'});return;
    }
    let args;
    try{args=parseRjMeteorologyQuery(req.url)}
    catch{send(res,400,{error:'invalid_rj_meteorology_query'});return}
    try {
      const result=await service.read(args);
      if(result.value===null && result.sourceRows.length===0)
        send(res,503,{error:'no_verified_current_weather_source',ibge:args.ibge});
      else send(res,200,result);
    } catch {
      send(res,503,{error:'official_weather_integration_unavailable'});
    }
  };
}
