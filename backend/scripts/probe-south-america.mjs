#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

import { probeSouthAmericaSourceAvailability } from '../src/south-america-source-probe.mjs';

const evidenceDir = new URL('../../evidence/south-america-sources/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const evidenceFile = new URL('availability.json', evidenceDir);

let evidence;
try {
  evidence = await probeSouthAmericaSourceAvailability();
} catch (error) {
  evidence = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    status: 'FAIL',
    errorCode: typeof error?.code === 'string' ? error.code : 'unexpected_error',
    mqttLiveSubscription: 'NOT_IMPLEMENTED_NO_MQTT_CLIENT',
    numericalForecastIngestion: 'NOT_IMPLEMENTED_AVAILABILITY_ONLY',
    productionForecastIngestion: 'NOT_PROVEN',
    canTriggerP0: false,
  };
}

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (evidence.status === 'PASS') {
  console.log('SOUTH_AMERICA_SOURCE_AVAILABILITY=PASS');
  console.log('SOUTH_AMERICA_NUMERICAL_FORECAST_INGESTION=NOT_IMPLEMENTED_AVAILABILITY_ONLY');
  console.log('SOUTH_AMERICA_MQTT_LIVE_SUBSCRIPTION=NOT_IMPLEMENTED_NO_MQTT_CLIENT');
} else {
  console.error('SOUTH_AMERICA_SOURCE_AVAILABILITY=FAIL');
  process.exitCode = 1;
}
