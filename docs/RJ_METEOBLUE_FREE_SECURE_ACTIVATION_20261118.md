# Meteoblue Free Weather API for Blaise V6 RJ — secure onboarding 2026-11-18

## Status — honest
- Operator screenshots dated 18/11/2026 show **Free Weather API active**, **10,000,000 credits remaining at screenshot time**, Forecast API and Images API enabled; the displayed expiration is **2027-11-18**. There is no live authenticated access to the user's account through this repository: the API key and backend connectivity remain **NOT verified**.
- **SECURITY HOLD:** the user accidentally disclosed an existing API key in a screenshot in the chat. DO NOT reuse or reproduce it in code, docs, logs, examples or manual calls. The user must create a new key on API Key Management and delete/revoke the previously pictured key. Only then provision the new key directly to Cloud Secret Manager, never via chat.
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

## Optional *single request* to verify API key in Cloud Shell
Only after the Free Weather API is visibly **active** and there is **no automatic credit recharge / paid subscription**. Each valid test consumes credits from the free allocation. First use the current original Blaise code at `~/Blaise-RJ` only if these branch changes have been safely reviewed, pulled into your own worktree and installed (do not reset, overwrite or accidentally replace main).

```bash
set +x
export BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED=true
# Set ONLY after creating a NEW key and revoking the screenshot-exposed key:
export BLAISE_METEOBLUE_KEY_ROTATED_AFTER_EXPOSURE=true
export BLAISE_METEOBLUE_AUTOTOPUP_DISABLED=true
export BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED=true
export BLAISE_METEOBLUE_FREE_API_KEY="$(gcloud secrets versions access latest --secret=blaise-meteoblue-free-api-key)"
node backend/scripts/check-meteoblue-free-one-shot.mjs --live --spend-one-free-request
unset BLAISE_METEOBLUE_FREE_API_KEY BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED BLAISE_METEOBLUE_AUTOTOPUP_DISABLED BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED
```

The one-shot command **never logs a key or the full upstream request URL**, never returns raw weather values, never auto-polls and never changes public API or Android. An HTTP 200 with an expected `basic-6h` forecast shape establishes a provisional successful key test, **not** that the user's personal free allocation, credits remaining, expiration or live regional data are independently verified. Confirm plan credits/expiry in the meteoblue account dashboard. Status is `NOT_VALIDATED` until a real user-authorized test succeeds.

## Supported domain and safe usage
- Source `METEOBLUE_FREE_FORECAST` (derived meteoblue mLM **P forecast**, not directly independent from ECMWF/DWD/NOAA models in its blend).
- This key gate is for scientific COMPARISON: forecast rain, gust, humidity, pressure, cloud, CAPE, UV. It does not add meteoblue to `temperatureC`, `feelsLikeC`, `rainNowMm`, `rainAccumulatedMm`, `lightningCount`, `riverLevelM` or `seaSurfaceTemperatureC`.
- Query one **IBGE-verified interior point** only, no unverified altitude, let meteoblue DEM choose altitude for complex Serra terrain.
- The project must keep a durable shared credit ledger and daily test cap before ever enabling repeated polling/92 municipalities; a process-local counter is not safe at multi-million-user scale.
- This integration remains OFF by default. Never claim subscriber release until reviewed CI, license, explicit subscription display rights and data audit.
