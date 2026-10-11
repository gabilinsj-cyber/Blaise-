/**
 * Official RJ environmental product adapters. No scraping, no guessed endpoints.
 * Callers must supply a licensed, documented JSON product endpoint and permission.
 * Absence of a verified feed is an explicit UNAVAILABLE state.
 */
const CATALOG = Object.freeze({
  MONITORA_RJ_SES: Object.freeze({
    authority:'Secretaria de Estado de Saude do RJ',
    homepage:'https://monitorar.saude.rj.gov.br/',
    scope:'RJ_MUNICIPAL',kind:'HEAT_HEALTH_RISK',maxAgeMillis:6*60*60*1000,
    approvedHosts:Object.freeze(['monitorar.saude.rj.gov.br']),
  }),
  MONITORAR_RIO_SMAC: Object.freeze({
    authority:'Secretaria Municipal do Ambiente e Clima do Rio',
    homepage:'https://ambienteclima.prefeitura.rio/monitorar-2026-dados/',
    scope:'RIO_CITY_STATIONS',kind:'AIR_QUALITY_OR_METEOROLOGY',maxAgeMillis:3*60*60*1000,
    approvedHosts:Object.freeze(['ambienteclima.prefeitura.rio']),
  }),
});
export const RJ_NEW_OFFICIAL_SOURCES = CATALOG;
const unavailable=(id,reason)=>Object.freeze({sourceId:id,state:'UNAVAILABLE',reason,observations:Object.freeze([])});
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function allowedEndpoint(value,source) {
  if(typeof value!=='string')return false;
  try {const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
      source.approvedHosts.includes(u.hostname.toLowerCase())&&
      !/^(localhost|.*\.localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1)/i.test(u.hostname);
  }catch{return false;}
}
export function validateRjOfficialProduct(id,payload,{nowMillis=Date.now()}={}) {
  const source=CATALOG[id];
  if(!source)throw new TypeError('unknown_rj_official_source');
  if(!isObject(payload)||!Array.isArray(payload.observations)||!Number.isFinite(nowMillis))
    return unavailable(id,'INVALID_CONTRACT');
  const accepted=[];
  for(const item of payload.observations) {
    if(!isObject(item)||item.sourceId!==id||!allowedEndpoint(item.sourceUrl,source)||
      typeof item.observedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(item.observedAt))
      continue;
    const timestamp=Date.parse(item.observedAt);
    if(!Number.isFinite(timestamp)||timestamp>nowMillis+5*60*1000||
      nowMillis-timestamp>source.maxAgeMillis||!/^33\d{5}$/.test(String(item.ibge)))continue;
    if(id==='MONITORA_RJ_SES') {
      if(!/^33\d{5}$/.test(String(item.ibge))||typeof item.riskLabel!=='string'||
        item.riskLabel.length<1||item.riskLabel.length>80||
        item.productKind!=='HEAT_HEALTH_RISK')continue;
    }else{
      if(String(item.ibge)!=='3304557'||typeof item.stationId!=='string'||
        item.stationId.length<1||item.stationId.length>80||
        !['AIR_QUALITY','METEOROLOGY'].includes(item.productKind))continue;
    }
    accepted.push(Object.freeze({
      sourceId:id,sourceUrl:item.sourceUrl,observedAt:item.observedAt,
      ibge:String(item.ibge),productKind:item.productKind,
      stationId:id==='MONITORAR_RIO_SMAC'?item.stationId:null,
      riskLabel:id==='MONITORA_RJ_SES'?item.riskLabel:null,
      // The SES heat product may reuse INMET: never treat as independent evidence.
      independence:id==='MONITORA_RJ_SES'?'NOT_INDEPENDENT_OF_INMET_UNTIL_PROVEN':'UNVERIFIED',
      verification:'SCHEMA_AND_FRESHNESS_ONLY',
    }));
  }
  if(!accepted.length)return unavailable(id,'NO_FRESH_VERIFIABLE_RECORDS');
  return Object.freeze({sourceId:id,state:'CANDIDATE_VALIDATED_NOT_AUTHORIZED_FOR_ALERTS',
    observations:Object.freeze(accepted)});
}
export async function collectRjOfficialProduct(id,{
  endpoint,licensed=false,fetcher,nowMillis=Date.now(),
}={}) {
  if(!CATALOG[id])throw new TypeError('unknown_rj_official_source');
  if(!licensed)return unavailable(id,'LICENSE_NOT_APPROVED');
  if(!allowedEndpoint(endpoint,CATALOG[id]))return unavailable(id,'VERIFIED_HTTPS_ENDPOINT_REQUIRED');
  if(typeof fetcher!=='function')return unavailable(id,'FETCHER_NOT_CONFIGURED');
  try {
    const payload=await fetcher(endpoint,{sourceId:id,timeoutMillis:8000});
    return validateRjOfficialProduct(id,payload,{nowMillis});
  }catch{return unavailable(id,'OFFICIAL_FETCH_FAILED');}
}
