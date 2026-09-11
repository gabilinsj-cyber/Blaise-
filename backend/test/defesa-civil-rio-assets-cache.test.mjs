import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefesaCivilRioAssetsCache,
  DEFESA_CIVIL_RIO_ASSETS_MAX_CACHE_AGE_MS,
  DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY,
} from '../src/defesa-civil-rio-assets-cache.mjs';
import {
  DEFESA_CIVIL_RIO_ASSETS_HOST,
  DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
  DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
} from '../src/defesa-civil-rio-assets.mjs';
import {
  ALERTA_RIO_RAINFALL_TASK_ID,
  createOfficialSourceWorker,
  DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
  loadOfficialSourceWorkerConfig,
} from '../src/official-source-worker.mjs';
import { ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';

const NOW = Date.parse('2026-09-11T13:00:00.000Z');

function digest(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

function assetsSnapshot() {
  const sirens = [{
    objectId: 1,
    globalId: '123e4567-e89b-12d3-a456-426614174000',
    geometry: Object.freeze({ longitude: -43.25, latitude: -22.95 }),
    sirenCode: 101,
    name: 'Sirene de teste',
    community: 'Comunidade de teste',
    reference: null,
    hasRainGauge: true,
  }];
  const supportPoints = [{
    objectId: 2,
    globalId: '223e4567-e89b-12d3-a456-426614174001',
    geometry: Object.freeze({ longitude: -43.24, latitude: -22.94 }),
    supportCode: 201,
    name: 'Ponto de apoio de teste',
    community: 'Comunidade de teste',
    reference: null,
    address: null,
    mainPoint: null,
  }];
  return {
    sourceId: DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID,
    sourceHost: DEFESA_CIVIL_RIO_ASSETS_HOST,
    serviceItemId: DEFESA_CIVIL_RIO_SERVICE_ITEM_ID,
    spatialReference: 4326,
    sirens: { count: sirens.length, sha256: digest(sirens), items: sirens },
    supportPoints: { count: supportPoints.length, sha256: digest(supportPoints), items: supportPoints },
  };
}

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

test('Defesa Civil Rio assets cache validates, freezes and expires inventory fail-closed', () => {
  let now = NOW;
  const cache = createDefesaCivilRioAssetsCache({ now: () => now });
  const input = assetsSnapshot();
  cache.recordSuccess(input, { fetchedAt: now });

  input.sirens.items[0].name = 'mutated after cache';
  const current = cache.read();
  assert.equal(current.state, 'CURRENT');
  assert.equal(current.semanticValidity, DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY);
  assert.equal(current.snapshot.sirens.items[0].name, 'Sirene de teste');
  assert.equal(Object.isFrozen(current.snapshot.sirens.items[0]), true);

  now += DEFESA_CIVIL_RIO_ASSETS_MAX_CACHE_AGE_MS + 1;
  const stale = cache.read();
  assert.equal(stale.state, 'STALE');
  assert.equal(stale.snapshot, null);
});

test('Defesa Civil Rio assets cache rejects tampered inventory digest', () => {
  const cache = createDefesaCivilRioAssetsCache({ now: () => NOW });
  const snapshot = assetsSnapshot();
  snapshot.sirens.sha256 = 'f'.repeat(64);
  assert.throws(
    () => cache.recordSuccess(snapshot, { fetchedAt: NOW }),
    (error) => error.code === 'defesa_civil_rio_assets_cache_sirens_digest_invalid',
  );
});

test('Defesa Civil Rio runtime task is explicit, redacted and does not claim siren operational state', async () => {
  assert.throws(
    () => loadOfficialSourceWorkerConfig({ BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED: 'yes' }),
    (error) => error.code === 'official_source_worker_invalid_defesa_civil_rio_assets_enabled_flag',
  );
  const parsed = loadOfficialSourceWorkerConfig({ BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED: 'true' });
  assert.equal(parsed.defesaCivilRioAssetsEnabled, true);

  let calls = 0;
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      defesaCivilRioAssetsEnabled: true,
    },
    now: () => NOW,
    autoSchedule: false,
    maxConcurrency: 2,
    probeAlertaRio: async () => alertaRioSnapshot(),
    probeDefesaCivilRioAssetsLive: async () => {
      calls += 1;
      return assetsSnapshot();
    },
  });

  worker.start();
  const launched = await worker.tick();
  assert.deepEqual(
    [...launched].sort(),
    [ALERTA_RIO_RAINFALL_TASK_ID, DEFESA_CIVIL_RIO_ASSETS_TASK_ID].sort(),
  );
  assert.equal(calls, 1);

  const reading = worker.readSource(DEFESA_CIVIL_RIO_ASSETS_TASK_ID);
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.semanticValidity, DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY);
  assert.equal(reading.snapshot.sirens.count, 1);
  assert.equal(reading.snapshot.supportPoints.count, 1);

  const status = worker.status();
  assert.equal(status.defesaCivilRioAssetsConfigured, true);
  const sourceStatus = status.sources.find((source) => source.sourceId === DEFESA_CIVIL_RIO_ASSETS_SOURCE_ID);
  assert.equal(sourceStatus.payloadExposed, false);
  assert.equal(sourceStatus.semanticValidity, DEFESA_CIVIL_RIO_ASSETS_SEMANTIC_VALIDITY);
  assert.equal(JSON.stringify(status).includes('Sirene de teste'), false);
  assert.equal(JSON.stringify(status).includes('operational'), false);
});
