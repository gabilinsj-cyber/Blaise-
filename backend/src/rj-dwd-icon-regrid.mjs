/**
 * DWD official ICON Global icosahedral -> regular 0.25deg lat/lon conversion.
 * Forecast P. Uses DWD's published CDO grid+weights, never interpolates
 * without the authentic remapping metadata. Opt-in staging, not a scheduler.
 *
 * DWD official data: https://opendata.dwd.de/weather/lib/cdo/
 * DWD reference: https://github.com/DeutscherWetterdienst/regrid
 */
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export const DWD_ICON_OFFICIAL_WEIGHTS_URL=
  'https://opendata.dwd.de/weather/lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2';
const MAX_BZ_BYTES=50*1024*1024;
const BLOCKED=/[\x00-\x1f]/;
function safeMember(m){
  if(typeof m!=='string'||m.length>240||BLOCKED.test(m)||m.startsWith('/')||
     m.includes('\\')||m.split('/').includes('..')||m.split('/').includes(''))return false;
  return true;
}
const execBounded=(command,args,{timeout=90_000,maxBuffer=32768}={})=>
  exec(command,args,{timeout,maxBuffer});
export function chooseDwdWeightMembers(members){
  if(!Array.isArray(members)||members.length<2||
     members.some(m=>!safeMember(m)))throw Error('DWD_WEIGHTS_TAR_PATH_INVALID');
  const find=(name)=>members.filter(x=>x===name||x.endsWith('/'+name));
  const target=find('target_grid_world_025.txt');
  const weights=find('weights_icogl2world_025.nc');
  if(target.length!==1||weights.length!==1)throw Error('DWD_WEIGHTS_EXPECTED_MEMBERS_MISSING');
  return Object.freeze({target:target[0],weights:weights[0]});
}
export async function fetchDwdOfficialWeights(fetchImpl=globalThis.fetch){
  const response=await fetchImpl(DWD_ICON_OFFICIAL_WEIGHTS_URL,{
    redirect:'error',signal:AbortSignal.timeout(90_000),
    headers:{Accept:'application/octet-stream'}
  });
  if(!response.ok||!response.body)throw Error('DWD_WEIGHT_DOWNLOAD_FAILED');
  const len=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(len)&&len>MAX_BZ_BYTES)throw Error('DWD_WEIGHT_FILE_EXCEEDS_CAP');
  const chunks=[];let total=0;
  for await(const piece of response.body){
    total+=piece.length;
    if(total>MAX_BZ_BYTES)throw Error('DWD_WEIGHT_FILE_EXCEEDS_CAP');
    chunks.push(Buffer.from(piece));
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.length<1000||bytes.subarray(0,3).toString('ascii')!=='BZh')
    throw Error('DWD_WEIGHT_BZIP_HEADER_INVALID');
  return bytes;
}
export async function regridDwdIconGlobalGrib({
  originalFile,workspace,fetchImpl=globalThis.fetch,
  execCommand=execBounded
}={}){
  if(typeof originalFile!=='string'||!originalFile.startsWith('/')||
     typeof workspace!=='string'||!workspace.startsWith('/'))
    throw Error('DWD_REGRID_WORKSPACE_INVALID');
  const weightsDir=join(workspace,'dwd-weights');
  await mkdir(weightsDir,{recursive:true,mode:0o700});
  const archive=join(weightsDir,'official-025.tar.bz2');
  const bytes=await fetchDwdOfficialWeights(fetchImpl);
  await writeFile(archive,bytes,{mode:0o600});
  const listing=(await execCommand('tar',['-tjf',archive])).stdout.trim();
  const members=listing.split('\n').filter(Boolean).map(x=>x.replace(/^\.\//,''));
  const {target,weights}=chooseDwdWeightMembers(members);
  // Extract the two named official data files only, never arbitrary tar entries.
  await execCommand('tar',['-xjf',archive,'-C',weightsDir,
    '--no-same-owner','--no-same-permissions',target,weights],
    {timeout:90_000,maxBuffer:32768});
  const root=resolve(weightsDir);
  const safePath=(name)=>{
    const p=resolve(root,name);
    if(relative(root,p).startsWith('..')||!p.startsWith(root+'/'))
      throw Error('DWD_REGRID_PATH_ESCAPE');
    return p;
  };
  const gridPath=safePath(target),weightsPath=safePath(weights);
  const grid=(await readFile(gridPath,'utf8')).slice(0,4096);
  if(!/gridtype\s*=\s*lonlat/.test(grid)||!/xinc\s*=\s*0\.25/.test(grid)||
     !/yinc\s*=\s*0\.25/.test(grid))
    throw Error('DWD_REGRID_GRID_DESCRIPTION_INVALID');
  const ws=await stat(weightsPath);
  if(ws.size<1024||ws.size>500*1024*1024)throw Error('DWD_REGRID_WEIGHTS_SIZE_INVALID');
  const output=join(workspace,'icon-global-rj-regular-025.grib2');
  // Remapping code is CDO on the CI machine; provider archive holds data only.
  await execCommand('cdo',['-f','grb2',
    'remap,'+gridPath+','+weightsPath,originalFile,output],
    {timeout:180_000,maxBuffer:65536});
  const out=await stat(output);
  if(out.size<64||out.size>80*1024*1024)throw Error('DWD_REGRID_OUTPUT_INVALID');
  return Object.freeze({file:output,
    gridResolutionDegrees:0.25,
    interpolation:'DWD_OFFICIAL_CDO_PRECOMPUTED_WEIGHTS',
    weightsUrl:DWD_ICON_OFFICIAL_WEIGHTS_URL});
}
