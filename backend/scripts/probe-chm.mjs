import { mkdir, writeFile } from 'node:fs/promises';

import {
  CHM_SOURCE_ID,
  ChmSourceContractError,
  probeChmTides,
  probeChmWarnings,
} from '../src/chm-source.mjs';
import {
  CHM_TIDE_CATALOG_HOST,
  ChmTideCatalogError,
  probeChmRjTideCatalog,
} from '../src/chm-tide-catalog.mjs';
import {
  CHM_TIDE_PDF_MAX_BYTES,
  ChmTidePdfArtifactError,
  probeChmRjTidePdfArtifacts,
  validateChmTidePdfBytes,
} from '../src/chm-tide-artifact.mjs';
import {
  CHM_TIDE_LIVE_VALUE_STATUS,
  ChmTideLiveTextError,
} from '../src/chm-tide-live-text.mjs';
import { createChmTideValuesCache } from '../src/chm-tide-cache.mjs';
import {
  CHM_TIDE_DELIVERY_CONTRACT,
  CHM_TIDE_SOURCE_TO_CACHE_CONTRACT,
  ChmTidePipelineError,
  ingestChmTidePdfToCache,
} from '../src/chm-tide-pipeline.mjs';
import { ChmTideTextError } from '../src/chm-tide-text.mjs';
import { fetchBinaryContract, SourceContractError } from '../src/source-contract.mjs';

const evidencePath = 'evidence/official-sources/chm.json';

function errorCode(error) {
  if (error instanceof ChmSourceContractError) return error.code;
  if (error instanceof ChmTideCatalogError) return error.code;
  if (error instanceof ChmTidePdfArtifactError) return error.code;
  if (error instanceof ChmTideLiveTextError) return error.code;
  if (error instanceof ChmTidePipelineError) return error.code;
  if (error instanceof ChmTideTextError) return error.code;
  if (error instanceof SourceContractError) return `chm_tide_text_${error.code}`;
  return error?.code ?? 'chm_unexpected_error';
}

function warningEvidence(result) {
  return {
    status: 'PASS',
    sourceHost: result.sourceHost,
    metarea: result.metarea,
    activeWarningCount: result.activeWarningCount,
    noWarningMarker: result.noWarningMarker,
    warningIds: result.warnings.map((record) => record.id),
    warningTypes: [...new Set(result.warnings.map((record) => record.warningType))].sort(),
    warningInventorySha256: result.warningInventorySha256,
    rawWarningTextRetention: result.rawWarningTextRetention,
    temporalValidityValidation: result.temporalValidityValidation,
    rjCoastGeofenceValidation: result.rjCoastGeofenceValidation,
  };
}

function tideEvidence(publication, catalog, pdfArtifacts, cacheIngestions) {
  if (publication.calendarYear !== catalog.calendarYear
      || catalog.calendarYear !== pdfArtifacts.calendarYear
      || catalog.calendarYear !== cacheIngestions.calendarYear) {
    throw new ChmTideCatalogError('chm_tide_catalog_year_mismatch');
  }
  if (catalog.rjStationCount !== pdfArtifacts.artifactCount
      || catalog.rjStationCount !== cacheIngestions.ingestionCount) {
    throw new ChmTidePdfArtifactError('chm_tide_pdf_artifact_count_mismatch');
  }

  return {
    status: 'PASS',
    sourceHost: publication.sourceHost,
    calendarYear: publication.calendarYear,
    tidePublicationSha256: publication.tidePublicationSha256,
    rjStationCount: catalog.rjStationCount,
    rjStationNumbers: catalog.stations.map((station) => station.stationNumber),
    rjStationNames: catalog.stations.map((station) => station.name),
    stationCatalogSha256: catalog.stationCatalogSha256,
    tideDocumentCatalogSha256: catalog.tideDocumentCatalogSha256,
    tideDocumentFilenames: catalog.stations.map((station) => station.tideTablePdfFilename),
    rawCatalogTextRetention: catalog.rawCatalogTextRetention,
    tideValueNormalization: CHM_TIDE_LIVE_VALUE_STATUS,
    tideValueIngestion: 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK',
    sourceToCacheIngestion: cacheIngestions.status,
    sourceToCacheContract: CHM_TIDE_SOURCE_TO_CACHE_CONTRACT,
    deliveryContract: CHM_TIDE_DELIVERY_CONTRACT,
    androidNetworkDelivery: 'BLOCKED_PAID_ENTITLEMENT_SAFE_HTTPS_API_NOT_IMPLEMENTED',
    portSelectionValidation: catalog.portSelectionValidation,
    tideDocumentBindingValidation: catalog.tideDocumentBindingValidation,
    pdfContentValidation: 'PASS_OFFICIAL_CHM_PDF_CONTAINER_DIGEST_LAYOUT_TEXT_AND_STRUCTURED_VALUES',
    pdfArtifactValidation: pdfArtifacts.pdfArtifactValidation,
    pdfArtifactCount: pdfArtifacts.artifactCount,
    pdfArtifactInventorySha256: pdfArtifacts.artifactInventorySha256,
    pdfArtifacts: pdfArtifacts.artifacts.map((artifact) => ({
      stationNumber: artifact.stationNumber,
      tideTablePdfFilename: artifact.tideTablePdfFilename,
      byteLength: artifact.byteLength,
      sourceArtifactSha256: artifact.sourceArtifactSha256,
      pdfMagicValidation: artifact.pdfMagicValidation,
      pdfEofValidation: artifact.pdfEofValidation,
    })),
    textExtractionValidation: cacheIngestions.textExtractionStatus,
    textExtractionCount: cacheIngestions.ingestionCount,
    textExtractions: cacheIngestions.ingestions,
    rawPdfRetention: 'NONE_AFTER_EPHEMERAL_EXTRACTION',
    rawTextRetention: 'NONE',
    pdfTextExtraction: 'PASS_OFFICIAL_CHM_PDF_PDFTOTEXT_LAYOUT',
    liveTideValueNormalization: CHM_TIDE_LIVE_VALUE_STATUS,
    liveTideValueIngestion: 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK',
    catalogContract: catalog.contract,
    pdfArtifactContract: pdfArtifacts.contract,
    textExtractionContract: cacheIngestions.contract,
  };
}

async function probeChmTideCacheIngestions(catalog, pdfArtifacts) {
  const cache = createChmTideValuesCache();
  const ingestions = [];
  for (const station of catalog.stations) {
    const artifact = pdfArtifacts.artifacts.find((candidate) => candidate.stationNumber === station.stationNumber);
    if (!artifact) throw new ChmTidePdfArtifactError('chm_tide_pdf_artifact_missing');

    const { bytes } = await fetchBinaryContract(station.tideTablePdfUrl, {
      allowedHosts: [CHM_TIDE_CATALOG_HOST],
      allowedContentTypes: ['application/pdf'],
      accept: 'application/pdf',
      timeoutMs: 12_000,
      maxBytes: CHM_TIDE_PDF_MAX_BYTES,
    });
    const validated = validateChmTidePdfBytes(bytes);
    if (validated.sourceArtifactSha256 !== artifact.sourceArtifactSha256) {
      throw new ChmTidePdfArtifactError('chm_tide_pdf_artifact_changed_during_probe');
    }

    const ingested = await ingestChmTidePdfToCache({
      cache,
      bytes,
      station,
      calendarYear: catalog.calendarYear,
      sourceArtifactSha256: validated.sourceArtifactSha256,
      fetchedAt: Date.now(),
    });
    const { delivery: _delivery, ...summaryOnly } = ingested;
    ingestions.push(Object.freeze(summaryOnly));
  }

  return Object.freeze({
    calendarYear: catalog.calendarYear,
    ingestionCount: ingestions.length,
    ingestions: Object.freeze(ingestions),
    status: 'PASS_OFFICIAL_2026_PDF_TO_NORMALIZED_MEMORY_CACHE_READBACK',
    textExtractionStatus: 'PASS_OFFICIAL_2026_PDF_LAYOUT_TEXT_AND_STRUCTURED_VALUE_NORMALIZATION',
    contract: 'OFFICIAL_CHM_RJ_TIDE_PDF_EPHEMERAL_TEXT_VALUE_NORMALIZATION_AND_CACHE_READBACK_NO_RAW_RETENTION',
  });
}

const evidence = {
  sourceId: CHM_SOURCE_ID,
  contract: 'official_metarea_v_warning_inventory+official_tide_publication_discovery+official_rj_tide_station_catalog+official_rj_tide_pdf_binding+official_rj_tide_pdf_artifact_validation+official_rj_tide_pdf_text_extraction+official_rj_tide_value_normalization+official_rj_tide_memory_cache_readback',
  status: 'BLOCKED_SOURCE_CONTRACT',
  execution: 'LIVE_PUBLIC_SOURCE_PROBE',
  warnings: { status: 'NOT_RUN' },
  tides: { status: 'NOT_RUN' },
  liveWaveObservationIngestion: 'NOT_IMPLEMENTED',
  liveTideValueNormalization: 'NOT_RUN',
  liveTideValueIngestion: 'NOT_RUN',
  tidePdfArtifactValidation: 'NOT_RUN',
  tidePdfTextExtraction: 'NOT_RUN',
  tideSourceToCacheIngestion: 'NOT_RUN',
  androidNetworkDelivery: 'BLOCKED_PAID_ENTITLEMENT_SAFE_HTTPS_API_NOT_IMPLEMENTED',
  rjCoastGeofenceValidation: 'NOT_IMPLEMENTED',
};

let failure = null;
try {
  evidence.warnings = warningEvidence(await probeChmWarnings());
} catch (error) {
  failure = error;
  evidence.warnings = { status: 'BLOCKED_SOURCE_CONTRACT', errorCode: errorCode(error) };
}

if (!failure) {
  try {
    const publication = await probeChmTides();
    const catalog = await probeChmRjTideCatalog();
    const pdfArtifacts = await probeChmRjTidePdfArtifacts(catalog);
    const cacheIngestions = await probeChmTideCacheIngestions(catalog, pdfArtifacts);
    evidence.tides = tideEvidence(publication, catalog, pdfArtifacts, cacheIngestions);
    evidence.tidePdfArtifactValidation = pdfArtifacts.pdfArtifactValidation;
    evidence.tidePdfTextExtraction = cacheIngestions.textExtractionStatus;
    evidence.liveTideValueNormalization = CHM_TIDE_LIVE_VALUE_STATUS;
    evidence.liveTideValueIngestion = 'PASS_FAIL_CLOSED_MEMORY_CACHE_READBACK';
    evidence.tideSourceToCacheIngestion = cacheIngestions.status;
  } catch (error) {
    failure = error;
    evidence.tides = { status: 'BLOCKED_SOURCE_CONTRACT', errorCode: errorCode(error) };
  }
}

if (!failure) evidence.status = 'PASS_SOURCE_DISCOVERY_DOCUMENT_BINDING_PDF_ARTIFACTS_TEXT_VALUES_AND_MEMORY_CACHE_READBACK';

await mkdir('evidence/official-sources', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (failure) {
  console.error(`CHM_SOURCE_PROBE=BLOCKED:${errorCode(failure)}`);
  process.exitCode = 1;
} else {
  console.log('CHM_SOURCE_PROBE=PASS_SOURCE_DISCOVERY_DOCUMENT_BINDING_PDF_ARTIFACTS_TEXT_VALUES_AND_MEMORY_CACHE_READBACK');
}
