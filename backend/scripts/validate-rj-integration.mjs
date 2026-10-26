import { mkdir, writeFile } from 'node:fs/promises';
import { createOfficialSourceWorker } from '../src/official-source-worker.mjs';
import { buildStatewideDashboardSnapshot } from '../src/statewide-dashboard.mjs';

// Public-source checks only. Never use purchase tokens or publish alerts.
const worker = createOfficialSourceWorker({
  config: { enabled: true, initialMode: 'normal', ineaStationUrl: null,
    cemadenRjEnabled: true, chmWarningsEnabled: true, inmetWarningsEnabled: true },
  autoSchedule: false,
  maxConcurrency: 4,
  fetchImpl: (url, options = {}) => fetch(url, { ...options,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000) }),
});
let report;
try {
  worker.start();
  await worker.tick();
  const status = worker.status();
  const snapshot = buildStatewideDashboardSnapshot(worker);
  const sources = status.sources.map(({ sourceId, state, reason, observedAt, fetchedAt, lastErrorCode }) =>
    ({ sourceId, state, reason, observedAt, fetchedAt, lastErrorCode }));
  report = {
    checkedAt: new Date().toISOString(),
    separateConnectors: sources,
    integratedStatewide: {
      municipalityCount: snapshot.municipalities.length,
      uniqueIbgeCount: new Set(snapshot.municipalities.map(city => city.ibge)).size,
      currentHydrologicalMunicipalities: snapshot.municipalities.filter(city => city.hydrologicalRisk.level !== null).length,
      currentWarnings: snapshot.warnings.length,
      unresolvedWarnings: snapshot.warnings.filter(warning => warning.attribution === 'UNRESOLVED_RJ_AREA').length,
      pendingProducts: snapshot.sources.filter(source => source.state === 'NOT_CONNECTED').map(source => source.id),
    },
    realPurchaseAccess: 'NOT_TESTED_NO_REAL_PURCHASE',
    installedDevice: 'NOT_TESTED_NO_DEVICE_CONNECTION',
    deployment: 'NOT_PERFORMED',
    automaticAlerts: 'NOT_PUBLISHED',
  };
} finally { worker.stop(); }
await mkdir('evidence/official-sources', { recursive: true });
await writeFile('evidence/official-sources/rj-integration.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (report.separateConnectors.some(source => !['CURRENT', 'CURRENT_DEGRADED'].includes(source.state))
    || report.integratedStatewide.municipalityCount !== 92 || report.integratedStatewide.uniqueIbgeCount !== 92) {
  process.exitCode = 1;
}
