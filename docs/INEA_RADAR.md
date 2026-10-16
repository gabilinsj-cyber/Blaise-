# INEA Radar Contract

## Objective

Blaise V6 RJ treats radar imagery as safety-relevant data. No frame may enter the operational 30-minute animation window merely because it is an image served by an INEA domain. Each stage is fail-closed and preserves only bounded metadata evidence.

## Official evidence chain

1. **Monitoring provenance** — the official INEA hydrometeorological monitoring page must identify the radar network, the five-minute representation cadence, and the canonical public radar entry point.
2. **Official radar inventory** — the official INEA flood-alert page must identify the two-radar system as **Guaratiba** and **Macaé**. The validated inventory is hashed and its raw source URL is not retained in operational evidence.
3. **Radar Tool gateway and viewer** — the gateway must resolve a single official HTTPS viewer and bounded official media candidates.
4. **Binary envelopes** — candidate images must pass type/signature/content-type/size validation. Binary contents are not retained.
5. **Same-candidate metadata binding** — before a frame can become trusted, the exact binary candidate must be bound to official live identity and timestamp evidence, plus the validated provenance and inventory digests. Caller-controlled booleans or structurally similar objects are never sufficient.
6. **30-minute operational window** — only trusted bound frames can enter the in-memory window. Future, stale, duplicate, malformed or unsupported frames fail closed; interpolation is forbidden.

## Current gate state

The repository validates the official provenance contract, the independent Guaratiba/Macaé inventory contract, the trusted binder contract and the 30-minute in-memory window with unit/CI evidence.

The following remain explicitly **not proven by static CI alone**:

- live same-candidate extraction of radar identity;
- live same-candidate extraction of frame timestamp;
- live freshness proof based on those bound timestamps;
- production ingestion of live radar frames.

The manual `INEA Radar Viewer Probe` may query the official external sources only when `execute_live_probe=true`. Its default remains `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`, and a partial external failure must not be upgraded to PASS.

## Privacy and retention

- Raw radar media URLs are not retained in the operational window.
- Radar binary content is not retained after validation.
- Evidence uses bounded hashes, source hosts, stage status and non-user operational metadata only.
