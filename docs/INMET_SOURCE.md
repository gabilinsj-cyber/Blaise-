# INMET official warning source

This gate adds a fail-closed contract for the public INMET CAP warning feed used by Blaise V6 RJ.

## Pinned source

- Source ID: `inmet-cap-warnings`
- Host: `apiprevmet3.inmet.gov.br`
- Feed: `https://apiprevmet3.inmet.gov.br/avisos/rss`
- The public INMET portal remains the human-facing reference for meteorological warnings.

The implementation accepts XML/CAP/RSS content only, rejects redirects and HTML fallbacks, enforces a 2 MiB body cap and an 8 second source timeout, and does not retain the raw feed or CAP polygon geometry.

## Identity and temporal gates

Every normalized record must be an `Actual` CAP `Alert` or `Update`, use an `@inmet.gov.br` sender and the current INMET OID namespace prefix `urn:oid:2.49.0.0.76.0.`. CAP urgency/severity values are restricted to their bounded standard enums. `onset` and `expires` must be offset-aware timestamps, with `expires > onset` and a maximum warning window of seven days.

Any schema/identity/time drift blocks the source contract instead of being interpreted as a valid warning.

## Rio de Janeiro geofence

A warning is classified as affecting Estado do Rio de Janeiro only when at least one CAP area supplies one of these bounded signals:

1. an IBGE municipality code matching `33xxxxx`;
2. an explicit `BR-RJ` geocode; or
3. `Rio de Janeiro` in the CAP `areaDesc` when a structured RJ geocode is not present.

The evidence records the match method for auditability. It does not retain the source polygon.

## Evidence and execution

`.github/workflows/inmet-source-probe.yml` is manual-only. It performs a live public-source probe and uploads `evidence/official-sources/inmet.json` with normalized identifiers, event/severity/timing, counts, geofence method and the canonical inventory SHA-256. Descriptions, instructions, raw XML and polygons are not retained.

Deterministic parser/fail-closed tests run in normal backend CI through `backend/test/inmet-source.test.mjs`.

## Not yet proven

This contract does **not** claim that INMET warnings are already promoted to Blaise P0, delivered through FCM, or rendered in the Android UI. Those production integrations remain blocked until the live-source contract is observed successfully and the downstream P0 promotion policy is implemented and tested on the same release candidate.
