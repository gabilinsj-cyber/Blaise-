# Cloud Run rollout gate

The production backend rollout is intentionally manual-only and fail-closed. The workflow is `.github/workflows/cloudrun-rollout.yml`.

## Safety model

The default operation is `plan`. In plan mode the workflow performs no Google authentication and no Google Cloud mutation. Any external operation requires `confirm_production_change=true` and repository configuration to be present.

Authentication uses GitHub OIDC Workload Identity Federation. Long-lived Google service-account JSON keys are not accepted by the workflow. The Google auth and setup-gcloud actions are pinned by full commit SHA and the Google Cloud CLI is pinned to 583.0.0.

## Operations

- `bootstrap-private`: creates the first private Cloud Run service revision from an immutable Artifact Registry image digest. It is blocked if the service already exists.
- `candidate`: deploys a tagged revision with `--no-traffic`, validates the Cloud Run Ready condition, and probes `/healthz` and `/readyz` on the tagged revision using an identity token.
- `canary`: shifts only 1..25 percent of traffic to an explicitly named Ready revision.
- `promote`: sends 100 percent of traffic to an explicitly named Ready revision.
- `rollback`: sends 100 percent of traffic to an explicitly named known-good Ready revision.

The rollout workflow does not grant public/unauthenticated invocation. IAM exposure is a separate production decision. The deploy identity must have only the permissions needed to push to the selected Artifact Registry repository, deploy/inspect the selected Cloud Run service, act as the runtime identity, and invoke the private service for readiness probes.

## Required repository variables

Deployment control:

- `BLAISE_GCP_PROJECT_ID`
- `BLAISE_GCP_WIF_PROVIDER`
- `BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT`
- `BLAISE_GCP_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT`
- `BLAISE_CLOUDRUN_REGION`
- `BLAISE_CLOUDRUN_SERVICE`
- `BLAISE_ARTIFACT_REGISTRY_REPOSITORY`

Runtime configuration required before `bootstrap-private` or `candidate`:

- `BLAISE_MONTHLY_PRODUCT_ID`
- `BLAISE_ANNUAL_PRODUCT_ID`
- `BLAISE_FIREBASE_PROJECT_ID`
- `BLAISE_FCM_P0_TOPIC`
- `BLAISE_PUBSUB_AUDIENCE`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT`
- `BLAISE_P0_AUDIENCE`
- `BLAISE_P0_SERVICE_ACCOUNT`
- `BLAISE_OBSERVABILITY_AUDIENCE`
- `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT`

The monthly and annual IDs must be real Google Play product IDs and must differ. Placeholder production values are not permitted.

## Evidence and current status

Every run uploads `blaise-cloudrun-rollout-evidence`. Failed or incomplete runs retain a BLOCKED marker rather than manufacturing a PASS.

As of this change, the workflow is prepared only. No Cloud Run service, Artifact Registry image, WIF trust, traffic shift, canary, promotion, or rollback has been executed by this repository change. Those remain external production gates pending the real Google Play/Firebase/GCP configuration and explicit execution approval.
