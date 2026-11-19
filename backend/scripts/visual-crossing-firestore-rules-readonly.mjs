/**
 * READ ONLY: inspect current Firebase Rules metadata for Blaise V6 RJ.
 * Does NOT write rules, change IAM, read Firestore data, fetch meteorological
 * APIs, log Google access tokens, or print the full project ruleset.
 *
 * This summary is NOT a security pass. A wildcard allow may overlap any
 * explicitly denied collection; emulator & IAM review are required.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const PROJECT='blaise-v6-rj';
const COLLECTIONS=Object.freeze([
 'blaise_rj_visual_crossing_free_private_weather_v1',
 'blaise_rj_vc_free_92_future_budget_v1',
 'blaise_rj_visual_crossing_free_trial_budget_v1'
]);
function fail(code){
 console.log('RJ_VC_FIRESTORE_RULES_AUDIT='+JSON.stringify({
  status:'REVIEW_REQUIRED',reason:code,
  rulesRead:false,manualReviewRequired:true,noChanges:true
 }));
 process.exitCode=2;
}
export function summarizeRjVisualCrossingRules(source){
 if(typeof source!=='string'||source.length>250000)throw Error('invalid_rule_text');
 const sourceNoComments=source.replace(/\/\*[\s\S]*?\*\//g,' ')
  .replace(/(^|\n)\s*\/\/[^\n]*/g,' ');
 const paths=COLLECTIONS.map(id=>({
  collection:id,
  explicitPathMention:sourceNoComments.includes('/'+id+'/')||
   sourceNoComments.includes('/'+id+'{')||
   sourceNoComments.includes('/'+id+' '),
 }));
 // Heuristics only! Not a parser/evaluator for Firestore rules.
 const suspicious=/(allow\s+(?:read|write|create|delete|update|list|get|read\s*,\s*write|write\s*,\s*read)\s*:\s*if\s+(?:true\b|request\.auth\s*!=\s*null\b))/i.test(sourceNoComments);
 return Object.freeze({
  paths,hasRecursiveWildcard:/\{\s*\w+\s*=\s*\*\*\s*\}/.test(sourceNoComments),
  suspiciousBroadAllowHeuristic:suspicious,
  sourceFingerprintSha256:createHash('sha256').update(source).digest('hex'),
  isSecureVerdict:false,manualReviewRequired:true,
  explanation:'Exact collection match never overrides a broader allow. Emulator client-deny tests and server IAM review required.'
 });
}
async function main(){
 try{
  const token=execFileSync('gcloud',['auth','print-access-token'],{
   encoding:'utf8',timeout:10000,maxBuffer:8192,
   stdio:['ignore','pipe','ignore']
  }).trim();
  if(!/^[A-Za-z0-9._~-]{40,}$/.test(token))return fail('GOOGLE_AUTH_UNAVAILABLE');
  const get=async(path)=>{
   const url='https://firebaserules.googleapis.com/v1/'+path;
   const r=await fetch(url,{
    method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    redirect:'error',signal:AbortSignal.timeout(14000)
   });
   if(!r.ok)throw Error('rules_api_unavailable');
   const text=await r.text();
   if(text.length>500000)throw Error('oversized_rules_response');
   return JSON.parse(text);
  };
  const releases=await get('projects/'+PROJECT+'/releases');
  const exact=['projects/'+PROJECT+'/releases/cloud.firestore',
    'projects/'+PROJECT+'/releases/cloud.firestore/(default)'];
  const release=(releases?.releases||[]).find(r=>exact.includes(r?.name));
  if(!release||typeof release.rulesetName!=='string'||
     !/^projects\/blaise-v6-rj\/rulesets\/[A-Za-z0-9_-]+$/.test(release.rulesetName))
   return fail('DEFAULT_FIRESTORE_RULES_RELEASE_NOT_FOUND');
  const ruleset=await get(release.rulesetName);
  const files=ruleset?.source?.files;
  if(!Array.isArray(files)||files.length<1||files.length>50)
   return fail('RULESET_FILES_UNAVAILABLE');
  const combined=files.map(f=>typeof f.content==='string'?f.content:'').join('\n');
  if(!combined.includes('service cloud.firestore'))
   return fail('CLOUD_FIRESTORE_RULES_NOT_PRESENT');
  const summary=summarizeRjVisualCrossingRules(combined);
  console.log('RJ_VC_FIRESTORE_RULES_AUDIT='+JSON.stringify({
   status:'REVIEW_REQUIRED',rulesRead:true,
   ruleFiles:files.length,...summary,
   rulesReleaseIsDefault:true,credentialsPrinted:false,
   dataCopied:false,modifiedProduction:false,noChanges:true
  }));
 }catch{
  fail('FIREBASE_RULES_READ_PERMISSION_OR_NETWORK_UNAVAILABLE');
 }
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)
 await main();
