# Blaise V6 RJ — meteoblue Free API: private collector + credit control
Date: 2026-11-18. Stacked on draft PR #171. Do NOT merge or deploy to customers until release review.

## Evidence and user account
- Actual operator Cloud Shell screenshot: 2026-11-18 ~13:15 BRT, HTTP 200 from `/packages/basic-6h`, 29 returned forecast timestamps for one Rio point. This is **NOT** a live audit of numeric forecast fields; it proves a compatible key and usable six-hour schema/time array.
- `blaise-v6-rj` Google Cloud project; Secret Manager `blaise-meteoblue-free-api-key` version 1 enabled, nonempty (user screenshot 14:14 BRT).
- IAM secretAccessor granted to `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`, used by `blaise-v6-rj-backend`.
- New Cloud Run revision with `BLAISE_METEOBLUE_FREE_API_KEY` bound to the Secret Manager version is staged at **0% traffic**; existing two revisions still split 99% and 1%. **Do NOT shift traffic** until a separate release approval. At time of this code, old live revision does not have the collector logic.
- Previously pictured API key should be rotated BEFORE production. Operator has accepted its use only for a temporary, one-shot private check. Do not display credentials in scripts, tickets, CI, logs or the mobile app.

## Official source/credit policy (2026-11-18)
- Account: Free Weather API, 10,000,000 credits total, expires `2027-11-18` per account screenshot, commercial use permitted subject to provider terms, no credit top-up or EUR/US$ payment authorized.
- Official OpenAPI: https://my.meteoblue.com/packages/openapi.json .
- **Exactly one** `basic-6h` package, cost **4,000 credits per call** (official OpenAPI package pricing). Credits != requests. A 92-point sweep costs **368,000 credits**; 10M covers about 27 sweeps total without any other consumption. **Do NOT promise 92 municipalities in realtime with this trial**.
- Local strict Firestore budget reserves at most **8,000,000 credits** (2,000 local calls) leaving a **2M safety margin** for historical/pre-existing provider use outside the local ledger. **Provider's true remaining balance is unknown** and must be checked manually in the meteoblue dashboard. Reservation is charged locally even if the HTTP call fails, because real upstream charging can occur.
- Shared, atomic Firestore transaction: maximum **4 calls / UTC day**, maximum **one query per municipality / rolling 24h**. Shared per-city private forecast cache has **6h TTL**. No user location, voice, identities, per-customer API calls, map copying, TTL deletes or provider raw request URL are stored.
- If Firestore, quota state, Cloud Run secret, provider response, municipal IBGE point or time windows fail: return UNAVAILABLE, never fall back to per-instance counters or emergency paid products.
- These gates bound only the Blaise collector, not direct meteoblue key misuse outside the app. Protect the meteoblue account with a provider-side API-key daily credit limit and rotate the exposed key.

## Fields and scientific semantics
The official `basic-6h` JSON fields are validated by `rj-meteoblue-basic6h-parse.mjs` using provider timestamps, lengths, finite ranges and optional metadata:

| JSON field | Admin-only projection | Meaning |
|---|---|---|
| `precipitation` | forecastPrecipitationSixHourMm | total forecast in 6-hour interval, **not observed mm** |
| `convective_precipitation` | forecastConvectivePrecipitationSixHourMm | 6-hour forecast convective component, not thunder detection |
| `precipitation_probability` | forecastPrecipitationProbabilitySixHourPct | 6-hour precipitation probability |
| `windspeed_mean` | forecastWindMeanSixHourKmh | 10m 6-hour mean, **not instantaneous** |
| `windspeed_max` | forecastWindMaxSixHourKmh | 10m maximum mean wind in interval, **not observed gust** |
| `relativehumidity_mean` | forecastHumidityMeanSixHourPct | 6-hour average % |
| `sealevelpressure_mean` | forecastSeaLevelPressureMeanSixHourHpa | 6-hour average sea-level pressure |

No meteoblue field from this free comparison may override `temperatureC`, `feelsLikeC`, `rainNowMm`, `rainNextHourForecastMm`, `gustKmh`, official lightning/rain alerts, river level or NOAA sea temperatures. The `basic-6h` fields cannot stand in for the hourly, current or station-gauge fields of the customer UI. The mLM model may include ECMWF/DWD/NOAA input, so it is NOT an independent 4th model vote. Even parsed data stays **private staging, not scientifically homologated or subscriber-published** pending real value+metadata audit.

## Code and deliberate gating
- `backend/src/rj-meteoblue-basic6h-parse.mjs`: raw JSON + unit/time/field validation, privacy-safe internal result.
- `backend/src/rj-meteoblue-free-firestore-store.mjs`: distributed quota + private 6h cache + budget report.
- `backend/src/rj-meteoblue-free-collector.mjs`: one city request after atomic reservation, no retry on unknown provider billing.
- `backend/src/rj-meteoblue-runtime-optional.mjs` and `backend/src/runtime.mjs`: opt-in initialization, **no public HTTP endpoint** and **no polling**.
- `backend/scripts/meteoblue-free-private-field-audit.mjs`: operator-only staging check, masked metadata and field coverage; not called in CI with live flags.
- `backend/scripts/meteoblue-free-credit-status.mjs`: Firestore **local ledger** report only, no provider access.
- `backend/test/rj-meteoblue-free-collector.test.mjs`: sample schema, illegal data, 92-point location restriction, atomic concurrency, budget/day/city caps, cache, secret/privacy and failure cases.
- CI never obtains secret or calls the provider. It tests fixtures only.

## Manual execution in Cloud Shell (one 4,000-credit probe)
This is optional, NEVER automatic. This cannot be run on the already deployed Cloud Run revision without code review, it uses source code from the PR. Only after reviewing it in a separate worktree of the original repo:

```bash
# Do not reset, overwrite, clean or checkout the original Blaise files.
cd ~/Blaise-RJ
git fetch origin feature/rj-meteoblue-free-credential-gate-20261118
git worktree add ~/blaise-meteoblue-review FETCH_HEAD
cd ~/blaise-meteoblue-review/backend
node --version
npm ci
node --test test/rj-meteoblue-free-collector.test.mjs
node scripts/meteoblue-free-private-field-audit.mjs  # OFFLINE; zero credits
```

Only when Node v24, Firestore default database/IAM and authorization are confirmed, and the owner consciously approves one *additional* 4,000-credit private call using the currently pictured key, run the following on its own (NO secrets pasted into the command, no logging with `set -x`):

```bash
set +x
BLAISE_METEOBLUE_PROJECT_ID=blaise-v6-rj \
BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED=true \
BLAISE_METEOBLUE_AUTOTOPUP_DISABLED=true \
BLAISE_METEOBLUE_PAID_ALLOWED=false \
BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED=true \
BLAISE_METEOBLUE_FIRESTORE_ENABLED=true \
BLAISE_METEOBLUE_TEMPORARY_KEY_RISK_ACCEPTED=true \
BLAISE_METEOBLUE_STAGING_ONESHOT_APPROVED=true \
BLAISE_METEOBLUE_ALLOW_REAL_CREDIT_SPEND=true \
BLAISE_METEOBLUE_FREE_API_KEY="$(gcloud secrets versions access latest --secret=blaise-meteoblue-free-api-key --project=blaise-v6-rj)" \
node scripts/meteoblue-free-private-field-audit.mjs --live --one-credit --private-staging
```

The shared Firestore ledger blocks any second call using the exposed key. To inspect remaining **LOCAL** reservations without provider use:
```bash
node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget
```

If Firestore is unavailable, the script fails closed and no new meteoblue call is made. This plan does not enable a paid meteoblue service, public traffic, source copying, or an automatic scheduler. Firestore and Cloud Run may incur separate Google Cloud infrastructure charges, even when meteoblue trial credits are free.
