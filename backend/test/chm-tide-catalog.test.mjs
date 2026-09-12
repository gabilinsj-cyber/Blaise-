import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_EXPECTED_RJ_TIDE_STATION_COUNT,
  CHM_RJ_TIDE_CATALOG_CONTRACT,
  CHM_RJ_TIDE_CATALOG_URL,
  ChmTideCatalogError,
  probeChmRjTideCatalog,
  validateChmRjTideCatalogHtml,
} from '../src/chm-tide-catalog.mjs';

function stationRows() {
  return `
    <div>42 - PORTO DO FORNO - 136 - 138 POINT (-42.01 -22.97) Rio de Janeiro</div>
    <div>38 - PORTO DO AÇU - 124 - 126 POINT (-40.1 -21.81) Rio de Janeiro</div>
    <div>39 - TERMINAL MARÍTIMO DE IMBETIBA - 127 - 129 POINT (-41.77 -22.39) Rio de Janeiro</div>
    <div>40 - PORTO DO RIO DE JANEIRO - I FISCAL - 130 - 132 POINT (-43.17 -22.9) Rio de Janeiro</div>
    <div>41 - PORTO DE ITAGUAÍ - 133 - 135 POINT (-43.84 -22.93) Rio de Janeiro</div>
    <div>43 - TERMINAL DA ILHA GUAÍBA - 139 - 141 POINT (-44.03 -22.1) Rio de Janeiro</div>
    <div>44 - PORTO DE ANGRA DOS REIS - 142 - 144 POINT (-44.32 -23.01) Rio de Janeiro</div>
  `;
}

function fixture({ year = 2026, rows = stationRows(), identity = 'CHM Centro de Hidrografia da Marinha' } = {}) {
  return `<!doctype html><html lang="pt-BR">
    <head><title>Tábuas de Maré ${year} | CHM</title></head>
    <body>
      <header>${identity}</header>
      <h1>Tábuas de Maré ${year}</h1>
      <section><h2>Rio de Janeiro</h2>${rows}</section>
      <p>Catálogo oficial de estações de maré.</p>
    </body>
  </html>`;
}

test('normalizes the seven official RJ tide-table stations without claiming tide values', () => {
  const result = validateChmRjTideCatalogHtml(fixture());

  assert.equal(result.calendarYear, 2026);
  assert.equal(result.rjStationCount, CHM_EXPECTED_RJ_TIDE_STATION_COUNT);
  assert.equal(result.rjStationCount, 7);
  assert.deepEqual(result.stations.map((station) => station.stationNumber), [38, 39, 40, 41, 42, 43, 44]);
  assert.deepEqual(result.stations.map((station) => station.name), [
    'PORTO DO AÇU',
    'TERMINAL MARÍTIMO DE IMBETIBA',
    'PORTO DO RIO DE JANEIRO - I FISCAL',
    'PORTO DE ITAGUAÍ',
    'PORTO DO FORNO',
    'TERMINAL DA ILHA GUAÍBA',
    'PORTO DE ANGRA DOS REIS',
  ]);
  assert.equal(result.stations[2].longitude, -43.17);
  assert.equal(result.stations[2].latitude, -22.9);
  assert.equal(result.portSelectionValidation, 'PASS_OFFICIAL_RJ_TIDE_STATION_CATALOG');
  assert.equal(result.tideValueIngestion, 'NOT_IMPLEMENTED');
  assert.equal(result.rawCatalogTextRetention, 'NONE');
  assert.equal(result.contract, CHM_RJ_TIDE_CATALOG_CONTRACT);
  assert.match(result.stationCatalogSha256, /^[a-f0-9]{64}$/);
});

test('fails closed when the official RJ station count drifts', () => {
  const rows = stationRows().replace(
    '<div>44 - PORTO DE ANGRA DOS REIS - 142 - 144 POINT (-44.32 -23.01) Rio de Janeiro</div>',
    '',
  );

  assert.throws(
    () => validateChmRjTideCatalogHtml(fixture({ rows })),
    (error) => error instanceof ChmTideCatalogError
      && error.code === 'chm_rj_tide_station_count_invalid',
  );
});

test('fails closed on duplicate official station numbers', () => {
  const rows = stationRows().replace(
    '44 - PORTO DE ANGRA DOS REIS',
    '38 - PORTO DE ANGRA DOS REIS',
  );

  assert.throws(
    () => validateChmRjTideCatalogHtml(fixture({ rows })),
    (error) => error instanceof ChmTideCatalogError
      && error.code === 'chm_rj_tide_station_number_duplicate',
  );
});

test('fails closed when an RJ station coordinate leaves the RJ coastal bounds', () => {
  const rows = stationRows().replace('POINT (-40.1 -21.81)', 'POINT (-35.1 -21.81)');

  assert.throws(
    () => validateChmRjTideCatalogHtml(fixture({ rows })),
    (error) => error instanceof ChmTideCatalogError
      && error.code === 'chm_rj_tide_longitude_invalid',
  );
});

test('fails closed when the CHM tide catalog identity marker disappears', () => {
  assert.throws(
    () => validateChmRjTideCatalogHtml(fixture({ identity: 'Portal genérico' })),
    (error) => error instanceof ChmTideCatalogError
      && error.code === 'chm_rj_tide_catalog_identity_missing',
  );
});

test('RJ tide catalog probe fetches only the pinned official CHM catalog URL', async () => {
  let observedUrl = null;
  const result = await probeChmRjTideCatalog({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });

  assert.equal(observedUrl, CHM_RJ_TIDE_CATALOG_URL);
  assert.equal(result.rjStationCount, 7);
  assert.equal(result.portSelectionValidation, 'PASS_OFFICIAL_RJ_TIDE_STATION_CATALOG');
});
