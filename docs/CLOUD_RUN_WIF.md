# Cloud Run + WIF readiness, candidate and promotion gates

This repository prepares the Blaise entitlement/P0 backend for keyless Cloud Run deployment while keeping production traffic fail-closed.

## Safety model

The workflow `.github/workflows/cloudrun-readiness.yml` is a read-only `workflow_dispatch` gate. Its default is `execute_probe=false`; in that mode it performs local validation only and records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`. When explicitly enabled, it authenticates with GitHub OIDC Workload Identity Federation, verifies that the active identity is the dedicated deployment service account, confirms the configured Artifact Registry repository is a readable Docker repository in the configured region, and checks whether the Cloud Run service is present/readable. It never deploys, pushes an image, changes traffic, or mutates Artifact Registry.

The workflow `.github/workflows/cloudrun-candidate.yml` is also `workflow_dispatch` only. Its default is `execute_deploy=false`; in that mode it validates configuration and records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED` without authenticating to Google Cloud, pushing an image, creating a revision, or changing traffic.

When `execute_deploy=true`, GitHub obtains short-lived Google credentials through OIDC Workload Identity Federation. No service-account JSON key is accepted or referenced. The deploy identity and the runtime identity must be separate user-managed service accounts; preflight fails closed if both values are the same.

The candidate image is built from `backend/Dockerfile` and pushed to Artifact Registry with the Git commit SHA as a traceability tag. Before deployment, the workflow resolves that tag to the Artifact Registry `sha256` digest, validates the digest format, constructs an `image@sha256:...` reference, and deploys **that digest-pinned reference** with `--no-traffic` plus a revision traffic tag. After Cloud Run creates the revision, the workflow reads `status.imageDigest` and requires an exact match with the pushed Artifact Registry digest before the candidate can pass. This prevents a mutable tag from being treated as immutable deployment evidence.

The candidate is then called through its tagged URL for `/healthz` and `/readyz`. The candidate gate does not promote production traffic.

For a first service creation, the workflow explicitly keeps the service authenticated. For an existing service, it does not change the existing Cloud Run IAM policy. This avoids silently removing or adding public invocation during a candidate deployment.

## Repository variables required before readiness probing

- `BLAISE_GCP_PROJECT_ID`
- `BLAISE_GCP_WIF_PROVIDER`
- `BLAISE_GCP_CLOUDRUN_DEPLOY_SERVICE_ACCOUNT`
- `BLAISE_CLOUDRUN_RUNTIME_SERVICE_ACCOUNT`
- `BLAISE_CLOUDRUN_REGION`
- `BLAISE_CLOUDRUN_SERVICE`
- `BLAISE_ARTIFACT_REGISTRY_REPOSITORY`

These are locally validated by `scripts/cloudrun-readiness-preflight.sh`. A real readiness probe additionally proves WIF authentication and read access to the configured Artifact Registry and Cloud Run control plane. If the Cloud Run service does not exist yet, the readiness evidence records that state as an initial-deploy condition; it does not create the service.

## Additional variables required before any real candidate deployment

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

These values are validated by `scripts/cloudrun-preflight.sh`. Product IDs must be distinct, service-to-service audiences must be HTTPS, service account formats must be valid, the deploy/runtime identities must be distinct, and the WIF provider must be a full Google Workload Identity Provider resource name.

## IAM intent

The GitHub WIF principal should only be allowed to impersonate the dedicated deployment service account. The deployment account should receive only the permissions needed to read/push to the selected Artifact Registry repository, deploy/update the selected Cloud Run service, attach the dedicated runtime service account, invoke the private tagged candidate for smoke testing, and update traffic when an explicit promotion run is approved. Do not grant Owner or Editor for convenience.

The Cloud Run runtime service account is the backend's Application Default Credentials identity. It must receive only the Google Play/Firebase permissions required by the backend. Google Play Console access for subscription verification is a separate external production prerequisite and is not proven by these repository gates.

## Bounded canary promotion

The workflow `.github/workflows/cloudrun-promotion.yml` is also `workflow_dispatch` only and defaults to `execute_promotion=false`. It never runs on push or on a schedule. A real traffic change requires the exact candidate revision and `candidate-xxxxxxxx` tag produced by the candidate gate plus an explicitly selected target percentage.

Promotion is sequential and fail-closed. The only accepted progression is `0 -> 1 -> 5 -> 10 -> 25 -> 50 -> 100`. A request that skips a stage is rejected after reading the live Cloud Run traffic state. The workflow also requires exactly one non-candidate revision to carry the remaining production traffic; unexpected topologies are rejected rather than guessed.

Before any traffic mutation, the candidate tagged URL must pass authenticated `/healthz` and `/readyz` checks. After the mutation, the workflow verifies the exact live traffic split and then checks the candidate tagged URL and canonical service URL again.

If a post-mutation step fails, the workflow attempts to restore the exact traffic percentages captured before the attempted promotion. The evidence distinguishes `FAILED_ROLLED_BACK` from `FAILED_ROLLBACK_NOT_PROVEN`; a failed rollback is never reported as safe. Every successful stage requires a separate explicit workflow dispatch for the next stage, including the final 100% promotion.

## Traffic and release policy

A readiness PASS means only: WIF authentication succeeded with the configured deployment identity, the Docker Artifact Registry repository is readable in the configured region, and the Cloud Run control plane can be queried. It performs no deployment and changes no traffic.

A candidate PASS means only: the image push succeeded, the pushed Artifact Registry digest was resolved and bound exactly to the resulting Cloud Run revision, a revision was created with zero production traffic, and the tagged revision answered `/healthz` and `/readyz` under authenticated invocation.

A promotion PASS means only that one explicitly approved canary stage was applied, the resulting traffic split matched the requested bounded stage, and the post-change health/readiness checks passed. It does **not** mean Play Billing production verification, FCM live delivery, RTDN delivery, 3M/9M load, multi-region failover, signed Android release, or Play publication passed.

Real readiness probing, real candidate deployment and real traffic promotion remain external operations and must stay `NOT_RUN` until the required Google Cloud/Firebase/Play configuration exists and execution is explicitly approved. Production Preflight, Firebase Test Lab, signed Release Gate, load/failover evidence, and Play publication remain independent gates.
