import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { probeIneaRadarOfficialInventory } from '../src/inea-radar-inventory.mjs';
import { probeIneaRadarTool } from '../src/inea-radar-source.mjs';
import { probeIneaRadarOfficialProvenance } from '../src/inea-radar-provenance.mjs';
import {
  createIneaRadarProbeEvidence,
  markIneaRadarInventoryPass,
  markIneaRadarProbeFailure,
  markIneaRadarProvenancePass,
  markIneaRadarToolPass,
} from '../src/inea-radar-probe-evidence.mjs';

const outputPath = process.env.BLAISE_INEA_RADAR_EVIDENCE_FILE
  || 'evidence/official-sources/inea-radar.json';

function errorCode(error) {
  if (error && typeof error.code === 'string') return error.code;
  return 'unexpected_error';
}

async function writeEvidence(evidence) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}

const checkedAt = new Date().toISOString();
let evidence = createIneaRadarProbeEvidence(checkedAt);

try {
  const provenance = await probeIneaRadarOfficialProvenance();
  evidence = markIneaRadarProvenancePass(evidence, provenance);
  console.log('INEA_RADAR_OFFICIAL_PROVENANCE=PASS');

  const inventory = await probeIneaRadarOfficialInventory();
  evidence = markIneaRadarInventoryPass(evidence, inventory);
  console.log('INEA_RADAR_OFFICIAL_INVENTORY=PASS');

  const result = await probeIneaRadarTool();
  evidence = markIneaRadarToolPass(evidence, result);
  await writeEvidence(evidence);

  console.log('INEA_RADAR_GATEWAY_CONTRACT=PASS');
  console.log('INEA_RADAR_EMBEDDED_VIEWER=PASS');
  console.log('INEA_RADAR_MEDIA_CANDIDATES=PASS');
  console.log('INEA_RADAR_BINARY_ENVELOPES=PASS');
  console.log('INEA_RADAR_IDENTITY=NOT_IMPLEMENTED_SAME_CANDIDATE_EVIDENCE_REQUIRED');
  console.log('INEA_RADAR_TIMESTAMP=NOT_IMPLEMENTED');
  console.log('INEA_RADAR_FRESHNESS=NOT_IMPLEMENTED');
  console.log('INEA_RADAR_FRAME_INGESTION=NOT_IMPLEMENTED');
} catch (error) {
  const code = errorCode(error);
  evidence = markIneaRadarProbeFailure(evidence, code);
  await writeEvidence(evidence);

  if (evidence.officialProvenance.status === 'PASS') {
    console.log('INEA_RADAR_OFFICIAL_PROVENANCE=PASS');
  } else {
    console.error('INEA_RADAR_OFFICIAL_PROVENANCE=FAIL');
  }
  if (evidence.officialRadarInventory.status === 'PASS') {
    console.log('INEA_RADAR_OFFICIAL_INVENTORY=PASS');
  } else {
    console.error('INEA_RADAR_OFFICIAL_INVENTORY=FAIL');
  }
  console.error(`INEA_RADAR_PROBE_ERROR=${code}`);
  console.error('INEA_RADAR_GATEWAY_CONTRACT=FAIL');
  process.exitCode = 1;
}
