package br.com.blaise.rj.data

import br.com.blaise.rj.BuildConfig
import br.com.blaise.rj.billing.FirebaseSubscriberAccess

import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import br.com.blaise.rj.cities.RioMunicipalities
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Instant
import java.util.concurrent.Executor
import java.util.concurrent.Executors

const val DASHBOARD_DATA_PAID_HTTPS_PATH = "/v1/data/dashboard"
const val DASHBOARD_DATA_ENTITLEMENT_VERIFY_PATH = "/v1/entitlements/verify"
const val DASHBOARD_DATA_CONTRACT = "PAID_OFFICIAL_DASHBOARD_SNAPSHOT_V1"
const val DASHBOARD_DATA_RAINFALL_SOURCE_ID = "alerta-rio-rainfall-live"
const val DASHBOARD_DATA_RAINFALL_COVERAGE = "RIO_CITY_ALERTA_RIO_STATIONS"
const val DASHBOARD_DATA_ALERTA_RIO_STATION_COUNT = 33
const val DASHBOARD_DATA_MAX_RESPONSE_BYTES = 128 * 1024

object DashboardDataEndpointPolicy {
    fun deriveFromEntitlementVerifier(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) return null
        if (uri.userInfo != null || uri.rawQuery != null || uri.rawFragment != null) return null
        if (uri.path != DASHBOARD_DATA_ENTITLEMENT_VERIFY_PATH) return null
        return runCatching {
            URI("https", null, uri.host, uri.port, DASHBOARD_DATA_PAID_HTTPS_PATH, null, null).toString()
        }.getOrNull()
    }
}

data class DashboardRainfallSummary(
    val state: String,
    val observedAt: Instant,
    val fetchedAt: Instant?,
    val stationCount: Int,
    val wetStationCount: Int,
    val missingValueCount: Int?,
    val max15mMm: Double?,
    val max1hMm: Double?,
    val max24hMm: Double?,
)

data class DashboardOfficialSourceState(
    val sourceId: String,
    val state: String,
    val reason: String,
    val fetchedAt: Instant?,
    val observedAt: Instant?,
    val dataAgeMs: Long?,
    val cacheAgeMs: Long?,
    val semanticValidity: String?,
)


data class DashboardMarineReading(
    val waveHeightM: Double,
    val source: String,
    val validAt: Instant,
    val lastCheckedAt: Instant,
    val expiresAt: Instant,
    val latitude: Double,
    val longitude: Double,
) {
    fun current(now: Instant): Boolean {
        val age = java.time.Duration.between(validAt, now).seconds
        val checkedAge = java.time.Duration.between(lastCheckedAt, now).seconds
        return age in 0L..3599L &&
            checkedAge in 0L..MAX_CURRENT_OBSERVATION_AGE_SECONDS &&
            expiresAt.isAfter(now)
    }
}

/** A model forecast is NOT a local observed weather reading.
 * The backend must have verified origin, timestamps, license and geographic scope.
 */
data class DashboardInternationalForecast(
    val ibge: Int,
    val issuedAt: Instant,
    val validAt: Instant,
    val checkedAt: Instant,
    val temperatureC: Double?,
    val feelsLikeC: Double?,
    val humidityPct: Double?,
    val pressureHpa: Double?,
    val dewPointC: Double?,
    val cloudPct: Double?,
    val windKmh: Double?,
    val gustKmh: Double?,
    val uvClearSkyIndex: Double?,
    val precipitationNextHourMm: Double?,
    val precipitationProbabilityNextHourPct: Double?,
) {
    val sourceLabel = "MET Norway / ECMWF IFS"
    val uvSourceLabel = "CAMS via MET Norway • céu limpo"
    val isOfficialObservation = false
    val mayCreateAlerts = false
    fun current(now: Instant): Boolean =
        !issuedAt.isAfter(now) && !validAt.isAfter(now) && !checkedAt.isAfter(now) &&
        java.time.Duration.between(issuedAt, now).seconds in 0L..43_200L &&
        java.time.Duration.between(validAt, now).seconds in 0L..5_400L &&
        java.time.Duration.between(checkedAt, now).seconds in 0L..120L
}

/**
 * Visual Crossing Free current values are E (aggregated/estimated), never O.
 * Forecast values are P and never become emergency or station observations.
 * All numbers are optional: absent is not numeric zero.
 */
data class DashboardVisualCrossingWeather(
    val ibge: Int,
    val checkedAt: Instant,
    val currentValidAt: Instant?,
    val temperatureC: Double?,
    val feelsLikeC: Double?,
    val humidityPct: Double?,
    val dewPointC: Double?,
    val windKmh: Double?,
    val gustKmh: Double?,
    val precipitationMm: Double?,
    val precipitationProbabilityPct: Double?,
    val pressureHpa: Double?,
    val severeRiskIndex: Double?,
    val forecastNextValidAt: Instant?,
    val forecastPrecipitationMm: Double?,
    val forecastPrecipitationProbabilityPct: Double?,
    val forecastWindGustKmh: Double?,
) {
    val sourceLabel = "Visual Crossing"
    val attribution = "Weather data by Visual Crossing"
    val isStationObservation = false
    val mayCreateOfficialWarnings = false
    fun current(now: Instant): Boolean {
        val valid=currentValidAt ?: return false
        val age=java.time.Duration.between(valid,now).seconds
        val checkedAge=java.time.Duration.between(checkedAt,now).seconds
        return age in 0L..1800L && checkedAge in 0L..1800L &&
            listOfNotNull(temperatureC,feelsLikeC,humidityPct,dewPointC,windKmh,
                gustKmh,precipitationMm,precipitationProbabilityPct,pressureHpa,
                severeRiskIndex).isNotEmpty()
    }
    fun nextForecast(now: Instant): Boolean {
        val time=forecastNextValidAt ?: return false
        val nextAge=java.time.Duration.between(now,time).seconds
        val checkedAge=java.time.Duration.between(checkedAt,now).seconds
        return nextAge in 1L..3600L && checkedAge in 0L..21600L &&
            listOfNotNull(forecastPrecipitationMm,
                forecastPrecipitationProbabilityPct,forecastWindGustKmh).isNotEmpty()
    }
}

data class DashboardOfficialNotice(val id: String, val name: String, val message: String, val url: String)

data class DashboardDataSnapshot(
    val generatedAt: Instant,
    val mode: String,
    val sourceCount: Int,
    val currentSourceCount: Int,
    val rainfall: DashboardRainfallSummary?,
    val officialNoticeLinks: List<DashboardOfficialNotice> = emptyList(),
    val sources: List<DashboardOfficialSourceState>,
    val marine: DashboardMarineReading? = null,
    val internationalForecasts: List<DashboardInternationalForecast> = emptyList(),
    val visualCrossingWeather: List<DashboardVisualCrossingWeather> = emptyList(),
) {
    fun current(now: Instant): Boolean {
        fun ageWithin(value: Instant, limit: Long): Boolean =
            !value.isAfter(now) && java.time.Duration.between(value, now).seconds <= limit
        return ageWithin(generatedAt, 120) &&
            (rainfall == null || (ageWithin(rainfall.observedAt, MAX_CURRENT_OBSERVATION_AGE_SECONDS) &&
                rainfall.fetchedAt?.let { ageWithin(it, if (mode == "severe") 120 else MAX_CURRENT_OBSERVATION_AGE_SECONDS) } == true))
    }
}

sealed interface DashboardDataNetworkResult {
    data class Available(val snapshot: DashboardDataSnapshot) : DashboardDataNetworkResult
    data object Denied : DashboardDataNetworkResult
    data object Unavailable : DashboardDataNetworkResult
}

object DashboardDataParser {
    private val topLevelKeys = setOf(
        "contract",
        "generatedAt",
        "mode",
        "scope",
        "sourceCount",
        "currentSourceCount",
        "rainfall",
        "sources",
        "privacy",
    )
    private val rainfallKeys = setOf(
        "sourceId",
        "coverage",
        "state",
        "reason",
        "observedAt",
        "fetchedAt",
        "stationCount",
        "wetStationCount",
        "missingValueCount",
        "max15mMm",
        "max1hMm",
        "max24hMm",
    )
    private val sourceKeys = setOf(
        "sourceId",
        "state",
        "reason",
        "fetchedAt",
        "observedAt",
        "dataAgeMs",
        "cacheAgeMs",
        "semanticValidity",
    )
    private val privacyKeys = setOf("purchaseTokenExposed", "rawStationPayloadExposed", "userLocationStored")
    private val acceptedSourceStates = setOf("CURRENT", "CURRENT_DEGRADED", "STALE", "UNAVAILABLE")

    fun parse(payload: Map<String, Any?>): DashboardDataSnapshot {
        require(payload.keys.containsAll(topLevelKeys) &&
            (payload.keys - topLevelKeys).all { it in setOf("marine", "rainfallAvailability", "officialNoticeLinks", "internationalForecasts", "visualCrossingWeather") })
        require(payload["contract"] == DASHBOARD_DATA_CONTRACT)
        require(payload["scope"] in setOf("RJ_OFFICIAL_SOURCES_WITH_RIO_CITY_RAINFALL", "RJ_APPROVED_SOURCES"))

        val generatedAt = instant(payload["generatedAt"])
        val mode = string(payload["mode"], 3, 16)
        require(mode == "normal" || mode == "severe")
        val sourceCount = boundedInt(payload["sourceCount"], 0, 64)
        val currentSourceCount = boundedInt(payload["currentSourceCount"], 0, sourceCount)

        val rainfallMap = payload["rainfall"]?.let(::stringMap)
        if (rainfallMap != null) require(rainfallMap.keys == rainfallKeys)
        if (rainfallMap != null) require(rainfallMap["sourceId"] == DASHBOARD_DATA_RAINFALL_SOURCE_ID)
        if (rainfallMap != null) require(rainfallMap["coverage"] == DASHBOARD_DATA_RAINFALL_COVERAGE)
        val rainfallState = rainfallMap?.let { string(it["state"], 3, 32) }
        if (rainfallMap != null) require(rainfallState == "CURRENT" || rainfallState == "CURRENT_DEGRADED")
        if (rainfallMap != null) string(rainfallMap["reason"], 1, 96)
        val stationCount = rainfallMap?.let { boundedInt(it["stationCount"], DASHBOARD_DATA_ALERTA_RIO_STATION_COUNT, DASHBOARD_DATA_ALERTA_RIO_STATION_COUNT) } ?: 0
        val wetStationCount = rainfallMap?.let { boundedInt(it["wetStationCount"], 0, stationCount) } ?: 0
        val missingValueCount = rainfallMap?.let { nullableBoundedInt(it["missingValueCount"], 0, stationCount * 14) }
        val rainfall = rainfallMap?.let { DashboardRainfallSummary(
            state = rainfallState ?: throw IllegalArgumentException("invalid_rain_state"),
            observedAt = instant(rainfallMap["observedAt"]),
            fetchedAt = nullableInstant(rainfallMap["fetchedAt"]),
            stationCount = stationCount,
            wetStationCount = wetStationCount,
            missingValueCount = missingValueCount,
            max15mMm = nullableRainMm(rainfallMap["max15mMm"]),
            max1hMm = nullableRainMm(rainfallMap["max1hMm"]),
            max24hMm = nullableRainMm(rainfallMap["max24hMm"]),
        ) }
        if (payload.containsKey("rainfallAvailability")) {
            require(payload["rainfallAvailability"] == if (rainfall == null) "UNAVAILABLE" else "AVAILABLE")
        }

        val sourceValues = payload["sources"] as? List<*> ?: throw IllegalArgumentException("invalid_sources")
        require(sourceValues.size == sourceCount)
        val sources = sourceValues.map { raw ->
            val value = stringMap(raw)
            require(value.keys == sourceKeys)
            val state = string(value["state"], 3, 32)
            require(state in acceptedSourceStates)
            DashboardOfficialSourceState(
                sourceId = identifier(value["sourceId"]),
                state = state,
                reason = string(value["reason"], 1, 96),
                fetchedAt = nullableInstant(value["fetchedAt"]),
                observedAt = nullableInstant(value["observedAt"]),
                dataAgeMs = nullableBoundedLong(value["dataAgeMs"], 0, 7L * 24 * 60 * 60 * 1000),
                cacheAgeMs = nullableBoundedLong(value["cacheAgeMs"], 0, 7L * 24 * 60 * 60 * 1000),
                semanticValidity = nullableString(value["semanticValidity"], 1, 160),
            )
        }
        require(sources.count { it.state == "CURRENT" || it.state == "CURRENT_DEGRADED" } == currentSourceCount)
        require(sources.map { it.sourceId }.toSet().size == sources.size)
        // Old server revisions must not leak INMET/CEMADEN comparator status
        // into the subscriber app; reject instead of silently accepting it.
        require(sources.none {
            it.sourceId.contains("inmet", ignoreCase = true) ||
            it.sourceId.contains("cemaden", ignoreCase = true)
        })


        val marine = payload["marine"]?.let { raw ->
            val m = stringMap(raw)
            require(m.keys == setOf(
                "waveHeightM", "units", "source", "nature",
                "validAt", "lastCheckedAt", "expiresAt",
                "latitude", "longitude"
            ))
            require(m["units"] == "m")
            require(m["nature"] == "MODELO")
            require(m["source"] == "NOAA GFS-Wave")

            fun coordinate(key: String): Double =
                (m[key] as? Number)?.toDouble()?.also {
                    require(it.isFinite())
                } ?: throw IllegalArgumentException("marine_coordinate_invalid")

            val wave = coordinate("waveHeightM")
            val latitude = coordinate("latitude")
            val longitude = coordinate("longitude")
            require(wave in 0.0..50.0)
            require(latitude in -25.0..-21.0)
            require(longitude in -45.0..-40.0)

            val validAt = instant(m["validAt"])
            val checkedAt = instant(m["lastCheckedAt"])
            val expiresAt = instant(m["expiresAt"])
            require(!validAt.isAfter(checkedAt))
            require(expiresAt.isAfter(validAt))
            require(java.time.Duration.between(validAt, expiresAt).seconds <= 3600)

            DashboardMarineReading(
                wave, "NOAA GFS-Wave", validAt,
                checkedAt, expiresAt, latitude, longitude
            )
        }

        val privacy = stringMap(payload["privacy"])
        require(privacy.keys == privacyKeys)
        require(privacy["purchaseTokenExposed"] == false)
        require(privacy["rawStationPayloadExposed"] == false)
        require(privacy["userLocationStored"] == false)

        val notices = (payload["officialNoticeLinks"] as? List<*>)?.map { raw ->
            val value = stringMap(raw)
            require(value.keys == setOf("id", "name", "message", "url"))
            val id = identifier(value["id"])
            val url = string(value["url"], 12, 180)
            require((id == "alerta-rio" && url == "https://www.sistema-alerta-rio.com.br/alertas/") ||
                (id == "defesa-civil-rj" && url == "https://defesacivil.rj.gov.br/") ||
                (id == "inmet-avisos" && url == "https://avisos.inmet.gov.br/") ||
                (id == "inpe-cptec-avisos" && url == "https://www.cptec.inpe.br/"))
            DashboardOfficialNotice(id, string(value["name"], 3, 64), string(value["message"], 10, 300), url)
        }.orEmpty()
        require(notices.size <= 4 && notices.map { it.id }.toSet().size == notices.size)

        val forecastKeys = setOf(
            "ibge", "sourceId", "modelOrigin", "uvOrigin", "kind",
            "issuedAt", "validAt", "checkedAt", "temperatureC", "feelsLikeC",
            "humidityPct", "pressureHpa", "dewPointC", "cloudPct", "windKmh",
            "gustKmh", "uvClearSkyIndex", "precipitationNextHourMm",
            "precipitationProbabilityNextHourPct", "credit", "sourceUrl", "license"
        )
        val forecasts = (payload["internationalForecasts"] as? List<*>)?.map { raw ->
            val m = stringMap(raw)
            require(m.keys == forecastKeys)
            val municipalityCode = (m["ibge"] as? String)?.toIntOrNull()
                ?: throw IllegalArgumentException("invalid_model_ibge")
            require(RioMunicipalities.byIbgeCode(municipalityCode) != null)
            require(m["sourceId"] == "MET_NORWAY_LOCATIONFORECAST_2")
            require(m["modelOrigin"] == "ECMWF_IFS")
            require(m["uvOrigin"] == "COPERNICUS_CAMS_UV_VIA_MET_NO")
            require(m["kind"] == "MODEL_FORECAST_NOT_LOCAL_MEASUREMENT")
            require(m["sourceUrl"] == "https://api.met.no/weatherapi/locationforecast/2.0/complete")
            require(m["license"] == "CC BY 4.0")
            require(m["credit"] == "MET Norway / ECMWF IFS (UV céu limpo: CAMS via MET Norway)")
            val issuedAt = instant(m["issuedAt"])
            val validAt = instant(m["validAt"])
            val checkedAt = instant(m["checkedAt"])
            // Check observed clock time (not response-generated time) in UI too.
            fun metric(key: String, low: Double, high: Double): Double? {
                val v = m[key] ?: return null
                val n = (v as? Number)?.toDouble() ?: throw IllegalArgumentException("invalid_model_field")
                require(n.isFinite() && n in low..high)
                return n
            }
            DashboardInternationalForecast(
                ibge = (m["ibge"] as String).toInt(),
                issuedAt = issuedAt, validAt = validAt, checkedAt = checkedAt,
                temperatureC = metric("temperatureC", -60.0, 65.0),
                feelsLikeC = metric("feelsLikeC", -80.0, 80.0),
                humidityPct = metric("humidityPct", 0.0, 100.0),
                pressureHpa = metric("pressureHpa", 800.0, 1150.0),
                dewPointC = metric("dewPointC", -90.0, 65.0),
                cloudPct = metric("cloudPct", 0.0, 100.0),
                windKmh = metric("windKmh", 0.0, 400.0),
                gustKmh = metric("gustKmh", 0.0, 550.0),
                uvClearSkyIndex = metric("uvClearSkyIndex", 0.0, 25.0),
                precipitationNextHourMm = metric("precipitationNextHourMm", 0.0, 500.0),
                precipitationProbabilityNextHourPct = metric("precipitationProbabilityNextHourPct", 0.0, 100.0),
            )
        }.orEmpty()
        require(forecasts.size <= 2 && forecasts.map { it.ibge }.toSet().size == forecasts.size)
        require(forecasts.all { it.current(generatedAt) })

        val vcTopKeys=setOf("contract","ibge","sourceId","sourceLabel",
            "attribution","currentKind","forecastKind","currentValidAt",
            "checkedAt","officialAlert","dataNotForSafetyCriticalDecisions",
            "current","forecastNext")
        val vcValueKeys=setOf("temperatureC","feelsLikeC","humidityPct",
            "dewPointC","windKmh","gustKmh","precipitationMm",
            "precipitationProbabilityPct","pressureHpa","severeRiskIndex")
        fun vcMetric(map: Map<String,Any?>,key:String,lo:Double,hi:Double):Double? {
            val raw=map[key] ?: return null
            val n=(raw as? Number)?.toDouble()
                ?: throw IllegalArgumentException("invalid_visual_crossing_field")
            require(n.isFinite() && n in lo..hi)
            return n
        }
        val vcWeather=(payload["visualCrossingWeather"] as? List<*>)?.map { raw ->
            val row=stringMap(raw)
            require(row.keys==vcTopKeys)
            require(row["contract"]=="RJ_VISUAL_CROSSING_BOUNDED_CITY_E_P_V1")
            require(row["sourceId"]=="VISUAL_CROSSING_FREE")
            require(row["sourceLabel"]=="Visual Crossing")
            require(row["attribution"]=="Weather data by Visual Crossing")
            require(row["currentKind"]=="E_AGGREGATED_NOT_STATION")
            require(row["forecastKind"]=="P_MODEL_NOT_OBSERVATION")
            require(row["officialAlert"]==false)
            require(row["dataNotForSafetyCriticalDecisions"]==true)
            val ibge=(row["ibge"] as? String)?.toIntOrNull()
                ?: throw IllegalArgumentException("invalid_vc_city")
            require(RioMunicipalities.byIbgeCode(ibge)!=null)
            val checked=instant(row["checkedAt"])
            require(!checked.isAfter(generatedAt))
            val currentDate=nullableInstant(row["currentValidAt"])
            val current=stringMap(row["current"])
            require(current.keys==vcValueKeys)
            if(currentDate==null)require(current.values.all{it==null})
            else {
                require(!currentDate.isAfter(generatedAt))
                require(java.time.Duration.between(currentDate,generatedAt).seconds in 0L..1800L)
                require(java.time.Duration.between(checked,generatedAt).seconds in 0L..1800L)
            }
            val next=row["forecastNext"]?.let(::stringMap)
            if(next!=null){
                require(next.keys==setOf("validAt","kind","precipitationMm",
                    "precipitationProbabilityPct","windGustKmh"))
                require(next["kind"]=="P")
                val nextTime=instant(next["validAt"])
                require(nextTime.isAfter(generatedAt))
                require(java.time.Duration.between(generatedAt,nextTime).seconds<=3600)
                require(java.time.Duration.between(checked,generatedAt).seconds<=21600)
            }
            DashboardVisualCrossingWeather(
                ibge=ibge,checkedAt=checked,currentValidAt=currentDate,
                temperatureC=vcMetric(current,"temperatureC",-40.0,60.0),
                feelsLikeC=vcMetric(current,"feelsLikeC",-60.0,70.0),
                humidityPct=vcMetric(current,"humidityPct",0.0,100.0),
                dewPointC=vcMetric(current,"dewPointC",-60.0,60.0),
                windKmh=vcMetric(current,"windKmh",0.0,350.0),
                gustKmh=vcMetric(current,"gustKmh",0.0,450.0),
                precipitationMm=vcMetric(current,"precipitationMm",0.0,500.0),
                precipitationProbabilityPct=vcMetric(current,"precipitationProbabilityPct",0.0,100.0),
                pressureHpa=vcMetric(current,"pressureHpa",800.0,1100.0),
                severeRiskIndex=vcMetric(current,"severeRiskIndex",0.0,100.0),
                forecastNextValidAt=next?.let{instant(it["validAt"])},
                forecastPrecipitationMm=next?.let{vcMetric(it,"precipitationMm",0.0,500.0)},
                forecastPrecipitationProbabilityPct=next?.let{
                    vcMetric(it,"precipitationProbabilityPct",0.0,100.0)},
                forecastWindGustKmh=next?.let{vcMetric(it,"windGustKmh",0.0,450.0)},
            )
        }.orEmpty()
        require(vcWeather.size<=2 &&
            vcWeather.map{it.ibge}.toSet().size==vcWeather.size)
        require(vcWeather.all{it.current(generatedAt)||it.nextForecast(generatedAt)})

        return DashboardDataSnapshot(
            generatedAt = generatedAt,
            mode = mode,
            sourceCount = sourceCount,
            currentSourceCount = currentSourceCount,
            rainfall = rainfall,
            officialNoticeLinks = notices,
            sources = sources,
            marine = marine,
            internationalForecasts = forecasts,
            visualCrossingWeather = vcWeather,
        )
    }

    private fun stringMap(value: Any?): Map<String, Any?> {
        @Suppress("UNCHECKED_CAST")
        return value as? Map<String, Any?> ?: throw IllegalArgumentException("invalid_object")
    }

    private fun string(value: Any?, min: Int, max: Int): String {
        val result = value as? String ?: throw IllegalArgumentException("invalid_string")
        require(result.length in min..max)
        require(result.none { it.code < 0x20 || it.code == 0x7f })
        return result
    }

    private fun nullableString(value: Any?, min: Int, max: Int): String? =
        if (value == null) null else string(value, min, max)

    private fun identifier(value: Any?): String {
        val result = string(value, 1, 80)
        require(Regex("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$").matches(result))
        return result
    }

    private fun instant(value: Any?): Instant {
        val raw = value as? String ?: throw IllegalArgumentException("invalid_instant")
        return runCatching { Instant.parse(raw) }.getOrElse { throw IllegalArgumentException("invalid_instant") }
    }

    private fun nullableInstant(value: Any?): Instant? = if (value == null) null else instant(value)

    private fun boundedInt(value: Any?, min: Int, max: Int): Int {
        val number = value as? Number ?: throw IllegalArgumentException("invalid_integer")
        val long = number.toLong()
        require(number.toDouble() == long.toDouble() && long in min.toLong()..max.toLong())
        return long.toInt()
    }

    private fun nullableBoundedInt(value: Any?, min: Int, max: Int): Int? =
        if (value == null) null else boundedInt(value, min, max)

    private fun nullableBoundedLong(value: Any?, min: Long, max: Long): Long? {
        if (value == null) return null
        val number = value as? Number ?: throw IllegalArgumentException("invalid_long")
        val long = number.toLong()
        require(number.toDouble() == long.toDouble() && long in min..max)
        return long
    }

    private fun nullableRainMm(value: Any?): Double? {
        if (value == null) return null
        val result = (value as? Number)?.toDouble() ?: throw IllegalArgumentException("invalid_rain")
        require(result.isFinite() && result in 0.0..20_000.0)
        return result
    }
}

class DashboardDataHttpsClient private constructor(
    endpoint: String,
    private val packageName: String,
    private val executor: Executor,
) {
    private val endpointUrl = URL(endpoint)

    fun fetch(candidate: PlayPurchaseCandidate, callback: (DashboardDataNetworkResult) -> Unit) =
        fetch(candidate, emptyList(), callback)

    /** At most two IBGE IDs; never sends user GPS or 92-place fanout. */
    fun fetch(
        candidate: PlayPurchaseCandidate,
        municipalityIbges: List<Int>,
        callback: (DashboardDataNetworkResult) -> Unit,
    ) {
        if (candidate.state != LocalPurchaseState.PURCHASED
            || candidate.purchaseToken.isBlank()
            || candidate.productIds.isEmpty()
            || municipalityIbges.size > 2
            || municipalityIbges.size != municipalityIbges.toSet().size
            || municipalityIbges.any { RioMunicipalities.byIbgeCode(it) == null }
        ) {
            callback(DashboardDataNetworkResult.Unavailable)
            return
        }
        executor.execute {
            callback(
                runCatching { fetchBlocking(candidate, municipalityIbges) }
                    .getOrDefault(DashboardDataNetworkResult.Unavailable),
            )
        }
    }

    private fun fetchBlocking(
        candidate: PlayPurchaseCandidate,
        municipalityIbges: List<Int>,
    ): DashboardDataNetworkResult {
        val bearer = if (BuildConfig.BLAISE_SUBSCRIBER_AUTH_ENABLED)
            FirebaseSubscriberAccess.authorizationHeader() ?: return DashboardDataNetworkResult.Unavailable else null
        val connection = endpointUrl.openConnection() as? HttpURLConnection
            ?: return DashboardDataNetworkResult.Unavailable
        return try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.connectTimeout = 7_000
            connection.readTimeout = 7_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            if (bearer != null) connection.setRequestProperty("Authorization", bearer)

            val request = JSONObject()
                .put("packageName", packageName)
                .put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds))
            if (municipalityIbges.isNotEmpty())
                request.put("municipalityIbges", JSONArray(municipalityIbges))
            val payload = request.toString().toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(payload.size)
            connection.outputStream.use { it.write(payload) }

            when (connection.responseCode) {
                HttpURLConnection.HTTP_FORBIDDEN -> DashboardDataNetworkResult.Denied
                HttpURLConnection.HTTP_OK -> {
                    val body = readBoundedUtf8(connection) ?: return DashboardDataNetworkResult.Unavailable
                    val json = runCatching { JSONObject(body) }.getOrNull()
                        ?: return DashboardDataNetworkResult.Unavailable
                    val snapshot = runCatching { DashboardDataParser.parse(jsonObjectToMap(json)) }.getOrNull()
                        ?: return DashboardDataNetworkResult.Unavailable
                    DashboardDataNetworkResult.Available(snapshot)
                }
                else -> DashboardDataNetworkResult.Unavailable
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedUtf8(connection: HttpURLConnection): String? {
        val output = ByteArrayOutputStream()
        connection.inputStream.use { input ->
            val buffer = ByteArray(8_192)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                if (output.size() + read > DASHBOARD_DATA_MAX_RESPONSE_BYTES) return null
                output.write(buffer, 0, read)
            }
        }
        return output.toByteArray().toString(Charsets.UTF_8)
    }

    private fun jsonObjectToMap(value: JSONObject): Map<String, Any?> {
        val result = LinkedHashMap<String, Any?>()
        val keys = value.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            result[key] = jsonValue(value.get(key))
        }
        return result
    }

    private fun jsonArrayToList(value: JSONArray): List<Any?> =
        (0 until value.length()).map { index -> jsonValue(value.get(index)) }

    private fun jsonValue(value: Any?): Any? = when (value) {
        null, JSONObject.NULL -> null
        is JSONObject -> jsonObjectToMap(value)
        is JSONArray -> jsonArrayToList(value)
        else -> value
    }

    companion object {
        private val sharedExecutor = Executors.newCachedThreadPool { runnable ->
            Thread(runnable, "blaise-dashboard-data-client").apply { isDaemon = true }
        }

        fun create(
            entitlementVerifierEndpoint: String,
            packageName: String,
            executor: Executor = sharedExecutor,
        ): DashboardDataHttpsClient? {
            val endpoint = DashboardDataEndpointPolicy.deriveFromEntitlementVerifier(entitlementVerifierEndpoint)
                ?: return null
            if (packageName.isBlank()) return null
            return DashboardDataHttpsClient(endpoint, packageName, executor)
        }
    }
}
