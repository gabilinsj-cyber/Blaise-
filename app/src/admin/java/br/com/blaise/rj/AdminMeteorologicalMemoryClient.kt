package br.com.blaise.rj

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Duration
import java.time.Instant
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Admin APK only. GETs read-only cache status through the allowlisted,
 * Firebase-authenticated scientific backend. Never contacts meteoblue.
 * A failed request returns UNAVAILABLE; no fake fields or observations.
 */
data class AdminMeteorologicalMemorySnapshot(
    val evaluatedAt: Instant,
    val cacheState: String,
    val forecastValidAt: Instant?,
    val modelRun: Instant?,
    val fields: List<AdminMeteorologicalMemoryField>,
    val sourceStates: List<Pair<String,String>>,
    val localCreditsReserved: Int?,
    val reservedCallsToday: Int?,
    val providerCreditBalanceVerified: Boolean = false,
) {
    fun readable(now: Instant): Boolean {
        val age = Duration.between(evaluatedAt, now).seconds
        return age in 0L..180L && cacheState == "PRIVATE_CACHE_VALID" &&
            forecastValidAt != null &&
            Duration.between(now, forecastValidAt).seconds in 0L..21600L &&
            fields.size == 7
    }
}
data class AdminMeteorologicalMemoryField(
    val jsonKey: String,
    val label: String,
    val value: Double,
    val unit: String,
) {
    fun description(): String = label + ": " +
        String.format(Locale("pt", "BR"), "%.2f", value) + " " + unit
}

object AdminMeteorologicalMemoryClient {
    private const val PATH = "/v1/admin/meteorological-memory"
    private const val VERIFY_PATH = "/v1/entitlements/verify"

    fun endpointFromVerifier(raw: String): String? = runCatching {
        val uri = URI(raw.trim())
        require(uri.scheme.equals("https", ignoreCase = true))
        require(uri.host != null && uri.userInfo == null &&
            uri.rawQuery == null && uri.rawFragment == null &&
            uri.path == VERIFY_PATH)
        URI("https", null, uri.host, uri.port, PATH, null, null).toString()
    }.getOrNull()

    fun parse(json: JSONObject): AdminMeteorologicalMemorySnapshot {
        require(json.getString("contract") == "RJ_ADMIN_METEOROLOGICAL_MEMORY_V1")
        require(json.getString("scope") == "ADMIN_ONLY")
        require(!json.getBoolean("pollingWeatherProviders"))
        require(!json.getBoolean("clientPublishingEnabled"))
        require(!json.getBoolean("currentObservationsClaimed"))
        val evaluatedAt = Instant.parse(json.getString("evaluatedAt"))
        val privateMb = json.getJSONObject("privateMeteoblue")
        require(privateMb.getString("sourceId") == "METEOBLUE_FREE_FORECAST")
        require(privateMb.getString("kind") == "P")
        require(privateMb.getBoolean("privateOnly"))
        val state = privateMb.getString("status")
        require(state == "INDISPONIVEL" || state == "PRIVATE_CACHE_VALID")
        val defs = AdminCollectorReadiness.meteoblueFieldAudit
        val fields = mutableListOf<AdminMeteorologicalMemoryField>()
        if (state == "PRIVATE_CACHE_VALID") {
            val values = privateMb.getJSONArray("fields")
            require(values.length() == 7)
            val allowed = defs.associateBy { it.label }
            val mapping = defs.associateBy {
                when (it.jsonKey) {
                    "precipitation" -> "forecastPrecipitationSixHourMm"
                    "convective_precipitation" -> "forecastConvectivePrecipitationSixHourMm"
                    "precipitation_probability" -> "forecastPrecipitationProbabilitySixHourPct"
                    "windspeed_mean" -> "forecastWindMeanSixHourKmh"
                    "windspeed_max" -> "forecastWindMaxSixHourKmh"
                    "relativehumidity_mean" -> "forecastHumidityMeanSixHourPct"
                    else -> "forecastSeaLevelPressureMeanSixHourHpa"
                }
            }
            val seen = mutableSetOf<String>()
            for (i in 0 until values.length()) {
                val r = values.getJSONObject(i)
                val id = r.getString("field")
                val def = mapping[id] ?: throw IllegalArgumentException("unrecognized_forecast_field")
                require(seen.add(id) && r.getString("kind") == "P" &&
                    r.getString("unit") == def.unit)
                val n = r.getDouble("value")
                val range = when(def.jsonKey) {
                    "precipitation", "convective_precipitation" -> 0.0..500.0
                    "precipitation_probability", "relativehumidity_mean" -> 0.0..100.0
                    "windspeed_mean", "windspeed_max" -> 0.0..400.0
                    else -> 800.0..1100.0
                }
                require(n.isFinite() && n in range)
                fields += AdminMeteorologicalMemoryField(def.jsonKey, def.label, n, def.unit)
            }
            require(seen.size == 7)
        } else require(privateMb.getJSONArray("fields").length() == 0)

        val sourcesJson = json.getJSONArray("sources")
        require(sourcesJson.length() in 1..20)
        val allowedSources = setOf(
            "METEOBLUE_FREE_FORECAST","DWD_ICON_GLOBAL","ECMWF_IFS","NOAA_GFS",
            "NOAA_GFS_WAVE","NOAA_COASTWATCH_SST","NOAA_GLM",
            "OPENWEATHER_AGENT13","HG_BRASIL_WEATHER_PRO","ANA_RIVER","SGB_SACE"
        )
        val sourceStates=mutableListOf<Pair<String,String>>()
        for (i in 0 until sourcesJson.length()){
            val item=sourcesJson.getJSONObject(i)
            require(item.getString("id") in allowedSources)
            require(!item.getBoolean("clientPublished"))
            val status=item.getString("state")
            require(status in setOf("UNVERIFIED_CURRENT_CACHE","NOT_CONTRACTED",
                "INDISPONIVEL","PRIVATE_CACHE_VALID"))
            sourceStates+=item.getString("label").take(80) to status
        }
        val ledger=json.optJSONObject("quotaLedger")
        return AdminMeteorologicalMemorySnapshot(
            evaluatedAt=evaluatedAt,
            cacheState=state,
            forecastValidAt=privateMb.optString("forecastValidAt").takeIf{
                it.isNotBlank() && it!="null" }?.let(Instant::parse),
            modelRun=privateMb.optString("modelRun").takeIf{
                it.isNotBlank() && it!="null" }?.let(Instant::parse),
            fields=fields,
            sourceStates=sourceStates,
            localCreditsReserved=ledger?.optInt("localSpentCredits", -1)?.takeIf{it>=0},
            reservedCallsToday=ledger?.optInt("callsReservedToday",-1)?.takeIf{it>=0}
        )
    }

    fun fetch(endpoint: String, idToken: String, onResult: (AdminMeteorologicalMemorySnapshot?) -> Unit) {
        if (!endpoint.startsWith("https://") || idToken.isBlank()) {
            onResult(null)
            return
        }
        thread(name="blaise-admin-memory-read", isDaemon=true) {
            val result=runCatching {
                val c=URL(endpoint).openConnection() as HttpURLConnection
                try {
                    c.instanceFollowRedirects=false
                    c.requestMethod="GET"
                    c.connectTimeout=5000
                    c.readTimeout=5000
                    c.setRequestProperty("Authorization","Bearer $idToken")
                    c.setRequestProperty("Accept","application/json")
                    c.setRequestProperty("Cache-Control","no-store")
                    require(c.responseCode==200)
                    val bytes=ByteArrayOutputStream()
                    c.inputStream.use { input ->
                        val buf=ByteArray(4096)
                        while(true){
                            val read=input.read(buf)
                            if(read<0)break
                            require(bytes.size()+read <= 32768)
                            bytes.write(buf,0,read)
                        }
                    }
                    parse(JSONObject(bytes.toString("UTF-8")))
                } finally { c.disconnect() }
            }.getOrNull()
            onResult(result)
        }
    }
}
