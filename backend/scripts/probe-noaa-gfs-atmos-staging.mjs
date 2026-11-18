/**
 * One-time public NOAA GFS atmospheric forecast proof for Rio de Janeiro.
 * Opt-in --live only. Does not update backend, public app, customer data or secrets.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {probeNoaaGfsAtmosphericPoint} from '../src/noaa-gfs-atmos-collector.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('NOAA_GFS_ATMOS_STAGING=OFFLINE; explicit --live required');
    process.exitCode=2;
  }else{
    const result=await probeNoaaGfsAtmosphericPoint({ibge:'3304557'});
    const dir=new URL('../../evidence/international-sources/',import.meta.url);
    await mkdir(dir,{recursive:true});
    await writeFile(new URL('../../evidence/international-sources/noaa-gfs-atmos-rio.json',import.meta.url),
      JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log('NOAA_GFS_ATMOS_STAGING='+result.status);
    console.log('IBGE='+result.ibge);
    console.log('STATUS='+JSON.stringify(result));
  }
}
