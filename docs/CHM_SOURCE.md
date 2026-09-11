# Marinha / CHM marine source contract

This integration is fail-closed and intentionally separates **source discovery** from **operational marine values**.

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
- duplicate map/detail renderings of the same warning ID are collapsed only when core warning type and issue time agree; if both copies provide an area it must also agree, otherwise parsing fails closed;
- `duplicateRenderCount` records only how many compatible duplicate renderings were collapsed and does not retain duplicated warning text;
- explicit `NIL` / `NÃO HÁ AVISOS` as the only accepted zero-warning state;
- annual `Tábuas das Marés` publication year and `Página de Dados de Maré` discovery marker.

The evidence layer stores only bounded metadata and SHA-256 digests. It does **not** retain raw warning text.

## Explicitly not yet proven

This stage does not claim:

- warning temporal-validity evaluation from the full issued/valid interval;
- geofencing of METAREA V warnings to the Rio de Janeiro coast / selected municipalities;
- observed wave height or confirmation that a forecast warning actually produced coastal ressaca;
- live tide values for Rio/Niterói/São Gonçalo ports;
- wave-direction/current/surf operational values;
- automatic P0 severity mapping.

Those remain fail-closed until their exact official live contracts are implemented and evidenced.

## Execution policy

`.github/workflows/chm-source-probe.yml` is manual-only. With `execute_live_probe=false` it records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`; it never fabricates a live PASS. With explicit live execution it queries only the two pinned public CHM pages and uploads sanitized evidence as `blaise-chm-marine-evidence`.
