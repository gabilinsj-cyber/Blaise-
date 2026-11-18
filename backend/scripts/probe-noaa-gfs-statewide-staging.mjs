/** Real one-shot GFS 0.25° grid over all 92 RJ municipality reference points.
 * Strictly forecast P; staging only. No data becomes a thermometer observation.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {probeNoaaGfsRj92} from '../src/noaa-gfs-atmos-statewide.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('NOAA_GFS_92_STAGING=OFFLINE; explicit --live required');
    process.exitCode=2;
  }else{
    const result=await probeNoaaGfsRj92();
    const dir=new URL('../../evidence/international-sources/',import.meta.url);
    await mkdir(dir,{recursive:true});
    await writeFile(new URL('../../evidence/international-sources/noaa-gfs-rj-92-temperature.json',import.meta.url),
      JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log('NOAA_GFS_92_STAGING='+result.state);
    console.log('VALIDATED='+result.verifiedMunicipalities+'/92');
    console.log('FORECAST_P_NOT_STATION_OBSERVATION=true');
    console.log('CUSTOMER_PUBLICATION=false');
  }
}
