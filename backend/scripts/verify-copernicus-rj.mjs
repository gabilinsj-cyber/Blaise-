import {probeCopernicusRjOcean} from '../src/copernicus-rj-ocean.mjs';
try{const snapshot=await probeCopernicusRjOcean();console.log(JSON.stringify({verification:'REAL_TOOLBOX_SUBSET_AND_STRICT_SCHEMA',snapshot}));}
catch(error){console.log(JSON.stringify({verification:'UNAVAILABLE',errorCode:error.code??'copernicus_collection_failed',snapshot:null}));process.exitCode=1;}
