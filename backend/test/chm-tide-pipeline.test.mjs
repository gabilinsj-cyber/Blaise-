import assert from 'node:assert/strict';
import test from 'node:test';

import { createChmTideValuesCache } from '../src/chm-tide-cache.mjs';
import {
  CHM_TIDE_DELIVERY_CONTRACT,
  CHM_TIDE_SOURCE_TO_CACHE_CONTRACT,
  buildChmTideDelivery,
  ingestChmTidePdfToCache,
} from '../src/chm-tide-pipeline.mjs';

const station = Object.freeze({
  stationNumber: 40,
  name: 'PORTO DO RIO DE JANEIRO - I FISCAL',
  pageStart: 130,
  pageEnd: 132,
});
const sourceArtifactSha256 = 'c'.repeat(64);
const monthNames = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL',
  'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
  'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function page(months, pageNumber) {
  const header = pageNumber === 130
    ? 'PORTO DO RIO DE JANEIRO - ILHA FISCAL (ESTADO DO RIO DE JANEIRO) - 2026\nLatitude 22 53.8 S\nLongitude 43 10 W\nFuso UTC -03.0 horas\nCHM\n70 Componentes\nNivel Medio 0.73 m\nCarta 1515\n'
    : 'CENTRO DE HIDROGRAFIA DA MARINHA\n';
  return `${header}${months.join('          ')}\n${months.map(() => '01 PM 0330 1,20').join('    ')}\n${months.map(() => 'BM 10:41 0.40').join('    ')}\nPAGINA ${pageNumber}`;
}

function fixture() {
  return [
    page(monthNames.slice(0, 4), 130),
    page(monthNames.slice(4, 8), 131),
    page(monthNames.slice(8, 12), 132),
  ].join('\f');
}

const bytes = new TextEncoder().encode('%PDF-1.7 synthetic test bytes %%EOF');
const execFixture = async () => ({ stdout: `${fixture()}\f\n`, stderr: '' });

test('CHM tide pipeline ingests normalized official-layout values, reads cache back and builds delivery contract', async () => {
  const fetchedAt = Date.parse('2026-09-14T18:00:00Z');
  const cache = createChmTideValuesCache({ now: () => fetchedAt });
  const result = await ingestChmTidePdfToCache({
    cache,
    bytes,
    station,
    calendarYear: 2026,
    sourceArtifactSha256,
    fetchedAt,
    execFileImpl: execFixture,
  });

  assert.equal(result.sourceToCacheIngestion, 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK');
  assert.equal(result.cacheState, 'CURRENT');
  assert.equal(result.pipelineContract, CHM_TIDE_SOURCE_TO_CACHE_CONTRACT);
  assert.equal(result.deliveryContract, CHM_TIDE_DELIVERY_CONTRACT);
  assert.equal(result.delivery.contract, CHM_TIDE_DELIVERY_CONTRACT);
  assert.equal(result.delivery.sourceId, 'chm-marine');
  assert.equal(result.delivery.stationNumber, 40);
  assert.equal(result.delivery.snapshot.predictionCount, 24);
  assert.equal(result.delivery.snapshot.predictions[0].instantUtc, '2026-01-01T06:30:00.000Z');
  assert.equal(result.delivery.snapshot.tideValueSha256, result.tideValueSha256);
  assert.match(result.deliverySha256, /^[a-f0-9]{64}$/u);
  assert.equal('text' in result, false);
  assert.equal('bytes' in result, false);
});

test('CHM tide pipeline records extraction failure and keeps cache unavailable without a verified snapshot', async () => {
  const fetchedAt = Date.parse('2026-09-14T18:00:00Z');
  const cache = createChmTideValuesCache({ now: () => fetchedAt });
  await assert.rejects(() => ingestChmTidePdfToCache({
    cache,
    bytes,
    station,
    calendarYear: 2026,
    sourceArtifactSha256,
    fetchedAt,
    execFileImpl: async () => { throw new Error('pdftotext unavailable'); },
  }));

  const reading = cache.read({ stationNumber: 40, calendarYear: 2026, at: fetchedAt });
  assert.equal(reading.state, 'UNAVAILABLE');
  assert.equal(reading.reason, 'refresh_failed_without_snapshot');
  assert.equal(reading.lastErrorCode, 'chm_tide_live_text_pdftotext_failed');
  assert.equal(reading.snapshot, null);
});

test('delivery builder refuses stale or unavailable cache states', () => {
  const cache = createChmTideValuesCache({ now: () => Date.parse('2026-09-14T18:00:00Z') });
  const reading = cache.read({ stationNumber: 40, calendarYear: 2026 });
  assert.throws(() => buildChmTideDelivery(reading), /chm_tide_delivery_state_not_current/u);
});
