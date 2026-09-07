import { mkdir, writeFile } from 'node:fs/promises';

import {
  probeAlertaRioLiveRainfall,
  probeAlertaRioStationCatalog,
} from '../src/alerta-rio-source.mjs';

const evidenceDir = new URL('../../evidence/official-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const evidenceFile = new URL('alerta-rio.json', evidenceDir);

function errorCode(reason) {
  return typeof reason?.code === 'string' ? reason.code : 'unexpected_error';
}

const [catalogProbe, rainfallProbe] = await Promise.allSettled([
  probeAlertaRioStationCatalog(),
  probeAlertaRioLiveRainfall(),
]);

const evidence = {
  sourceId: 'alerta-rio',
  contract: 'station_inventory+live_rainfall_snapshot',
  status: catalogProbe.status === 'fulfilled' && rainfallProbe.status === 'fulfilled' ? 'PASS' : 'FAIL',
  checkedAt: new Date().toISOString(),
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
        status: 'PASS',
        sourceHost: rainfallProbe.value.sourceHost,
        stationCount: rainfallProbe.value.stationCount,
        missingValueCount: rainfallProbe.value.missingValueCount,
        oldestObservedAt: rainfallProbe.value.oldestObservedAt,
        freshestObservedAt: rainfallProbe.value.freshestObservedAt,
        snapshotSha256: rainfallProbe.value.snapshotSha256,
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
