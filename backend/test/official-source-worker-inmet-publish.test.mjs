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
import {
  INMET_CAP_RSS_URL,
  INMET_HOST,
  INMET_SOURCE_ID,
} from '../src/inmet-source.mjs';

const NOW = Date.parse('2026-09-11T15:00:00.000Z');

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
    identifier: 'urn:oid:2.49.0.0.76.0.2026.30002.1',
    sender: 'info.aviso@inmet.gov.br',
    sent: '2026-09-11T11:50:00-03:00',
    status: 'Actual',
    msgType: 'Alert',
    event: 'Chuvas Intensas',
    urgency: 'Immediate',
    severity: 'Severe',
    certainty: 'Likely',
    onset: '2026-09-11T12:00:00-03:00',
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

function enabledConfig() {
  return {
    enabled: true,
    initialMode: 'severe',
    ineaStationUrl: null,
    inmetWarningsEnabled: true,
    inmetP0PublishEnabled: true,
  };
}

test('INMET P0 runtime publication is explicit, dependency-bound and fail-closed', () => {
  assert.deepEqual(loadOfficialSourceWorkerConfig({
    BLAISE_INMET_WARNINGS_ENABLED: 'true',
    BLAISE_INMET_P0_PUBLISH_ENABLED: 'true',
  }), {
    enabled: false,
    initialMode: 'normal',
    ineaStationUrl: null,
    inmetWarningsEnabled: true,
    inmetP0PublishEnabled: true,
  });
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_INMET_P0_PUBLISH_ENABLED: 'true' }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_inmet_p0_publish_requires_warnings',
  );
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_INMET_P0_PUBLISH_ENABLED: 'yes' }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_invalid_inmet_p0_publish_enabled_flag',
  );
});

test('enabled INMET P0 publication requires an injected authenticated publisher', () => {
  assert.throws(
    () => createOfficialSourceWorker({ config: enabledConfig(), autoSchedule: false }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_inmet_p0_publisher_missing',
  );
});

test('explicit INMET P0 publication sends only a validated staged batch and projects redacted acceptance status', async () => {
  let publisherCalls = 0;
  let capturedSha = null;
  const worker = createOfficialSourceWorker({
    config: enabledConfig(),
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => inmetSnapshot(),
    publishInmetP0: async (batch, { nowMillis }) => {
      publisherCalls += 1;
      capturedSha = batch.batchSha256;
      assert.equal(nowMillis, NOW);
      assert.equal(batch.candidateCount, 1);
      return Object.freeze({
        schema: batch.schema,
        batchSha256: batch.batchSha256,
        acceptedCount: 1,
        duplicateCount: 0,
        newlyAcceptedCount: 1,
        delivery: 'BACKEND_P0_ENDPOINT_ACCEPTED',
      });
    },
  });

  worker.start();
  const launched = await worker.tick();
  assert.equal(launched.includes(INMET_WARNINGS_TASK_ID), true);
  assert.equal(publisherCalls, 1);

  const status = worker.status();
  assert.equal(status.inmetP0PublishEnabled, true);
  assert.equal(status.inmetP0Evaluation.status, 'BACKEND_ACCEPTED');
  assert.equal(status.inmetP0Evaluation.publication, 'PERFORMED');
  assert.equal(status.inmetP0Evaluation.automaticPublication, 'ENABLED_EXPLICIT');
  assert.equal(status.inmetP0Evaluation.fcmDelivery, 'BACKEND_ACCEPTED_NOT_DEVICE_PROVEN');
  assert.equal(status.inmetP0Evaluation.acceptedCount, 1);
  assert.equal(status.inmetP0Evaluation.duplicateCount, 0);
  assert.equal(status.inmetP0Evaluation.newlyAcceptedCount, 1);
  assert.equal(status.inmetP0Evaluation.batchSha256, capturedSha);
  assert.equal(worker.readSource(INMET_WARNINGS_TASK_ID).state, 'CURRENT');
  assert.equal(JSON.stringify(status).includes('3304557'), false);
  assert.equal(JSON.stringify(status).includes('Chuvas Intensas'), false);
});

test('INMET publication failure keeps source cache current, marks delivery blocked and schedules retry', async () => {
  const worker = createOfficialSourceWorker({
    config: enabledConfig(),
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => inmetSnapshot(),
    publishInmetP0: async () => {
      const error = new Error('sensitive backend response must not leak');
      error.code = 'inmet_p0_backend_publish_failed';
      throw error;
    },
  });

  worker.start();
  await worker.tick();

  assert.equal(worker.readSource(INMET_WARNINGS_TASK_ID).state, 'CURRENT');
  const status = worker.status();
  assert.equal(status.inmetP0Evaluation.status, 'BLOCKED_PUBLICATION_FAILED');
  assert.equal(status.inmetP0Evaluation.lastErrorCode, 'inmet_p0_backend_publish_failed');
  assert.equal(status.inmetP0Evaluation.publication, 'FAILED');
  assert.equal(status.inmetP0Evaluation.fcmDelivery, 'NOT_PROVEN');
  assert.equal(status.inmetP0Evaluation.automaticPublication, 'ENABLED_EXPLICIT');
  const task = status.scheduler.tasks.find((entry) => entry.taskId === INMET_WARNINGS_TASK_ID);
  assert.equal(task.lastOutcome, 'FAILURE');
  assert.equal(task.lastErrorCode, 'inmet_p0_backend_publish_failed');
  assert.equal(JSON.stringify(status).includes('sensitive backend response'), false);
});
