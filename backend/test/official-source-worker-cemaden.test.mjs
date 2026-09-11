import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';
import { CEMADEN_RJ_SOURCE_ID } from '../src/cemaden-rj-source.mjs';
import {
  ALERTA_RIO_RAINFALL_TASK_ID,
  CEMADEN_RJ_TASK_ID,
  createOfficialSourceWorker,
  loadOfficialSourceWorkerConfig,
  OfficialSourceWorkerError,
} from '../src/official-source-worker.mjs';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';

const NOW = Date.parse('2026-09-11T06:00:00.000Z');

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

function cemadenSnapshot() {
  const observedAt = new Date(NOW).toISOString();
  const records = RJ_MUNICIPALITIES
    .map((city) => Object.freeze({
      municipality: city.name,
      ibge: city.ibge,
      redec: 'METROPOLITANA',
      risk: 'MODERADO',
      priority: 3,
      observedAt,
    }))
    .sort((a, b) => a.ibge.localeCompare(b.ibge));
  const canonical = records.map((record) => ({
    ibge: record.ibge,
    municipality: record.municipality,
    redec: record.redec,
    risk: record.risk,
    priority: record.priority,
    observedAt: record.observedAt,
  }));
  return Object.freeze({
    sourceId: CEMADEN_RJ_SOURCE_ID,
    municipalityCount: 92,
    municipalCoverage: '92_OF_92_CANONICAL_RJ',
    records: Object.freeze(records),
    oldestObservedAt: observedAt,
    latestObservedAt: observedAt,
    statusInventorySha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  });
}

test('CEMADEN runtime polling is opt-in and invalid flags fail closed', () => {
  assert.deepEqual(loadOfficialSourceWorkerConfig({}), {
    enabled: false,
    initialMode: 'normal',
    ineaStationUrl: null,
  });
  assert.deepEqual(
    loadOfficialSourceWorkerConfig({ BLAISE_CEMADEN_RJ_ENABLED: 'true' }),
    {
      enabled: false,
      initialMode: 'normal',
      ineaStationUrl: null,
      cemadenRjEnabled: true,
    },
  );
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_CEMADEN_RJ_ENABLED: 'yes' }),
    (error) => error instanceof OfficialSourceWorkerError
      && error.code === 'official_source_worker_invalid_cemaden_rj_enabled_flag',
  );
});

test('enabled worker refreshes CEMADEN 92-city hydrological risk into memory-only cache', async () => {
  let cemadenCalls = 0;
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      cemadenRjEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeCemadenRj: async () => {
      cemadenCalls += 1;
      return cemadenSnapshot();
    },
  });

  assert.equal(worker.start(), true);
  const launched = await worker.tick();
  assert.deepEqual([...launched].sort(), [ALERTA_RIO_RAINFALL_TASK_ID, CEMADEN_RJ_TASK_ID].sort());
  assert.equal(cemadenCalls, 1);

  const reading = worker.readSource(CEMADEN_RJ_TASK_ID);
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.snapshot.municipalityCount, 92);
  assert.equal(reading.snapshot.records.length, 92);

  const status = worker.status();
  assert.equal(status.cemadenRjConfigured, true);
  const source = status.sources.find((item) => item.sourceId === CEMADEN_RJ_SOURCE_ID);
  assert.equal(source.state, 'CURRENT');
  assert.equal(source.payloadExposed, false);
  assert.equal(JSON.stringify(status).includes('records'), false);
});

test('CEMADEN source failures remain bounded and do not expose upstream content', async () => {
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      cemadenRjEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeCemadenRj: async () => {
      const error = new Error('raw CEMADEN body must not escape');
      error.code = 'cemaden_source_timeout';
      throw error;
    },
  });

  worker.start();
  await worker.tick();
  const source = worker.status().sources.find((item) => item.sourceId === CEMADEN_RJ_SOURCE_ID);
  assert.equal(source.state, 'UNAVAILABLE');
  assert.equal(source.lastErrorCode, 'cemaden_source_timeout');
  assert.equal(JSON.stringify(worker.status()).includes('raw CEMADEN body'), false);
});
