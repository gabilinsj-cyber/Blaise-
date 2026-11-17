/**
 * Read-only, OFFLINE audit of backend meteorological ingestion readiness.
 * A zero here means "no trusted meteorological product records supplied to
 * this audit", NOT "nature is reporting zero or all external stations are down".
 * This CLI deliberately does not call any paid/free weather APIs.
 */
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';

const report=buildInternalRjMeteorologyCoverage();
console.log('BLAISE V6 RJ — ADMINISTRATIVE O/E/P DATA GATE');
console.log('MODE=OFFLINE_NO_LIVE_ADAPTERS');
console.log('INVENTORY=NOT_CONNECTED_TO_LIVE_SOURCE_WORKER');
console.log('NOTE=Zero verified fields in this audit does not mean zero meteorological phenomena.');
console.log('MUNICIPALITIES='+report.municipalityCount);
console.log('PARAMETERS='+report.fieldCount);
console.log('VERIFIED_VALUES_IN_THIS_AUDIT='+report.verifiedValueCount);
for(const field of report.fields){
  console.log(field.field+': '+field.state+' ('+field.coveredMunicipalities+'/'+report.municipalityCount+' with audited value)');
}
console.log('OPENWEATHER_CALLS=0');
console.log('ADMIN_ONLY=true');
