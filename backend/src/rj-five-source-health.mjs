/**
 * Public, read-only operational evidence for the five main RJ weather sources.
 * Product-specific: a siren map is NOT temperature measurements; INMET CAP
 * warnings are NOT INMET station observations. INPE and Windy have no
 * instrumented, licensed live adapters until they are separately connected.
 *
 * No subscriber, private location, source payload or credentials are exposed.
 */
import {
  ALERTA_RIO_RAINFALL_TASK_ID,
  DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
  INMET_WARNINGS_TASK_ID,
} from './official-source-worker.mjs';

export const RJ_FIVE_SOURCE_HEALTH_CONTRACT = 'BLAISE_RJ_FIVE_SOURCE_HEALTH_V1';

const SOURCE_CATALOG = Object.freeze([
  Object.freeze({id:'alerta-rio',label:'Alerta Rio',taskId:ALERTA_RIO_RAINFALL_TASK_ID,
    product:'CHUVA_REDE_DE_ESTACOES',kind:'OFFICIAL_OBSERVATION',coverage:'RIO_CITY_ONLY'}),
  Object.freeze({id:'defesa-civil',label:'Defesa Civil RJ',taskId:DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
    product:'ATIVOS_GEOGRAFICOS_SIRENES_E_APOIO',kind:'OFFICIAL_GEOGRAPHIC_ASSETS',
    coverage:'CITY_OF_RIO_ONLY_NOT_ALL_DEFESA_CIVIL'}),
  Object.freeze({id:'inmet',label:'INMET',taskId:INMET_WARNINGS_TASK_ID,
    product:'AVISOS_CAP',kind:'OFFICIAL_WARNINGS',coverage:'RJ_BY_EXACT_IBGE_WHEN_AVAILABLE'}),
  Object.freeze({id:'inpe-cptec',label:'INPE/CPTEC',taskId:null,
    product:null,kind:'FORECAST_PRODUCTS_NOT_STATION_OBSERVATIONS',
    coverage:'RJ_MODEL_GRID_AS_LICENSED'}),
  Object.freeze({id:'windy',label:'Windy',taskId:null,
    product:null,kind:'COMPARATIVE_FORECAST_MODELS_NOT_OBSERVATIONS',
    coverage:'RJ_MODEL_GRID_AS_LICENSED'}),
]);

export function buildRjFiveSourceHealth(worker,{nowMillis=Date.now()}={}) {
  if(!worker||typeof worker.status!=='function'||typeof worker.readSource!=='function'
    ||!Number.isFinite(nowMillis)||nowMillis<0)
    throw new TypeError('rj_five_source_health_invalid_input');
  const status=worker.status();
  const operating=status?.enabled===true&&status?.started===true;
  const sources=SOURCE_CATALOG.map(source=>{
    let state='NOT_CONNECTED',lastObservedAt=null;
    if(operating&&source.taskId) {
      let reading=null;
      try { reading=worker.readSource(source.taskId); }catch{ /* fail closed */ }
      const age=Date.parse(reading?.fetchedAt);
      const observed=Date.parse(reading?.observedAt);
      const fresh=Number.isFinite(age)&&age<=nowMillis
        &&nowMillis-age<=15*60_000;
      if(reading&&fresh&&['CURRENT','CURRENT_DEGRADED'].includes(reading.state)
        &&reading.snapshot&&typeof reading.snapshot==='object') {
        state='CURRENT_PRODUCT_ONLY';
        if(Number.isFinite(observed)&&observed<=nowMillis) {
          lastObservedAt=new Date(observed).toISOString();
        } else {
          lastObservedAt=new Date(age).toISOString();
        }
      }else if(reading&&['STALE','CURRENT','CURRENT_DEGRADED'].includes(reading.state)) {
        state='STALE_OR_UNVERIFIED';
      }
    }
    return Object.freeze({
      id:source.id,label:source.label,product:source.product,kind:source.kind,
      coverage:source.coverage,status:state,observedAt:lastObservedAt,
      provenRealTimeFor92Cities:false,temperatureServiceConnected:false,
      radarFramesConnected:false,
      activeForecastIntegration:source.id==='inpe-cptec'||source.id==='windy'?false:null,
    });
  });
  return Object.freeze({
    contract:RJ_FIVE_SOURCE_HEALTH_CONTRACT,
    generatedAt:new Date(nowMillis).toISOString(),
    workerRunning:operating,
    scope:'RJ_92_MUNICIPALITIES_BY_VERIFIED_COVERAGE',
    sources:Object.freeze(sources),
    fiveSimultaneousLiveFeedsConfirmed:false,
    weatherRadarSpatialFramesConfirmed:false,
    noSubstitutedStateMeasurements:true,
  });
}
