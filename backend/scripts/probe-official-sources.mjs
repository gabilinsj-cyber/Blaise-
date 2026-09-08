import { mkdir, writeFile } from 'node:fs/promises';

import {
  probeAlertaRioLiveRainfall,
  probeAlertaRioStationCatalog,
} from '../src/alerta-rio-source.mjs';
import { createAlertaRioRainfallCache } from '../src/official-source-cache.mjs';

const evidenceDir = new URL('../../evidence/official-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const evidenceFile = new URL('alerta-rio.json', evidenceDir);

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
const [catalogProbe, rainfallProbe] = await Promise.allSettled([
  probeAlertaRioStationCatalog(),
  probeAlertaRioLiveRainfall(),
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

const evidence = {
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

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (evidence.status === 'PASS') {
  console.log('ALERTA_RIO_OFFICIAL_SOURCE_CONTRACT=PASS');
} else {
  console.error('ALERTA_RIO_OFFICIAL_SOURCE_CONTRACT=FAIL');
  process.exitCode = 1;
}
