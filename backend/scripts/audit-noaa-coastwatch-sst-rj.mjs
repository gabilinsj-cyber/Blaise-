import {readFile,writeFile} from 'node:fs/promises';
import {verifyRjNoaaCoastwatchSst} from '../src/rj-noaa-coastwatch-sst-admin.mjs';
const src=new URL('../../evidence/international-sources/noaa-coastwatch-acspo-rj-sst.json',import.meta.url);
const dst=new URL('../../evidence/international-sources/noaa-coastwatch-acspo-rj-audit.json',import.meta.url);
const parsed=JSON.parse(await readFile(src,'utf8'));
const inspected=verifyRjNoaaCoastwatchSst(parsed,{
 now:Date.now(),rightsAttributionReviewed:true
});
const out={
 contract:inspected.contract,state:inspected.state,reason:inspected.reason,
 sourceId:'NOAA_COASTWATCH_SST',sourceUrl:parsed.sourceUrl,
 checkedAt:parsed.checkedAt,validAt:parsed.validAt,
 verifiedPointCount:inspected.approvedValues,expectedPointCount:3,
 records:inspected.records,
 kind:'E',samePhysicalSatelliteAsEumetsat:true,
 noLandTemperature:true,noMunicipalityStationObservations:true,
 publishedToAndroid:false,publishedToSubscriber:false,
 automaticCollection:false,attribution:'NOAA CoastWatch / NOAA STAR ACSPO'
};
await writeFile(dst,JSON.stringify(out,null,2)+'\n',{mode:0o600});
console.log('BLAISE_NOAA_COASTWATCH_SST_ADMIN='+JSON.stringify({
 state:out.state,verified:out.verifiedPointCount,
 reason:out.reason,kind:'E',samePhysicalSatelliteAsEumetsat:true,
 publishedToSubscriber:false
}));
