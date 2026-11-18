/**
 * Internal audit of the same real DWD ICON global 92-point GRIB evidence.
 * A lack of valid data stays UNAVAILABLE; not a customer/production endpoint.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {approvedDwdIcon92AdminRecords} from '../src/rj-dwd-icon-92-admin-bridge.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
const source=new URL('../../evidence/international-sources/dwd-icon-rj-92.json',import.meta.url);
const dest=new URL('../../evidence/international-sources/dwd-icon-rj-92-admin-audit.json',import.meta.url);
const batch=JSON.parse(await readFile(source,'utf8'));
const now=Date.now();
const records=approvedDwdIcon92AdminRecords(batch,{now,dwdRightsReviewed:true});
const audit=buildInternalRjMeteorologyCoverage(records,{now});
const field=audit.fields.find(x=>x.field==='temperatureC');
const result=Object.freeze({
  contract:'BLAISE_RJ_DWD_ICON_92_ADMIN_AUDIT_V1',
  state:field.state,source:'DWD_ICON_GLOBAL',kind:'P',
  instrumentObservation:false,municipalitiesInIbge:92,
  verifiedMunicipalities:field.coveredMunicipalities,
  unavailableMunicipalities:field.unavailableMunicipalities,
  rejectedRecords:audit.rejectedRecordCount,
  datasetId:'ICON_GLOBAL_2M',
  issuedAt:batch.issuedAt??null,validAt:batch.validAt??null,
  checkedAt:batch.checkedAt??null,
  sourceUrl:batch.sourceUrl??null,
  altitudeVerified:false,
  dataLicensedSubjectToDwdTerms:true,
  officialInmetAgreementChecked:false,
  officialDefesaCivilAgreementChecked:false,
  autoCollectionEnabled:false,publishedToAndroid:false,
  publishedToSubscriber:false,paidHgPlanActivated:false,
});
await writeFile(dest,JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log('BLAISE_DWD_RJ_92_ADMIN_AUDIT='+JSON.stringify(result));
