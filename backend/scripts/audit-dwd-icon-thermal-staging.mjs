/**
 * Explicit post-probe private audit. NO provider call or publication.
 * The DWD numeric evidence must have been produced by the same CI job.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {auditedDwdThermalRecord} from '../src/rj-dwd-thermal-admin-bridge.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
const source=new URL('../../evidence/international-sources/dwd-icon-rio.json',import.meta.url);
const dest=new URL('../../evidence/international-sources/dwd-icon-rio-admin-audit.json',import.meta.url);
const proof=JSON.parse(await readFile(source,'utf8'));
const now=Date.now();
const record=auditedDwdThermalRecord(proof,{now,dwdRightsReviewed:true});
const report=buildInternalRjMeteorologyCoverage(record?[record]:[],{now});
const temp=report.fields.find(x=>x.field==='temperatureC');
const evidence=Object.freeze({
  contract:'RJ_DWD_ICON_ADMIN_THERMAL_EVIDENCE_V1',
  source:'DWD_ICON_GLOBAL',nature:'P',
  adminAuditStatus:temp.state,
  validMunicipalities:temp.coveredMunicipalities,
  sourceStagingStatus:proof.status,sourceFailureReason:proof.reason??null,
  publishedToSubscribers:false,automaticCollection:false,
  officialObservation:false,checkedAt:proof.checkedAt
});
await writeFile(dest,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log('DWD_ADMIN_AUDIT='+JSON.stringify(evidence));
