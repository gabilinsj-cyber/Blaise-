# CHM Tide Values Cache

## Scope

This boundary stores only structured, already-normalized tide predictions derived from the official CHM 2026 tide-table pipeline. It does not retain PDF bytes, extracted raw text, or unvalidated source payloads.

The source-to-cache path is now explicitly wired through the ephemeral official-PDF extraction boundary: validated PDF bytes are converted with `pdftotext -layout`, parsed, normalized, revalidated by `createChmTideValuesCache`, read back, and digest-checked before delivery-contract material is produced. The raw PDF and extracted text remain ephemeral and are never placed in the cache.

The app-facing **network** API is still deliberately separate. This closure defines and tests the Android/backend delivery contract, but does not expose an unauthenticated tide endpoint or bypass the paid-entitlement boundary.

## Contracts

Cache: `OFFICIAL_CHM_TIDE_VALUES_MEMORY_CACHE_V1`

Source-to-cache readback: `OFFICIAL_CHM_TIDE_SOURCE_TO_CACHE_READBACK_V1`

Cross-platform delivery payload: `OFFICIAL_CHM_TIDE_VALUES_DELIVERY_V1`

Each successful cache write must contain:

- source id `chm-marine`;
- a canonical CHM station and calendar year;
- the CHM legal local-time basis;
- the effective UTC offset already bound by the civil-clock policy;
- the official source artifact SHA-256;
- normalized tide predictions;
- the exact `tideValueSha256` produced by `normalizeChmTideValues`.

Before a snapshot is accepted, the cache re-runs `normalizeChmTideValues` and recomputes the digest. A mismatched digest is rejected fail-closed. The source-to-cache pipeline immediately reads the accepted snapshot back and refuses to produce a delivery payload unless the state is `CURRENT` and the digest still matches.

## Android delivery boundary

Android now has a dedicated `TideRepository` contract and strict `ChmTideDeliveryParser`. The parser accepts only `CURRENT` or `CURRENT_DEGRADED`, verifies source/station/year identity, exact payload shape, 24-hour verification-age bound, SHA-256 formats, page ranges, prediction count, height bounds, and the exact UTC instant implied by the CHM local clock plus the evidenced UTC offset.

Unknown fields, stale/unavailable state, mismatched station/year, invalid digests, or inconsistent local-time/UTC pairs fail closed. This is a cross-platform contract only: HTTPS transport and paid-entitlement authorization for tide content remain blocked until separately implemented and evidenced.

## Freshness and refresh policy

The cache shares the official-source scheduler cadence:

- normal mode: refresh due every 15 minutes;
- severe mode: refresh due every 1 minute.

These intervals indicate when the official source should be checked again; they do not imply that an annual tide table becomes invalid every 15 minutes. To prevent an indefinitely trusted source artifact, the cached verification snapshot has a hard maximum verification age of 24 hours. Once that age is exceeded, the cache returns `STALE` and withholds the snapshot until the official source is reverified.

A failed refresh after a still-valid snapshot returns `CURRENT_DEGRADED`, preserving the last verified values while explicitly reporting the failed refresh. A cache with no verified snapshot returns `UNAVAILABLE`.

## Privacy and retention

- raw PDF retention: `NONE` after ephemeral extraction;
- extracted raw text retention: `NONE`;
- only normalized structured predictions and bounded provenance metadata are kept in memory;
- a stored snapshot is immutable;
- stale or unavailable states do not expose a snapshot;
- CHM manual probe evidence stores summaries/digests only, not raw PDFs, extracted text, or full prediction payloads.

## Fail-closed states

- `UNAVAILABLE`: no verified snapshot, invalid clock relationship, or source refresh failed before any valid snapshot existed;
- `CURRENT`: verified snapshot is within the source-verification window;
- `CURRENT_DEGRADED`: verified snapshot is still valid but the latest refresh failed;
- `STALE`: source-verification age exceeded; values are withheld.

## Evidence boundary

The normal CI validates synthetic source-to-cache ingestion, digest readback, Android delivery parsing, UTC consistency, stale-state rejection, and no-raw-retention behavior. The external CHM workflow remains manual-only. When explicitly executed, it can now prove the public official PDF -> normalized values -> memory cache readback chain for the bound RJ stations without making the external probe automatic.

## Still gated

This closure does not claim a paid-entitlement-safe Android HTTPS tide endpoint, multi-instance/distributed cache persistence, automatic production CHM polling, Play Console approval, signed release, or end-device production rendering. Those remain separate evidence gates.
