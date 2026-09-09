import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CEMADEN_RJ_EXPECTED_MUNICIPALITIES,
  CEMADEN_RJ_HOST,
  CEMADEN_RJ_SOURCE_ID,
  CEMADEN_RJ_HYDRO_URL,
  CemadenRjSourceContractError,
  probeCemadenRjHydrologicalRisk,
  validateCemadenRjHydrologicalHtml,
} from '../src/cemaden-rj-source.mjs';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';

const REDECS = [
  'CAPITAL', 'METROPOLITANA', 'BAIXADA FLUMINENSE', 'COSTA VERDE',
  'BAIXADA LITORÂNEA', 'NORTE', 'NOROESTE', 'SERRANA I', 'SERRANA II', 'SUL I', 'SUL II',
];
const RISK = [
  ['MUITO BAIXO', 1],
  ['BAIXO', 2],
  ['MODERADO', 3],
  ['ALTO', 4],
  ['MUITO ALTO', 5],
];

function row({ city, index, risk = RISK[index % RISK.length], redec = REDECS[index % REDECS.length], timestamp } = {}) {
  const observed = timestamp ?? `09/09/2026 ${String(8 + (index % 10)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`;
  return `<tr><td>${city.name}</td><td>${redec}</td><td>${risk[0]}</td><td>${observed}</td><td><a href="#">histórico</a></td><td>${risk[1]}</td></tr>`;
}

function fixture({ transformRows } = {}) {
  let rows = RJ_MUNICIPALITIES.map((city, index) => row({ city, index }));
  if (transformRows) rows = transformRows(rows);
  return `<!doctype html><html><head><title>CEMADEN-RJ</title></head><body>
    <h1>Risco Hidrológico - Status atual dos Municípios</h1>
    <div>Lista de Município</div>
    <table><thead><tr><th>Município</th><th>Redec</th><th>Risco Atual</th><th>Última Atualização</th><th>Histórico</th><th>Prioridade</th></tr></thead>
    <tbody>${rows.join('\n')}</tbody></table><footer>CEMADEN-RJ</footer></body></html>`;
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof CemadenRjSourceContractError && error.code === code);
}

test('CEMADEN-RJ hydrological contract requires exact 92-city canonical coverage', () => {
  const result = validateCemadenRjHydrologicalHtml(fixture());
  assert.equal(result.sourceId, CEMADEN_RJ_SOURCE_ID);
  assert.equal(result.sourceHost, CEMADEN_RJ_HOST);
  assert.equal(result.sourceUrl, CEMADEN_RJ_HYDRO_URL);
  assert.equal(result.municipalityCount, CEMADEN_RJ_EXPECTED_MUNICIPALITIES);
  assert.equal(result.records.length, 92);
  assert.equal(result.municipalCoverage, '92_OF_92_CANONICAL_RJ');
  assert.equal(result.maxPriority, 5);
  assert.equal(result.highestRisk, 'MUITO ALTO');
  assert.match(result.statusInventorySha256, /^[a-f0-9]{64}$/);
  assert.equal(result.operationalFreshnessValidation, 'NOT_YET_PROVEN');
  assert.equal(result.p0PromotionPolicy, 'NOT_IMPLEMENTED');
  const niteroi = result.records.find((record) => record.ibge === '3303302');
  assert.equal(niteroi?.municipality, 'Niterói');
});

test('CEMADEN-RJ contract is deterministic regardless of source row order', () => {
  const a = validateCemadenRjHydrologicalHtml(fixture());
  const b = validateCemadenRjHydrologicalHtml(fixture({ transformRows: (rows) => [...rows].reverse() }));
  assert.equal(a.statusInventorySha256, b.statusInventorySha256);
});

test('CEMADEN-RJ contract rejects duplicate municipality', () => {
  const html = fixture({ transformRows: (rows) => {
    const copy = [...rows];
    copy[copy.length - 1] = row({ city: RJ_MUNICIPALITIES[0], index: 91 });
    return copy;
  }});
  expectCode(() => validateCemadenRjHydrologicalHtml(html), 'cemaden_duplicate_municipality');
});

test('CEMADEN-RJ contract rejects incomplete municipal coverage', () => {
  const html = fixture({ transformRows: (rows) => rows.slice(0, -1) });
  expectCode(() => validateCemadenRjHydrologicalHtml(html), 'cemaden_municipality_count_invalid');
});

test('CEMADEN-RJ contract rejects risk and priority mismatch', () => {
  const html = fixture({ transformRows: (rows) => {
    const copy = [...rows];
    copy[0] = row({ city: RJ_MUNICIPALITIES[0], index: 0, risk: ['BAIXO', 3] });
    return copy;
  }});
  expectCode(() => validateCemadenRjHydrologicalHtml(html), 'cemaden_risk_priority_mismatch');
});

test('CEMADEN-RJ contract rejects unknown risk level', () => {
  const html = fixture({ transformRows: (rows) => {
    const copy = [...rows];
    copy[0] = row({ city: RJ_MUNICIPALITIES[0], index: 0, risk: ['CRÍTICO', 5] });
    return copy;
  }});
  expectCode(() => validateCemadenRjHydrologicalHtml(html), 'cemaden_risk_invalid');
});

test('CEMADEN-RJ contract rejects invalid official timestamp', () => {
  const html = fixture({ transformRows: (rows) => {
    const copy = [...rows];
    copy[0] = row({ city: RJ_MUNICIPALITIES[0], index: 0, timestamp: '31/02/2026 12:00:00' });
    return copy;
  }});
  expectCode(() => validateCemadenRjHydrologicalHtml(html), 'cemaden_timestamp_invalid');
});

test('CEMADEN-RJ live probe applies bounded HTTPS/host/content contract', async () => {
  let captured;
  const result = await probeCemadenRjHydrologicalRisk({
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(fixture(), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  assert.equal(captured.url, CEMADEN_RJ_HYDRO_URL);
  assert.equal(captured.options.redirect, 'manual');
  assert.equal(result.municipalityCount, 92);
});

test('CEMADEN-RJ live probe fails closed on redirects', async () => {
  await assert.rejects(
    probeCemadenRjHydrologicalRisk({
      fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://example.com/' } }),
    }),
    (error) => error instanceof CemadenRjSourceContractError && error.code === 'cemaden_source_redirect_rejected',
  );
});
