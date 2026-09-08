import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INEA_RADAR_INVENTORY_CONTRACT,
  INEA_RADAR_INVENTORY_HOST,
  INEA_RADAR_INVENTORY_IDENTITIES,
  IneaRadarInventoryError,
  probeIneaRadarOfficialInventory,
  validateIneaRadarOfficialInventoryHtml,
} from '../src/inea-radar-inventory.mjs';

function inventoryHtml(overrides = '') {
  return `<!doctype html><html><body>
    <h1>Inundações</h1>
    <p>O Sistema de Alerta de Cheias apoia a prevenção de eventos hidrometeorológicos.</p>
    <p>Em 2015, dois radares meteorológicos de última geração foram instalados no bairro de Guaratiba, na Zona Oeste do Rio de Janeiro, e no município de Macaé, no Norte Fluminense, para ampliar a cobertura do Sistema de Alerta de Cheias.</p>
    ${overrides}
    ${'monitoramento '.repeat(30)}
  </body></html>`;
}

function assertCode(fn, code) {
  assert.throws(fn, (error) => error instanceof IneaRadarInventoryError && error.code === code);
}

test('validates the official two-radar INEA inventory without retaining the raw source URL', () => {
  const result = validateIneaRadarOfficialInventoryHtml(inventoryHtml());
  assert.equal(result.contract, INEA_RADAR_INVENTORY_CONTRACT);
  assert.equal(result.sourceHost, INEA_RADAR_INVENTORY_HOST);
  assert.deepEqual(result.identities, ['guaratiba', 'macae']);
  assert.deepEqual(result.identities, INEA_RADAR_INVENTORY_IDENTITIES);
  assert.equal(result.identityCount, 2);
  assert.match(result.sourceUrlSha256, /^[a-f0-9]{64}$/);
  assert.match(result.inventorySha256, /^[a-f0-9]{64}$/);
  assert.equal(result.rawSourceUrl, 'REDACTED');
  assert.equal(result.sameCandidateIdentityBinding, 'NOT_IMPLEMENTED');
});

test('fails closed when either official radar identity marker is absent', () => {
  const withoutGuaratiba = inventoryHtml().replaceAll('Guaratiba', 'Zona Oeste');
  assertCode(
    () => validateIneaRadarOfficialInventoryHtml(withoutGuaratiba),
    'inea_radar_inventory_guaratiba_marker_missing',
  );

  const withoutMacae = inventoryHtml().replaceAll('Macaé', 'Norte Fluminense');
  assertCode(
    () => validateIneaRadarOfficialInventoryHtml(withoutMacae),
    'inea_radar_inventory_macae_marker_missing',
  );
});

test('fails closed when the official two-radar context or flood-alert system marker changes', () => {
  assertCode(
    () => validateIneaRadarOfficialInventoryHtml(
      inventoryHtml().replaceAll('dois radares meteorológicos', 'equipamentos meteorológicos'),
    ),
    'inea_radar_inventory_count_marker_missing',
  );
  assertCode(
    () => validateIneaRadarOfficialInventoryHtml(
      inventoryHtml().replaceAll('Sistema de Alerta de Cheias', 'Sistema Operacional'),
    ),
    'inea_radar_inventory_system_marker_missing',
  );
});

test('live inventory probe enforces official host and maps source-contract failures', async () => {
  let requestedUrl = null;
  const result = await probeIneaRadarOfficialInventory({
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(inventoryHtml(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.match(requestedUrl, /^https:\/\/www\.inea\.rj\.gov\.br\//);
  assert.equal(result.contract, INEA_RADAR_INVENTORY_CONTRACT);

  await assert.rejects(
    () => probeIneaRadarOfficialInventory({
      fetchImpl: async () => new Response('unavailable', { status: 503 }),
    }),
    (error) => error instanceof IneaRadarInventoryError && error.code === 'inea_radar_inventory_source_http_error',
  );
});
