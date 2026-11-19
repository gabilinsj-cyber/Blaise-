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
    val noaaWaveHeightM: Double? = null,
    val noaaWaveValidAt: Instant? = null,
    val metNorwayValidAt: Instant? = null,
    val providerCreditBalanceVerified: Boolean = false,
    val visualCrossingIbge: String = "3304557",
    val visualCrossingStatus: String = "INDISPONIVEL",
    val visualCrossingValidAt: Instant? = null,
    val visualCrossingCheckedAt: Instant? = null,
    val visualCrossingCurrentFields: List<AdminMeteorologicalMemoryField> = emptyList(),
    val visualCrossingForecastSlots: Int = 0,
    val visualCrossingAttribution: String = "Weather data by Visual Crossing",
) {
    fun visualCrossingReadable(now: Instant): Boolean {
        val age=Duration.between(evaluatedAt, now).seconds
        val validAt=visualCrossingValidAt ?: return false
        val checkedAt=visualCrossingCheckedAt ?: return false
        val observedAge=Duration.between(validAt,now).seconds
        val readAge=Duration.between(checkedAt,now).seconds
        return visualCrossingStatus=="PRIVATE_CACHE_VALID" &&
            age in 0L..180L && readAge in 0L..1800L &&
            observedAge in 0L..1800L && visualCrossingCurrentFields.isNotEmpty()
    }
    fun noaaWaveReadable(now: Instant): Boolean {
        val age=Duration.between(evaluatedAt,now).seconds
        val waveAt=noaaWaveValidAt ?: return false
        val waveAge=Duration.between(waveAt,now).seconds
        return age in 0L..180L && waveAge in 0L..3600L &&
            noaaWaveHeightM?.isFinite()==true && noaaWaveHeightM in 0.0..35.0
    }
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
                val n = (r.get("value") as? Number)?.toDouble()
                    ?: throw IllegalArgumentException("non_numeric_forecast_value")
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
            "OPENWEATHER_AGENT13","HG_BRASIL_WEATHER_PRO","ANA_RIVER","SGB_SACE",
            "VISUAL_CROSSING_FREE"
        )
        val sourceStates=mutableListOf<Pair<String,String>>()
        for (i in 0 until sourcesJson.length()){
            val item=sourcesJson.getJSONObject(i)
            require(item.getString("id") in allowedSources)
            require(!item.getBoolean("clientPublished"))
            val status=item.getString("state")
            require(status in setOf("UNVERIFIED_CURRENT_CACHE","NOT_CONTRACTED",
                "INDISPONIVEL","PRIVATE_CACHE_VALID","NOT_YET_VALIDATED",
                "PRIVATE_ONE_SHOT_AUDITED_NO_CURRENT_CACHE"))
            sourceStates+=item.getString("label").take(80) to status
        }
        val noaa=json.optJSONObject("privateNoaaWave")
        var noaaHeight:Double?=null
        var noaaValid:Instant?=null
        if(noaa!=null){
            require(noaa.getString("sourceId")=="NOAA_GFS_WAVE")
            require(noaa.getString("kind")=="P")
            require(!noaa.getBoolean("physicalObservation"))
            require(!noaa.getBoolean("publishedToSubscriber"))
            require(noaa.getString("status") in setOf("INDISPONIVEL","PRIVATE_CACHE_VALID"))
            if(noaa.getString("status")=="PRIVATE_CACHE_VALID"){
                val v=(noaa.get("waveHeightM") as? Number)?.toDouble()
                    ?: throw IllegalArgumentException("invalid_wave_value")
                require(v.isFinite() && v in 0.0..35.0 && noaa.getString("unit")=="m")
                noaaHeight=v
                noaaValid=Instant.parse(noaa.getString("validAt"))
            }
        }
        val met=json.optJSONObject("privateMetNorway")
        var metValid:Instant?=null
        if(met!=null){
            require(met.getString("sourceId")=="ECMWF_IFS")
            require(met.getString("kind")=="P")
            require(!met.getBoolean("officialObservation"))
            require(!met.getBoolean("publishedToSubscriber"))
            require(met.getString("status") in setOf("INDISPONIVEL","PRIVATE_CACHE_VALID"))
            if(met.getString("status")=="PRIVATE_CACHE_VALID")
                metValid=Instant.parse(met.getString("validAt"))
        }
        var vcCity="3304557"
        var vcState="INDISPONIVEL"
        var vcCurrentAt:Instant?=null
        var vcCheckedAt:Instant?=null
        val vcFields=mutableListOf<AdminMeteorologicalMemoryField>()
        var vcSlots=0
        val visualCrossing=json.optJSONObject("privateVisualCrossing")
        if(visualCrossing!=null){
            require(visualCrossing.getString("sourceId")=="VISUAL_CROSSING_FREE")
            vcCity=visualCrossing.getString("ibge")
            require(vcCity.matches(Regex("[0-9]{7}")))
            vcState=visualCrossing.getString("status")
            require(vcState in setOf("INDISPONIVEL","PRIVATE_CACHE_VALID"))
            require(!visualCrossing.getBoolean("publishedToSubscribers"))
            require(!visualCrossing.getBoolean("providerBalanceVerified"))
            if(vcState=="PRIVATE_CACHE_VALID") {
                vcCheckedAt=Instant.parse(visualCrossing.getString("checkedAt"))
                vcCurrentAt=visualCrossing.optString("validAt").takeIf{
                    it.isNotBlank()&&it!="null"
                }?.let(Instant::parse)
                val available=visualCrossing.getJSONArray("fields")
                require(available.length()<=10)
                val permitted=mapOf(
                    "temperatureC" to ("°C" to (-40.0..60.0)),
                    "feelsLikeC" to ("°C" to (-60.0..70.0)),
                    "relativeHumidityPct" to ("%" to (0.0..100.0)),
                    "dewPointC" to ("°C" to (-60.0..60.0)),
                    "windSpeedKmh" to ("km/h" to (0.0..350.0)),
                    "windGustKmh" to ("km/h" to (0.0..450.0)),
                    "precipitationMm" to ("mm" to (0.0..500.0)),
                    "precipitationProbabilityPct" to ("%" to (0.0..100.0)),
                    "pressureHpa" to ("hPa" to (800.0..1100.0)),
                    "severeRiskIndex" to ("index 0-100" to (0.0..100.0))
                )
                val seenVc=mutableSetOf<String>()
                for(i in 0 until available.length()){
                    val field=available.getJSONObject(i)
                    val id=field.getString("field")
                    val rule=permitted[id] ?: throw IllegalArgumentException("unexpected_vc_field")
                    require(seenVc.add(id) && field.getString("kind")=="E" &&
                        field.getString("unit")==rule.first)
                    val value=(field.get("value") as? Number)?.toDouble()
                        ?: throw IllegalArgumentException("invalid_vc_value")
                    require(value.isFinite() && value in rule.second)
                    vcFields += AdminMeteorologicalMemoryField(id,id,value,rule.first)
                }
                val forecast=visualCrossing.getJSONArray("forecast")
                require(forecast.length()<=36)
                for(i in 0 until forecast.length()){
                    val slot=forecast.getJSONObject(i)
                    require(slot.getString("kind")=="P")
                    val time=Instant.parse(slot.getString("validAt"))
                    require(time.isAfter(evaluatedAt.minusSeconds(1)))
                    vcSlots++
                }
                require(visualCrossing.getString("attribution")=="Weather data by Visual Crossing")
            }
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
            reservedCallsToday=ledger?.optInt("callsReservedToday",-1)?.takeIf{it>=0},
            noaaWaveHeightM=noaaHeight,
            noaaWaveValidAt=noaaValid,
            metNorwayValidAt=metValid,
            visualCrossingIbge=vcCity,
            visualCrossingStatus=vcState,
            visualCrossingValidAt=vcCurrentAt,
            visualCrossingCheckedAt=vcCheckedAt,
            visualCrossingCurrentFields=vcFields,
            visualCrossingForecastSlots=vcSlots
        )
    }

    fun fetch(endpoint: String, idToken: String,
        ibge: String = "3304557",
        onResult: (AdminMeteorologicalMemorySnapshot?) -> Unit) {
        if (!endpoint.startsWith("https://") || idToken.isBlank() ||
            !ibge.matches(Regex("[0-9]{7}"))) {
            onResult(null)
            return
        }
        thread(name="blaise-admin-memory-read", isDaemon=true) {
            val result=runCatching {
                val c=URL("$endpoint?ibge=$ibge").openConnection() as HttpURLConnection
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
