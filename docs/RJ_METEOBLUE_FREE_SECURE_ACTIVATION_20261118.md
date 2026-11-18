# Meteoblue Free Weather API for Blaise V6 RJ — secure onboarding 2026-11-18

## Status — honest
- Operator screenshots dated 18/11/2026 show **Free Weather API active**, **10,000,000 credits remaining at screenshot time**, Forecast API and Images API enabled; the displayed expiration is **2027-11-18**. Screenshot verification update (18/11/2026 13:15 BRT): operator directly ran a Cloud Shell call to `/packages/basic-6h`; the terminal reported **HTTP 200**, `RESULTADO: METEOBLUE VALIDADA` and **29 forecast timestamps**. This demonstrates successful API-key authentication and a parsable response for the tested point/package at that moment. The key was never supplied to the repository. **Update 14:04 BRT:** Cloud Shell screenshot confirms Secret Manager API enabled, secret `blaise-meteoblue-free-api-key` in project `blaise-v6-rj` has version 1 in state `enabled`. The screenshot does not independently establish that its payload equals the previously tested key; **runtime service-account IAM, backend binding, per-field forecast value/provenance validation and Android publication remain UNVERIFIED/INACTIVE**.
- **EXPOSED KEY WARNING:** an existing key appeared in a screenshot. The operator explicitly prefers a temporary one-shot verification with the current FREE key rather than rotating now. This carries a risk of someone else consuming credits. Do not copy it into code, docs, GitHub, logs or chat. The one-shot gate accepts an explicit operator flag for **staging only**; rotating the key remains recommended before production, and this exception never enables billing, auto-polling or subscriber publishing.
- **Update 14:12 BRT:** Screenshot of Cloud Shell confirms IAM policy of `blaise-meteoblue-free-api-key` was updated to grant `roles/secretmanager.secretAccessor` to **only** `serviceAccount:blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`. The Cloud Run `blaise-v6-rj-backend` service is confirmed to use this identity. This is authorization to read the secret, **not** a deployed environment-secret binding, not an auto collector and not a proof of correct payload content. No production Cloud Run revision has been deliberately deployed for meteoblue.
- **Update 14:14 BRT (operator screenshot):** using `gcloud secrets versions access latest` piped to a Node length-only check, Cloud Shell printed `SEGREDO: CONTEUDO PRESENTE`. This confirms a nonempty accessible Secret Manager version without displaying the payload. It does **not** prove the value equals the key previously accepted by meteoblue; no Cloud Run runtime secret binding, backend collection, or Android publication has yet been verified. Keep all production changes gated and avoid exposing secret values in logs.
- **Update 14:20 BRT (operator screenshot):** `gcloud run services describe blaise-v6-rj-backend` printed `VINCULO METEOBLUE: CONFIGURADO`. The ready revision containing the secret reference is staged with **0% traffic**. Two prior revisions continue to receive **99% and 1%** respectively. No subscriber traffic has been shifted to the new revision. The Cloud Run revision is NOT proof that the Blaise runtime collector processes Meteoblue values: current app collector, budget control, model/field mapping and Android publication are still unvalidated. Preserve this safe no-traffic state until coding/tests and explicit release.
- Screenshot shows a €25 offer for 10 million *additional prepaid credits*, not a required monthly subscription. Purchase is optional, renewal is optional and must stay OFF. No purchase now.
- There is **NO password validation** from this app. The email account password and meteoblue account password are NOT needed, must NOT be sent to GitHub/ChatGPT/Android.
- One-year free access can be activated within user's meteoblue account: top-right account icon -> **Account overview** -> **Weather API** -> enable Free Weather API.
- Official docs: https://docs.meteoblue.com/en/weather-apis/free-weather-api/overview
- Official 2026 public offer: **€0, 10M credits, 12 months**, approx <=2,500 calls with cheapest packages and <=1,250 with `basic-1h`. The FREE trial period is not renewable. `basic-6h` is a supported cheap package and is used here for **one manual credential test only**. Each request consumes credits even if there is no financial charge.
- Basic, Wind, Clouds, Air (CAPE/lifted index), Trend and Air Quality *forecasts* are among free packages. Free does not include Sea, Current, Nowcast, Measurements, Warnings, Maps, History or Dataset. Do not confuse point+ consumer subscription or a €25 subscription with Weather API commercial access.
- Official package table: https://business.meteoblue.com/products/weather-apis/free-weather-api

## Cloud Shell: safe credential storage (NEVER paste secrets in this chat or git)
First open https://console.cloud.google.com/ and select the actual Blaise project (do not guess the Google Cloud project ID). In Cloud Shell:

```bash
gcloud config get-value project
# One-time secret; if already exists, skip the creation step:
gcloud secrets create blaise-meteoblue-free-api-key --replication-policy=automatic
# Type key invisibly at this terminal prompt, not in chat / screenshot:
set +x
read -rsp 'Cole aqui sua chave meteoblue (não a senha): ' MB_KEY
printf '\n'
printf '%s' "$MB_KEY" | gcloud secrets versions add blaise-meteoblue-free-api-key --data-file=-
unset MB_KEY
```

Only Cloud Shell user should run these commands. Do not paste the key literally into a command or an exported script. A secret is not a password and should have narrow permissions. Later, grant the actual Blaise backend Cloud Run service identity Secret Manager accessor for that secret; never a shared public permission. This manual workflow creates a new secret/version in YOUR cloud project and may generate Google Cloud infrastructure usage costs depending on your plan; confirm free-tier and billing settings before use.

## Deprecated legacy key-only test — replaced on 2026-11-18

The former `check-meteoblue-free-one-shot.mjs` path is **disabled**, including with `--live`, because it did not reserve credits in shared Firestore before contacting meteoblue. It is retained as a fail-closed compatibility command; do **not** use it for live checks.

For any additional operator-authorized single real call, use only `backend/scripts/meteoblue-free-private-field-audit.mjs` as described in `RJ_METEOBLUE_FREE_COLLECTOR_AND_CREDIT_BUDGET_20261118.md`. It reserves **4,000 credits atomically** under the shared 8M ceiling, four calls/day, and 24h/municipality cooling period. Production/Android remains untouched. The original key test's HTTP 200 and 29 timestamps are historical evidence, not an authorization to bypass the new budget gate.

## Supported domain and safe usage
- Source `METEOBLUE_FREE_FORECAST` (derived meteoblue mLM **P forecast**, not directly independent from ECMWF/DWD/NOAA models in its blend).
- This key gate is for scientific COMPARISON: forecast rain, gust, humidity, pressure, cloud, CAPE, UV. It does not add meteoblue to `temperatureC`, `feelsLikeC`, `rainNowMm`, `rainAccumulatedMm`, `lightningCount`, `riverLevelM` or `seaSurfaceTemperatureC`.
- Query one **IBGE-verified interior point** only, no unverified altitude, let meteoblue DEM choose altitude for complex Serra terrain.
- The project must keep a durable shared credit ledger and daily test cap before ever enabling repeated polling/92 municipalities; a process-local counter is not safe at multi-million-user scale.
- This integration remains OFF by default. Never claim subscriber release until reviewed CI, license, explicit subscription display rights and data audit.
