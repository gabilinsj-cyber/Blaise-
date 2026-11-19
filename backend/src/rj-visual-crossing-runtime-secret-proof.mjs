/**
 * Visual Crossing Free — future, isolated runtime-only proof of actual
 * secretmanager.versions.access under the APPROVED Cloud Run service identity.
 *
 * NOT imported by backend/src/runtime.mjs, NOT routed to HTTP, NOT scheduled.
 * Never requests the Visual Crossing provider, Firestore or the Android app.
 * The Secret Manager access response includes secret bytes: discard its body
 * WITHOUT parsing, logging, storing, hashing, decoding or printing any bytes.
 * Only run inside a reviewed Cloud Run no-traffic diagnostic workload with
 * explicit separate operator approval and IAM configuration.
 */
export const VISUAL_CROSSING_PROOF_SPEC=Object.freeze({
 projectId:'blaise-v6-rj',
 secret:'blaise-visual-crossing-free-api-key',
 version:'1',
 expectedServiceAccount:'blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com',
 metadataBase:'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default',
 secretManagerEndpoint:'https://secretmanager.googleapis.com/v1/projects/blaise-v6-rj/secrets/blaise-visual-crossing-free-api-key/versions/1:access'
});

const CLOSED=Object.freeze({
  status:'NOT_EXECUTED',
  proofPerformed:false,
  secretAccessAttempted:false,
  secretPayloadParsed:false,
  secretPayloadLogged:false,
  providerCalled:false,
  clientPublished:false,
  iamModified:false,
  deploymentPerformed:false,
  releaseApproved:false
});
function result(status,{attempted=false,confirmed=false}={}){
 return Object.freeze({...CLOSED,status,
  proofPerformed:attempted,
  secretAccessAttempted:attempted,
  identityVerified:confirmed,
  authorizationAtTime: status==='VERSION_ACCESS_GRANTED_AT_TIME'
    ?'GRANTED_AT_TIME_OF_PROBE'
    :status==='VERSION_ACCESS_DENIED_AT_TIME'
      ?'DENIED_FOR_THIS_ATTEMPT'
      :'NOT_VERIFIED'
 });
}
async function discardBody(response){
 try{await response?.body?.cancel?.();}catch{}
}
const safeTimeout=millis=>AbortSignal.timeout(millis);

/** Inject fetchImpl for offline tests. No key, token or error body in output. */
export async function probeVisualCrossingSecretFromApprovedRuntime({
 env={},fetchImpl=globalThis.fetch,clock=()=>Date.now()
}={}){
 if(env.BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED!=='true'||
    !(env.K_SERVICE||env.CLOUD_RUN_JOB)||
    typeof fetchImpl!=='function'||typeof clock!=='function')
  return result('EXPLICIT_APPROVAL_AND_CLOUD_RUN_REQUIRED');
 let identity;
 try{
  const r=await fetchImpl(
   VISUAL_CROSSING_PROOF_SPEC.metadataBase+'/email',
   {method:'GET',redirect:'error',headers:{'Metadata-Flavor':'Google'},
     signal:safeTimeout(5000)});
  if(r?.status!==200){
   await discardBody(r);return result('METADATA_IDENTITY_UNAVAILABLE');
  }
  identity=(await r.text()).trim();
 }catch{return result('METADATA_IDENTITY_UNAVAILABLE');}
 if(identity!==VISUAL_CROSSING_PROOF_SPEC.expectedServiceAccount)
  return result('SERVICE_IDENTITY_MISMATCH');
 let token;
 try{
  const r=await fetchImpl(
   VISUAL_CROSSING_PROOF_SPEC.metadataBase+'/token',
   {method:'GET',redirect:'error',headers:{'Metadata-Flavor':'Google'},
    signal:safeTimeout(5000)});
  if(r?.status!==200){
   await discardBody(r);return result('METADATA_TOKEN_UNAVAILABLE');
  }
  const v=await r.json();
  if(v?.token_type!=='Bearer'||typeof v.access_token!=='string'||
      v.access_token.length<32)return result('METADATA_TOKEN_INVALID');
  token=v.access_token;
 }catch{return result('METADATA_TOKEN_UNAVAILABLE');}
 let r;
 try{
  r=await fetchImpl(VISUAL_CROSSING_PROOF_SPEC.secretManagerEndpoint,{
   method:'GET',redirect:'error',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:safeTimeout(10000)
  });
 }catch{
  return result('SECRET_MANAGER_REQUEST_FAILED',{attempted:true,confirmed:true});
 }finally{
  token=undefined;
 }
 const status=r?.status;
 // Critical: do NOT call .json(), .text(), .arrayBuffer(), hash, log or
 // write the Secret Manager response body. It contains the API credential.
 await discardBody(r);
 if(status===200)return result('VERSION_ACCESS_GRANTED_AT_TIME',
  {attempted:true,confirmed:true});
 if(status===401||status===403)return result('VERSION_ACCESS_DENIED_AT_TIME',
  {attempted:true,confirmed:true});
 return result('SECRET_MANAGER_UNEXPECTED_STATUS',
  {attempted:true,confirmed:true});
}
