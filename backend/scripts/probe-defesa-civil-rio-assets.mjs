import { mkdir, writeFile } from 'node:fs/promises';
import { probeDefesaCivilRioMapAssets } from '../src/defesa-civil-rio-assets.mjs';

const evidenceDir = new URL('../../evidence/defesa-civil-rio-assets/', import.meta.url);
const evidenceFile = new URL('gate.json', evidenceDir);
await mkdir(evidenceDir, { recursive: true });

let evidence;
try {
  const result = await probeDefesaCivilRioMapAssets();
  evidence = {
    sourceId: result.sourceId,
    sourceHost: result.sourceHost,
    serviceItemId: result.serviceItemId,
    status: 'PASS',
    execution: 'PASS_LIVE_PUBLIC_SOURCE_QUERY',
    checkedAt: new Date().toISOString(),
    spatialReference: result.spatialReference,
    sirens: {
      status: 'PASS',
      count: result.sirens.count,
      sha256: result.sirens.sha256,
    },
    supportPoints: {
      status: 'PASS',
      count: result.supportPoints.count,
      sha256: result.supportPoints.sha256,
    },
  };
  console.log('DEFESA_CIVIL_RIO_MAP_ASSETS=PASS');
} catch (error) {
  const errorCode = typeof error?.code === 'string' ? error.code : 'unexpected_error';
  evidence = {
    sourceId: 'defesa-civil-rio-map-assets',
    status: 'FAIL',
    execution: 'FAIL_LIVE_PUBLIC_SOURCE_QUERY',
    checkedAt: new Date().toISOString(),
    errorCode,
  };
  console.error(`DEFESA_CIVIL_RIO_MAP_ASSETS=FAIL:${errorCode}`);
  process.exitCode = 1;
}

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
