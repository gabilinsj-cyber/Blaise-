/**
 * Blaise V6 RJ — 2026-10-12, two weather source tables.
 *
 * Table 1: Alerta Rio (ONLY Rio city), regional Civil Defence, OpenWeatherMap.
 * Table 2: INPE/CPTEC, INMET, CEMADEN, Windy, NOAA.
 *
 * No official alert, municipal weather estimate, real-time data retrieval,
 * commercial permission or live deployment can be inferred from this policy.
 * A forecast cannot be averaged as though it were a station measurement.
 */
import { rjSourceRouting } from './rj-phenomenon-source-policy.mjs';
import { weightedOfficialMean } from './rj-scientific-calculator.mjs';

const RIO='3304557';
export const RJ_TWO_TABLES_VERSION='rj-two-tables-2026-10-12';
export const RJ_TABLE_1=Object.freeze([
  Object.freeze({id:'ALERTA_RIO',type:'OFFICIAL_OBSERVATION',scope:'RIO_CITY_ONLY'}),
  Object.freeze({id:'DEFESA_CIVIL_RJ_REGIONAL',type:'OFFICIAL_OBSERVATION',scope:'OFFICIAL_COVERAGE_ONLY'}),
  Object.freeze({id:'OPENWEATHERMAP_API',type:'FORECAST_OR_DERIVED_PRODUCT',scope:'PRODUCT_COVERAGE_AND_PERMISSION'}),
]);
export const RJ_TABLE_2=Object.freeze([
  Object.freeze({id:'INPE_CPTEC_FORECAST',type:'FORECAST_OR_SATELLITE_PRODUCT',scope:'PRODUCT_COVERAGE_AND_PERMISSION'}),
  Object.freeze({id:'INMET_STATION',type:'OFFICIAL_OBSERVATION',scope:'STATION_COVERAGE_ONLY'}),
  Object.freeze({id:'CEMADEN_RJ',type:'OFFICIAL_OBSERVATION',scope:'RAIN_HYDRO_STATION_COVERAGE_ONLY'}),
  Object.freeze({id:'WINDY_MODELO',type:'FORECAST_MODEL',scope:'PRODUCT_COVERAGE_AND_PERMISSION'}),
  Object.freeze({id:'NOAA',type:'FORECAST_OR_SATELLITE_PRODUCT',scope:'PRODUCT_COVERAGE_AND_PERMISSION'}),
]);
const RANGES=Object.freeze({
  TEMPERATURA_C:{phenomenon:'TEMPERATURA',unit:'°C',min:-30,max:60,tolerance:2},
  VENTO_KMH:{phenomenon:'VENTO',unit:'km/h',min:0,max:400,tolerance:12},
  RAJADA_KMH:{phenomenon:'RAJADA',unit:'km/h',min:0,max:400,tolerance:16},
  CHUVA_MM_1H:{phenomenon:'CHUVA_ACUMULADA',unit:'mm',min:0,max:400,tolerance:8},
  UMIDADE_PERCENTUAL:{phenomenon:'UMIDADE',unit:'%',min:0,max:100,tolerance:10},
});
const OBS=new Set(['ALERTA_RIO','DEFESA_CIVIL_RJ_REGIONAL','INMET_STATION','CEMADEN_RJ']);
const MODELS=new Set(['OPENWEATHERMAP_API','INPE_CPTEC_FORECAST','WINDY_MODELO','NOAA']);
const ALIASES=Object.freeze({
  ALERTA_RIO:'ALERTA_RIO',
  DEFESA_CIVIL:'DEFESA_CIVIL_RJ_REGIONAL',
  DEFESA_CIVIL_RJ_REGIONAL:'DEFESA_CIVIL_RJ_REGIONAL',
  INMET:'INMET_STATION',INMET_STATION:'INMET_STATION',
  CEMADEN:'CEMADEN_RJ',CEMADEN_RJ:'CEMADEN_RJ',
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const between=(x,a,b)=>finite(x)&&x>=a&&x<=b;
const when=s=>typeof s==='string'?Date.parse(s):NaN;
const rad=Math.PI/180;
function km(a,b) {
  const p=(b.latitude-a.latitude)*rad;
  const l=(b.longitude-a.longitude)*rad;
  const h=Math.sin(p/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(l/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
const blocked=(state,details={})=>Object.freeze({
  state,kind:'NOT_VERIFIED_MEASUREMENT',value:null,
  weightedMean:null,comparison:null,
  triggersOfficialAlert:false,claimsLiveIntegration:false,
  ...details,
});
function isValid(row,sourceId,kind,ibge,variable,spec,now) {
  if(!row||typeof row!=='object'||row.ibge==null)return false;
  if(String(row.ibge)!==String(ibge)||row.variable!==variable
     ||row.unit!==spec.unit||!between(row.value,spec.min,spec.max))return false;
  if(!row.sourceUrl?.startsWith('https://')
     ||row.usagePermissionStatus!=='VERIFIED_FOR_APP_DATA_DISPLAY')return false;
  if(kind==='OBSERVATION') {
    const stamp=when(row.observedAt);
    return row.origin==='OFFICIAL_OBSERVATION'&&ALIASES[row.sourceId]===sourceId
      &&OBS.has(sourceId) && (sourceId!=='ALERTA_RIO'||String(ibge)===RIO)
      &&(sourceId!=='CEMADEN_RJ'||variable==='CHUVA_MM_1H')
      &&between(row.latitude,-23.7,-20.4)&&between(row.longitude,-45.5,-40.4)
      &&typeof row.stationId==='string'&&row.stationId.length>=2
      &&between(row.weight,0.01,5)
      &&finite(stamp)&&now-stamp>=0&&now-stamp<=7_200_000
      &&(variable!=='CHUVA_MM_1H'||row.measurementWindowMinutes===60);
  }
  const issued=when(row.issuedAt),valid=when(row.validAt);
  return row.kind==='MODEL_FORECAST'&&row.sourceId===sourceId
    &&MODELS.has(sourceId)
    &&typeof row.productId==='string'&&row.productId.length>2
    &&typeof row.modelRunId==='string'&&row.modelRunId.length>2
    &&between(row.latitude,-23.7,-20.4)&&between(row.longitude,-45.5,-40.4)
    &&between(row.gridResolutionKm,0.1,40)
    &&finite(issued)&&now-issued>=0&&now-issued<=86_400_000
    &&finite(valid)&&Math.abs(valid-now)<=86_400_000
    &&(variable!=='CHUVA_MM_1H'||row.forecastWindowMinutes===60);
}
function publicReading(o,id) {
  return Object.freeze({sourceId:id,value:o.value,unit:o.unit,
    dataType:OBS.has(id)?'OFFICIAL_STATION_OBSERVATION':'FORECAST_MODEL_NOT_STATION',
    stationId:OBS.has(id)?o.stationId:null,
    productId:MODELS.has(id)?o.productId:null,
    observedAt:o.observedAt||null,validAt:o.validAt||null,
    sourceUrl:o.sourceUrl});
}
function compatible(a,b,variable,spec) {
  const aTime=when(a.observedAt||a.validAt);
  const bTime=when(b.observedAt||b.validAt);
  if(!finite(aTime)||!finite(bTime)||Math.abs(aTime-bTime)>900_000)return false;
  if(km(a,b)>25)return false;
  if(variable==='CHUVA_MM_1H'
    &&a.measurementWindowMinutes!==b.measurementWindowMinutes)return false;
  return Math.abs(a.value-b.value)<=spec.tolerance;
}

/**
 * INPE, INMET, CEMADEN, Windy and NOAA are queried in Table 2 order.
 * Two compatible verified, independent OBSERVATIONS permit an observed
 * weighted mean. One observed + one modeled product gives a source-labeled
 * comparison only (NEVER a weighted observed temperature).
 */
export function resolveRjTwoTables({
  ibge,variable,table1=[],table2=[],now=Date.now(),
}={}) {
  const spec=RANGES[variable];
  if(!spec)throw TypeError('rj_two_table_variable_unsupported');
  rjSourceRouting({ibge,phenomenon:spec.phenomenon});
  if(!finite(now)||!Array.isArray(table1)||!Array.isArray(table2)
     ||table1.length>80||table2.length>80)throw TypeError('rj_two_table_records_invalid');
  const tableOne=String(ibge)===RIO?RJ_TABLE_1:RJ_TABLE_1.filter(x=>x.id!=='ALERTA_RIO');
  const admitted=(records,source)=>{
    const kind=OBS.has(source.id)?'OBSERVATION':'FORECAST';
    return records.filter(v=>isValid(v,source.id,kind,ibge,variable,spec,now))
      .sort((a,b)=>when(b.observedAt||b.issuedAt)-when(a.observedAt||a.issuedAt))[0]||null;
  };
  const t1=tableOne.map(s=>({id:s.id,record:admitted(table1,s)}))
    .filter(e=>e.record);
  const measurements=t1.filter(x=>OBS.has(x.id));
  for(let i=0;i<measurements.length;i++)for(let j=i+1;j<measurements.length;j++) {
    const a=measurements[i],b=measurements[j];
    if(!compatible(a.record,b.record,variable,spec))continue;
    // Reject duplicated independent-looking inputs from the same underlying station.
    if(a.record.stationId===b.record.stationId)continue;
    const computed=weightedOfficialMean({
      observations:[{...a.record,sourceId:a.id},{...b.record,sourceId:b.id}],
      now,maxAgeMs:7_200_000,maxSkewMs:900_000,maxSeparationKm:25,
    });
    if(computed.state!=='CALCULO_EXPERIMENTAL_BLAISE')continue;
    return blocked('TABLE_1_TWO_COMPATIBLE_OFFICIAL_OBSERVATIONS',{
      kind:'BLAISE_WEIGHTED_OFFICIAL_OBSERVATION_ESTIMATE',
      value:computed.value,weightedMean:computed.value,unit:spec.unit,
      sourcePair:Object.freeze([publicReading(a.record,a.id),publicReading(b.record,b.id)]),
      reviewedTable2Sources:Object.freeze([]),observationalSourceCount:2,
      formula:computed.formula,
      notMunicipalMean:true,
    });
  }
  const inspected=[];
  const validT2=RJ_TABLE_2.map(src=>{
    inspected.push(src.id);
    return {id:src.id,record:admitted(table2,src)};
  }).filter(x=>x.record);
  const validT1=t1;
  // The source in Table 2 is the first compatible consultation result in
  // priority order. For non-observation models: NEVER pretend two sensors.
  for(const reference of validT2) {
    const eligible=validT1.filter(base=>base.id!==reference.id
      &&compatible(base.record,reference.record,variable,spec));
    if(!eligible.length)continue;
    // Prefer an independently measured source from Table 1 over a forecast.
    const choice=eligible.find(x=>OBS.has(x.id))||eligible[0];
    if(OBS.has(reference.id)&&OBS.has(choice.id)) {
      if(reference.record.stationId===choice.record.stationId)continue;
      const mean=weightedOfficialMean({
        observations:[{...choice.record,sourceId:choice.id},
          {...reference.record,sourceId:reference.id}],now,maxAgeMs:7_200_000,
      });
      if(mean.state!=='CALCULO_EXPERIMENTAL_BLAISE')continue;
      return blocked('TABLE_2_CONFIRMS_INDEPENDENT_OFFICIAL_OBSERVATION',{
        kind:'BLAISE_WEIGHTED_OFFICIAL_OBSERVATION_ESTIMATE',
        value:mean.value,weightedMean:mean.value,unit:spec.unit,
        sourcePair:Object.freeze([publicReading(choice.record,choice.id),
          publicReading(reference.record,reference.id)]),
        checkedTable2Sources:Object.freeze(inspected.slice(0,RJ_TABLE_2.findIndex(x=>x.id===reference.id)+1)),
        observationalSourceCount:2,formula:mean.formula,notMunicipalMean:true,
      });
    }
    return blocked('TABLE_2_MATCHES_TABLE_1_FOR_COMPARISON',{
      kind:'MIXED_PRODUCT_COMPARISON_NOT_WEIGHTED',
      unit:spec.unit,value:null,weightedMean:null,
      sourcePair:Object.freeze([publicReading(choice.record,choice.id),
        publicReading(reference.record,reference.id)]),
      checkedTable2Sources:Object.freeze(inspected.slice(0,RJ_TABLE_2.findIndex(x=>x.id===reference.id)+1)),
      comparison:Object.freeze({difference:Math.round(Math.abs(choice.record.value-reference.record.value)*100)/100,
        unit:spec.unit,interpretation:'MODEL_PROXIMITY_OR_PRODUCT_COMPARISON_NOT_PROOF_OF_SENSOR_ACCURACY'}),
      observationalSourceCount:OBS.has(choice.id)?1:0,
    });
  }
  // Transparently show actual sources when no comparable pair exists; do
  // NOT invent a weighted mean or a phantom second source.
  return blocked('NO_COMPATIBLE_PAIR_VERIFIED',{
    unit:spec.unit,sourcePair:Object.freeze([]),
    table1Available:Object.freeze(t1.map(x=>publicReading(x.record,x.id))),
    table2Available:Object.freeze(validT2.map(x=>publicReading(x.record,x.id))),
    checkedTable2Sources:Object.freeze(RJ_TABLE_2.map(x=>x.id)),
    reason:'NO_TWO_INDEPENDENT_COMPARABLE_PRODUCTS_FOR_REQUESTED_LOCALITY_TIME_VARIABLE',
  });
}
export function rjTwoTableCadencePolicy(level=1){
  if(!Number.isInteger(level)||level<1||level>5)throw RangeError('invalid_severity');
  return Object.freeze({
    level,
    recommendedRefreshMs:level>=4?60_000:level===3?60_000:300_000,
    severeTargetCollectMs:level>=4?30_000:null,
    severeTargetRecalculateMs:level>=4?30_000:null,
    actuallyScheduled:false,liveConnectorsVerified:false,
    caution:'Targets apply only when source publication cadence and access policies permit.',
  });
}
