import { probeAlertaRioMeteorology } from '../src/alerta-rio-meteorology-live.mjs';
try {
  console.log(JSON.stringify({ verification: 'REAL_HTTP_AND_STRICT_SCHEMA', snapshot: await probeAlertaRioMeteorology() }));
} catch (error) {
  console.log(JSON.stringify({ verification: 'UNAVAILABLE', errorCode: error.code ?? 'alerta_rio_meteorology_invalid_response', snapshot: null }));
  process.exitCode = 1;
}
