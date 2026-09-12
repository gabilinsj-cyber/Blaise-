# CHM / METAREA V — RJ zone classification

This stage adds a bounded, fail-closed **subarea-to-Rio-de-Janeiro relevance classifier**. It does not claim exact municipality geofencing and it does not publish P0 alerts by itself.

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

## Code contract

`backend/src/chm-rj-zone.mjs` classifies only recognized CHM area labels. Unknown or malformed area labels fail closed.

The safe relevance model is intentionally coarse:

- `CHARLIE` and `DELTA` are `RJ_COASTAL_ZONE` candidates because their official coastal boundaries include portions of the Rio de Janeiro coastline on opposite sides of Arraial do Cabo;
- `BRAVO` is `RJ_OFFSHORE_ZONE` because it is the oceanic sector from Laguna to Arraial do Cabo and can be relevant to Atlantic monitoring near RJ;
- the remaining direct coastal sectors are `OUTSIDE_DIRECT_RJ_ZONE`;
- broad oceanic sectors are `BROAD_OCEANIC_NOT_RJ_GEOFENCED`.

Every classification explicitly returns:

- `municipalityGeofenceValidated=false`;
- `canPromoteMunicipalityP0=false`;
- contract marker `OFFICIAL_METAREA_V_SUBAREA_RJ_ZONE_CLASSIFICATION_NOT_MUNICIPAL_GEOFENCE`.

## What this closes

This prevents the backend from treating a raw METAREA V area label as if it were already a municipality-level Rio de Janeiro geofence. It provides a deterministic first-stage filter that later exact geometry/coordinate logic can consume.

## Still not proven

This stage does not prove:

- exact polygon/coordinate intersection with any RJ municipality;
- municipality selection for Rio, Niterói, São Gonçalo or any of the 92 municipalities;
- current coastal impact, ressaca occurrence or observed wave height;
- automatic severity mapping;
- automatic CHM-to-P0 publication.

Those remain fail closed until exact official geometry/coordinate evidence and publication policy are implemented and tested.
