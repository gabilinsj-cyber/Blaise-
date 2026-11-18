# Blaise V6 RJ — temperature/thermal official source gates (18 November 2026)

### DWD ICON Global from Germany
- Official source: DWD ICON Global 2-meter air temperature, type **P forecast**, never a calibrated thermometer or local instrumental observation.
- A single (compressed) DWD Global icosahedral GRIB2 is remapped with **DWD official CDO weights**, and then a numeric value is read for each of 92 separate, verified **IBGE interior reference points**.
- A point can be far from the town center or be affected by terrain; **92 polygon-interior points do not equal 92 station measurements**. City-altitude adjustment is not licensed or validated and will not be invented.
- On a real live run, store per-city values, issue and validity times, original DWD file URL and official remap provenance. Missing grid points remain unavailable.
- Internal O/E/P completeness review receives only validated P records; no client, paid API, Firestore, release or scheduled deployment is activated by this PR.

### OpenWeather One Call 4.0
- An already existing authorized Agent13 service has provider authentication and **900 calls/day maximum** backed by a durable shared atomic counter, shared caching and explicit subscription/release gates.
- The new `rj-openweather-thermal-evidence.mjs` converts a **previously fetched, verified, normalized** OpenWeather response (estimated current E) into **only** `temperatureC` and `feelsLikeC` for the private audit and source selector.
- The bridge itself **cannot fetch**, consume a billable call, read a credential or schedule a collection. It requires a server-verified place and an approved subscription, respects provider timestamps and avoids converting forecasts to observations.
- Without active provider service and verified current values, these two fields remain `indisponível`. A numeric thermal sensation is **not calculated** from missing humidity, wind or other physical inputs.

### HG Brasil
- Formal paid-subscriber display permission by e-mail is on file. However, the **HG Pro subscription is not yet active**. The thermal selector now blocks HG until `hgSubscriptionActive: true` is explicitly supplied by a trusted server gate after actual purchase and homologation. No HG calls or payment are initiated.

### Official visual comparison
- INMET can be consulted as a nearby comparison reference if its station, time and temperature are comparable. Defesa Civil may publish an alert rather than an instrumental temperature; such a warning cannot automatically define °C or thermal sensation.
- **Neither source is automatically collected or copied**. Existing `reviewThermalAgainstOfficial` is manual, private and non-overriding; no claim of current agreement without verified data.

### Release
The PR stack is intentionally unmerged. Product deployment, mobile display and any live continuous 92-city scheduler require successful CI, rights review, real provider service test and end-to-end QA. Existing ADM APK is from the previous QA build and will not update itself.
