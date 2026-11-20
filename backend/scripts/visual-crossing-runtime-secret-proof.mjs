/**
 * FUTURE, MANUAL, ISOLATED CLOUD RUN DIAGNOSTIC ONLY.
 * Never invoke as a web endpoint or from the production runtime.
 * Requires BLAISE_VC_SECRET_RUNTIME_PROOF_APPROVED=true and trusted
 * Cloud Run service identity. A Secret Manager version access is requested,
 * but the response body (containing key material) is immediately discarded.
 * The caller must separately authorize IAM, workload creation and cost.
 */
import {probeVisualCrossingSecretFromApprovedRuntime}
 from '../src/rj-visual-crossing-runtime-secret-proof.mjs';

const result=await probeVisualCrossingSecretFromApprovedRuntime({
 env:process.env
});
console.log('BLAISE_VC_SECRET_RUNTIME_ACCESS_PROOF='+JSON.stringify(result));
// Fail closed in Cloud Run Job result: unavailable/denied is not a success.
if(result.status!=='VERSION_ACCESS_GRANTED_AT_TIME')process.exitCode=1;
