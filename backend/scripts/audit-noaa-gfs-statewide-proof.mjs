/**
 * Internal one-shot proof that a REAL NOAA GFS 92-point snapshot can pass the
 * Blaise O/E/P coverage gate. No client publication or persistent storage.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
import {modelGridToAdminTemperatureRecords} from '../src/noaa-gfs-admin-coverage-bridge.mjs';
const source=new URL('../../evidence/international-sources/noaa-gfs-rj-92-temperature.json',import.meta.url);
const dest=new URL('../../evidence/international-sources/noaa-gfs-rj-92-admin-coverage.json',import.meta.url);
const batch=JSON.parse(await readFile(source,'utf8'));
const now=Date.now();
// NOAA GFS is already approved for scientific admin-side assessment;
// this DOES NOT grant subscriber publication or permit raw data resale.
const records=modelGridToAdminTemperatureRecords(batch,{now,modelRightsReviewed:true});
const report=buildInternalRjMeteorologyCoverage(records,{now});
const field=report.fields.find(x=>x.field==='temperatureC');
const evidence={
  contract:'RJ_NOAA_GFS_ATMOS_ADMIN_COVERAGE_EVIDENCE_V1',
  status:field.state,sourceId:'NOAA_GFS',category:'P',
  verifiedMunicipalities:field.coveredMunicipalities,municipalityCount:92,
  backendAuditVerifiedRecordCount:report.verifiedValueCount,
  modelForecastNotStationObservation:true,automaticCollection:false,
  publishedToSubscribers:false,publishedToAndroid:false,
  ...{checkedAt:batch.checkedAt,validAt:batch.validAt,sourceUrl:batch.sourceUrl}
};
await writeFile(dest,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log('NOAA_RJ_ADMIN_AUDIT='+JSON.stringify(evidence));
