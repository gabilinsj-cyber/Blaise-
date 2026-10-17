import { probeInmetWis2Warnings } from '../src/inmet-wis2-source.mjs';
import { createInmetCapWarningsCache } from '../src/inmet-warning-cache.mjs';
import { probeCemadenNationalAlerts } from '../src/cemaden-national-source.mjs';
import { rjAlertIsActive } from '../src/rj-alert-retention.mjs';
const results = await Promise.allSettled([
  (async () => {
    const snapshot = await probeInmetWis2Warnings();
    const cache = createInmetCapWarningsCache(); cache.recordSuccess(snapshot);
    const at = Date.now();
    const eligible = snapshot.rjWarnings.filter(w => Date.parse(w.sent) <= at
      && Date.parse(w.onset) <= at && rjAlertIsActive(w.sent, w.expires, at));
    return { source: 'INMET_WIS2', checkedAt: new Date(at).toISOString(),
      state: cache.read().state, sourceUrl: snapshot.sourceUrl,
      verifiedDocuments: snapshot.archiveDocumentCount, inventoryComplete: false,
      scheduledRjWarnings: snapshot.rjWarnings.filter(w => Date.parse(w.sent) <= at
        && Date.parse(w.onset) > at && rjAlertIsActive(w.sent, w.expires, at))
        .map(w => ({ id: w.identifier, event: w.event, onset: w.onset, expires: w.expires })),
      eligibleRjWarnings: eligible.map(w => ({ id: w.identifier, event: w.event, severity: w.severity,
        sent: w.sent, expires: w.expires, municipalityIbges: w.rjMunicipalityIbges })) };
  })(),
  (async () => {
    const s = await probeCemadenNationalAlerts();
    return { source: 'CEMADEN_NATIONAL', checkedAt: new Date().toISOString(),
      sourceUpdatedAt: s.sourceUpdatedAt, sourceUrl: s.sourceUrl, rjOpenAlerts: s.alerts,
      absenceOfRiskProven: false, municipalRiskLevelProvided: false };
  })(),
]);
console.log(JSON.stringify(results.map((r, i) => r.status === 'fulfilled' ? r.value
  : { source: i === 0 ? 'INMET_WIS2' : 'CEMADEN_NATIONAL', errorCode: r.reason.code ?? 'unexpected_error' }), null, 2));
if (results.some(r => r.status === 'rejected')) process.exitCode = 1;
