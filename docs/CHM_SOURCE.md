# Marinha / CHM marine source contract

This integration is fail-closed and intentionally separates **official source parsing**, **Rio de Janeiro regional marine routing** and **municipality/P0 publication**.

## Official sources

- METAREA V warnings: `https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo`
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

Each normalized warning is now also bound to the fail-closed RJ regional routing contract from `backend/src/chm-rj-zone.mjs`:

- `BRAVO`, `CHARLIE` and `DELTA` can be exposed only as `RJ_MARINE_REGIONAL` because their official METAREA V sectors intersect the RJ marine monitoring scope;
- `SUL OCEÂNICA` / `NORTE OCEÂNICA` remain `BROAD_OCEANIC_REVIEW_REQUIRED` and are not silently treated as direct RJ alerts;
- other known METAREA V sectors are `NOT_DIRECT_RJ`;
- a warning with no explicit area is `UNROUTABLE_NO_EXPLICIT_AREA`;
- any unknown area label fails source normalization closed instead of being guessed.

Regional routing is deliberately separate from municipality targeting. Every routing result keeps `municipalityGeofenceValidated=false` and `canPromoteMunicipalityP0=false`.

The warning inventory digest is bound to identity, areas, type, validated temporal interval **and the derived regional routing object**. The evidence/cache layer stores only bounded metadata and SHA-256 digests. It does **not** retain raw warning text.

The cache semantic marker is `SOURCE_INVENTORY_TEMPORAL_VALIDITY_RJ_REGIONAL_ROUTED_NOT_MUNICIPAL_GEOFENCED`: temporal chronology and coarse RJ regional marine routing are validated, but a warning is still **not** promoted to a municipality alert or municipality P0 solely because it appears in the METAREA V inventory.

## Explicitly not yet proven

This stage does not claim:

- exact geofencing of a CHM warning to Rio de Janeiro municipalities;
- current applicability to a selected municipality based on coordinates, directional qualifiers or official warning geometry;
- which municipalities are affected on either side of the Arraial do Cabo sector boundary for a specific warning;
- observed wave height or confirmation that a forecast warning actually produced coastal ressaca;
- live tide values for Rio/Niterói/São Gonçalo ports;
- wave-direction/current/surf operational values;
- automatic municipality P0 severity mapping or municipality P0 publication from CHM warnings.

Those remain fail-closed until their exact official live contracts are implemented and evidenced.

## Execution policy

`.github/workflows/chm-source-probe.yml` is manual-only. With `execute_live_probe=false` it records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`; it never fabricates a live PASS. With explicit live execution it queries only the two pinned public CHM pages and uploads sanitized evidence as `blaise-chm-marine-evidence`.
