import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_TIDE_CIVIL_CLOCK_BINDING,
  CHM_TIDE_CIVIL_CLOCK_CONTRACT,
} from '../src/chm-tide-civil-clock.mjs';
import {
  CHM_TIDE_FUSO_SIGN_CONVENTION,
} from '../src/chm-tide-fuso.mjs';
import {
  CHM_TIDE_FUSO_BINDING,
  CHM_TIDE_TEXT_CONTRACT,
  ChmTideTextError,
  parseChmTidePdfLayoutText,
} from '../src/chm-tide-text.mjs';

const station = Object.freeze({
  stationNumber: 40,
  name: 'PORTO DO RIO DE JANEIRO - I FISCAL',
  pageStart: 130,
  pageEnd: 132,
});

const sourceArtifactSha256 = 'a'.repeat(64);
const monthNames = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL',
  'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
  'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function page(months, pageNumber, { fuso = '-03.0' } = {}) {
  const header = pageNumber === 130
    ? `PORTO DO RIO DE JANEIRO - ILHA FISCAL (ESTADO DO RIO DE JANEIRO) - 2026\nLatitude 22 53.8 S\nLongitude 43 10 W\nFuso UTC ${fuso} horas\nCHM\n70 Componentes\nNivel Medio 0.73 m\nCarta 1515\n`
    : 'CENTRO DE HIDROGRAFIA DA MARINHA\n';
  const monthHeader = months.join('          ');
  const first = months.map(() => '01 PM 0330 1,20').join('    ');
  const second = months.map(() => 'BM 10:41 0.40').join('    ');
  return `${header}${monthHeader}\n${first}\n${second}\nPAGINA ${pageNumber}`;
}

function fixture(options = {}) {
  return [
    page(monthNames.slice(0, 4), 130, options),
    page(monthNames.slice(4, 8), 131, options),
    page(monthNames.slice(8, 12), 132, options),
  ].join('\f');
}

test('parses synthetic layout while binding the official 2026 CHM UTC header and RJ civil clock', () => {
  const result = parseChmTidePdfLayoutText({
    text: fixture(), station, calendarYear: 2026, sourceArtifactSha256,
  });
  assert.equal(result.pageCount, 3);
  assert.equal(result.predictionCount, 24);
  assert.equal(result.fusoRawToken, '-03.0');
  assert.equal(result.fusoUtcOffsetHours, -3);
  assert.equal(result.fusoZoneHoursWestDerived, 3);
  assert.equal(result.baseUtcOffsetMinutes, -180);
  assert.equal(result.fusoSignConvention, CHM_TIDE_FUSO_SIGN_CONVENTION);
  assert.equal(result.fusoSemanticsBinding, CHM_TIDE_FUSO_BINDING);
  assert.equal(result.civilClockAdjustmentMinutes, 0);
  assert.equal(result.civilClockBinding, CHM_TIDE_CIVIL_CLOCK_BINDING);
  assert.equal(result.civilClockContract, CHM_TIDE_CIVIL_CLOCK_CONTRACT);
  assert.equal(result.civilClockPolicySnapshotDate, '2026-09-14');
  assert.equal(result.utcOffsetMinutes, -180);
  assert.equal(result.liveSourceExtraction, 'BLOCKED_OFFICIAL_2026_PDF_LAYOUT_NOT_YET_EVIDENCED');
  assert.equal(result.contract, CHM_TIDE_TEXT_CONTRACT);
  assert.match(result.extractedTextSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.parsedValueSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.predictions[0].localDate, '2026-01-01');
  assert.equal(result.predictions[0].localTime, '03:30');
  assert.equal(result.predictions[0].phase, 'PM');
  assert.equal(result.predictions[0].sourcePage, 130);
  assert.equal(result.predictions[1].phase, 'BM');
});

test('accepts the official catalog abbreviation I FISCAL when the PDF identity expands it to ILHA FISCAL', () => {
  const result = parseChmTidePdfLayoutText({
    text: fixture(), station, calendarYear: 2026, sourceArtifactSha256,
  });
  assert.equal(result.station.name, station.name);
});

test('fails closed if the extracted text does not contain exactly three pages', () => {
  const twoPages = fixture().split('\f').slice(0, 2).join('\f');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text: twoPages, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_page_count_invalid',
  );
});

test('fails closed if the station identity is not present in the extracted text', () => {
  const text = fixture().replace('PORTO DO RIO DE JANEIRO - ILHA FISCAL', 'ESTACAO DESCONHECIDA');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_station_identity_missing',
  );
});

test('fails closed on ambiguous signed UTC FUSO tokens instead of guessing civil-clock semantics', () => {
  const text = fixture().replace('Fuso UTC -03.0 horas', 'Fuso UTC -03.0 horas\nFuso UTC -02.0 horas');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_fuso_ambiguous',
  );
});

test('fails closed on an unlabeled nautical-style FUSO token that is not the evidenced 2026 tide-header form', () => {
  const text = fixture().replace('Fuso UTC -03.0 horas', 'FUSO +3');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_fuso_missing',
  );
});

test('fails closed when month coverage/order drifts', () => {
  const text = fixture().replace('SETEMBRO          OUTUBRO          NOVEMBRO          DEZEMBRO', 'SETEMBRO          OUTUBRO          NOVEMBRO          NOVEMBRO');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_month_coverage_invalid',
  );
});

test('fails closed when a continuation row appears before any day context', () => {
  const text = fixture().replace('01 PM 0330 1,20', 'PM 0330 1,20');
  assert.throws(
    () => parseChmTidePdfLayoutText({ text, station, calendarYear: 2026, sourceArtifactSha256 }),
    (error) => error instanceof ChmTideTextError && error.code === 'chm_tide_text_day_context_missing',
  );
});

test('fails closed when the evidenced RJ 2026 civil-clock base offset does not match the source header', () => {
  assert.throws(
    () => parseChmTidePdfLayoutText({
      text: fixture({ fuso: '-02.0' }), station, calendarYear: 2026, sourceArtifactSha256,
    }),
    (error) => error?.code === 'chm_tide_civil_clock_base_offset_mismatch',
  );
});
