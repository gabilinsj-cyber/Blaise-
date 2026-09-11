# Marinha / CHM marine source contract

This integration is fail-closed and intentionally separates **official source parsing** from **Rio de Janeiro applicability / alert publication**.

## Official sources

- METAREA V warnings: `https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo`
- 24-hour METAREA V forecast / area-boundary labels: `https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas`
- Tide tables publication: `https://www.marinha.mil.br/chm/dados-do-segnav-publicacoes/tabuas-das-mares`

Only HTTPS responses from `www.marinha.mil.br` are accepted by the shared source-contract layer. Redirects, unexpected hosts, oversized bodies, unsupported content types and network/HTTP errors fail closed.

## Current proven code contract

`backend/src/chm-source.mjs` validates:

- CHM / Centro de Hidrografia da Marinha identity marker;
- METAREA V warning-page marker;
- bounded Portuguese `AVISO NR n/yyyy` warning inventory;
- warning type and issue Z-clock as bounded metadata;
- the published issue date and `VÁLIDO ATÉ DDHHMMZ` token for every rendered Portuguese warning;
- canonical UTC `issuedAt` and `validUntil` timestamps, including deterministic month/year rollover from the issue date;
- `validUntil > issuedAt` with a bounded maximum validity window of 14 days; malformed, missing or implausible temporal metadata fails closed;
- warning ID year must match the issued timestamp year;
- compatible duplicate map/detail renderings of the same warning ID are collapsed only when type, issue time and the full temporal interval agree;
- distinct bounded area labels for compatible duplicate renderings are preserved in insertion order while the first area remains in the legacy `area` field;
- `duplicateRenderCount` records only how many compatible duplicate renderings were collapsed and does not retain duplicated warning text;
- explicit `NIL` / `NÃO HÁ AVISOS` as the only accepted zero-warning state;
- annual `Tábuas das Marés` publication year and `Página de Dados de Maré` discovery marker.

`backend/src/chm-area-definition.mjs` separately validates the official METAREA V boundary-label prerequisites required before RJ geofencing can be implemented. It currently requires the official 24-hour forecast page to expose, consistently across repeated forecast periods:

- `BRAVO`: Laguna → Arraial do Cabo, `OCEÂNICA`;
- `CHARLIE`: Laguna → Arraial do Cabo, `COSTEIRA`;
- `DELTA`: Arraial do Cabo → Caravelas, with no coast/ocean qualifier asserted when the heading does not provide one.

Any missing or conflicting boundary label fails closed. The resulting digest binds the three official labels only. This contract deliberately returns `municipalityGeofenceValidation=NOT_IMPLEMENTED`, `rjApplicability=UNRESOLVED_WITHOUT_GEOSPATIAL_MAPPING`, and `p0Eligibility=BLOCKED_UNTIL_RJ_GEOFENCE_PROVEN`; it does not infer municipality applicability from textual endpoints alone.

The warning inventory digest is bound to identity, areas, type and the validated temporal interval. The evidence/cache layer stores only bounded metadata and SHA-256 digests. It does **not** retain raw warning text.

The cache semantic marker is `SOURCE_INVENTORY_TEMPORAL_VALIDITY_NOT_RJ_GEOFENCED`: temporal chronology is validated, but a warning is **not** promoted to an RJ coastal alert solely because it appears in the METAREA V inventory.

## Explicitly not yet proven

This stage does not claim:

- municipality-level geofencing of METAREA V warnings to the Rio de Janeiro coast;
- current applicability to a selected municipality based on coordinates or official polygon geometry;
- that a textual endpoint such as Arraial do Cabo alone is sufficient to resolve a municipal boundary case;
- observed wave height or confirmation that a forecast warning actually produced coastal ressaca;
- live tide values for Rio/Niterói/São Gonçalo ports;
- wave-direction/current/surf operational values;
- automatic P0 severity mapping or P0 publication from CHM warnings.

Those remain fail-closed until their exact official live/geospatial contracts are implemented and evidenced.

## Execution policy

`.github/workflows/chm-source-probe.yml` is manual-only. With `execute_live_probe=false` it records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`; it never fabricates a live PASS. Existing live execution remains limited to explicitly approved public CHM probes. The new area-definition parser is covered by deterministic source-contract tests; a future live probe should be added only with the same explicit-execution and sanitized-evidence policy.
