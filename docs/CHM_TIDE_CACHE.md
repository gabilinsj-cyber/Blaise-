# CHM Tide Values Cache

## Scope

This boundary stores only structured, already-normalized tide predictions derived from the official CHM 2026 tide-table pipeline. It does not retain PDF bytes, extracted raw text, or unvalidated source payloads.

The cache is intentionally separate from public/app API exposure. Landing this cache does **not** mean that tide values are already served to Android clients. Source-to-cache population and a paid-entitlement-safe app-facing API remain separate gates.

## Contract

`OFFICIAL_CHM_TIDE_VALUES_MEMORY_CACHE_V1`

Each successful write must contain:

- source id `chm-marine`;
- a canonical CHM station and calendar year;
- the CHM legal local-time basis;
- the effective UTC offset already bound by the civil-clock policy;
- the official source artifact SHA-256;
- normalized tide predictions;
- the exact `tideValueSha256` produced by `normalizeChmTideValues`.

Before a snapshot is accepted, the cache re-runs `normalizeChmTideValues` and recomputes the digest. A mismatched digest is rejected fail-closed.

## Freshness and refresh policy

The cache shares the official-source scheduler cadence:

- normal mode: refresh due every 15 minutes;
- severe mode: refresh due every 1 minute.

These intervals indicate when the official source should be checked again; they do not imply that an annual tide table becomes invalid every 15 minutes. To prevent an indefinitely trusted source artifact, the cached verification snapshot has a hard maximum verification age of 24 hours. Once that age is exceeded, the cache returns `STALE` and withholds the snapshot until the official source is reverified.

A failed refresh after a still-valid snapshot returns `CURRENT_DEGRADED`, preserving the last verified values while explicitly reporting the failed refresh. A cache with no verified snapshot returns `UNAVAILABLE`.

## Privacy and retention

- raw PDF retention: `NONE`;
- extracted raw text retention: `NONE`;
- only normalized structured predictions and bounded provenance metadata are kept in memory;
- a stored snapshot is immutable;
- stale or unavailable states do not expose a snapshot.

## Fail-closed states

- `UNAVAILABLE`: no verified snapshot, invalid clock relationship, or source refresh failed before any valid snapshot existed;
- `CURRENT`: verified snapshot is within the source-verification window;
- `CURRENT_DEGRADED`: verified snapshot is still valid but the latest refresh failed;
- `STALE`: source-verification age exceeded; values are withheld.

## Not yet proven by this boundary

This cache alone does not prove production source scheduling, multi-instance cache persistence, Android delivery, entitlement enforcement for tide content, Cloud Run deployment, or end-device rendering. Those remain separate evidence gates.
