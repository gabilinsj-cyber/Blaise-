/**
 * Deterministic and SAFE orchestration plan for Blaise V6 RJ's ten agents.
 * No external fetches, no unattended PR merges, no purchases and NO warning
 * publishing. Actual executor must be enabled only with proven infrastructure.
 */
import { BLAISE_RJ_AGENTS, rjCadenceForLevel } from './rj-agent-registry.mjs';
import { rjSourceRouting } from './rj-phenomenon-source-policy.mjs';

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
