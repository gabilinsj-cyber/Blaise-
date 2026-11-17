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


test('legacy INMET publish flag cannot enable customer publication', async () => {
  const config = enabledConfig();
  let publisherCalls = 0;
  const worker = createOfficialSourceWorker({
    config, now: () => NOW, autoSchedule: false, maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => inmetSnapshot(),
    publishInmetP0: async () => {
      publisherCalls++;
      throw Error('must never publish domestic data');
    },
  });
  worker.start();
  const launched = await worker.tick();
  assert.equal(launched.includes(INMET_WARNINGS_TASK_ID), true);
  assert.equal(publisherCalls, 0);
  assert.equal(worker.readSource(INMET_WARNINGS_TASK_ID).state, 'CURRENT');
  const status = worker.status();
  assert.equal(status.inmetP0PublishEnabled, false);
  assert.equal(status.inmetP0Evaluation.automaticPublication, 'DISABLED');
  assert.equal(status.inmetP0Evaluation.publication, 'NOT_PERFORMED');
  assert.equal(status.inmetP0Evaluation.delivery, 'STAGED_NOT_PUBLISHED');
  assert.equal(JSON.stringify(status).includes('Chuvas Intensas'), false);
});

test('without an injected publisher, domestic-only probe remains usable for comparison', async () => {
  const worker = createOfficialSourceWorker({
    config: enabledConfig(),
    now: () => NOW, autoSchedule: false, maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeInmetWarningsLive: async () => inmetSnapshot(),
  });
  worker.start();
  await worker.tick();
  assert.equal(worker.status().inmetP0PublishEnabled, false);
  assert.equal(worker.status().inmetP0Evaluation.publication, 'NOT_PERFORMED');
});
