// Read-only verification using the same strict contracts as the runtime.
import { probeInmetCapWarnings } from '../src/inmet-source.mjs';
import { probeCemadenRjHydrologicalRisk } from '../src/cemaden-rj-source.mjs';
import { fetchJsonContract } from '../src/source-contract.mjs';
import { createCemadenRjHydrologicalRiskCache } from '../src/cemaden-rj-cache.mjs';

async function verify(name, probe) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const started = Date.now();
    const target = new URL(url);
    const request = { host: target.hostname, path: target.pathname };
    requests.push(request);
    try {
      const response = await fetch(url, options);
      Object.assign(request, { httpStatus: response.status,
        contentType: response.headers.get('content-type'), elapsedMs: Date.now() - started });
      return response;
    } catch {
      Object.assign(request, { transport: options.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        elapsedMs: Date.now() - started });
      throw new TypeError('verification_transport_failure');
    }
  };
  const startedAt = new Date().toISOString();
  try {
    const snapshot = await probe({ fetchImpl });
    const checkedAt = new Date().toISOString();
    if (name === 'CEMADEN_RJ') {
      const cache = createCemadenRjHydrologicalRiskCache();
      cache.recordSuccess(snapshot);
      const { snapshot: ignored, ...reading } = cache.read();
      const now = Date.now();
      const municipalities = snapshot.records.map(r => ({ ibge: r.ibge, municipality: r.municipality,
        sourceUpdatedAt: r.observedAt, updateAgeMs: now - Date.parse(r.observedAt),
        eligibleForFiveMinuteDashboard: now >= Date.parse(r.observedAt)
          && now - Date.parse(r.observedAt) <= 300_000 }));
      return { source: name, startedAt, checkedAt, contract: 'PASS', reading,
        timestampMeaning: 'OFFICIAL_STATUS_LAST_UPDATE_NOT_SENSOR_OBSERVATION',
        eligibleMunicipalities: municipalities.filter(r => r.eligibleForFiveMinuteDashboard).length,
        municipalities, requests };
    }
    const now = Date.now();
    return { source: name, startedAt, checkedAt, contract: 'PASS',
      inventoryComplete: true, totalWarnings: snapshot.activeWarningCount,
      rjWarnings: snapshot.rjWarningCount,
      validNowRjWarnings: snapshot.rjWarnings.filter(w => Date.parse(w.onset) <= now
        && now < Date.parse(w.expires)).length,
      inventorySha256: snapshot.warningInventorySha256, requests };
  } catch (e) {
    return { source: name, startedAt, checkedAt: new Date().toISOString(), contract: 'FAIL',
      errorCode: e.code ?? 'unexpected_error', inventoryComplete: false,
      warningAbsenceProven: false, requests };
  }
}
async function alternatives() {
  const candidates = [
    { source: 'INMET_WIS2', url: 'https://wis2bra.inmet.gov.br/oapi/collections/discovery-metadata/items?f=json',
      validate: value => {
        const cap = value.features?.find(f => f.id === 'urn:wmo:md:br-inmet:alerts');
        if (!cap?.links?.some(l => l.channel === 'origin/a/wis2/br-inmet/data/core/weather/advisories-warnings')) {
          throw new Error('alternative_schema_invalid');
        }
        return { metadataValidated: true, liveCapDeliveryValidated: false,
          replacementReady: false, reason: 'MQTT_CAP_DELIVERY_AND_INVENTORY_NOT_YET_VALIDATED' };
      } },
    { source: 'CEMADEN_NATIONAL_ALERTS', url: 'https://painelalertas.cemaden.gov.br/wsAlertas2',
      validate: value => {
        if (!Array.isArray(value.alertas) || typeof value.atualizado !== 'string'
            || value.alertas.some(a => !Number.isInteger(a.codibge) || !Number.isInteger(a.status))) {
          throw new Error('alternative_schema_invalid');
        }
        return { payloadValidated: true, sourceUpdatedAtRaw: value.atualizado,
          rjOpenAlertCount: value.alertas.filter(a => a.status === 1 && String(a.codibge).startsWith('33')).length,
          replacementReady: false, absenceOfRiskProven: false,
          reason: 'OPEN_ALERTS_ARE_NOT_92_MUNICIPAL_RISK_STATUSES' };
      } },
  ];
  return Promise.all(candidates.map(async candidate => {
    try {
      const value = await fetchJsonContract(candidate.url, {
        allowedHosts: [new URL(candidate.url).hostname], timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024,
      });
      return { source: candidate.source, checkedAt: new Date().toISOString(), ...candidate.validate(value) };
    } catch (e) {
      return { source: candidate.source, checkedAt: new Date().toISOString(),
        replacementReady: false, errorCode: e.code ?? 'alternative_schema_invalid' };
    }
  }));
}
const [results, alternativeChannels] = await Promise.all([Promise.all([
  verify('INMET', probeInmetCapWarnings), verify('CEMADEN_RJ', probeCemadenRjHydrologicalRisk),
]), alternatives()]);
console.log(JSON.stringify({ schemaVersion: 1, results, alternativeChannels }, null, 2));
if (results.some(r => r.contract === 'FAIL')) process.exitCode = 1;
