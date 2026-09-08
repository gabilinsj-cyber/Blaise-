import { mkdir, writeFile } from 'node:fs/promises';

import {
  probeAlertaRioLiveRainfall,
  probeAlertaRioStationCatalog,
} from '../src/alerta-rio-source.mjs';
import { probeIneaHydrometDiscovery, probeIneaStationSnapshot } from '../src/inea-source.mjs';
import { createAlertaRioRainfallCache } from '../src/official-source-cache.mjs';

const evidenceDir = new URL('../../evidence/official-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const alertaRioEvidenceFile = new URL('alerta-rio.json', evidenceDir);
const ineaEvidenceFile = new URL('inea.json', evidenceDir);

function errorCode(reason) {
  return typeof reason?.code === 'string' ? reason.code : 'unexpected_error';
}

function summarizeFreshness(result) {
  return {
    state: result.state,
    reason: result.reason,
    refreshIntervalMs: result.refreshIntervalMs,
    refreshDue: result.refreshDue,
    nextRefreshDueAt: result.nextRefreshDueAt,
    dataAgeMs: result.dataAgeMs,
    cacheAgeMs: result.cacheAgeMs,
  };
}

const checkedAt = new Date();
const ineaStationUrl = String(process.env.BLAISE_INEA_STATION_URL || '').trim();
const [catalogProbe, rainfallProbe, ineaProbe, ineaStationProbe] = await Promise.allSettled([
  probeAlertaRioStationCatalog(),
  probeAlertaRioLiveRainfall(),
  probeIneaHydrometDiscovery(),
  ineaStationUrl ? probeIneaStationSnapshot({ stationUrl: ineaStationUrl }) : Promise.resolve(null),
]);

let rainfallFreshness = null;
let rainfallFreshnessError = null;
if (rainfallProbe.status === 'fulfilled') {
  try {
    const cache = createAlertaRioRainfallCache({ now: () => checkedAt.getTime() });
    cache.recordSuccess(rainfallProbe.value, { fetchedAt: checkedAt });
    rainfallFreshness = {
      normal: summarizeFreshness(cache.read({ at: checkedAt, mode: 'normal' })),
      severe: summarizeFreshness(cache.read({ at: checkedAt, mode: 'severe' })),
    };
  } catch (error) {
    rainfallFreshnessError = errorCode(error);
  }
}

const rainfallOperationalPass = rainfallProbe.status === 'fulfilled'
  && rainfallFreshnessError === null
  && rainfallFreshness?.normal?.state === 'CURRENT'
  && rainfallFreshness?.severe?.state === 'CURRENT';

const alertaRioEvidence = {
  sourceId: 'alerta-rio',
  contract: 'station_inventory+live_rainfall_snapshot+operational_freshness',
  status: catalogProbe.status === 'fulfilled' && rainfallOperationalPass ? 'PASS' : 'FAIL',
  checkedAt: checkedAt.toISOString(),
  stationCatalog: catalogProbe.status === 'fulfilled'
    ? {
        status: 'PASS',
        sourceHost: catalogProbe.value.sourceHost,
        stationCount: catalogProbe.value.stationCount,
        catalogSha256: catalogProbe.value.catalogSha256,
      }
    : {
        status: 'FAIL',
        errorCode: errorCode(catalogProbe.reason),
      },
  rainfallLiveIngestion: rainfallProbe.status === 'fulfilled'
    ? {
        status: rainfallOperationalPass ? 'PASS' : 'FAIL',
        sourceHost: rainfallProbe.value.sourceHost,
        stationCount: rainfallProbe.value.stationCount,
        missingValueCount: rainfallProbe.value.missingValueCount,
        oldestObservedAt: rainfallProbe.value.oldestObservedAt,
        freshestObservedAt: rainfallProbe.value.freshestObservedAt,
        snapshotSha256: rainfallProbe.value.snapshotSha256,
        operationalFreshness: rainfallFreshnessError === null
          ? rainfallFreshness
          : { status: 'FAIL', errorCode: rainfallFreshnessError },
      }
    : {
        status: 'FAIL',
        errorCode: errorCode(rainfallProbe.reason),
      },
};

const stationConfigured = ineaStationUrl.length > 0;
const stationOperationalPass = !stationConfigured || ineaStationProbe.status === 'fulfilled';
const ineaOverallPass = ineaProbe.status === 'fulfilled' && stationOperationalPass;

const ineaEvidence = {
  sourceId: 'inea',
  contract: 'hydromet_discovery+official_link_contract+optional_live_station_snapshot',
  status: ineaOverallPass ? 'PASS' : 'FAIL',
  checkedAt: checkedAt.toISOString(),
  discoveryContract: ineaProbe.status === 'fulfilled'
    ? {
        status: 'PASS',
        sourceHost: ineaProbe.value.sourceHost,
        alertHost: ineaProbe.value.alertHost,
        telemetryCadenceMinutes: ineaProbe.value.telemetryCadenceMinutes,
        radarCadenceMinutes: ineaProbe.value.radarCadenceMinutes,
        dataPageUrl: ineaProbe.value.dataPageUrl,
        radarPageUrl: ineaProbe.value.radarPageUrl,
        discoverySha256: ineaProbe.value.discoverySha256,
      }
    : {
        status: 'FAIL',
        errorCode: errorCode(ineaProbe.reason),
      },
  liveHydrometValueIngestion: !stationConfigured
    ? {
        status: 'NOT_RUN_STATION_URL_NOT_CONFIGURED',
        execution: 'NOT_RUN',
      }
    : ineaStationProbe.status === 'fulfilled'
      ? {
          status: 'PASS',
          sourceHost: ineaStationProbe.value.sourceHost,
          stationId: ineaStationProbe.value.stationId,
          observedDate: ineaStationProbe.value.observedDate,
          observedTime: ineaStationProbe.value.observedTime,
          timezone: ineaStationProbe.value.timezone,
          telemetryCadenceMinutes: ineaStationProbe.value.telemetryCadenceMinutes,
          missingValueCount: ineaStationProbe.value.missingValueCount,
          snapshotSha256: ineaStationProbe.value.snapshotSha256,
        }
      : {
          status: 'FAIL',
          errorCode: errorCode(ineaStationProbe.reason),
        },
  liveRadarFrameIngestion: 'NOT_IMPLEMENTED',
};

await Promise.all([
  writeFile(alertaRioEvidenceFile, `${JSON.stringify(alertaRioEvidence, null, 2)}\n`, { mode: 0o600 }),
  writeFile(ineaEvidenceFile, `${JSON.stringify(ineaEvidence, null, 2)}\n`, { mode: 0o600 }),
]);

if (alertaRioEvidence.status === 'PASS') {
  console.log('ALERTA_RIO_OFFICIAL_SOURCE_CONTRACT=PASS');
} else {
  console.error('ALERTA_RIO_OFFICIAL_SOURCE_CONTRACT=FAIL');
  process.exitCode = 1;
}

if (ineaEvidence.status === 'PASS') {
  console.log('INEA_OFFICIAL_SOURCE_CONTRACT=PASS');
  if (stationConfigured) console.log('INEA_LIVE_HYDROMET_STATION_CONTRACT=PASS');
  else console.log('INEA_LIVE_HYDROMET_STATION_CONTRACT=NOT_RUN_STATION_URL_NOT_CONFIGURED');
} else {
  console.error('INEA_OFFICIAL_SOURCE_CONTRACT=FAIL');
  process.exitCode = 1;
}
