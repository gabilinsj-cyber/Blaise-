# Marinha / CHM marine source contract

This integration is fail-closed and intentionally separates **official source parsing**, **Rio de Janeiro regional marine routing**, **RJ tide-station selection** and **municipality/P0 publication**.

## Official sources

- METAREA V warnings: `https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo`
- Tide tables publication: `https://www.marinha.mil.br/chm/dados-do-segnav-publicacoes/tabuas-das-mares`
- Current official RJ tide-station catalog: `https://www.marinha.mil.br/chm/tabuas-de-mare-6`

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

`backend/src/chm-marine-signal.mjs` additionally normalizes only explicit CHM wave expressions found inside a warning, including bounded wave direction and wave-height/range. The product threshold `> 3.5 m` is kept separate from the official CHM `RESSACA` label. This signal is regional marine metadata only: it cannot promote a municipality P0 and no raw warning text is retained.

Each normalized warning is bound to the fail-closed RJ regional routing contract from `backend/src/chm-rj-zone.mjs`:

- `BRAVO`, `CHARLIE` and `DELTA` can be exposed only as `RJ_MARINE_REGIONAL` because their official METAREA V sectors intersect the RJ marine monitoring scope;
- `SUL OCEÂNICA` / `NORTE OCEÂNICA` remain `BROAD_OCEANIC_REVIEW_REQUIRED` and are not silently treated as direct RJ alerts;
- other known METAREA V sectors are `NOT_DIRECT_RJ`;
- a warning with no explicit area is `UNROUTABLE_NO_EXPLICIT_AREA`;
- any unknown area label fails source normalization closed instead of being guessed.

Regional routing is deliberately separate from municipality targeting. Every routing result keeps `municipalityGeofenceValidated=false` and `canPromoteMunicipalityP0=false`.

## RJ tide-station selection contract

`backend/src/chm-tide-catalog.mjs` validates the separate official CHM tide-station catalog before the app/backend can present an RJ tide location selector. It does **not** parse tide heights or times.

The catalog contract:

- requires the CHM identity marker and an explicit `Tábuas de Maré YYYY` year;
- parses only rows explicitly labeled `Rio de Janeiro`;
- requires exactly the seven RJ entries currently published by CHM for the active 2026 catalog;
- validates bounded station numbers, three-page table ranges and RJ coastal coordinate bounds;
- rejects duplicate station numbers, names or page ranges;
- canonicalizes the seven stations by station number and emits a SHA-256 catalog digest;
- keeps `rawCatalogTextRetention=NONE`;
- exposes `portSelectionValidation=PASS_OFFICIAL_RJ_TIDE_STATION_CATALOG` only after the full catalog validates;
- keeps `tideValueIngestion=NOT_IMPLEMENTED` until actual official tide values are parsed and evidenced.

The live probe also requires the tide-publication year and the RJ station-catalog year to match. A mismatch fails closed instead of silently mixing yearly publications.

The currently expected RJ catalog contains Porto do Açu, Terminal Marítimo de Imbetiba, Porto do Rio de Janeiro - Ilha Fiscal, Porto de Itaguaí, Porto do Forno, Terminal da Ilha Guaíba and Porto de Angra dos Reis. Any official count/name/range/coordinate drift is intended to stop the contract for review rather than being guessed.

## Evidence and retention

The warning inventory digest is bound to identity, areas, type, validated temporal interval and the derived regional routing object. The evidence/cache layer stores only bounded metadata and SHA-256 digests. It does **not** retain raw warning text.

The tide-station evidence stores bounded public station metadata and a catalog SHA-256 digest; it does not retain the raw catalog page.

The warning cache semantic marker remains `SOURCE_INVENTORY_TEMPORAL_VALIDITY_RJ_REGIONAL_ROUTED_NOT_MUNICIPAL_GEOFENCED`: temporal chronology and coarse RJ regional marine routing are validated, but a warning is still **not** promoted to a municipality alert or municipality P0 solely because it appears in the METAREA V inventory.

## Explicitly not yet proven

This stage does not claim:

- exact geofencing of a CHM warning to Rio de Janeiro municipalities;
- current applicability to a selected municipality based on coordinates, directional qualifiers or official warning geometry;
- which municipalities are affected on either side of the Arraial do Cabo sector boundary for a specific warning;
- observed wave height or confirmation that a forecast warning actually produced coastal ressaca;
- live tide height/time values for the seven validated RJ tide stations;
- current/surf operational values derived from tide tables;
- automatic municipality P0 severity mapping or municipality P0 publication from CHM warnings.

Those remain fail-closed until their exact official live contracts are implemented and evidenced.

## Execution policy

`.github/workflows/chm-source-probe.yml` is manual-only. With `execute_live_probe=false` it records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`; it never fabricates a live PASS. With explicit live execution it queries only the three pinned public CHM pages above and uploads sanitized evidence as `blaise-chm-marine-evidence`.
