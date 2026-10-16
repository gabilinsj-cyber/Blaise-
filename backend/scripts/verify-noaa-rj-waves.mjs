import {probeNoaaRjWaves} from '../src/noaa-rj-wave-forecast.mjs';
try {
 const snapshot=await probeNoaaRjWaves();
 console.log(JSON.stringify({verification:'REAL_HTTP_AND_STRICT_SCHEMA',...snapshot},null,2));
} catch(error) {
 console.log(JSON.stringify({verification:'UNAVAILABLE',errorCode:error.code??'noaa_wave_request_failed',snapshot:null}));
 process.exitCode=1;
}
