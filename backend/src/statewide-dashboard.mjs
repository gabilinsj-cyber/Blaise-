import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';
import { RJ_SEAFRONT_MUNICIPALITIES } from './rj-seafront-municipalities.mjs';
import { CEMADEN_RJ_TASK_ID, INMET_WARNINGS_TASK_ID } from './official-source-worker.mjs';
import { CEMADEN_RJ_HYDRO_URL } from './cemaden-rj-source.mjs';
import { INMET_CAP_RSS_URL, INMET_SOURCE_ID } from './inmet-source.mjs';

export const STATEWIDE_DASHBOARD_PATH = '/v1/data/municipalities';
export const STATEWIDE_DASHBOARD_CONTRACT = 'RJ_92_MUNICIPALITIES_V1';
export const STATEWIDE_DASHBOARD_MAX_BYTES = 1024 * 1024;
const currentStates = new Set(['CURRENT', 'CURRENT_DEGRADED']);
const coastal = new Set(RJ_SEAFRONT_MUNICIPALITIES.map(city => city.ibge));

// Approved responsibilities, not a claim that all portals supply an operational feed.
export const STATEWIDE_SOURCE_RESPONSIBILITIES = Object.freeze([
  { id: 'inmet', name: 'INMET', products: ['temperatura', 'umidade', 'vento', 'previsao', 'avisos'], scope: 'RJ_POR_COBERTURA_VALIDADA', taskId: INMET_WARNINGS_TASK_ID },
  { id: 'cemaden-rj', name: 'CEMADEN-RJ / Defesa Civil RJ', products: ['risco-hidrologico', 'chuva', 'radar-conforme-produto'], scope: 'RJ_92_MUNICIPIOS', taskId: CEMADEN_RJ_TASK_ID },
  { id: 'alerta-rio', name: 'Alerta Rio', products: ['chuva', 'meteorologia', 'radar-conforme-produto'], scope: 'MUNICIPIO_DO_RIO', taskId: 'alerta-rio-rainfall' },
  { id: 'ana', name: 'ANA / Hidroweb / HidroWebService', products: ['nivel-de-rios', 'vazao', 'historico-hidrologico'], scope: 'ESTACOES_COM_COBERTURA_RJ' },
  { id: 'sgb-sace', name: 'SGB / SACE', products: ['cheias', 'inundacao', 'boletins-hidrologicos'], scope: 'BACIAS_COM_COBERTURA_RJ' },
  { id: 'chm', name: 'Marinha / CHM', products: ['avisos-maritimos', 'mares', 'ondas', 'ressaca'], scope: 'ZONAS_MARITIMAS_VALIDADAS', taskId: 'chm-marine-warnings' },
  { id: 'ww3', name: 'Marinha / WW3', products: ['previsao-de-ondas'], scope: 'GRADE_MODELO_MARITIMO' },
  { id: 'pnboia', name: 'Marinha / PNBOIA', products: ['boias', 'ondas-observadas'], scope: 'PONTOS_OBSERVADOS' },
  { id: 'noaa', name: 'NOAA', products: ['satelite', 'tsunami-conforme-produto'], scope: 'ATLANTICO_COM_RELEVANCIA_RJ' },
  { id: 'windy', name: 'Windy', products: ['vento-modelado', 'rajadas-modeladas'], scope: 'MODELO_COM_LICENCA_E_CHAVE' },
  { id: 'defesa-civil', name: 'Defesa Civil estadual e municipal', products: ['avisos-locais', 'ocorrencias', 'sirenes'], scope: 'JURISDICAO_DO_ORGAO' },
  { id: 'cor-cet', name: 'COR.Rio / CET-Rio', products: ['transito', 'alagamentos', 'interdicoes'], scope: 'JURISDICAO_DO_ORGAO' },
  { id: 'prf-pmerj', name: 'PRF / PMERJ', products: ['rodovias', 'ocorrencias'], scope: 'JURISDICAO_DO_ORGAO' },
  { id: 'usgs', name: 'USGS', products: ['sismos'], scope: 'EVENTOS_GLOBAIS_E_RELEVANCIA_RJ' },
].map(Object.freeze));

function reading(worker, task) {
  try { return worker.readSource(task); } catch { return null; }
}
function freshStamp(value, now, maxAge) {
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) && stamp <= now && now - stamp <= maxAge;
}
function ready(reading, now, limit) {
  return reading && currentStates.has(reading.state) && reading.snapshot && freshStamp(reading.fetchedAt, now, limit);
}

export function buildStatewideDashboardSnapshot(worker, { nowMillis = Date.now() } = {}) {
  if (!Number.isFinite(nowMillis) || nowMillis < 0) throw new Error('statewide_clock_invalid');
  const status = worker.status();
  const active = status?.enabled === true && status?.started === true;
  const hydro = active ? reading(worker, CEMADEN_RJ_TASK_ID) : null;
  const cap = active ? reading(worker, INMET_WARNINGS_TASK_ID) : null;
  const hydroReady = ready(hydro, nowMillis, 30 * 60_000) && hydro.snapshot.sourceId === CEMADEN_RJ_TASK_ID;
  const capReady = ready(cap, nowMillis, 15 * 60_000) && cap.snapshot.sourceId === INMET_SOURCE_ID && cap.snapshot.sourceUrl === INMET_CAP_RSS_URL;
  const records = hydroReady ? hydro.snapshot.records : [];
  const byIbge = new Map((Array.isArray(records) ? records : []).map(item => [item.ibge, item]));
  const inventory = capReady && Array.isArray(cap.snapshot.rjWarnings) ? cap.snapshot.rjWarnings : [];
  // A CAP naming RJ without municipality codes cannot be attributed to every city.
  const currentWarnings = inventory.filter(item => item.msgType !== 'Cancel' && item.status === 'Actual'
    && Number.isFinite(Date.parse(item.sent)) && Date.parse(item.sent) <= nowMillis
    && Date.parse(item.onset) <= nowMillis && Date.parse(item.expires) > nowMillis);
  const boundedInventory = currentWarnings.length <= 64;
  const warnings = boundedInventory ? currentWarnings.map(item => ({
    id: item.identifier,
    event: item.event,
    severity: item.severity,
    sent: item.sent,
    onset: item.onset,
    expires: item.expires,
    sourceUrl: INMET_CAP_RSS_URL,
    municipalityIbges: [...(item.rjMunicipalityIbges ?? [])],
    attribution: item.rjMunicipalityIbges?.length ? 'EXACT_IBGE' : 'UNRESOLVED_RJ_AREA',
  })) : [];
  const unresolved = warnings.some(item => item.attribution === 'UNRESOLVED_RJ_AREA');
  const municipalities = RJ_MUNICIPALITIES.map(city => {
    const item = byIbge.get(city.ibge);
    const validRisk = item && freshStamp(item.observedAt, nowMillis, 30 * 60_000)
      && Number.isInteger(item.priority) && item.priority >= 1 && item.priority <= 5;
    return {
      ibge: city.ibge,
      name: city.name,
      seaFacing: coastal.has(city.ibge),
      hydrologicalRisk: validRisk ? {
        state: hydro.state, label: item.risk, level: item.priority,
        observedAt: item.observedAt, sourceUrl: CEMADEN_RJ_HYDRO_URL,
        region: item.redec,
      } : { state: hydro?.state === 'STALE' ? 'STALE' : 'UNAVAILABLE', label: null, level: null,
        observedAt: null, sourceUrl: CEMADEN_RJ_HYDRO_URL, region: null },
      warningIds: warnings.filter(warning => warning.municipalityIbges.includes(city.ibge)).map(warning => warning.id),
      warningCoverage: !capReady ? 'UNAVAILABLE' : !boundedInventory ? 'INVENTORY_LIMIT' : unresolved ? 'PARTIAL_UNRESOLVED_AREAS' : 'EXACT_IBGE_ONLY',
    };
  });
  const sourceStates = Array.isArray(status?.sources) ? status.sources : [];
  return {
    contract: STATEWIDE_DASHBOARD_CONTRACT,
    generatedAt: new Date(nowMillis).toISOString(),
    scope: 'RJ_92_MUNICIPALITIES',
    workerActive: active,
    municipalities,
    warnings,
    sources: STATEWIDE_SOURCE_RESPONSIBILITIES.map(source => {
      const actualId = source.taskId ? reading(worker, source.taskId)?.sourceId : null;
      const actual = active ? sourceStates.find(item => item.sourceId === source.taskId || item.sourceId === actualId
        || source.id === 'alerta-rio' && item.sourceId === 'alerta-rio-rainfall-live') : null;
      return { id: source.id, name: source.name, products: source.products, scope: source.scope,
        state: actual?.state ?? 'NOT_CONNECTED', observedAt: actual?.observedAt ?? null,
        // Connector state applies only to this product, never every listed responsibility.
        connectedProduct: actual ? (source.id === 'inmet' ? 'avisos' : source.id === 'cemaden-rj' ? 'risco-hidrologico'
          : source.id === 'alerta-rio' ? 'chuva' : 'inventario-avisos-maritimos') : null };
    }),
  };
}
