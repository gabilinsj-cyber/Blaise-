/**
 * Explicit live NOAA GFS-Wave numeric validation at one FIXED offshore test
 * coordinate (not a municipality or a user's position).
 * Does not publish a measurement or update a production endpoint.
 * Requires a runner with libeccodes-tools; calls ≤4 recent model subsets.
 * Usage: node scripts/probe-noaa-wave-staging.mjs --live
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {collectNoaaWave} from '../src/noaa-wave-collector.mjs';

export const NOAA_OFFSHORE_RJ_STAGING_POINT=Object.freeze({
  latitude:-23.5,longitude:-42.5,
  scope:'FIXED_OFFSHORE_TEST_POINT_NOT_IBGE_MUNICIPALITY'
});
export async function probeNoaaOffshoreStaging({
  collect=collectNoaaWave,clock=()=>Date.now()
}={}){
  const at=clock();
  if(!Number.isSafeInteger(at)||at<0)throw Error('invalid_probe_clock');
  const base={
    contract:'BLAISE_NOAA_GFS_WAVE_STAGING_EVIDENCE_V1',
    scope:NOAA_OFFSHORE_RJ_STAGING_POINT.scope,
    checkedAt:new Date(at).toISOString(),
    sourceId:'NOAA_GFS_WAVE',kind:'P',
    productionChanged:false,publishedToClient:false,
    userLocationStored:false,officialObservation:false,officialAlert:false
  };
  try{
    const r=await collect(NOAA_OFFSHORE_RJ_STAGING_POINT.latitude,
      NOAA_OFFSHORE_RJ_STAGING_POINT.longitude,at);
    const valid=Date.parse(r.validAt),issued=Date.parse(r.issuedAt),
      expires=Date.parse(r.expiresAt);
    if(!Number.isFinite(r.waveHeightM)||r.waveHeightM<0||
       r.waveHeightM>35||r.nature!=='MODELO'||
       ![valid,issued,expires].every(Number.isFinite)||
       issued>valid||valid>at||expires<=at||
       r.sourceName!=='NOAA GFS Wave'||
       typeof r.sourceUrl!=='string'||!r.sourceUrl.startsWith(
          'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?'))
      throw Error('INVALID_OR_STALE_FORECAST_PRODUCT');
    return Object.freeze({...base,state:'REAL_MODEL_FIELD_VALIDATED',
      value:r.waveHeightM,unit:'m',issuedAt:r.issuedAt,
      validAt:r.validAt,expiresAt:r.expiresAt,sourceUrl:r.sourceUrl
    });
  }catch(error){
    return Object.freeze({...base,state:'UNAVAILABLE',value:null,
      reason:String(error?.message||'UNKNOWN').slice(0,100)
    });
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('Explicit --live required. No NOAA network call made.');
    process.exitCode=2;
  }else{
    const evidence=await probeNoaaOffshoreStaging();
    await mkdir(new URL('../../evidence/international-sources/',import.meta.url),
      {recursive:true});
    await writeFile(new URL('../../evidence/international-sources/noaa-wave-offshore.json',import.meta.url),
      JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(evidence));
  }
}
