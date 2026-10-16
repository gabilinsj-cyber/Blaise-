# CHM structured tide-value normalization

This layer validates and canonicalizes official CHM tide predictions after the source PDF, station binding and extracted layout have been proven. It remains deliberately fail-closed: no raw PDF/text retention, no inferred tide phase and no live downstream ingestion claim without a separate cache/API path.

## Implemented contracts

`backend/src/chm-tide-values.mjs` accepts only structured predictions attributed to one validated RJ CHM tide station. It rejects malformed station metadata, source-page drift, year mismatch, impossible dates/times, duplicate local timestamps, excessive daily event counts, implausible heights, malformed source-artifact SHA-256 digests and missing/unproven time-basis metadata.

The caller must provide `timeBasis=LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER` and an explicit effective UTC offset. Source phase tokens `PM`/`BM` may be normalized to `HIGH`/`LOW`; absent phase remains null with `NOT_PROVIDED_NO_INFERENCE`. Each normalized event receives a deterministic UTC instant and the result produces a SHA-256 digest over the canonical station/year/time-basis/source-artifact/value set.

## Official PDF artifact and text boundaries

`backend/src/chm-tide-artifact.mjs` retrieves only allowlisted HTTPS CHM PDFs, enforces `application/pdf`, a bounded size, `%PDF-` and trailing `%%EOF`, and emits source-artifact SHA-256 evidence without retaining raw bytes.

`backend/src/chm-tide-text.mjs` validates exactly three extracted pages, station/year identity, four ordered month columns per page, January-through-December coverage, bounded day/time/height rows, optional explicit `PM`/`BM`, per-day event limits, source-page attribution and the upstream PDF SHA-256. The official station-40 catalog abbreviation `I FISCAL` is explicitly bound to the PDF identity `ILHA FISCAL` rather than weakening identity validation.

`backend/src/chm-tide-live-text.mjs` performs bounded ephemeral `pdftotext -layout` extraction, immediately parses and normalizes the structured tide values, emits only digest/count/date/UTC-boundary evidence, and deletes the temporary PDF. Raw PDF bytes, extracted text and prediction arrays are not returned by the live evidence summary.

## 2026 tide-header UTC-offset binding

The official CHM 2026 Rio de Janeiro tide PDF prints `Fuso UTC -03.0 horas`. `backend/src/chm-tide-fuso.mjs` treats this field as a signed UTC offset: `-03.0` maps directly to `baseUtcOffsetMinutes=-180`; no west-positive nautical inversion is applied.

CHM evidence references:

- https://www.marinha.mil.br/chm/pagina-basica/informacoes-sobre-mares
- https://www.marinha.mil.br/chm/tabuas-de-mare-6
- https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/40%20-%20PORTO%20DO%20RIO%20DE%20JANEIRO%20-%20I%20FISCAL%20-%20130%20-%20132.pdf

## RJ 2026 civil-clock binding

`backend/src/chm-tide-civil-clock.mjs` closes the separate civil-clock contract for calendar year 2026 only. It accepts only the already evidenced CHM base offset `-180` minutes and binds `civilClockAdjustmentMinutes=0`, yielding `effectiveUtcOffsetMinutes=-180`.

The binding is intentionally year-scoped and fail-closed. A future year is rejected until its policy is independently evidenced; a source header that disagrees with `-03:00` is also rejected.

Official policy references checked for the 2026 binding:

- Presidency/Planalto Decree 9.772/2019: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9772.htm
- Ministry of Mines and Energy daylight-saving page: https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/horario-de-verao
- Observatório Nacional / Hora Legal Brasileira service: https://www.gov.br/pt-br/servicos/hora-falada-on?id=9525&origem=servico

The evidence snapshot date encoded by the contract is `2026-09-14`. Decree 9.772/2019 ended daylight saving nationally, the current MME page still identifies that decree as the revocation of the prior daylight-saving rules, and the Observatório Nacional service is the official federal reference for Hora Legal Brasileira. This closes only the 2026 RJ effective-offset question; it does not authorize assumptions for later years.

## Current live boundary

With the civil-clock binding present, the live CHM text path can now prove `-03:00` effective offset, derive UTC instants and produce a canonical `tideValueSha256` for each validated RJ station while retaining no raw values in the evidence artifact.

The remaining production blocker is downstream ingestion: there is not yet a dedicated tide cache/API serving these values to the Android app. Therefore the live evidence status is `PASS_OFFICIAL_CHM_PDF_TEXT_STRUCTURED_TIDE_VALUES_NORMALIZED`, while `liveTideValueIngestion` remains `BLOCKED_DOWNSTREAM_TIDE_CACHE_API_NOT_IMPLEMENTED`.

The manual CHM workflow remains the only live external path and defaults to `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`. Synthetic tests and code-level civil-clock evidence are never represented as a successful live CHM probe.

## Safety and retention

- no raw PDF bytes or extracted source text are retained by the evidence layer;
- no raw prediction array is emitted by the live evidence summary;
- no municipality P0 is created from tide values;
- no high/low phase is inferred when the source does not provide it;
- no station is accepted outside validated official RJ station metadata;
- PDF network retrieval is HTTPS-only, host allowlisted, redirect-rejecting, content-type checked and size bounded;
- 2027+ civil-clock behavior fails closed until separately evidenced;
- CI/Runtime must pass on the exact final SHA before any new implementation claim is promoted.
