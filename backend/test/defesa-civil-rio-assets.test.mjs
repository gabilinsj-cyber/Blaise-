import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFESA_CIVIL_RIO_ASSETS_HOST,
  DEFESA_CIVIL_RIO_SIRENS_URL,
  DEFESA_CIVIL_RIO_SUPPORT_POINTS_URL,
  probeDefesaCivilRioMapAssets,
  validateDefesaCivilRioSirens,
  validateDefesaCivilRioSupportPoints,
} from '../src/defesa-civil-rio-assets.mjs';

function envelope(features) {
  return {
    geometryType: 'esriGeometryPoint',
    spatialReference: { wkid: 4326, latestWkid: 4326 },
    features,
  };
}

function siren(objectid, cod_sirene, x, y, overrides = {}) {
  return {
    attributes: {
      objectid,
      cod_sirene,
      sirene: `Sirene ${cod_sirene}`,
      favela: 'Comunidade A',
      nome_favela: 'Comunidade A',
      referencia: 'Referência pública',
      pluviometro: 1,
      globalid: `{00000000-0000-4000-8000-${String(objectid).padStart(12, '0')}}`,
      ...overrides,
    },
    geometry: { x, y },
  };
}

function supportPoint(objectid, cod_papoio, x, y, overrides = {}) {
  return {
    attributes: {
      objectid,
      cod_papoio,
      pontos_apo: `Ponto ${cod_papoio}`,
      favela: 'Comunidade B',
      nome_favela: 'Comunidade B',
      ref_cia: 'Escola municipal',
      end_rco: 'Rua de teste, 100',
      pto_ppal: 'Entrada principal',
      globalid: `{10000000-0000-4000-8000-${String(objectid).padStart(12, '0')}}`,
      ...overrides,
    },
    geometry: { x, y },
  };
}

const validSirens = () => envelope([
  siren(1, 11, -43.25, -22.95),
  siren(2, 12, -43.30, -22.90),
]);
const validSupportPoints = () => envelope([
  supportPoint(10, 21, -43.24, -22.94),
  supportPoint(11, 22, -43.29, -22.89),
]);

test('Defesa Civil Rio URLs are fixed to the official ArcGIS host and WGS84 geometry', () => {
  for (const raw of [DEFESA_CIVIL_RIO_SIRENS_URL, DEFESA_CIVIL_RIO_SUPPORT_POINTS_URL]) {
    const url = new URL(raw);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, DEFESA_CIVIL_RIO_ASSETS_HOST);
    assert.equal(url.searchParams.get('where'), '1=1');
    assert.equal(url.searchParams.get('returnGeometry'), 'true');
    assert.equal(url.searchParams.get('outSR'), '4326');
    assert.equal(url.searchParams.get('orderByFields'), 'objectid');
    assert.equal(url.searchParams.get('f'), 'json');
  }
});

test('normalizes bounded sirens and support points with deterministic digests', () => {
  const sirens = validateDefesaCivilRioSirens(validSirens());
  const supportPoints = validateDefesaCivilRioSupportPoints(validSupportPoints());

  assert.equal(sirens.count, 2);
  assert.match(sirens.sha256, /^[0-9a-f]{64}$/);
  assert.equal(sirens.items[0].sirenCode, 11);
  assert.equal(sirens.items[0].hasRainGauge, true);
  assert.deepEqual(sirens.items[0].geometry, { longitude: -43.25, latitude: -22.95 });

  assert.equal(supportPoints.count, 2);
  assert.match(supportPoints.sha256, /^[0-9a-f]{64}$/);
  assert.equal(supportPoints.items[0].supportCode, 21);
  assert.equal(supportPoints.items[0].address, 'Rua de teste, 100');
});

test('fails closed on ArcGIS transfer truncation, spatial drift and geometry outside Rio bounds', () => {
  assert.throws(
    () => validateDefesaCivilRioSirens({ ...validSirens(), exceededTransferLimit: true }),
    /defesa_civil_rio_transfer_limit_exceeded/,
  );
  assert.throws(
    () => validateDefesaCivilRioSupportPoints({ ...validSupportPoints(), spatialReference: { wkid: 31983 } }),
    /defesa_civil_rio_spatial_reference_drift/,
  );
  const outside = validSirens();
  outside.features[0].geometry.x = -40;
  assert.throws(
    () => validateDefesaCivilRioSirens(outside),
    /defesa_civil_rio_geometry_outside_expected_bounds/,
  );
});

test('fails closed on duplicate source identifiers and invalid operational flags', () => {
  const duplicate = validSirens();
  duplicate.features[1].attributes.cod_sirene = 11;
  assert.throws(
    () => validateDefesaCivilRioSirens(duplicate),
    /defesa_civil_rio_duplicate_siren_code/,
  );

  const invalidFlag = validSirens();
  invalidFlag.features[0].attributes.pluviometro = 2;
  assert.throws(
    () => validateDefesaCivilRioSirens(invalidFlag),
    /defesa_civil_rio_invalid_rain_gauge_flag/,
  );
});

test('live probe wrapper uses only the two fixed official URLs and returns no raw response metadata', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    const payload = String(url).includes('/0/query') ? validSirens() : validSupportPoints();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await probeDefesaCivilRioMapAssets({ fetchImpl });
  assert.deepEqual(seen.sort(), [DEFESA_CIVIL_RIO_SIRENS_URL, DEFESA_CIVIL_RIO_SUPPORT_POINTS_URL].sort());
  assert.equal(result.sourceHost, DEFESA_CIVIL_RIO_ASSETS_HOST);
  assert.equal(result.sirens.count, 2);
  assert.equal(result.supportPoints.count, 2);
  assert.equal(result.spatialReference, 4326);
});
