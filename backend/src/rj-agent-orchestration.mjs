/**
 * Deterministic and SAFE orchestration plan for Blaise V6 RJ's ten agents.
 * No external fetches, no unattended PR merges, no purchases and NO warning
 * publishing. Actual executor must be enabled only with proven infrastructure.
 */
import { BLAISE_RJ_AGENTS, rjCadenceForLevel } from './rj-agent-registry.mjs';
import { rjSourceRouting } from './rj-phenomenon-source-policy.mjs';
import { consultRjSourcesUntilTwo } from './rj-hierarchical-weather-resolution.mjs';
import { createRjInmetLiveAdapters } from './rj-inmet-live-hierarchy-adapter.mjs';
import { linkedRjDisputeSteps, RJ_METEO_MARINE_TABLE } from './rj-meteorological-homologation.mjs';
import { RJ_TABLE1_THREE, RJ_TABLE2_FIVE } from './rj-canonical-table-sources.mjs';

const ALL = Object.freeze(BLAISE_RJ_AGENTS.map(a=>a.number));
const HYDRO = new Set(['CHUVA_ACUMULADA','RISCO_HIDROLOGICO','VAZAO_RIO','DESLIZAMENTO','ALAGAMENTO']);
const OCEAN = new Set(['RESSACA','ONDAS','CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','MASSA_AR','TSUNAMI']);
const TRACK = new Set(['TEMPORAL','TEMPESTADE','CICLONE_EXTRATROPICAL','GRANIZO','FRENTE_FRIA']);
const DIAGNOSTIC = new Set(['TEMPERATURA','SENSACAO_TERMICA','UMIDADE','VENTO','RAJADA','CHUVA_ACUMULADA',
  'TEMPORAL','TEMPESTADE','CICLONE_EXTRATROPICAL','MASSA_AR','GRANIZO','FRENTE_FRIA']);
export const RJ_10_AGENT_PLAN_VERSION = 'rj-10-agent-plan-2026-10-10';

/**
 * Static policy routing. "SCHEDULED" would be an incorrect claim: agent
 * descriptions and registries are not a deployed service.
 */
export function planRjPhenomenonCase({ibge=null,phenomenon,region='MUNICIPAL',level=1}={}) {
  const routing=rjSourceRouting({ibge,phenomenon,region});
  const cadence=rjCadenceForLevel(level);
  const relevant=new Set([1,8,9,10]); // Always validate, audit, security and scale review.
  if(DIAGNOSTIC.has(phenomenon)) { relevant.add(2); relevant.add(3); }
  if(TRACK.has(phenomenon)) relevant.add(4);
  if(HYDRO.has(phenomenon)) relevant.add(5);
  if(OCEAN.has(phenomenon)||region!=='MUNICIPAL') relevant.add(6);
  if(phenomenon==='RADAR') { relevant.add(2); relevant.add(4); }
  if(phenomenon==='SISMO'||phenomenon==='TSUNAMI') relevant.add(7);
  // Seismic and tsunami source routing is a separate product input requiring
  // authoritative earthquake+tsunami contracts before dispatching Agent 7.
  const participants=BLAISE_RJ_AGENTS.filter(a=>relevant.has(a.number)).map(a=>Object.freeze({
    number:a.number,id:a.id,name:a.name,
    runtimeStatus:a.runtimeStatus,
    reason:a.number===1?'SOURCE_VALIDATION':a.number===8?'AUDIT_AND_CONSISTENCY':
      a.number===9?'REGRESSION_AND_INTEGRITY_REVIEW':
      a.number===10?'SECURITY_AND_SCALING_REVIEW':'DOMAIN_SCIENCE_AND_CALCULATION',
  }));
  return Object.freeze({
    project:'Blaise V6 RJ',
    version:RJ_10_AGENT_PLAN_VERSION,
    municipalitySelectionCoverage:92,
    requestedPhenomenon:phenomenon,
    locality:routing.locality,
    linkedTable1Phenomenon:phenomenon,
    applicableTable2StepCodes:Object.freeze(
      linkedRjDisputeSteps(phenomenon).map(step=>step.code)),
    linkedMaritimeCategories:Object.freeze(RJ_METEO_MARINE_TABLE.filter(
      row=>row.phenomena.includes(phenomenon)).map(row=>row.code)),
    weightedObservationalMeanAllowedByPhenomenon:linkedRjDisputeSteps(phenomenon).some(
      step=>step.code==='PONDERACAO_COMPATIVEL' &&
        !['SENSACAO_TERMICA'].includes(phenomenon)),
    level,
    eligibleSources:routing.sources,
    sourceStatus:'NOT_CONFIRMED_LIVE',
    autoSourcePolling:false,
    calculatedValues:null,
    sourceRecency:'NOT_CONFIRMED',
    estimatedArrivalTime:null,
    severityEscalation:'NOT_AUTHORIZED_BY_POLICY_ROUTING',
    audibleAlert:false,
    publishersTriggered:false,
    purchasesTriggered:false,
    cadence,
    agents:Object.freeze(participants),
    rosterNumbers:ALL,
    nextAction:'VERIFY_LIVE_OFFICIAL_SOURCE_TIME_SCOPE_LICENSE_AND_PHYSICS_INPUTS',
  });
}

/**
 * Blaise Sentinel (1) -> Fusion (3) -> Vector (2) processing contract.
 * Authorized, live source adapters must be registered separately by the
 * deploying backend; this function does not claim any connector is running.
 */
export async function reconcileRjWeatherCase({
  ibge, variable, level=1, adapters={}, now=Date.now(),
}={}) {
  const phenomenonByVariable = Object.freeze({
    TEMPERATURA_C:'TEMPERATURA',
    VENTO_KMH:'VENTO',
    RAJADA_KMH:'RAJADA',
    CHUVA_MM_1H:'CHUVA_ACUMULADA',
    UMIDADE_PERCENTUAL:'UMIDADE',
    PRESSAO_HPA:'PRESSAO_ATMOSFERICA',
  });
  if(!Object.hasOwn(phenomenonByVariable,variable))
    throw new TypeError('rj_unsupported_weather_variable');
  const policyPlan=planRjPhenomenonCase({
    ibge,phenomenon:phenomenonByVariable[variable],level,
  });
  const determination=await consultRjSourcesUntilTwo({
    ibge,variable,adapters,now,
  });
  return Object.freeze({
    ...policyPlan,
    reconciliationVersion:'rj-two-compatible-2026-10-10-v1',
    dataHandlingAgents:Object.freeze([1,3,2,8]),
    latestVerifiedResult:determination,
    resultKind:determination.resultKind,
    verifiedSourceCount:determination.selectedSourceIds.length,
    observedOfficialReadingCount:determination.officialReadings?.length ??
      (determination.officialMeasurement ? 1 : 0),
    officialReadingsForDisplay:determination.officialReadings ?? null,
    modelTieBreakEvidence:determination.modelTieBreak ?? null,
    inpeConsultationEvidence:determination.inpeConsultation ?? null,
    twoSourceDisplay:determination.sourcePairForDisplay ?? null,
    sourcePairContainsForecast:determination.sourcePairForDisplay?.some(
      x=>x.dataType==='MODEL_FORECAST_NOT_A_MEASURED_STATION') ?? false,
    showBothDiscrepantSources:determination.showBothSourceMeasurements === true,
    observedOrEstimatedValue:determination.value,
    calculatedValues:determination.resultKind==='CALCULO_BLAISE_SOBRE_DUAS_MEDICOES_OFICIAIS'
      ||determination.resultKind==='PREVISAO_PONDERADA_BLAISE_NAO_OBSERVACAO'
      ?determination.value:null,
    sourceStatus:determination.state,
    audibleAlert:false,
    publishersTriggered:false,
    purchasesTriggered:false,
    sourcePollingState:'NO_AUTONOMOUS_SOURCE_CONNECTORS_REGISTERED_HERE',
  });
}

/**
 * Explicit on-demand integration entrypoint for Sentinel/Fusion/Vector:
 * builds the real INMET adapter once (caching bounded station responses),
 * then passes it together with independently provided source adapters to
 * the validated two-source hierarchy. No background polling, publication,
 * paid entitlement or emergency alert is started by this function.
 *
 * Defaults must remain disabled until product-specific rights and actual
 * live source responses are verified by the operator.
 */
export function createRjWeatherSourceExecutor({
  inmetLive={enabled:false,usageApproved:false},
  sourceAdapters={},
  clock=()=>Date.now(),
}={}) {
  if(!sourceAdapters||typeof sourceAdapters!=='object'||Array.isArray(sourceAdapters)
    ||typeof clock!=='function')throw TypeError('rj_weather_executor_invalid_configuration');
  const inmet=createRjInmetLiveAdapters(inmetLive);
  const adapters=Object.freeze({...sourceAdapters,INMET_STATION:inmet.INMET_STATION});
  return async ({ibge,variable,level=1,now=clock()}={})=>
    reconcileRjWeatherCase({ibge,variable,level,adapters,now});
}

/**
 * Opt-in Table 1 -> Table 2 operational calculator entrypoint.
 * It follows the new two-of-three first, five-source conditional arbitration
 * without replacing the pre-existing legacy executor or silently deploying a
 * polling service. All external adapters must be independently authorized.
 */
export async function reconcileRjTable12Case({
  ibge,variable,level=1,adapters={},now=Date.now(),
}={}) {
  const variablePhenomena=Object.freeze({
    TEMPERATURA_C:'TEMPERATURA',
    UMIDADE_PERCENTUAL:'UMIDADE',
    VENTO_KMH:'VENTO',
    RAJADA_KMH:'RAJADA',
    CHUVA_MM_1H:'CHUVA_ACUMULADA',
    PRESSAO_HPA:'PRESSAO_ATMOSFERICA',
  });
  if(!Object.hasOwn(variablePhenomena,variable))
    throw new TypeError('rj_table12_not_a_numeric_observation_variable');
  const plan=planRjPhenomenonCase({
    ibge,phenomenon:variablePhenomena[variable],level,
  });
  const reconciliation=await consultRjTable12FiveSourceDispute({
    ibge,variable,adapters,now,
  });
  return Object.freeze({
    ...plan,
    sourcePolicy:'THREE_TABLE1_THEN_FIVE_TABLE2_CONDITIONAL',
    firstThreeSources:RJ_TABLE1_THREE,
    fallbackFiveSources:RJ_TABLE2_FIVE,
    table2ActuallyRequired:reconciliation.stage!=='TABLE_1_TWO_OF_THREE_CONVERGED',
    arbitration:reconciliation,
    resultKind:reconciliation.state,
    observedOrEstimatedValue:reconciliation.estimatedValue,
    estimatedValueIsNotOfficialMunicipalMeasurement:true,
    resultHasSourcePair:reconciliation.selectedSources.length===2,
    mathIsWeighted:reconciliation.weighted,
    noWarningOnCalculations:true,
    audibleAlert:false,
    publishersTriggered:false,
    purchasesTriggered:false,
    sourcePollingState:'SOURCE_ADAPTERS_ON_DEMAND_ONLY_NO_BACKGROUND_RUNTIME_DEPLOYED',
  });
}

export function createRjTable12SourceExecutor({
  inmetLive={enabled:false,usageApproved:false},
  sourceAdapters={},
  clock=()=>Date.now(),
}={}) {
  if(!sourceAdapters||typeof sourceAdapters!=='object'||Array.isArray(sourceAdapters)
    ||typeof clock!=='function')throw TypeError('rj_table12_executor_invalid');
  const inmet=createRjInmetLiveAdapters(inmetLive);
  const adapters=Object.freeze({...sourceAdapters,INMET_STATION:inmet.INMET_STATION});
  return ({ibge,variable,level=1,now=clock()}={})=>
    reconcileRjTable12Case({ibge,variable,level,adapters,now});
}
