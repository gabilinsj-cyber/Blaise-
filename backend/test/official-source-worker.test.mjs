import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERTA_RIO_RAINFALL_TASK_ID,
  CHM_WARNINGS_TASK_ID,
  createOfficialSourceWorker,
  INEA_STATION_TASK_ID,
  loadOfficialSourceWorkerConfig,
  OfficialSourceWorkerError,
} from '../src/official-source-worker.mjs';
import { ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';
import { CHM_WARNINGS_SEMANTIC_VALIDITY } from '../src/chm-warning-cache.mjs';
import {
  CHM_RJ_ALERT_ROUTING_CONTRACT,
  classifyChmWarningRjRouting,
} from '../src/chm-rj-zone.mjs';
import {
  CHM_HOST,
  CHM_SOURCE_ID,
  CHM_TEMPORAL_VALIDITY_CONTRACT,
  CHM_WARNINGS_URL,
} from '../src/chm-source.mjs';
import {
  INEA_ALERT_HOST,
  INEA_STATION_SOURCE_ID,
  INEA_TELEMETRY_CADENCE_MINUTES,
} from '../src/inea-source.mjs';

const NOW = Date.parse('2026-09-10T15:00:00.000Z');

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

function ineaSnapshot() {
  return Object.freeze({
    sourceId: INEA_STATION_SOURCE_ID,
    sourceHost: INEA_ALERT_HOST,
    stationId: '12345678',
    stationName: 'Estação de teste',
    observedDate: '10/09/2026',
    observedTime: '12:00',
    timezone: 'America/Sao_Paulo',
    telemetryCadenceMinutes: INEA_TELEMETRY_CADENCE_MINUTES,
    rainfall: Object.freeze({ last15mMm: 0 }),
    missingValueCount: 0,
    snapshotSha256: 'b'.repeat(64),
  });
}

function chmSnapshot() {
  const baseWarning = {
    id: '321/2026',
    warningNumber: 321,
    year: 2026,
    area: 'CHARLIE',
    areas: Object.freeze(['CHARLIE']),
    warningType: 'AVISO DE VENTO FORTE',
    issuedZuluClock: '1200Z',
    issuedAt: '2026-09-10T12:00:00.000Z',
    validUntil: '2026-09-12T12:00:00.000Z',
    validityDurationMs: 48 * 60 * 60 * 1000,
  };
  const warnings = Object.freeze([
    Object.freeze({
      ...baseWarning,
      rjRouting: classifyChmWarningRjRouting(baseWarning),
    }),
  ]);
  const canonical = warnings.map((warning) => ({
    id: warning.id,
    area: warning.area,
    areas: warning.areas,
    warningType: warning.warningType,
    issuedZuluClock: warning.issuedZuluClock,
    issuedAt: warning.issuedAt,
    validUntil: warning.validUntil,
    validityDurationMs: warning.validityDurationMs,
    rjRouting: warning.rjRouting,
  }));
  return Object.freeze({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_WARNINGS_URL,
    metarea: 'V',
    activeWarningCount: 1,
    noWarningMarker: false,
    warnings,
    warningInventorySha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    rawWarningTextRetention: 'NONE',
    temporalValidityValidation: CHM_TEMPORAL_VALIDITY_CONTRACT,
    rjZoneRoutingValidation: CHM_RJ_ALERT_ROUTING_CONTRACT,
    rjCoastGeofenceValidation: 'NOT_IMPLEMENTED',
  });
}

test('worker configuration is disabled fail-closed by default', () => {
  assert.deepEqual(loadOfficialSourceWorkerConfig({}), {
    enabled: false,
    initialMode: 'normal',
    ineaStationUrl: null,
  });

  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED: 'yes' }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_invalid_enabled_flag',
  );
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_INEA_STATION_URL: 'https://example.com/station' }),
    (error) => error.code === 'official_source_worker_invalid_inea_station_url',
  );
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_CHM_WARNINGS_ENABLED: 'yes' }),
    (error) => error.code === 'official_source_worker_invalid_chm_warnings_enabled_flag',
  );
});

test('disabled worker cannot start external polling', async () => {
  let calls = 0;
  const worker = createOfficialSourceWorker({
    config: { enabled: false, initialMode: 'normal', ineaStationUrl: null },
    now: () => NOW,
    autoSchedule: false,
    probeAlertaRio: async () => {
      calls += 1;
      return alertaRioSnapshot();
    },
  });

  assert.equal(worker.start(), false);
  assert.deepEqual(await worker.tick(), []);
  assert.equal(calls, 0);
  const status = worker.status();
  assert.equal(status.externalPolling, 'DISABLED_FAIL_CLOSED');
  assert.equal(status.started, false);
  assert.equal(status.sources[0].state, 'UNAVAILABLE');
});

test('enabled worker refreshes Alerta Rio into memory-only cache', async () => {
  let calls = 0;
  const worker = createOfficialSourceWorker({
    config: { enabled: true, initialMode: 'normal', ineaStationUrl: null },
    now: () => NOW,
    autoSchedule: false,
    probeAlertaRio: async () => {
      calls += 1;
      return alertaRioSnapshot();
    },
  });

  assert.equal(worker.start(), true);
  assert.deepEqual(await worker.tick(), [ALERTA_RIO_RAINFALL_TASK_ID]);
  assert.equal(calls, 1);
  const reading = worker.readSource(ALERTA_RIO_RAINFALL_TASK_ID);
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.snapshot.stationCount, 33);

  const status = worker.status();
  assert.equal(status.sources[0].state, 'CURRENT');
  assert.equal(Object.hasOwn(status.sources[0], 'snapshot'), false);
  assert.equal(JSON.stringify(status).includes('stations'), false);
});

test('source failures are contained and exposed only as bounded error codes', async () => {
  const worker = createOfficialSourceWorker({
    config: { enabled: true, initialMode: 'normal', ineaStationUrl: null },
    now: () => NOW,
    autoSchedule: false,
    probeAlertaRio: async () => {
      const error = new Error('upstream body must not appear in status');
      error.code = 'alerta_rio_live_timeout';
      throw error;
    },
  });

  worker.start();
  assert.deepEqual(await worker.tick(), [ALERTA_RIO_RAINFALL_TASK_ID]);
  const status = worker.status();
  assert.equal(status.sources[0].state, 'UNAVAILABLE');
  assert.equal(status.sources[0].lastErrorCode, 'alerta_rio_live_timeout');
  assert.equal(JSON.stringify(status).includes('upstream body'), false);
});

test('optional INEA station task is explicit and honors severe cadence', async () => {
  const stationUrl = 'https://alertadecheias.inea.rj.gov.br/alertadecheias/12345678.html';
  let ineaCalls = 0;
  const worker = createOfficialSourceWorker({
    config: { enabled: true, initialMode: 'severe', ineaStationUrl: stationUrl },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeIneaStation: async ({ stationUrl: received }) => {
      assert.equal(received, stationUrl);
      ineaCalls += 1;
      return ineaSnapshot();
    },
  });

  worker.start();
  const launched = await worker.tick();
  assert.deepEqual([...launched].sort(), [ALERTA_RIO_RAINFALL_TASK_ID, INEA_STATION_TASK_ID].sort());
  assert.equal(ineaCalls, 1);
  assert.equal(worker.status().mode, 'severe');
  assert.equal(worker.status().scheduler.refreshIntervalMs, 60_000);
  assert.equal(worker.readSource(INEA_STATION_TASK_ID).state, 'CURRENT');
});

test('optional CHM warnings task exposes only validated RJ regional routing and never municipality P0', async () => {
  let chmCalls = 0;
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      chmWarningsEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeChmWarningsLive: async () => {
      chmCalls += 1;
      return chmSnapshot();
    },
  });

  worker.start();
  const launched = await worker.tick();
  assert.deepEqual([...launched].sort(), [ALERTA_RIO_RAINFALL_TASK_ID, CHM_WARNINGS_TASK_ID].sort());
  assert.equal(chmCalls, 1);

  const reading = worker.readSource(CHM_WARNINGS_TASK_ID);
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.semanticValidity, CHM_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(reading.snapshot.activeWarningCount, 1);
  assert.equal(reading.snapshot.temporalValidityValidation, CHM_TEMPORAL_VALIDITY_CONTRACT);
  assert.equal(reading.snapshot.rjZoneRoutingValidation, CHM_RJ_ALERT_ROUTING_CONTRACT);
  assert.equal(reading.snapshot.warnings[0].rjRouting.route, 'RJ_MARINE_REGIONAL');
  assert.equal(reading.snapshot.warnings[0].rjRouting.canExposeRjMarineWarning, true);
  assert.equal(reading.snapshot.warnings[0].rjRouting.municipalityGeofenceValidated, false);
  assert.equal(reading.snapshot.warnings[0].rjRouting.canPromoteMunicipalityP0, false);
  assert.equal(reading.snapshot.rjCoastGeofenceValidation, 'NOT_IMPLEMENTED');

  const status = worker.status();
  assert.equal(status.chmWarningsConfigured, true);
  const chmStatus = status.sources.find((source) => source.sourceId === CHM_SOURCE_ID);
  assert.equal(chmStatus.semanticValidity, CHM_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(chmStatus.payloadExposed, false);
  assert.equal(JSON.stringify(status).includes('AVISO DE VENTO FORTE'), false);
});

test('unknown source reads fail closed', () => {
  const worker = createOfficialSourceWorker({
    config: { enabled: false, initialMode: 'normal', ineaStationUrl: null },
    now: () => NOW,
    autoSchedule: false,
  });
  assert.throws(
    () => worker.readSource('unknown'),
    (error) => error.code === 'official_source_worker_unknown_source',
  );
});
