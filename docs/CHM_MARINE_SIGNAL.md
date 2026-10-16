# CHM explicit marine-signal contract

This stage extracts only bounded marine values that are explicitly present inside an already validated CHM / METAREA V warning. It does not infer municipality impact and it does not turn a wave-height value into an official ressaca declaration.

## Structured fields

`backend/src/chm-marine-signal.mjs` normalizes:

- explicit compass wave direction from the 16-point N/NE/E/SE/S/SW/W/NW family;
- an explicit single wave height or explicit min/max range in metres;
- decimal dot or comma input into numeric metre values;
- a fixed 3.5 m product threshold marker;
- `waveHeightThresholdExceeded`, which is `true` only when the explicit maximum is greater than 3.5 m;
- `officialRessacaLabel`, which is `true` only when the CHM warning type itself explicitly contains `RESSACA`;
- `canPromoteMunicipalityP0=false` in every result.

The contract marker is `CHM_EXPLICIT_WAVE_RANGE_AND_RESSACA_LABEL_NOT_MUNICIPAL_SEVERITY`.

## Fail-closed rules

When a warning contains an explicit `ONDAS DE ...` marker, the parser requires exactly one bounded expression it understands. Unknown directions, malformed numeric values, descending ranges, values above 30 m or conflicting duplicate renderings fail source normalization closed instead of being guessed or silently dropped.

If no explicit wave expression exists, the normalized warning retains a bounded null wave signal. This is different from a zero-wave observation.

Compatible duplicate renderings can contribute missing explicit wave metadata to one normalized warning. If both renderings contain explicit wave metadata, the direction and range must agree exactly.

## Integrity and privacy

The normalized marine signal is fed into the CHM RJ routing object. The existing warning inventory SHA-256 digest already binds the complete routing object, so a changed marine signal changes the canonical inventory digest. The cache recomputes the routing object from the warning and fails closed if the signal contract has been tampered with.

Raw CHM warning text is still not retained. Only bounded normalized metadata and digests are retained by the in-memory source/cache layer.

## Deliberate limitations

A wave range above 3.5 m is a product threshold signal, not proof of observed coastal ressaca. An official ressaca flag comes only from the explicit CHM warning type. Municipality geofencing and CHM-to-municipality-P0 publication remain disabled until separately validated with exact official spatial semantics and publication policy.
