# CHM tide paid HTTPS delivery

## Scope

This gate closes only the paid-entitlement-safe HTTPS delivery boundary for already-normalized official CHM tide snapshots. It does not claim that the production runtime is already ingesting CHM tide PDFs or that a real Google Play subscription has been exercised in production.

## Backend contract

The production runtime exposes `POST /v1/data/chm/tide`. The request shape is exact and bounded:

- `packageName`
- `purchaseToken`
- `productIds`
- `stationNumber`
- `calendarYear`

Before any tide values are returned, the backend reuses the same Google Play server-side verification path used by `/v1/entitlements/verify`. A non-entitled purchase receives a generic `403 access_denied`. Invalid input is rejected before Play lookup. A missing, stale or otherwise non-current CHM tide cache returns generic `503 source_unavailable` and never releases a stale snapshot.

The endpoint accepts only cache states `CURRENT` and `CURRENT_DEGRADED`, then serializes `OFFICIAL_CHM_TIDE_VALUES_DELIVERY_V1`. The request and response use `Cache-Control: no-store`; purchase tokens and station identifiers are not used as metric dimensions.

The endpoint has an independent bounded concurrency gate and fixed counters:

- `chm_tide_success_total`
- `chm_tide_denied_total`
- `chm_tide_unavailable_total`
- `chm_tide_busy_total`

## Android contract

`ChmTideHttpsClient` derives its tide URL only from the configured entitlement verifier URL. The verifier URL must be HTTPS and must have the exact path `/v1/entitlements/verify`, with no credentials, query or fragment. The tide client keeps the same scheme/host/port and replaces only the path with `/v1/data/chm/tide`. This prevents sending a Play purchase token to a second or attacker-controlled origin.

The Android client disables redirects, uses 7-second connect/read timeouts, bounds the response to 1,100,000 bytes, and passes the decoded payload through the strict `ChmTideDeliveryParser` with expected station/year matching. Any malformed, oversized, mismatched or non-current payload fails closed.

## Current production boundary

The HTTPS delivery code is implemented, but `runtime.mjs` intentionally starts with an empty in-memory CHM tide cache. The existing manual CHM probe can prove official PDF discovery/extraction/normalization/cache readback, but the long-running production source worker does not yet populate this runtime cache because production PDF extraction tooling and refresh wiring remain a separate gate.

Therefore the accurate state is:

`IMPLEMENTED_FAIL_CLOSED_REQUIRES_RUNTIME_CHM_TIDE_INGESTION_AND_REAL_PLAY_ENTITLEMENT_PROOF`

No production subscription, live Android delivery, or production CHM tide availability is claimed by this gate alone.
