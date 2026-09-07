# Cloud Run + WIF candidate gate

This repository prepares the Blaise entitlement/P0 backend for a keyless Cloud Run deployment while keeping production traffic fail-closed.

## Safety model

The workflow `.github/workflows/cloudrun-candidate.yml` is `workflow_dispatch` only. Its default is `execute_deploy=false`; in that mode it validates configuration and records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED` without authenticating to Google Cloud, pushing an image, creating a revision, or changing traffic.

When `execute_deploy=true`, GitHub obtains short-lived Google credentials through OIDC Workload Identity Federation. No service-account JSON key is accepted or referenced. The deploy identity and the runtime identity are separate user-managed service accounts.

The candidate image is built from `backend/Dockerfile`, pushed to Artifact Registry with the immutable Git commit SHA as its tag, and deployed with `--no-traffic` plus a revision traffic tag. The candidate is then called through its tagged URL for `/healthz` and `/readyz`. The gate does not contain `gcloud run services update-traffic`, `--to-latest`, or any other promotion command.

For a first service creation, the workflow explicitly keeps the service authenticated. For an existing service, it does not change the existing Cloud Run IAM policy. This avoids silently removing or adding public invocation during a candidate deployment.

## Repository variables required before any real candidate deployment

- `BLAISE_GCP_PROJECT_ID`
- `BLAISE_GCP_WIF_PROVIDER`
- `BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT`
- `BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT`
- `BLAISE_CLOUDRUN_REGION`
- `BLAISE_CLOUDRUN_SERVICE`
- `BLAISE_ARTIFACT_REGISTRY_REPOSITORY`
- `BLAISE_MONTHLY_PRODUCT_ID`
- `BLAISE_ANNUAL_PRODUCT_ID`
- `BLAISE_FIREBASE_PROJECT_ID`
- `BLAISE_PUBSUB_AUDIENCE`
- `BLAISE_PUBSUB_SERVICE_ACCOUNT`
- `BLAISE_P0_AUDIENCE`
- `BLAISE_P0_SERVICE_ACCOUNT`
- `BLAISE_OBSERVABILITY_AUDIENCE`
- `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT`
- optional `BLAISE_FCM_P0_TOPIC` (defaults to `blaise-rj-p0` in the deployment workflow)

These values are validated by `scripts/cloudrun-preflight.sh`. Product IDs must be distinct, service-to-service audiences must be HTTPS, service account formats must be valid, and the WIF provider must be a full Google Workload Identity Provider resource name.

## IAM intent

The GitHub WIF principal should only be allowed to impersonate the dedicated deployment service account. The deployment account should receive only the permissions needed to push to the selected Artifact Registry repository, deploy/update the selected Cloud Run service, attach the dedicated runtime service account, and invoke the private tagged candidate for smoke testing. Do not grant Owner or Editor for convenience.

The Cloud Run runtime service account is the backend's Application Default Credentials identity. It must receive only the Google Play/Firebase permissions required by the backend. Google Play Console access for subscription verification is a separate external production prerequisite and is not proven by this repository gate.

## Traffic and release policy

A candidate PASS means only: immutable image push succeeded, a Cloud Run revision was created with zero production traffic, and the tagged revision answered `/healthz` and `/readyz` under authenticated invocation. It does **not** mean Play Billing production verification, FCM live delivery, RTDN delivery, 3M/9M load, multi-region failover, signed Android release, or Play publication passed.

Production traffic promotion remains a separate explicit future gate after Production Preflight, real Firebase/Play configuration, and runtime evidence are available. Rollout should then use bounded percentages with rollback evidence rather than an automatic 100% switch.
