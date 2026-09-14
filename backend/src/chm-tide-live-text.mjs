import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { parseChmTidePdfLayoutText } from './chm-tide-text.mjs';

export const CHM_TIDE_LIVE_TEXT_CONTRACT = 'OFFICIAL_CHM_PDF_EPHEMERAL_PDFTOTEXT_LAYOUT_EXTRACTION_BOUNDARY';
export const CHM_TIDE_LIVE_TEXT_STATUS = 'PASS_EPHEMERAL_PDFTOTEXT_LAYOUT_PARSED';
export const CHM_TIDE_LIVE_TEXT_MAX_OUTPUT_BYTES = 1024 * 1024;

const execFileAsync = promisify(execFileCallback);

export class ChmTideLiveTextError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideLiveTextError';
    this.code = code;
  }
}

export function normalizePdftotextLayoutOutput(value) {
  if (typeof value !== 'string') throw new ChmTideLiveTextError('chm_tide_live_text_output_invalid');
  const normalized = value
    .replace(/\r\n?/gu, '\n')
    .replace(/\f\s*$/u, '');
  const byteLength = Buffer.byteLength(normalized, 'utf8');
  if (byteLength < 128) throw new ChmTideLiveTextError('chm_tide_live_text_output_too_small');
  if (byteLength > CHM_TIDE_LIVE_TEXT_MAX_OUTPUT_BYTES) {
    throw new ChmTideLiveTextError('chm_tide_live_text_output_too_large');
  }
  if (/\u0000/u.test(normalized)) throw new ChmTideLiveTextError('chm_tide_live_text_output_nul_invalid');
  return normalized;
}

function summary(parsed) {
  return Object.freeze({
    stationNumber: parsed.station.stationNumber,
    stationName: parsed.station.name,
    sourceArtifactSha256: parsed.sourceArtifactSha256,
    extractedTextSha256: parsed.extractedTextSha256,
    extractedTextByteLength: parsed.extractedTextByteLength,
    pageCount: parsed.pageCount,
    fusoRawToken: parsed.fusoRawToken,
    fusoUtcOffsetHours: parsed.fusoUtcOffsetHours,
    baseUtcOffsetMinutes: parsed.baseUtcOffsetMinutes,
    civilClockBinding: parsed.civilClockBinding,
    effectiveUtcOffsetMinutes: parsed.utcOffsetMinutes,
    predictionCount: parsed.predictionCount,
    parsedValueSha256: parsed.parsedValueSha256,
    rawPdfRetention: 'NONE_AFTER_EPHEMERAL_EXTRACTION',
    rawTextRetention: 'NONE',
    textExtraction: CHM_TIDE_LIVE_TEXT_STATUS,
    liveTideValueIngestion: 'BLOCKED_CIVIL_CLOCK_EFFECTIVE_OFFSET_NOT_BOUND',
    contract: CHM_TIDE_LIVE_TEXT_CONTRACT,
  });
}

export async function extractChmTidePdfTextWithPdftotext({
  bytes,
  station,
  calendarYear,
  sourceArtifactSha256,
  execFileImpl = execFileAsync,
  temporaryRoot = tmpdir(),
} = {}) {
  if (!(bytes instanceof Uint8Array)) throw new ChmTideLiveTextError('chm_tide_live_text_pdf_bytes_invalid');
  if (typeof execFileImpl !== 'function') throw new ChmTideLiveTextError('chm_tide_live_text_exec_invalid');

  const directory = await mkdtemp(join(temporaryRoot, 'blaise-chm-tide-'));
  const pdfPath = join(directory, 'source.pdf');
  try {
    await writeFile(pdfPath, bytes, { mode: 0o600 });
    let result;
    try {
      result = await execFileImpl(
        'pdftotext',
        ['-layout', '-enc', 'UTF-8', pdfPath, '-'],
        { timeout: 12_000, maxBuffer: CHM_TIDE_LIVE_TEXT_MAX_OUTPUT_BYTES + 64 * 1024 },
      );
    } catch {
      throw new ChmTideLiveTextError('chm_tide_live_text_pdftotext_failed');
    }

    const text = normalizePdftotextLayoutOutput(result?.stdout);
    const parsed = parseChmTidePdfLayoutText({
      text,
      station,
      calendarYear,
      sourceArtifactSha256,
    });
    return summary(parsed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
