import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_TIDE_LIVE_TEXT_CONTRACT,
  CHM_TIDE_LIVE_TEXT_STATUS,
  ChmTideLiveTextError,
  extractChmTidePdfTextWithPdftotext,
  normalizePdftotextLayoutOutput,
} from '../src/chm-tide-live-text.mjs';

const station = Object.freeze({
  stationNumber: 40,
  name: 'PORTO DO RIO DE JANEIRO - I FISCAL',
  pageStart: 130,
  pageEnd: 132,
});
const sourceArtifactSha256 = 'b'.repeat(64);
const monthNames = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL',
  'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
  'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function page(months, pageNumber) {
  const header = pageNumber === 130
    ? 'PORTO DO RIO DE JANEIRO - ILHA FISCAL (ESTADO DO RIO DE JANEIRO) - 2026\nLatitude 22 53.8 S\nLongitude 43 10 W\nFuso UTC -03.0 horas\nCHM\n70 Componentes\nNivel Medio 0.73 m\nCarta 1515\n'
    : 'CENTRO DE HIDROGRAFIA DA MARINHA\n';
  const monthHeader = months.join('          ');
  const first = months.map(() => '01 PM 0330 1,20').join('    ');
  const second = months.map(() => 'BM 10:41 0.40').join('    ');
  return `${header}${monthHeader}\n${first}\n${second}\nPAGINA ${pageNumber}`;
}

function fixture() {
  return [
    page(monthNames.slice(0, 4), 130),
    page(monthNames.slice(4, 8), 131),
    page(monthNames.slice(8, 12), 132),
  ].join('\f');
}

test('normalizes the trailing form-feed emitted by pdftotext without removing page separators', () => {
  const normalized = normalizePdftotextLayoutOutput(`${fixture()}\f\n`);
  assert.equal(normalized.split('\f').length, 3);
  assert.equal(normalized.endsWith('\f'), false);
});

test('extracts a bounded digest-only summary and never returns raw PDF, raw text or tide predictions', async () => {
  let observedCommand = null;
  let observedArgs = null;
  const result = await extractChmTidePdfTextWithPdftotext({
    bytes: new TextEncoder().encode('%PDF-1.7 synthetic test bytes %%EOF'),
    station,
    calendarYear: 2026,
    sourceArtifactSha256,
    execFileImpl: async (command, args) => {
      observedCommand = command;
      observedArgs = args;
      return { stdout: `${fixture()}\f\n`, stderr: '' };
    },
  });

  assert.equal(observedCommand, 'pdftotext');
  assert.deepEqual(observedArgs.slice(0, 3), ['-layout', '-enc', 'UTF-8']);
  assert.equal(observedArgs.at(-1), '-');
  assert.equal(result.stationNumber, 40);
  assert.equal(result.pageCount, 3);
  assert.equal(result.predictionCount, 24);
  assert.equal(result.fusoRawToken, '-03.0');
  assert.equal(result.baseUtcOffsetMinutes, -180);
  assert.equal(result.effectiveUtcOffsetMinutes, null);
  assert.equal(result.textExtraction, CHM_TIDE_LIVE_TEXT_STATUS);
  assert.equal(result.liveTideValueIngestion, 'BLOCKED_CIVIL_CLOCK_EFFECTIVE_OFFSET_NOT_BOUND');
  assert.equal(result.contract, CHM_TIDE_LIVE_TEXT_CONTRACT);
  assert.equal('predictions' in result, false);
  assert.equal('text' in result, false);
  assert.equal('bytes' in result, false);
  assert.match(result.extractedTextSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.parsedValueSha256, /^[a-f0-9]{64}$/u);
});

test('fails closed when pdftotext execution fails', async () => {
  await assert.rejects(
    () => extractChmTidePdfTextWithPdftotext({
      bytes: new TextEncoder().encode('%PDF-1.7 synthetic test bytes %%EOF'),
      station,
      calendarYear: 2026,
      sourceArtifactSha256,
      execFileImpl: async () => { throw new Error('tool unavailable'); },
    }),
    (error) => error instanceof ChmTideLiveTextError
      && error.code === 'chm_tide_live_text_pdftotext_failed',
  );
});
