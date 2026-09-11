import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';
import {
  createOfficialSourceWorker,
  INMET_WARNINGS_TASK_ID,
  loadOfficialSourceWorkerConfig,
  OfficialSourceWorkerError,
} from '../src/official-source-worker.mjs';
import { INMET_WARNINGS_SEMANTIC_VALIDITY } from '../src/inmet-warning-cache.mjs';
import {
  INMET_CAP_RSS_URL,
  INMET_HOST,
  INMET_SOURCE_ID,
} from '../src/inmet-source.mjs';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');

function alertaRioSnapshot() {
  const observedAt = new Date(NOW).toISOString();
  return Object.freeze({
    sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
    sourceHost: 'websempre.rio.rj.gov.br',
    stationCount: 33,
    missingValueCount: 0,
    oldestObservedAt: observedAt,
    freshestObservedAt: observedAt,
    snapshotSha256: 'a'.repeat(64),
    stations: Object.freeze(Array.from({ length: 33 }, (_, index) => Object.freeze({
      code: index + 1,
      observedAt,
    }))),
  });
}

function inmetSnapshot() {
  const warning = Object.freeze({
    identifier: 'urn:oid:2.49.0.0.76.0.2026.30001.1',
    sender: 'info.aviso@inmet.gov.br',
    sent: '2026-09-11T08:50:00-03:00',
    status: 'Actual',
    msgType: 'Alert',
    event: 'Chuvas Intensas',
    urgency: 'Expected',
    severity: 'Severe',
    certainty: 'Likely',
    onset: '2026-09-11T09:00:00-03:00',
    expires: '2026-09-11T18:00:00-03:00',
    areaCount: 1,
    areaDescriptions: Object.freeze(['Rio de Janeiro']),
    affectsRioDeJaneiro: true,
    rjMatchMethod: 'CAP_GEOCODE_IBGE_33',
    rjMunicipalityIbges: Object.freeze(['3304557']),
  });
  const warnings = Object.freeze([warning]);
  const canonical = warnings.map((record) => ({
    identifier: record.identifier,
    sent: record.sent,
    event: record.event,
    urgency: record.urgency,
    severity: record.severity,
    certainty: record.certainty,
    onset: record.onset,
    expires: record.expires,
    areaDescriptions: record.areaDescriptions,
    rjMatchMethod: record.rjMatchMethod,
    rjMunicipalityIbges: record.rjMunicipalityIbges,
  }));
  return Object.freeze({
    sourceId: INMET_SOURCE_ID,
    sourceHost: INMET_HOST,
    sourceUrl: INMET_CAP_RSS_URL,
    feedShape: 'CAP_ALERT',
    activeWarningCount: 1,
    rjWarningCount: 1,
    warnings,
    rjWarnings: warnings,
    warningInventorySha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    identityValidation: 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX',
    temporalValidityValidation: 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D',
    rjGeofenceValidation: 'CAP_CANONICAL_IBGE33_OR_BR_RJ_OR_AREA_DESC',
    polygonRetention: 'NONE',
    rawFeedRetention: 'NONE',
  });
}

test('INMET runtime polling is explicit and disabled by default', () => {
  assert.deepEqual(loadOfficialSourceWorkerConfig({}), {
    enabled: false,
    initialMode: 'normal',
    ineaStationUrl: null,
  });
  assert.deepEqual(loadOfficialSourceWorkerConfig({ BLAISE_INMET_WARNINGS_ENABLED: 'true' }), {
    enabled: false,
    initialMode: 'normal',
    ineaStationUrl: null,
    inmetWarningsEnabled: true,
  });
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_INMET_WARNINGS_ENABLED: 'yes' }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_invalid_inmet_warnings_enabled_flag',
  );
});

test('optional INMET CAP task caches validated inventory without evaluating or publishing P0', async () => {
  let inmetCalls = 0;
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'severe',
      ineaStationUrl: null,
      inmetWarningsEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => {
      inmetCalls += 1;
      return inmetSnapshot();
    },
  });

  assert.equal(worker.start(), true);
  const launched = await worker.tick();
  assert.equal(launched.includes(INMET_WARNINGS_TASK_ID), true);
  assert.equal(inmetCalls, 1);

  const reading = worker.readSource(INMET_WARNINGS_TASK_ID);
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.semanticValidity, INMET_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(reading.snapshot.rjWarningCount, 1);

  const status = worker.status();
  assert.equal(status.inmetWarningsConfigured, true);
  assert.equal(status.mode, 'severe');
  assert.equal(status.scheduler.refreshIntervalMs, 60_000);
  const inmetStatus = status.sources.find((source) => source.sourceId === INMET_SOURCE_ID);
  assert.equal(inmetStatus.semanticValidity, INMET_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(inmetStatus.payloadExposed, false);
  assert.equal(JSON.stringify(status).includes('Chuvas Intensas'), false);
  assert.equal(JSON.stringify(status).includes('3304557'), false);
});

test('INMET refresh failures remain fail-closed and payload-redacted', async () => {
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      inmetWarningsEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => {
      const error = new Error('CAP XML body must never reach runtime status');
      error.code = 'inmet_source_timeout';
      throw error;
    },
  });

  worker.start();
  await worker.tick();
  const reading = worker.readSource(INMET_WARNINGS_TASK_ID);
  assert.equal(reading.state, 'UNAVAILABLE');
  assert.equal(reading.lastErrorCode, 'inmet_source_timeout');
  assert.equal(reading.snapshot, null);
  assert.equal(JSON.stringify(worker.status()).includes('CAP XML body'), false);
});
