# CHM / METAREA V — RJ zone classification

This stage provides a bounded, fail-closed **subarea-to-Rio-de-Janeiro relevance classifier**, an IBGE 2024 sea-facing municipality prefilter and a separate **RJ regional marine routing** contract. It still does not claim exact CHM-to-municipality geofencing and it does not publish municipality P0 alerts by itself.

## Official CHM subarea boundaries used

The classifier follows the CHM METAREA V coastal/oceanic area names used by the official marine forecast contract:

- ALFA — Chuí to Laguna;
- BRAVO — Laguna to Arraial do Cabo, oceanic;
- CHARLIE — Laguna to Arraial do Cabo, coastal;
- DELTA — Arraial do Cabo to Caravelas;
- ECHO — Caravelas to Salvador;
- FOXTROT — Salvador to Natal;
- GOLF — Natal to São Luís;
- HOTEL — São Luís to Oiapoque;
- SUL OCEÂNICA and NORTE OCEÂNICA remain broad oceanic regions and are not treated as municipality geofences.

Official source pages:

- `https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas`
- `https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo`

## IBGE 2024 sea-facing municipality prefilter

`backend/src/rj-seafront-municipalities.mjs` contains the 25 Rio de Janeiro municipalities in the IBGE 2024 **Municípios Defrontantes com o Mar** recorte and startup-validates every pair against the canonical 92-municipality RJ catalog already used by the backend.

Official IBGE source:

- `https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/24072-municipios-defrontantes-com-o-mar.html`

The IBGE catalog is a coarse safety prefilter only. It identifies whether a selected RJ municipality is in the official sea-facing recorte; it does **not** prove that a particular CHM warning polygon, directional qualifier or local marine impact intersects that municipality.

Important distinction: municipalities such as Iguaba Grande and São Pedro da Aldeia can be relevant to the broader coastal/lagoon system but are not silently added to this specific IBGE sea-facing set. The code therefore keeps them `seaFacing=false` for this contract instead of broadening the official 25-entry recorte.

## Zone classification contract

`backend/src/chm-rj-zone.mjs` classifies only recognized CHM area labels. Unknown or malformed area labels fail closed.

The safe relevance model is intentionally coarse:

- `CHARLIE` and `DELTA` are `RJ_COASTAL_ZONE` candidates because their official coastal boundaries include portions of the Rio de Janeiro coastline on opposite sides of Arraial do Cabo;
- `BRAVO` is `RJ_OFFSHORE_ZONE` because it is the oceanic sector from Laguna to Arraial do Cabo and can be relevant to Atlantic monitoring near RJ;
- the remaining direct coastal sectors are `OUTSIDE_DIRECT_RJ_ZONE`;
- broad oceanic sectors are `BROAD_OCEANIC_NOT_RJ_GEOFENCED`.

`classifyChmRjMunicipalityCandidate(area, ibge)` combines only two proven coarse facts:

1. the CHM area is a recognized RJ coastal sector (`CHARLIE` or `DELTA`); and
2. the selected municipality belongs to the official IBGE 2024 RJ sea-facing catalog.

A positive `rjCoastalCatalogMatch` is therefore a **candidate filter**, not a geofence result. `BRAVO` never becomes a municipality coastal match because it is an offshore sector.

Every municipality prefilter result explicitly returns:

- `municipalityGeofenceValidated=false`;
- `canPromoteMunicipalityP0=false`;
- contract marker `CHM_METAREA_V_PLUS_IBGE_2024_SEAFRONT_PREFILTER_NOT_MUNICIPAL_GEOFENCE`.

## RJ regional marine routing contract

`classifyChmWarningRjRouting(warning)` now converts the proven coarse sector classification into a routing result suitable for the **RJ/Oceano Atlântico marine panel**, without converting that result into municipality targeting:

- any warning containing `BRAVO`, `CHARLIE` or `DELTA` is routed as `RJ_MARINE_REGIONAL`;
- `NORTE OCEÂNICA` or `SUL OCEÂNICA` without a direct RJ sector becomes `BROAD_OCEANIC_REVIEW_REQUIRED`;
- recognized sectors outside direct RJ become `NOT_DIRECT_RJ`;
- warnings with no explicit CHM area become `UNROUTABLE_NO_EXPLICIT_AREA`;
- unknown area labels fail closed.

A regional route can set `canExposeRjMarineWarning=true`, which means only that the warning may be shown in the RJ/Atlantic marine scope. It **never** changes these municipality safeguards:

- `municipalityGeofenceValidated=false`;
- `canPromoteMunicipalityP0=false`.

The routing contract marker is `CHM_METAREA_V_RJ_REGIONAL_ROUTING_NOT_MUNICIPAL_GEOFENCE`.

## What this closes

This prevents the backend from treating either a raw METAREA V label or generic “coastal RJ” status as if it were already exact municipality targeting, while still allowing proven CHM sectors that intersect the RJ marine monitoring scope to be represented as **regional marine relevance**. It also removes inland municipalities from the CHM coastal candidate set without inventing geometry.

## Still not proven

This stage does not prove:

- exact polygon/coordinate intersection with any RJ municipality;
- which side of the Arraial do Cabo boundary a municipality-specific impact belongs to for a particular warning;
- parsing of directional qualifiers such as “ao sul de Campos dos Goytacazes/RJ” into exact municipality sets;
- current coastal impact, ressaca occurrence or observed wave height;
- automatic severity mapping;
- automatic CHM-to-municipality-P0 publication.

Those remain fail closed until exact official geometry/coordinate evidence, warning-text spatial semantics and publication policy are implemented and tested.
