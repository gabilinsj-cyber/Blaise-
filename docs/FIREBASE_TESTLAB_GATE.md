# Firebase Test Lab gate

The Blaise V6 Firebase Test Lab gate is intentionally manual-only and fail-closed. It does not run on push, pull request, schedule, or release. The default manual dispatch performs only a live Test Lab catalog query after Google Cloud OIDC Workload Identity Federation authentication; it does not create a Test Lab matrix.

## Required repository variables

- `BLAISE_GCP_PROJECT_ID`
- `BLAISE_GCP_WIF_PROVIDER`
- `BLAISE_GCP_TESTLAB_SERVICE_ACCOUNT`

The workflow does not accept a long-lived service-account JSON key. The Google authentication and Google Cloud setup actions are pinned to exact commit SHAs, and Google Cloud CLI is pinned to 583.0.0.

## Execution policy

`execute_test` defaults to `false`. To create an external Test Lab matrix, an operator must explicitly dispatch with `execute_test=true` and provide both `model_id` and `version_id` from the current Test Lab catalog. The workflow re-queries the live catalog, describes the selected model/version/locale, confirms that the selected version is in `supportedVersionIds`, and rejects catalog data containing `deprecated` or `reduced_stability` before building or submitting the matrix.

The instrumentation matrix uses `pt_BR`, portrait orientation, the debug APK, and the debug AndroidTest APK. The old static Pixel2/API 30 target is retired.

## Evidence semantics

A catalog-only dispatch records `execution=NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`; this is not a Test Lab PASS. A real Test Lab PASS is recorded only after an explicitly approved external matrix completes successfully. Missing Google/Firebase/WIF configuration fails closed.
