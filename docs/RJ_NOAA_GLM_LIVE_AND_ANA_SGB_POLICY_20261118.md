# NOAA GOES-19 GLM for Blaise RJ — one-file scientific staging (18/11/2026)

## Official source
- NOAA GOES-19 Geostationary Lightning Mapper (GLM), L2 Lightning Cluster Filter Algorithm, NOAA NODD public AWS: https://registry.opendata.aws/noaa-goes/
- NOAA NCEI metadata/product: https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC01527
- AWS bucket: `https://noaa-goes19.s3.amazonaws.com/`, product prefix `GLM-L2-LCFA/YYYY/DDD/HH/`. No AWS account/API key is required to read the public bucket.
- Scientific data type: satellite **O** optical cloud lightning flashes (not necessarily ground strikes). A 20-second LCFA sample cannot prove 0 lightning in a municipality or define a safety warning level.

## Proof
- The staging probe picks only NOAA-owned GOES19 LCFA keys within the past 35 min, downloads **one** NetCDF4 with size limits and validates `flash_lat` and `flash_lon` records.
- Uses an over-inclusive scientific RJ test rectangle lat -24.5..-20.5, lon -45.5..-40.5; not equivalent to the IBGE 92 municipality boundaries.
- A legitimate file with no flashes intersecting this rectangle has count 0 **only for this file** and cannot mean 'no lightning' in the current hour, nor a safety declaration.
- Without a genuine file, leave `rjRectangleFlashesInSingleFile:null`, `UNAVAILABLE`; never infer "0" or create an alert.
- A municipal aggregator would need multiple recent files, geolocation uncertainties, source latency, deduplication, exact IBGE polygons and warning authority separation. Do not publish count, map nor P0 alert before these steps.
- No use of NASA APIs, EUMETSAT, Windy, INEA, Marinha or excluded sources.

## ANA / SGB after NOAA GLM
ANA official HidroWebService manual: https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/monitoramento-hidrologico/orientacoes-manuais/manuais/manual-hidrowebservice_publica.pdf
- Automated API access requires an **explicit email request** to `hidro@ana.gov.br` with the applicant's CPF/CNPJ in the subject, as described in the newest official manual.
- Do not attempt unauthorised extraction, use old deprecated legacy endpoints, or infer river levels from simulated rainfall.
- Once authorized, require station ID, river/georeferencing, authoritative source time, datum/reference, measured **O** water level and units, freshness, rights to redistribute in paid app.
- SGB/SACE will require separately verified public data/license and actual station availability. No levels are live in customer APK.
