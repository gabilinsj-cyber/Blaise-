# INMET official warning source

This gate adds a fail-closed contract for the public INMET CAP warning feed used by Blaise V6 RJ and a deterministic downstream policy that can normalize eligible official warnings into Blaise P0 candidates without publishing them.

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

## Evidence and execution

`.github/workflows/inmet-source-probe.yml` remains manual-only. It performs a live public-source probe and uploads `evidence/official-sources/inmet.json` with normalized identifiers, event/severity/certainty/timing, counts, geofence method, exact canonical municipality IDs when present, the canonical inventory SHA-256 and a dry-run summary of the P0 policy.

The live probe does **not** publish to FCM. It records candidate, blocked and ineligible counts plus reason histograms so source behavior can be audited without creating a real alert.

Deterministic parser/fail-closed tests run in normal backend CI through `backend/test/inmet-source.test.mjs` and `backend/test/inmet-p0-policy.test.mjs`.

## Not yet proven

This change does **not** claim live INMET-to-FCM delivery, Android rendering, or a production P0 alert path. Those remain blocked until a live INMET source probe passes on the same release candidate and the explicitly controlled publisher is wired and validated with real Firebase/FCM evidence. No warning is promoted merely from a deterministic test or dry-run policy evaluation.
