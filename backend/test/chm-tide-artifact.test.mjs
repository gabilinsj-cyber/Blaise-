import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_TIDE_PDF_ARTIFACT_CONTRACT,
  CHM_TIDE_PDF_ARTIFACT_VALIDATION,
  CHM_TIDE_PDF_MAX_BYTES,
  ChmTidePdfArtifactError,
  probeChmRjTidePdfArtifacts,
  probeChmTidePdfArtifact,
  validateChmTidePdfBytes,
} from '../src/chm-tide-artifact.mjs';

const HOST = 'www.marinha.mil.br';
const PREFIX = '/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/';

function station(number = 40, name = 'PORTO DO RIO DE JANEIRO - I FISCAL', start = 130, end = 132) {
  const filename = `${number} - ${name} - ${start} - ${end}.pdf`;
  return {
    stationNumber: number,
    name,
    pageStart: start,
    pageEnd: end,
    tideTablePdfFilename: filename,
    tideTablePdfUrl: `https://${HOST}${PREFIX}${encodeURIComponent(filename)}`,
  };
}

function validPdfBytes(seed = 'A') {
  const body = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${seed.repeat(700)}\nstartxref\n123\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

function responseFor(bytes = validPdfBytes(), contentType = 'application/pdf') {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  });
}

test('validates a bounded PDF container and returns only digest-level artifact metadata', async () => {
  let observedUrl = null;
  const result = await probeChmTidePdfArtifact(station(), {
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return responseFor();
    },
  });

  assert.equal(observedUrl, station().tideTablePdfUrl);
  assert.equal(result.stationNumber, 40);
  assert.equal(result.contentType, 'application/pdf');
  assert.equal(result.pdfMagicValidation, 'PASS');
  assert.equal(result.pdfEofValidation, 'PASS');
  assert.match(result.sourceArtifactSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.rawPdfRetention, 'NONE_AFTER_VALIDATION');
  assert.equal(result.textExtraction, 'NOT_IMPLEMENTED');
  assert.equal(result.tideValueExtraction, 'NOT_IMPLEMENTED');
  assert.equal(result.contract, CHM_TIDE_PDF_ARTIFACT_CONTRACT);
  assert.equal('bytes' in result, false);
});

test('fails closed before networking when the station PDF binding leaves the official CHM host', async () => {
  const invalid = station();
  invalid.tideTablePdfUrl = invalid.tideTablePdfUrl.replace(HOST, 'example.invalid');
  let called = false;

  await assert.rejects(
    () => probeChmTidePdfArtifact(invalid, {
      fetchImpl: async () => {
        called = true;
        return responseFor();
      },
    }),
    (error) => error instanceof ChmTidePdfArtifactError && error.code === 'chm_tide_pdf_url_invalid',
  );
  assert.equal(called, false);
});

test('fails closed when the source returns HTML instead of an official PDF content type', async () => {
  await assert.rejects(
    () => probeChmTidePdfArtifact(station(), {
      fetchImpl: async () => responseFor(validPdfBytes(), 'text/html'),
    }),
    (error) => error instanceof ChmTidePdfArtifactError
      && error.code === 'chm_tide_pdf_source_content_type_rejected',
  );
});

test('fails closed when PDF magic is missing', () => {
  const bytes = validPdfBytes();
  bytes[0] = 0x58;
  assert.throws(
    () => validateChmTidePdfBytes(bytes),
    (error) => error instanceof ChmTidePdfArtifactError && error.code === 'chm_tide_pdf_magic_invalid',
  );
});

test('fails closed when the bounded artifact has no PDF EOF marker', () => {
  const bytes = new TextEncoder().encode(`%PDF-1.7\n${'A'.repeat(700)}`);
  assert.throws(
    () => validateChmTidePdfBytes(bytes),
    (error) => error instanceof ChmTidePdfArtifactError && error.code === 'chm_tide_pdf_eof_missing',
  );
});

test('fails closed on an artifact larger than the source-contract maximum', () => {
  const bytes = new Uint8Array(CHM_TIDE_PDF_MAX_BYTES + 1);
  bytes.set(new TextEncoder().encode('%PDF-'), 0);
  assert.throws(
    () => validateChmTidePdfBytes(bytes),
    (error) => error instanceof ChmTidePdfArtifactError && error.code === 'chm_tide_pdf_body_too_large',
  );
});

test('validates all seven RJ station artifacts and emits a deterministic inventory digest without raw PDF bytes', async () => {
  const stations = [
    station(38, 'PORTO DO AÇU', 124, 126),
    station(39, 'TERMINAL MARÍTIMO DE IMBETIBA', 127, 129),
    station(40, 'PORTO DO RIO DE JANEIRO - I FISCAL', 130, 132),
    station(41, 'PORTO DE ITAGUAÍ', 133, 135),
    station(42, 'PORTO DO FORNO', 136, 138),
    station(43, 'TERMINAL DA ILHA GUAÍBA', 139, 141),
    station(44, 'PORTO DE ANGRA DOS REIS', 142, 144),
  ];
  const catalog = { calendarYear: 2026, rjStationCount: 7, stations };
  const result = await probeChmRjTidePdfArtifacts(catalog, {
    fetchImpl: async (url) => responseFor(validPdfBytes(String(url).includes('38%20-') ? 'B' : 'C')),
  });

  assert.equal(result.calendarYear, 2026);
  assert.equal(result.artifactCount, 7);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.stationNumber), [38, 39, 40, 41, 42, 43, 44]);
  assert.match(result.artifactInventorySha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.pdfArtifactValidation, CHM_TIDE_PDF_ARTIFACT_VALIDATION);
  assert.equal(result.rawPdfRetention, 'NONE_AFTER_VALIDATION');
  assert.equal(result.textExtraction, 'NOT_IMPLEMENTED');
  assert.equal(result.tideValueExtraction, 'NOT_IMPLEMENTED');
  assert.equal(result.contract, CHM_TIDE_PDF_ARTIFACT_CONTRACT);
  assert.equal(result.artifacts.some((artifact) => 'bytes' in artifact), false);
});
