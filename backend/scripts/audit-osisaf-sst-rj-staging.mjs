/** Privately audit one real EUMETSAT OSI SAF GOES-19 coastal SST probe. */
import {readFile,writeFile} from 'node:fs/promises';
import {verifyRjOsiSafSstAdmin} from '../src/rj-osisaf-sst-admin-bridge.mjs';
const src=new URL('../../evidence/international-sources/osi-saf-rj-coast-sst.json',import.meta.url);
const dest=new URL('../../evidence/international-sources/osi-saf-rj-coast-admin-audit.json',import.meta.url);
const source=JSON.parse(await readFile(src,'utf8'));
const snapshot=verifyRjOsiSafSstAdmin(source,{
  now:Date.now(),commercialUseAttributionReviewed:true
});
const audit={
  contract:snapshot.contract,sourceId:snapshot.sourceId,
  productId:snapshot.productId,state:snapshot.state,
  checkedAt:source.checkedAt,validAt:source.validAt,
  acceptedPointCount:snapshot.acceptedPointCount,
  missingPointCount:3-snapshot.acceptedPointCount,
  records:snapshot.records,
  reason:snapshot.reason??null,
  physicalObservation:false,airTemperatureMeasurements:0,
  publishedToAndroid:false,publishedToSubscribers:false,
  automaticCollection:false,attribution:'EUMETSAT OSI SAF, OSI-207-c, CC BY 4.0'
};
await writeFile(dest,JSON.stringify(audit,null,2)+'\n',{mode:0o600});
console.log('BLAISE_OSI_SAF_RJ_SST_AUDIT='+JSON.stringify({
  state:audit.state,verified:audit.acceptedPointCount,missing:audit.missingPointCount,
  reason:audit.reason,source:'EUMETSAT_OSI_SAF_SST',kind:'E',
  publishedToSubscribers:false
}));
