import { mkdir, writeFile } from 'node:fs/promises';

import {
  CHM_SOURCE_ID,
  ChmSourceContractError,
  probeChmTides,
  probeChmWarnings,
} from '../src/chm-source.mjs';
import {
  ChmTideCatalogError,
  probeChmRjTideCatalog,
} from '../src/chm-tide-catalog.mjs';

const evidencePath = 'evidence/official-sources/chm.json';

function errorCode(error) {
  if (error instanceof ChmSourceContractError) return error.code;
  if (error instanceof ChmTideCatalogError) return error.code;
  return 'chm_unexpected_error';
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

function tideEvidence(publication, catalog) {
  if (publication.calendarYear !== catalog.calendarYear) {
    throw new ChmTideCatalogError('chm_tide_catalog_year_mismatch');
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
    rawCatalogTextRetention: catalog.rawCatalogTextRetention,
    tideValueIngestion: catalog.tideValueIngestion,
    portSelectionValidation: catalog.portSelectionValidation,
    catalogContract: catalog.contract,
  };
}

const evidence = {
  sourceId: CHM_SOURCE_ID,
  contract: 'official_metarea_v_warning_inventory+official_tide_publication_discovery+official_rj_tide_station_catalog',
  status: 'BLOCKED_SOURCE_CONTRACT',
  execution: 'LIVE_PUBLIC_SOURCE_PROBE',
  warnings: { status: 'NOT_RUN' },
  tides: { status: 'NOT_RUN' },
  liveWaveObservationIngestion: 'NOT_IMPLEMENTED',
  liveTideValueIngestion: 'NOT_IMPLEMENTED',
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
    evidence.tides = tideEvidence(publication, catalog);
  } catch (error) {
    failure = error;
    evidence.tides = { status: 'BLOCKED_SOURCE_CONTRACT', errorCode: errorCode(error) };
  }
}

if (!failure) evidence.status = 'PASS_SOURCE_DISCOVERY_ONLY';

await mkdir('evidence/official-sources', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (failure) {
  console.error(`CHM_SOURCE_PROBE=BLOCKED:${errorCode(failure)}`);
  process.exitCode = 1;
} else {
  console.log('CHM_SOURCE_PROBE=PASS_SOURCE_DISCOVERY_ONLY');
}
