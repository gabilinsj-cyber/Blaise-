import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERTA_RIO_RAINFALL_TASK_ID,
  DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
  createOfficialSourceWorker,
} from '../src/official-source-worker.mjs';
import { STATEWIDE_SOURCE_RESPONSIBILITIES } from '../src/statewide-dashboard.mjs';

test('link-only municipal sources never poll the excluded live feeds', async () => {
  let bannedCalls = 0;
  const worker = createOfficialSourceWorker({
    config: {
      enabled: true,
      initialMode: 'normal',
      ineaStationUrl: null,
      municipalNoticeLinksOnly: true,
      defesaCivilRioAssetsEnabled: true,
    },
    now: () => Date.parse('2026-11-16T16:00:00Z'),
    autoSchedule: false,
    probeAlertaRio: async () => { bannedCalls += 1; throw new Error('forbidden'); },
    probeDefesaCivilRioAssetsLive: async () => { bannedCalls += 1; throw new Error('forbidden'); },
  });

  assert.equal(worker.start(), true);
  await worker.tick();
  assert.equal(bannedCalls, 0);
  assert.equal(worker.status().municipalNoticeLinksOnly, true);
  assert.equal(worker.status().defesaCivilRioAssetsConfigured, false);
  assert.deepEqual(worker.status().sources, []);
  assert.throws(() => worker.readSource(ALERTA_RIO_RAINFALL_TASK_ID));
  assert.throws(() => worker.readSource(DEFESA_CIVIL_RIO_ASSETS_TASK_ID));
  worker.stop();
});

test('comparison source catalog omits excluded providers without removing NOAA', () => {
  const ids = STATEWIDE_SOURCE_RESPONSIBILITIES.map(x => x.id);
  for (const id of ['alerta-rio', 'defesa-civil', 'windy']) assert.equal(ids.includes(id), false);
  for (const id of ['inmet','cemaden-rj']) assert.equal(ids.includes(id), false);
  for (const id of ['noaa', 'ecmwf', 'dwd', 'nasa', 'jaxa', 'eumetsat', 'agente-13-openweather']) {
    assert.equal(ids.includes(id), true);
  }
});
