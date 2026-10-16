# Blaise V6 RJ — Paid official dashboard snapshot

## Contract

`POST /v1/data/dashboard` is the first bounded read model for the premium dashboard. It is not a public weather endpoint and it never substitutes for the independent official P0 alert channel.

The request uses the same Google Play entitlement identity as `/v1/entitlements/verify`:

- `packageName`
- `purchaseToken`
- `productIds`

The backend re-verifies the purchase against Google Play on every dashboard request. A non-active entitlement returns `403 access_denied`. Tokens are used only for verification and are never echoed in responses, metrics, source status, or logs.

## Fail-closed source policy

The endpoint returns `200` only when the runtime official-source worker is enabled and started and the Alerta Rio rainfall cache is `CURRENT` or `CURRENT_DEGRADED`. `STALE`, `UNAVAILABLE`, malformed, disabled, or not-started source state returns `503 source_unavailable`.

The response contains only a normalized summary, not the raw 33-station payload:

- maximum accumulated rainfall over 15 minutes, 1 hour, and 24 hours when those values exist;
- station count and number of stations with rain in the latest 15-minute field;
- source/fetch/observation timestamps and bounded source-state metadata;
- no inferred temperature, rain probability, wind, municipality-specific condition, or P0-clear conclusion.

Coverage is explicitly `RIO_CITY_ALERTA_RIO_STATIONS`. It must not be presented as statewide municipal coverage.

## Android transport

`DashboardDataHttpsClient` derives the endpoint only from an exact HTTPS entitlement verifier URL ending in `/v1/entitlements/verify`. Redirects are disabled, connect/read timeouts are bounded, responses are size-limited, and the parser rejects contract drift, privacy drift, impossible station counts, duplicate source identities, and inconsistent current-source counts.

The client accepts only a locally purchased `PlayPurchaseCandidate`; server-side entitlement remains authoritative. This transport is intentionally fail-closed until a verified purchase session is wired into the dashboard UI.

## Privacy and observability

The response declares and the client validates:

- `purchaseTokenExposed=false`
- `rawStationPayloadExposed=false`
- `userLocationStored=false`

Operational metrics use only fixed counters: success, denied, unavailable, and busy. They contain no token, user, city, or location labels.

## P0 separation

P0 official alerts remain independent of subscription and continue through the existing FCM/P0 path. The premium dashboard endpoint must never be used to infer that there is no active P0 alert.
