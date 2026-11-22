/**
 * Visual Crossing Free — proposed Cloud Run -> Secret Manager binding only.
 *
 * This module does not read secrets, execute gcloud, call weather providers,
 * grant IAM, enable flags or create a revision. No runtime auto-init.
 *
 * A one-shot private collector already accepts
 * env.BLAISE_VISUAL_CROSSING_FREE_API_KEY. Only a future reviewed Cloud Run
 * deployment can map the Secret Manager resource to that environment name.
 * The 92-city collector has a separate BLAISE_VC_FREE_API_KEY contract and
 * remains disabled, including its key-rotation and supplier-budget gates.
 */
export const VC_CLOUD_RUN_SECRET_BINDING = Object.freeze({
  projectId:'blaise-v6-rj',
  service:'blaise-v6-rj-backend',
  serviceIdentity:'blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com',
  secret:'blaise-visual-crossing-free-api-key',
  // Pinned explicitly rather than 'latest' to avoid unreviewed version drift.
  secretVersion:'1',
  environmentVariable:'BLAISE_VISUAL_CROSSING_FREE_API_KEY',
  minimumIamRole:'roles/secretmanager.secretAccessor',
  iamScope:'SECRET_ONLY_NOT_PROJECT',
  target:'PRIVATE_ONE_SHOT_COLLECTOR_ONLY',
  proposedCloudRunFlag:'--update-secrets',
  collectorSchedulerEnabled:false,
  clientsEnabled:false,
  releaseApproved:false
});

const OFFLINE_LOCKS=Object.freeze([
 'BLAISE_VISUAL_CROSSING_PRIVATE_ENABLED',
 'BLAISE_VISUAL_CROSSING_ONESHOT_APPROVED',
 'BLAISE_VC_92_COLLECTION_ENABLED',
 'BLAISE_VC_92_OPERATOR_APPROVED',
 'BLAISE_VC_PUBLISH_CLIENT',
 'BLAISE_VISUAL_CROSSING_PUBLISH_TO_SUBSCRIBERS',
 'BLAISE_VC_SUBSCRIBER_CACHED_DISPLAY_ENABLED'
]);

/**
 * Metadata-only plan; no actual environment values are read or returned.
 * existingSecretReferenceCount is only a known/observed count, not an input
 * used to rewrite the existing service; never use --set-secrets (replacement).
 */
export function createVisualCrossingSecretWiringPlan({
 existingSecretReferenceCount=0,secretReferenceExists=false
}={}){
 if(!Number.isSafeInteger(existingSecretReferenceCount)||
    existingSecretReferenceCount<0||existingSecretReferenceCount>1000||
    typeof secretReferenceExists!=='boolean')
  throw Error('invalid_secret_binding_metadata');
 const spec=VC_CLOUD_RUN_SECRET_BINDING;
 return Object.freeze({
  state:'PREPARED_OFFLINE_NOT_APPLIED',
  targetProject:spec.projectId,
  targetService:spec.service,
  expectedRuntimeIdentity:spec.serviceIdentity,
  binding:Object.freeze({
   environmentVariable:spec.environmentVariable,
   secretResourceName:spec.secret,
   pinnedVersion:spec.secretVersion,
   // Proposed CLI update is incremental, not destructive replacement.
   safeUpdateMode:spec.proposedCloudRunFlag,
   existingSecretReferenceCount,
   referenceAlreadyPresent:secretReferenceExists,
   preserveExistingSecrets:true
  }),
  iam:Object.freeze({
   proposedRole:spec.minimumIamRole,
   proposedScope:spec.iamScope,
   identity:spec.serviceIdentity,
   permission:'secretmanager.versions.access',
   accessNotVerified:true,
   grantNotCreated:true,
   noProjectWideGrant:true,
   noTokenCreatorGrant:true
  }),
  requiredDisabledFlagNames:OFFLINE_LOCKS,
  sourceApiKeyValueIncluded:false,
  versionValueRead:false,
  accessTokenRequested:false,
  cloudApiCalled:false,
  weatherApiCalled:false,
  deployExecuted:false,
  iamModified:false,
  workerOrSchedulerEnabled:false,
  clientPublished:false,
  keyRotated:false,
  operatorReleaseApprovalRequired:true,
  exposedKeyRiskReviewPending:true,
  supplierLicenseAndQuotaReviewPending:true,
  releaseApproved:false
 });
}
