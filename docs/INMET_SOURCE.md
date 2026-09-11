# INMET official warning source

This gate adds a fail-closed contract for the public INMET CAP warning feed used by Blaise V6 RJ and a deterministic downstream policy that can normalize eligible official warnings into Blaise P0 candidates without automatically publishing them.

## Pinned source

- Source ID: `inmet-cap-warnings`
- Host: `apiprevmet3.inmet.gov.br`
- Feed: `https://apiprevmet3.inmet.gov.br/avisos/rss`
- The public INMET portal remains the human-facing reference for meteorological warnings.

The implementation accepts XML/CAP/RSS content only, rejects redirects and HTML fallbacks, enforces a 2 MiB body cap and an 8 second source timeout, and does not retain the raw feed or CAP polygon geometry.

## Identity, certainty and temporal gates

Every normalized record must be an `Actual` CAP `Alert` or `Update`, use an `@inmet.gov.br` sender and the current INMET OID namespace prefix `urn:oid:2.49.0.0.76.0.`. CAP urgency, severity and certainty values are restricted to bounded standard enums. `onset` and `expires` must be offset-aware timestamps, with `expires > onset` and a maximum warning window of seven days.

Any schema, identity, certainty or time drift blocks the source contract instead of being interpreted as a valid warning.

## Rio de Janeiro geofence

A warning is classified as affecting Estado do Rio de Janeiro only when at least one CAP area supplies one of these bounded signals:

1. an exact seven-digit IBGE municipality code beginning with `33` that resolves to one of the canonical 92 RJ municipalities;
2. an explicit `BR-RJ` geocode; or
3. `Rio de Janeiro` in the CAP `areaDesc` when a structured RJ geocode is not present.

RJ-looking seven-digit IBGE codes that are not in the canonical 92-city catalog fail closed. Exact municipality codes are normalized and retained only as canonical IBGE identifiers for downstream routing; CAP polygons remain unretained.

## Runtime polling, cache and policy evaluation

The production official-source worker can poll the validated CAP feed only when both the global source worker and the dedicated INMET switch are explicitly enabled. The dedicated switch is `BLAISE_INMET_WARNINGS_ENABLED=true`; it defaults to disabled and invalid values fail startup closed.

`backend/src/inmet-warning-cache.mjs` keeps only the normalized CAP inventory in memory. It independently revalidates source identity, bounded CAP fields, exact canonical RJ municipality identifiers, RJ inventory consistency and the canonical SHA-256 digest before accepting a snapshot. The cache is capped at 2 MiB, becomes stale after 30 minutes, follows the shared 15-minute normal / 1-minute severe refresh cadence, and never exposes warning payloads through worker status.

The cache semantic marker remains `CAP_CONTRACT_VALIDATED_P0_POLICY_NOT_EVALUATED` because it describes **only the source-cache contract**. A `CURRENT` cache by itself therefore never means that a warning passed P0 policy.

After each successful INMET source refresh, the worker separately invokes `stageInmetP0Batch()` using the refresh instant. The resulting full candidate batch is not retained in runtime status. Only a redacted `inmetP0Evaluation` projection is kept with the policy ID, status, timestamps, candidate/blocked/ineligible counts and batch SHA-256. Successful evaluation reports `READY_STAGED_NOT_PUBLISHED` and `STAGED_NOT_PUBLISHED`; it still reports `publication=NOT_PERFORMED`, `automaticPublication=DISABLED` and `fcmDelivery=NOT_PROVEN`.

A policy/staging failure does not poison a source snapshot that already passed the INMET source/cache contracts. In that case the source can remain `CURRENT` while the separate P0 evaluation reports `BLOCKED_POLICY_OR_STAGING_CONTRACT`. A source acquisition/validation failure instead reports `BLOCKED_SOURCE_UNAVAILABLE` for the P0 evaluation and does not evaluate stale payload as a new decision.

## P0 normalization policy

`backend/src/inmet-p0-policy.mjs` implements a deterministic, fail-closed policy but does not send FCM messages by itself.

A warning is eligible to become a P0 candidate only when all of these conditions hold:

- CAP severity is `Severe` or `Extreme`;
- urgency is `Immediate` or `Expected`;
- certainty is `Observed` or `Likely`;
- the warning has not expired and its CAP `sent` time is not beyond the existing five-minute future-skew allowance;
- the official `sent` to `expires` interval fits the existing Blaise P0 maximum validity of 24 hours;
- the RJ scope is exact and trusted.

When exact RJ municipality IBGE codes are present, the policy creates one candidate per canonical municipality, preserving the City 1/City 2 routing model. When the CAP source explicitly scopes the whole state through `BR-RJ` or a state-level area description, one statewide candidate is created. Unresolved municipal scope does not fall back to a statewide alert.

Every candidate is passed through the same `validateP0Alert` contract used by FCM before it is considered valid. Candidate IDs are deterministic SHA-256-derived identifiers, so no oversized source identifier is pushed into FCM payloads.

## Publication gate and evidence

`.github/workflows/inmet-source-probe.yml` remains manual-only for live public-source evidence. It uploads normalized source evidence and a dry-run P0 policy summary without publishing.

`.github/workflows/inmet-p0-publish.yml` is the separate manual-only publication gate. Real publication requires `execute_live_probe=true`, `execute_publish=true` and the exact confirmation `PUBLISH_OFFICIAL_P0`. It stages the live feed first, then authenticates through OIDC Workload Identity Federation and sends only the validated staged alerts to the protected `/v1/internal/p0` backend endpoint. It uses no long-lived Google service-account JSON key.

Backend acceptance is recorded separately from end-device delivery. Even after a backend `202 accepted`, the evidence remains explicit that FCM/device delivery requires independent proof.

Deterministic parser/fail-closed tests run in normal backend CI through `backend/test/inmet-source.test.mjs`, `backend/test/inmet-warning-cache.test.mjs`, `backend/test/official-source-worker-inmet.test.mjs`, `backend/test/inmet-p0-policy.test.mjs`, `backend/test/inmet-p0-publish.test.mjs` and `backend/test/inmet-p0-workflow.test.mjs`.

## Not yet proven

Continuous runtime evaluation/staging does **not** prove live INMET-to-FCM delivery, Android rendering or a production device alert. Automatic publication remains intentionally disabled. Before any always-on multi-instance publisher is considered, production-safe durable idempotency across process restarts/Cloud Run instances must be proven; the current backend replay protection alone must not be treated as that proof.
