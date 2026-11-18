/**
 * Explicit opt-in NOAA GFS Wave 3-point field audit. No subscription call,
 * no subscriber data, no scheduler. Produces actual model evidence or null.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {probeNoaaRjMarine} from '../src/noaa-wave-marine-rj.mjs';
import {verifyRjMarineAdminCoverage} from '../src/rj-noaa-marine-admin-bridge.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv.includes('--live')){
  console.error('NOAA_RJ_MARINE=OFFLINE; explicit --live required');
  process.exitCode=2;
 }else{
  const evidenceDir=new URL('../../evidence/international-sources/',import.meta.url);
  await mkdir(evidenceDir,{recursive:true});
  const source=await probeNoaaRjMarine();
  const admin=verifyRjMarineAdminCoverage(source,{
   now:Date.now(),noaaPublicDataLicenseReviewed:true
  });
  await writeFile(new URL('noaa-rj-offshore-wave-swell.json',evidenceDir),
   JSON.stringify(source,null,2)+'\n',{mode:0o600});
  await writeFile(new URL('noaa-rj-offshore-marine-admin-audit.json',evidenceDir),
   JSON.stringify(admin,null,2)+'\n',{mode:0o600});
  console.log('NOAA_RJ_MARINE_LIVE='+JSON.stringify({
   state:source.status,adminAudit:admin.status,
   waveHeightPoints:admin.verifiedWaveHeightPoints,
   swellPeriodPoints:admin.verifiedSwellPeriodPoints,
   issuedAt:source.issuedAt??null,validAt:source.validAt??null,
   checkedAt:source.checkedAt,
   fieldReasons:Object.fromEntries(Object.entries(source.sourceProducts??{})
    .map(([field,item])=>[field,item?.reason??null])),
   sourceId:'NOAA_GFS_WAVE',kind:'P',physicalObservation:false,
   publishedToSubscriber:false,automaticCollection:false
  }));
 }
}
