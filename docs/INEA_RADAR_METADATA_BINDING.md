# INEA radar metadata-binding gate

This gate prevents the 30-minute radar window from trusting caller-supplied booleans for radar identity or observation time.

## Required chain

A frame can enter `IneaRadarFrameWindow` only when it is the exact in-memory object returned by `bindIneaRadarFrameMetadata`. The binder requires three independent evidence groups:

- official INEA radar provenance contract: `OFFICIAL_INEA_RADAR_PROVENANCE_VALIDATED`;
- validated image-binary contract: `OFFICIAL_IMAGE_BINARY_ENVELOPES_VALIDATED`;
- same-candidate metadata contract: `OFFICIAL_INEA_SAME_CANDIDATE_METADATA_BINDING` with origin `OFFICIAL_LIVE_VIEWER_SAME_CANDIDATE`.

The binary candidate and metadata evidence must contain the same SHA-256 candidate reference. The binder also requires an exact supported radar identity (`guaratiba` or `macae`), a normalized UTC observation timestamp, separate identity/timestamp evidence digests, an unambiguous proof marker, a valid content digest, image type and bounded byte length.

The returned frame is frozen and registered in a private `WeakSet`. Copying or reconstructing the same fields does not preserve trust. The window rejects legacy objects that merely set `provenanceValidated`, `binaryValidated` and `metadataBindingValidated` to `true`.

## Privacy and retention

The trusted frame does not carry a raw media URL or binary body. It keeps only bounded metadata and SHA-256 references needed to correlate the same candidate through later gates. The existing 30-minute window remains memory-only and interpolation remains forbidden.

## Current external status

This commit implements the **internal fail-closed binding gate only**. It does **not** prove that the current live INEA viewer exposes a stable, trustworthy mapping from each media candidate to `radarId` and `observedAt`.

Therefore:

- live radar identity binding: **BLOCKED pending same-SHA official live evidence**;
- live frame timestamp binding: **BLOCKED pending same-SHA official live evidence**;
- live freshness: **BLOCKED until timestamp binding passes**;
- live radar frame ingestion: **NOT ENABLED**.

No filename pattern, URL substring, `alt` text, historical document, or guessed regular expression is sufficient by itself to turn those external gates into PASS. The live probe must first prove the exact source contract and reject ambiguity before it may construct binder inputs.
