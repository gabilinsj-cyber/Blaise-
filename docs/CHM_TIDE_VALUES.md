# CHM structured tide-value normalization

This layer is intentionally separate from live CHM PDF text/value extraction. It closes the internal validation and canonicalization contract for official tide predictions **after** an extractor has independently evidenced the source PDF/header/value format.

## Implemented contracts

`backend/src/chm-tide-values.mjs` accepts only structured tide predictions explicitly attributed to one already validated RJ CHM tide station. It fail-closes on malformed station metadata, source page drift, year mismatch, impossible dates/times, duplicate local timestamps, excessive daily event counts, implausible heights, malformed source-artifact SHA-256 digests and missing/unproven time-basis metadata.

`backend/src/chm-tide-artifact.mjs` adds the preceding PDF-artifact boundary. For each station already bound by the official CHM RJ catalog, it can retrieve only the pinned HTTPS CHM PDF, enforce the binary `application/pdf` contract and a 2 MiB ceiling, validate `%PDF-` plus a bounded trailing `%%EOF` marker, and emit the source-artifact SHA-256 and byte length. The raw PDF bytes are not returned by the validator and are not retained by the evidence layer after validation.

The caller of the tide-value normalizer must provide `timeBasis=LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER` and an explicit effective UTC offset for the legal local clock represented by the official table. The normalizer does not guess daylight-saving/civil-clock adjustment or phase. Source phase tokens `PM`/`BM` may be normalized to `HIGH`/`LOW`; an absent phase remains null with `NOT_PROVIDED_NO_INFERENCE`.

Each prediction is bound to a source page inside the station's validated three-page range. The normalized result is sorted deterministically, emits UTC instants from the explicit effective offset, retains no raw source text and produces a SHA-256 digest over the canonical station/year/time-basis/source-artifact/value set.

## PDF text/table parser boundary

`backend/src/chm-tide-text.mjs` adds a deliberately conservative **synthetic/internal** parser boundary for layout-preserving PDF text. It validates exactly three extracted pages, the bound station/year identity, four ordered month columns per page, complete January-through-December coverage, bounded day/time/height rows, optional explicit `PM`/`BM` tokens, per-day event limits, source-page attribution and the exact upstream PDF artifact SHA-256. It hashes the extracted text and canonical parsed values while retaining no raw text.

The official 2026 Rio de Janeiro catalog abbreviates station 40 as `PORTO DO RIO DE JANEIRO - I FISCAL`, while the official station PDF expands the same identity to `PORTO DO RIO DE JANEIRO - ILHA FISCAL`. The parser explicitly binds this catalog/PDF identity difference rather than silently weakening station validation.

This parser still does **not** prove that the complete official 2026 CHM PDF table layout matches the synthetic row/column contract. Its contract remains `CHM_PDF_TEXT_TABLE_PARSER_LIVE_SOURCE_EXTRACTION_NOT_YET_EVIDENCED`, and `liveSourceExtraction` remains blocked until a separately approved live probe demonstrates the real extraction layout for all required RJ station PDFs.

## 2026 tide-header UTC-offset binding

The tide-table header contract is now bound to the current official 2026 CHM publication itself, not to the sign convention of a different nautical `FUSO` context.

The CHM guidance states that each tide-table header contains the fuso of the legal time used for the predictions. The official 2026 PDF for station 40 (Porto do Rio de Janeiro - Ilha Fiscal) prints the header as `Fuso UTC -03.0 horas`. Therefore `backend/src/chm-tide-fuso.mjs` treats the tide-header token as a **signed UTC offset**: `-03.0` maps directly to `baseUtcOffsetMinutes=-180`; `+02.0` would map directly to `+120` minutes. The code does not apply a west-positive inversion to this field.

Evidence references used by this tide-header contract:

- https://www.marinha.mil.br/chm/pagina-basica/informacoes-sobre-mares
- https://www.marinha.mil.br/chm/tabuas-de-mare-6
- https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/40%20-%20PORTO%20DO%20RIO%20DE%20JANEIRO%20-%20I%20FISCAL%20-%20130%20-%20132.pdf

The sign convention is explicit as `SIGNED_UTC_OFFSET_FROM_CHM_TABLE_HEADER`. The code still keeps `civilClockAdjustmentMinutes` and `effectiveUtcOffsetMinutes` null under `BLOCKED_SEPARATE_CIVIL_CLOCK_ADJUSTMENT_POLICY`; this prevents historical or future civil-clock rules from being silently inferred. A derived west-positive value may be emitted only as compatibility metadata and is not the source sign convention.

Accordingly, `chm-tide-text.mjs` can expose the evidenced base UTC-offset conversion while keeping `utcOffsetMinutes=null`. Parsed rows still cannot be fed into the final live tide-value normalizer until the full official 2026 PDF layout and the effective civil-clock offset applicable to the table are both evidenced.

## Explicit boundary

PDF artifact/container validation is not tide-value extraction. The artifact validator contract is `OFFICIAL_CHM_TIDE_PDF_ARTIFACT_VALIDATED_NO_TEXT_EXTRACTION`; the structured value contract remains `STRUCTURED_OFFICIAL_CHM_TIDE_VALUES_NORMALIZER_LIVE_EXTRACTION_BLOCKED` until the official PDF text/table layout has been independently proven and parsed fail closed.

The manual CHM source workflow is the only current live path for exercising the artifact retrieval contract. Its default remains external execution not requested. A successful live artifact probe may prove host/path/content-type/container/digest evidence only; it must not be represented as proof that tide rows, effective legal-time offset, phases or heights were extracted.

A later stage must separately validate the official CHM PDF text/table extraction format for all seven RJ stations, bind each extracted value set to the exact PDF artifact SHA-256, evidence the effective civil-clock offset, and then run the same final SHA through Android CI and Runtime before live tide values can be marked implemented.

## Safety and retention

- no raw PDF bytes or extracted source text are retained by the tide artifact/value evidence layers;
- no municipality P0 is created from tide values;
- no high/low phase is inferred when the source does not provide it;
- no station is accepted outside the already validated official RJ station metadata;
- PDF network retrieval is HTTPS-only, CHM-host allowlisted, redirect-rejecting, content-type checked and size bounded;
- synthetic unit tests validate code contracts only and are never represented as live CHM evidence.
