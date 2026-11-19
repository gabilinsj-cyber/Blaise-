/**
 * READ-ONLY live project RULES retrieval, followed by LOCAL emulator tests.
 * Never reads live Firestore documents, mutates deployed rules, obtains a
 * weather API key, invokes Visual Crossing or stores subscriber data.
 *
 * Takes one argument: absolute path to offline probe.mjs from same PR.
 */
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const PROJECT='blaise-v6-rj';
const DEMO='demo-blaise-vc-firestore-rules';
const report=reason=>console.log('BLAISE_VC_LOCAL_SECURITY_CHECK='+JSON.stringify({
 state:'REVIEW_REQUIRED',reason,productionChanged:false,
 productionDocumentsRead:false,weatherApiCalled:false,clientRelease:false
}));
const invoke=(cmd,args,{cwd=undefined,timeout=30000,maxBuffer=1024*1024}={})=>
 execFileSync(cmd,args,{cwd,encoding:'utf8',timeout,maxBuffer,
  stdio:['ignore','pipe','pipe']});
let working=null;
try{
 if(process.argv.length!==3||
    !process.argv[2].endsWith('visual-crossing-firestore-client-probe.mjs'))
  throw Error('PROBE_REQUIRED');
 const probe=await readFile(process.argv[2],'utf8');
 if(!probe.includes('local_firestore_emulator_required')||probe.length>10000)
  throw Error('PROBE_INVALID');
 const token=invoke('gcloud',['auth','print-access-token'],{timeout:12000}).trim();
 if(!/^[A-Za-z0-9._~-]{40,}$/.test(token))throw Error('AUTH_UNAVAILABLE');
 const get=async path=>{
  const r=await fetch('https://firebaserules.googleapis.com/v1/'+path,{
   method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   redirect:'error',signal:AbortSignal.timeout(15000)
  });
  if(!r.ok)throw Error('RULESET_FETCH_UNAVAILABLE');
  const body=await r.text();
  if(body.length>500000)throw Error('RULESET_RESPONSE_TOO_LARGE');
  return JSON.parse(body);
 };
 const releases=await get('projects/'+PROJECT+'/releases');
 const candidates=[
  'projects/'+PROJECT+'/releases/cloud.firestore',
  'projects/'+PROJECT+'/releases/cloud.firestore/(default)'
 ];
 const release=releases?.releases?.find(r=>candidates.includes(r?.name));
 if(!release||typeof release.rulesetName!=='string'||
  !/^projects\/blaise-v6-rj\/rulesets\/[A-Za-z0-9_-]+$/.test(release.rulesetName))
  throw Error('RULESET_NOT_FOUND');
 const ruleset=await get(release.rulesetName);
 const files=ruleset?.source?.files;
 if(!Array.isArray(files)||!files.length||files.length>8||
    files.some(f=>typeof f?.content!=='string'))
  throw Error('RULESET_UNEXPECTED');
 const source=files.map(f=>f.content).join('\n');
 if(source.length>250000||!source.includes('service cloud.firestore'))
  throw Error('FIRESTORE_RULES_INVALID');
 working=await mkdtemp(join(tmpdir(),'blaise-vc-local-rules-'));
 await Promise.all([
  writeFile(join(working,'active-firestore.rules'),source,{mode:0o600}),
  writeFile(join(working,'probe.mjs'),probe,{mode:0o600}),
  writeFile(join(working,'package.json'),
   JSON.stringify({private:true,type:'module'}),{mode:0o600}),
  writeFile(join(working,'firebase.json'),JSON.stringify({
   firestore:{rules:'active-firestore.rules'},
   emulators:{firestore:{host:'127.0.0.1',port:8185},
    ui:{enabled:false},singleProjectMode:true}
  }),{mode:0o600})
 ]);
 // Install only into fresh /tmp. Does NOT modify Blaise-RJ, Firebase, or GCP.
 invoke('npm',['install','--no-audit','--no-fund','--no-save',
  'firebase-tools@14','firebase@12','@firebase/rules-unit-testing@5'],
  {cwd:working,timeout:180000,maxBuffer:512*1024});
 const output=invoke(join(working,'node_modules','.bin','firebase'),[
  'emulators:exec','--only','firestore','--project',DEMO,
  '--config',join(working,'firebase.json'),'node probe.mjs'
 ],{cwd:working,timeout:180000,maxBuffer:2*1024*1024});
 const marker=output.split('\n').find(x=>
  x.startsWith('BLAISE_VC_LOCAL_SECURITY_RESULTS='));
 if(!marker)throw Error('EMULATOR_RESULT_MISSING');
 console.log(marker);
}catch(e){
 const reasons=['PROBE_REQUIRED','PROBE_INVALID','AUTH_UNAVAILABLE',
  'RULESET_FETCH_UNAVAILABLE','RULESET_RESPONSE_TOO_LARGE',
  'RULESET_NOT_FOUND','RULESET_UNEXPECTED','FIRESTORE_RULES_INVALID',
  'EMULATOR_RESULT_MISSING'];
 report(reasons.includes(e?.message)?e.message:'EMULATOR_SETUP_OR_PERMISSION_UNAVAILABLE');
 process.exitCode=2;
}finally{
 if(working)await rm(working,{recursive:true,force:true}).catch(()=>{});
}
