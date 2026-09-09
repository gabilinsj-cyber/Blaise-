import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_HOST,
  CHM_SOURCE_ID,
  CHM_TIDES_URL,
  CHM_WARNINGS_URL,
  ChmSourceContractError,
  probeChmTides,
  probeChmWarnings,
  validateChmTidesHtml,
  validateChmWarningsHtml,
} from '../src/chm-source.mjs';

function warningsFixture({ metarea = 'METAREA V - avisos de mau tempo', identity = 'CHM Centro de Hidrografia da Marinha', body } = {}) {
  const warnings = body ?? `
    <p>ÁREA BRAVO AVISO NR 658/2026</p>
    <p>AVISO DE VENTO FORTE/MUITO FORTE</p>
    <p>EMITIDO ÀS 1200Z - TER - 08/SET/2026</p>
    <p>ÁREA OCEÂNICA ENTRE 29S043W E 24S043W.</p>
    <p>VÁLIDO ATÉ 110000Z.</p>
    <p>ÁREA DELTA AVISO NR 659/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1230Z - TER - 08/SET/2026</p>
    <p>ONDAS DE SW 3.0/4.0 METROS.</p>
    <p>VÁLIDO ATÉ 111200Z.</p>
    <p>BRAVO AREA WARNING NR 658/2026 NEAR GALE/GALE WARNING ISSUED AT 1200Z.</p>`;
  return `<!doctype html><html lang="pt-BR"><body>
    <header>${identity}</header>
    <h1>Avisos de Mau Tempo</h1>
    <h2>${metarea}</h2>
    <p>Serviço Meteorológico Marinho: página pública oficial para consulta dos avisos emitidos na METAREA V, com informações de apoio à navegação e atualização operacional do Centro de Hidrografia da Marinha.</p>
    ${warnings}
  </body></html>`;
}

function tidesFixture({ year = 2026, dataMarker = 'Página de Dados de Maré', identity = 'CHM Centro de Hidrografia da Marinha' } = {}) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header>${identity}</header>
    <h1>Tábuas das Marés</h1>
    <h2>TÁBUAS DAS MARÉS PARA ${year} - 63ª edição</h2>
    <p>A publicação contém previsões das marés para portos e ilhas da costa do Brasil.</p>
    <a href="#">${dataMarker}</a>
  </body></html>`;
}

test('normalizes bounded official CHM METAREA V warning inventory without retaining raw warning text', () => {
  const result = validateChmWarningsHtml(warningsFixture());
  assert.equal(result.sourceId, CHM_SOURCE_ID);
  assert.equal(result.sourceHost, CHM_HOST);
  assert.equal(result.sourceUrl, CHM_WARNINGS_URL);
  assert.equal(result.metarea, 'V');
  assert.equal(result.activeWarningCount, 2);
  assert.equal(result.noWarningMarker, false);
  assert.deepEqual(result.warnings.map((record) => record.id), ['658/2026', '659/2026']);
  assert.equal(result.warnings[0].area, 'BRAVO');
  assert.equal(result.warnings[0].warningType, 'AVISO DE VENTO FORTE/MUITO FORTE');
  assert.equal(result.warnings[0].issuedZuluClock, '1200Z');
  assert.equal(result.rawWarningTextRetention, 'NONE');
  assert.equal(result.temporalValidityValidation, 'NOT_IMPLEMENTED');
  assert.equal(result.rjCoastGeofenceValidation, 'NOT_IMPLEMENTED');
  assert.match(result.warningInventorySha256, /^[a-f0-9]{64}$/);
});

test('does not duplicate Portuguese warnings from the English mirror text', () => {
  const result = validateChmWarningsHtml(warningsFixture());
  assert.equal(result.activeWarningCount, 2);
});

test('accepts an explicit CHM no-warning marker without fabricating warnings', () => {
  const result = validateChmWarningsHtml(warningsFixture({ body: '<p>NIL - NÃO HÁ AVISOS DE MAU TEMPO EM VIGOR.</p>' }));
  assert.equal(result.activeWarningCount, 0);
  assert.equal(result.noWarningMarker, true);
  assert.deepEqual(result.warnings, []);
});

test('fails closed when METAREA V identity drifts', () => {
  assert.throws(
    () => validateChmWarningsHtml(warningsFixture({ metarea: 'Boletim geral' })),
    (error) => error instanceof ChmSourceContractError && error.code === 'chm_metarea_v_marker_missing',
  );
});

test('fails closed when warning inventory is absent without an explicit NIL/no-warning marker', () => {
  assert.throws(
    () => validateChmWarningsHtml(warningsFixture({ body: '<p>Conteúdo indisponível.</p>' })),
    (error) => error instanceof ChmSourceContractError && error.code === 'chm_warning_inventory_missing',
  );
});

test('warning probe fetches only the pinned official CHM warning URL', async () => {
  let observedUrl = null;
  const result = await probeChmWarnings({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(warningsFixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, CHM_WARNINGS_URL);
  assert.equal(result.activeWarningCount, 2);
});

test('normalizes the official CHM tide publication discovery contract without claiming tide values', () => {
  const result = validateChmTidesHtml(tidesFixture());
  assert.equal(result.sourceId, CHM_SOURCE_ID);
  assert.equal(result.sourceHost, CHM_HOST);
  assert.equal(result.sourceUrl, CHM_TIDES_URL);
  assert.equal(result.calendarYear, 2026);
  assert.equal(result.tideValueIngestion, 'NOT_IMPLEMENTED');
  assert.equal(result.portSelectionValidation, 'NOT_IMPLEMENTED');
  assert.match(result.tidePublicationSha256, /^[a-f0-9]{64}$/);
});

test('fails closed when the CHM tide data-page marker disappears', () => {
  assert.throws(
    () => validateChmTidesHtml(tidesFixture({ dataMarker: 'Consulta genérica' })),
    (error) => error instanceof ChmSourceContractError && error.code === 'chm_tide_data_page_marker_missing',
  );
});

test('tide probe fetches only the pinned official CHM tide publication URL', async () => {
  let observedUrl = null;
  const result = await probeChmTides({
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(tidesFixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(observedUrl, CHM_TIDES_URL);
  assert.equal(result.calendarYear, 2026);
});
