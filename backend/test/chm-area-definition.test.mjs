import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_AREA_DEFINITION_CONTRACT,
  CHM_FORECAST_24H_URL,
  CHM_RJ_PREREQUISITE_AREAS,
  ChmAreaDefinitionError,
  probeChmAreaDefinitions,
  validateChmAreaDefinitionsHtml,
} from '../src/chm-area-definition.mjs';

function fixture({ bravo = 'ÁREA BRAVO (DE LAGUNA ATÉ ARRAIAL DO CABO – OCEÂNICA)', charlie = 'ÁREA CHARLIE (DE LAGUNA ATÉ ARRAIAL DO CABO - COSTEIRA)', delta = 'ÁREA DELTA (DE ARRAIAL DO CABO ATÉ CARAVELAS)' } = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header>CHM Centro de Hidrografia da Marinha</header>
    <h1>METEOROMARINHA — METAREA V</h1>
    <h2>PREVISÃO DO TEMPO VÁLIDA DE 111200 ATÉ 121200</h2>
    <h4>${bravo}</h4><p>VENTO E ONDAS.</p>
    <h4>${charlie}</h4><p>VENTO E ONDAS.</p>
    <h4>${delta}</h4><p>VENTO E ONDAS.</p>
    <h2>PREVISÃO DO TEMPO VÁLIDA DE 121200 ATÉ 131200</h2>
    <h4>${bravo}</h4><p>VENTO E ONDAS.</p>
    <h4>${charlie}</h4><p>VENTO E ONDAS.</p>
    <h4>${delta}</h4><p>VENTO E ONDAS.</p>
    <p>Boletim oficial para a navegação, com dados meteorológicos e oceanográficos em áreas costeiras e oceânicas.</p>
  </body></html>`;
}

test('extracts only the official CHM area-boundary prerequisites for future RJ geofencing', () => {
  const result = validateChmAreaDefinitionsHtml(fixture());
  assert.equal(result.sourceUrl, CHM_FORECAST_24H_URL);
  assert.equal(result.contract, CHM_AREA_DEFINITION_CONTRACT);
  assert.deepEqual(result.areas.map((area) => area.area), CHM_RJ_PREREQUISITE_AREAS);
  assert.deepEqual(result.areas[0], {
    area: 'BRAVO',
    from: 'LAGUNA',
    to: 'ARRAIAL DO CABO',
    zone: 'OCEANICA',
  });
  assert.deepEqual(result.areas[1], {
    area: 'CHARLIE',
    from: 'LAGUNA',
    to: 'ARRAIAL DO CABO',
    zone: 'COSTEIRA',
  });
  assert.deepEqual(result.areas[2], {
    area: 'DELTA',
    from: 'ARRAIAL DO CABO',
    to: 'CARAVELAS',
    zone: null,
  });
  assert.match(result.areaDefinitionSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.municipalityGeofenceValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.rjApplicability, 'UNRESOLVED_WITHOUT_GEOSPATIAL_MAPPING');
  assert.equal(result.p0Eligibility, 'BLOCKED_UNTIL_RJ_GEOFENCE_PROVEN');
});

test('accepts compatible repeated area headings from consecutive forecast periods', () => {
  const result = validateChmAreaDefinitionsHtml(fixture());
  assert.equal(result.areas.length, 3);
});

test('fails closed when an official CHM boundary label drifts', () => {
  assert.throws(
    () => validateChmAreaDefinitionsHtml(fixture({
      charlie: 'ÁREA CHARLIE (DE LAGUNA ATÉ CABO FRIO - COSTEIRA)',
    })),
    (error) => error instanceof ChmAreaDefinitionError
      && error.code === 'chm_area_definition_charlie_drift',
  );
});

test('fails closed when repeated area headings disagree', () => {
  const html = fixture().replace(
    'ÁREA DELTA (DE ARRAIAL DO CABO ATÉ CARAVELAS)</h4><p>VENTO E ONDAS.</p>\n    <p>Boletim',
    'ÁREA DELTA (DE CABO FRIO ATÉ CARAVELAS)</h4><p>VENTO E ONDAS.</p>\n    <p>Boletim',
  );
  assert.throws(
    () => validateChmAreaDefinitionsHtml(html),
    (error) => error instanceof ChmAreaDefinitionError
      && error.code === 'chm_area_definition_duplicate_conflict',
  );
});

test('fails closed when CHM identity, METAREA or forecast markers disappear', () => {
  assert.throws(
    () => validateChmAreaDefinitionsHtml(fixture().replace('Centro de Hidrografia da Marinha', 'Portal')), 
    (error) => error.code === 'chm_area_definition_identity_missing',
  );
  assert.throws(
    () => validateChmAreaDefinitionsHtml(fixture().replaceAll('METAREA V', 'BOLETIM')),
    (error) => error.code === 'chm_area_definition_metarea_missing',
  );
  assert.throws(
    () => validateChmAreaDefinitionsHtml(fixture().replaceAll('PREVISÃO DO TEMPO VÁLIDA', 'PREVISÃO')),
    (error) => error.code === 'chm_area_definition_forecast_marker_missing',
  );
});

test('live adapter is pinned to the official CHM 24-hour forecast URL', async () => {
  let observed = null;
  const result = await probeChmAreaDefinitions({
    fetchImpl: async (url) => {
      observed = String(url);
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observed, CHM_FORECAST_24H_URL);
  assert.equal(result.areas.length, 3);
});

test('area-definition contract never fabricates municipality or P0 applicability', () => {
  const result = validateChmAreaDefinitionsHtml(fixture());
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('municipalityIbge'), false);
  assert.equal(serialized.includes('municipalityName'), false);
  assert.equal(result.p0Eligibility, 'BLOCKED_UNTIL_RJ_GEOFENCE_PROVEN');
});
