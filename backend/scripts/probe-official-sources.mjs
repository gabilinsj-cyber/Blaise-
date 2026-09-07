import { mkdir, writeFile } from 'node:fs/promises';

import { probeAlertaRioStationCatalog } from '../src/alerta-rio-source.mjs';

const evidenceDir = new URL('../../evidence/official-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const evidenceFile = new URL('alerta-rio.json', evidenceDir);

try {
  const result = await probeAlertaRioStationCatalog();
  const evidence = {
    sourceId: result.sourceId,
    sourceHost: result.sourceHost,
    contract: 'active_station_inventory',
    status: 'PASS',
    stationCount: result.stationCount,
    catalogSha256: result.catalogSha256,
    checkedAt: new Date().toISOString(),
    rainfallLiveIngestion: 'NOT_IMPLEMENTED',
  };
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log('ALERTA_RIO_STATION_CONTRACT=PASS');
} catch (error) {
  const errorCode = typeof error?.code === 'string' ? error.code : 'unexpected_error';
  const evidence = {
    sourceId: 'alerta-rio-stations',
    contract: 'active_station_inventory',
    status: 'FAIL',
    errorCode,
    checkedAt: new Date().toISOString(),
    rainfallLiveIngestion: 'NOT_IMPLEMENTED',
  };
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.error(`ALERTA_RIO_STATION_CONTRACT=FAIL code=${errorCode}`);
  process.exitCode = 1;
}
