import {createHash} from 'node:crypto';
import {RJ_TABLE1_THREE,RJ_TABLE2_FIVE} from './rj-table12-five-source-dispute.mjs';

/** One versioned result for all presentation consumers; never re-average it in the UI. */
export function canonicalRjWeatherSnapshot(decision,{ibge,variable,now=Date.now()}={}) {
  if(!Number.isFinite(now))throw TypeError('canonical_clock_invalid');
  const readings=decision?.measurementPair??decision?.readingAndForecast??[];
  if(readings.some(r=>r.ibge!==String(ibge)||r.variable!==variable))
    throw TypeError('canonical_city_or_variable_mismatch');
  const ids=decision?.selectedSources??[];
  const secondary=ids.filter(id=>RJ_TABLE2_FIVE.includes(id));
  const hasPrimary=ids.some(id=>RJ_TABLE1_THREE.includes(id));
  const secondaryOnlyPair=ids.length===2&&secondary.length===2&&new Set(ids).size===2;
  if(hasPrimary?secondary.length>1:secondary.length>0&&!secondaryOnlyPair)
    throw TypeError('canonical_requires_table1_and_at_most_one_table2');
  const weighted=decision?.weighted===true&&decision.state==='TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS';
  const observations=readings.filter(r=>r.type==='OBSERVED_STATION');
  // A combined measurement is only as current as its oldest contributor.
  const times=observations.map(r=>Date.parse(r.observedAt));
  const current=times.length>0&&times.every(t=>Number.isFinite(t)&&now-t>=0&&now-t<=300_000);
  const observedAt=times.length&&times.every(Number.isFinite)
    ?new Date(Math.min(...times)).toISOString():null;
  const value=weighted&&observations.length===2&&current&&Number.isFinite(decision.estimatedValue)
    ?decision.estimatedValue:null;
  const provenance=observations.map(r=>Object.freeze({...r}));
  const identity={ibge:String(ibge),variable,value,observedAt,sourceIds:[...ids],provenance};
  return Object.freeze({
    contract:'BLAISE_RJ_CANONICAL_WEATHER_SNAPSHOT_V1',
    snapshotId:createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
    ...identity,sourceIds:Object.freeze(identity.sourceIds),provenance:Object.freeze(provenance),
    asOf:new Date(now).toISOString(),
    nature:value!==null?'WEIGHTED_OBSERVATIONS':'READINGS_OR_MODEL_CONTEXT_NOT_WEIGHTED',
    selectedTable2Source:secondary.length===1?secondary[0]:null,
    selectedTable2Sources:Object.freeze([...secondary]),
    resolutionMode:hasPrimary?(secondary.length?'TABLE1_PLUS_ONE_TABLE2':'TABLE1'):'TABLE2_ONLY',
    formula:value!==null?decision.formula:null,
    connectorFailures:Object.freeze([...(decision.connectorFailures??[])]),
    sourceTimestampsNeverRenewed:true,
    mayIssueWarning:false,
  });
}

/** Municipal/variable isolation and a bounded hourly audit trail, called by the executor. */
export function createRjCanonicalWeatherLedger() {
  const records=new Map(),audit=[];
  let lastAudit=-Infinity;
  const key=(ibge,variable)=>`${ibge}:${variable}`;
  function record(ibge,variable,reason,now) {
    audit.push(Object.freeze({ibge:String(ibge),variable,reason,checkedAt:new Date(now).toISOString()}));
    if(audit.length>256)audit.shift();
  }
  function publish(snapshot,now) {
    if(!Number.isFinite(now))throw TypeError('canonical_clock_invalid');
    if(snapshot?.contract!=='BLAISE_RJ_CANONICAL_WEATHER_SNAPSHOT_V1')throw TypeError('canonical_contract_invalid');
    records.set(key(snapshot.ibge,snapshot.variable),snapshot);
    if(records.size>92*6)records.delete(records.keys().next().value);
    for(const sourceId of snapshot.connectorFailures??[])record(snapshot.ibge,snapshot.variable,'SOURCE_CONNECTOR_FAILURE:'+sourceId,now);
    if(snapshot.value===null)record(snapshot.ibge,snapshot.variable,'NO_VERIFIED_WEIGHTED_VALUE',now);
    return snapshot;
  }
  function read(ibge,variable,now) {
    if(!Number.isFinite(now))throw TypeError('canonical_clock_invalid');
    const snapshot=records.get(key(ibge,variable));
    if(!snapshot)return null;
    const times=snapshot.provenance.map(r=>Date.parse(r.observedAt));
    if(!times.length||times.some(t=>!Number.isFinite(t)||now-t<0||now-t>300_000))return null;
    return snapshot;
  }
  function auditHourly(now) {
    if(!Number.isFinite(now))throw TypeError('canonical_clock_invalid');
    if(now-lastAudit<3_600_000)return false;
    lastAudit=now;
    for(const snapshot of records.values())record(snapshot.ibge,snapshot.variable,
      read(snapshot.ibge,snapshot.variable,now)?'HOURLY_SOURCE_AND_CITY_CHECK_CURRENT':'HOURLY_SOURCE_DELAYED_OR_UNAVAILABLE',now);
    return true;
  }
  return Object.freeze({publish,read,auditHourly,audits:()=>Object.freeze([...audit])});
}
