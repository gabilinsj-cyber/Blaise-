import { createHash } from 'node:crypto';

import {
  CHM_EXPECTED_RJ_TIDE_STATION_COUNT,
  CHM_TIDE_CATALOG_HOST,
  CHM_TIDE_PDF_PATH_PREFIX,
} from './chm-tide-catalog.mjs';
import { fetchBinaryContract, SourceContractError } from './source-contract.mjs';

export const CHM_TIDE_PDF_ARTIFACT_SOURCE_ID = 'chm-marine';
export const CHM_TIDE_PDF_ARTIFACT_CONTRACT = 'OFFICIAL_CHM_TIDE_PDF_ARTIFACT_VALIDATED_NO_TEXT_EXTRACTION';
export const CHM_TIDE_PDF_ARTIFACT_VALIDATION = 'PASS_OFFICIAL_CHM_PDF_CONTAINER_AND_DIGEST';
export const CHM_TIDE_PDF_MAX_BYTES = 2 * 1024 * 1024;
export const CHM_TIDE_PDF_MIN_BYTES = 512;

export class ChmTidePdfArtifactError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTidePdfArtifactError';
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTidePdfArtifactError(code);
  }
  return parsed;
}

function normalizeStationName(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 3 || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_station_name_invalid');
  }
  return normalized;
}

function validateStationDescriptor(station) {
  if (!station || typeof station !== 'object' || Array.isArray(station)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_station_missing');
  }

  const stationNumber = boundedInteger(station.stationNumber, 1, 99, 'chm_tide_pdf_station_number_invalid');
  const name = normalizeStationName(station.name);
  const pageStart = boundedInteger(station.pageStart, 1, 400, 'chm_tide_pdf_page_range_invalid');
  const pageEnd = boundedInteger(station.pageEnd, 1, 400, 'chm_tide_pdf_page_range_invalid');
  if (pageEnd - pageStart !== 2) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_page_range_invalid');
  }

  const rawUrl = String(station.tideTablePdfUrl ?? '').trim();
  const filename = String(station.tideTablePdfFilename ?? '').trim();
  if (!rawUrl || !filename) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_binding_missing');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_url_invalid');
  }

  if (url.protocol !== 'https:'
      || url.hostname !== CHM_TIDE_CATALOG_HOST
      || url.username
      || url.password
      || url.port
      || url.search
      || url.hash) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_url_invalid');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_path_encoding_invalid');
  }

  if (!pathname.startsWith(CHM_TIDE_PDF_PATH_PREFIX) || !pathname.endsWith(`/${filename}`)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_path_invalid');
  }

  const filenamePattern = new RegExp(`^${stationNumber}\\s*-\\s*.+\\s*-\\s*${pageStart}\\s*-\\s*${pageEnd}\\.pdf$`, 'iu');
  if (!filenamePattern.test(filename)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_filename_binding_mismatch');
  }

  return Object.freeze({
    stationNumber,
    name,
    pageStart,
    pageEnd,
    tideTablePdfUrl: url.href,
    tideTablePdfFilename: filename,
  });
}

function hasPdfMagic(bytes) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

function hasPdfEof(bytes) {
  const start = Math.max(0, bytes.length - 4096);
  return Buffer.from(bytes.subarray(start)).toString('latin1').includes('%%EOF');
}

export function validateChmTidePdfBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_bytes_invalid');
  }
  if (bytes.byteLength < CHM_TIDE_PDF_MIN_BYTES) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_body_too_small');
  }
  if (bytes.byteLength > CHM_TIDE_PDF_MAX_BYTES) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_body_too_large');
  }
  if (!hasPdfMagic(bytes)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_magic_invalid');
  }
  if (!hasPdfEof(bytes)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_eof_missing');
  }

  return Object.freeze({
    byteLength: bytes.byteLength,
    sourceArtifactSha256: sha256(bytes),
    pdfMagicValidation: 'PASS',
    pdfEofValidation: 'PASS',
  });
}

export async function probeChmTidePdfArtifact(station, { fetchImpl = globalThis.fetch } = {}) {
  const descriptor = validateStationDescriptor(station);
  try {
    const { bytes, contentType } = await fetchBinaryContract(descriptor.tideTablePdfUrl, {
      allowedHosts: [CHM_TIDE_CATALOG_HOST],
      allowedContentTypes: ['application/pdf'],
      accept: 'application/pdf',
      fetchImpl,
      timeoutMs: 12_000,
      maxBytes: CHM_TIDE_PDF_MAX_BYTES,
    });
    const validated = validateChmTidePdfBytes(bytes);
    return Object.freeze({
      sourceId: CHM_TIDE_PDF_ARTIFACT_SOURCE_ID,
      sourceHost: CHM_TIDE_CATALOG_HOST,
      sourceUrl: descriptor.tideTablePdfUrl,
      stationNumber: descriptor.stationNumber,
      stationName: descriptor.name,
      pageStart: descriptor.pageStart,
      pageEnd: descriptor.pageEnd,
      tideTablePdfFilename: descriptor.tideTablePdfFilename,
      contentType,
      byteLength: validated.byteLength,
      sourceArtifactSha256: validated.sourceArtifactSha256,
      pdfMagicValidation: validated.pdfMagicValidation,
      pdfEofValidation: validated.pdfEofValidation,
      rawPdfRetention: 'NONE_AFTER_VALIDATION',
      textExtraction: 'NOT_IMPLEMENTED',
      tideValueExtraction: 'NOT_IMPLEMENTED',
      contract: CHM_TIDE_PDF_ARTIFACT_CONTRACT,
    });
  } catch (error) {
    if (error instanceof ChmTidePdfArtifactError) throw error;
    if (error instanceof SourceContractError) {
      throw new ChmTidePdfArtifactError(`chm_tide_pdf_${error.code}`);
    }
    throw error;
  }
}

export async function probeChmRjTidePdfArtifacts(catalog, { fetchImpl = globalThis.fetch } = {}) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_catalog_missing');
  }
  const calendarYear = boundedInteger(catalog.calendarYear, 2020, 2100, 'chm_tide_pdf_calendar_year_invalid');
  if (!Array.isArray(catalog.stations)
      || catalog.stations.length !== CHM_EXPECTED_RJ_TIDE_STATION_COUNT
      || catalog.rjStationCount !== CHM_EXPECTED_RJ_TIDE_STATION_COUNT) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_catalog_station_count_invalid');
  }

  const artifacts = [];
  for (const station of catalog.stations) {
    artifacts.push(await probeChmTidePdfArtifact(station, { fetchImpl }));
  }

  const seenStations = new Set();
  const canonicalArtifacts = artifacts.map((artifact) => {
    if (seenStations.has(artifact.stationNumber)) {
      throw new ChmTidePdfArtifactError('chm_tide_pdf_station_duplicate');
    }
    seenStations.add(artifact.stationNumber);
    return {
      stationNumber: artifact.stationNumber,
      sourceArtifactSha256: artifact.sourceArtifactSha256,
      byteLength: artifact.byteLength,
      tideTablePdfFilename: artifact.tideTablePdfFilename,
    };
  });

  return Object.freeze({
    sourceId: CHM_TIDE_PDF_ARTIFACT_SOURCE_ID,
    sourceHost: CHM_TIDE_CATALOG_HOST,
    calendarYear,
    artifactCount: artifacts.length,
    artifacts: Object.freeze(artifacts),
    artifactInventorySha256: sha256(Buffer.from(JSON.stringify(canonicalArtifacts), 'utf8')),
    pdfArtifactValidation: CHM_TIDE_PDF_ARTIFACT_VALIDATION,
    rawPdfRetention: 'NONE_AFTER_VALIDATION',
    textExtraction: 'NOT_IMPLEMENTED',
    tideValueExtraction: 'NOT_IMPLEMENTED',
    contract: CHM_TIDE_PDF_ARTIFACT_CONTRACT,
  });
}
