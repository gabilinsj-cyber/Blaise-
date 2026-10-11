package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Public RJ weather endpoint — disabled when no reviewed HTTPS service URL is configured. */
const val RJ_METEOROLOGY_PUBLIC_PATH = "/v1/public/rj-meteorology"
const val RJ_METEOROLOGY_PUBLIC_CONTRACT = "BLAISE_RJ_OFFICIAL_METEOROLOGY_V1"

enum class RjObservedVariable(val backendCode: String) {
    TEMPERATURE("TEMPERATURA_C"), HUMIDITY("UMIDADE_PERCENTUAL"),
    WIND("VENTO_KMH"), GUST("RAJADA_KMH"), RAIN_1H("CHUVA_MM_1H"),
}

data class RjOfficialStationMetric(
    val ibge: Int,
    val variable: RjObservedVariable,
    val value: Double,
    val unit: String,
    val sourceId: String,
    val stationId: String,
    val observedAt: Instant,
    val sourceUrl: String,
    val generatedAt: Instant,
) {
    fun current(now: Instant): Boolean {
        val age = Duration.between(observedAt, now).seconds
        val snapshotAge = Duration.between(generatedAt, now).seconds
        return age in 0..7200 && snapshotAge in 0..120 &&
            value.isFinite() && RioMunicipalities.byIbgeCode(ibge) != null &&
            sourceId == "INMET_STATION" && Regex("[A-Z][0-9]{3}").matches(stationId) &&
            sourceUrl.startsWith("https://apitempo.inmet.gov.br/estacao/")
    }
}

sealed interface RjMeteorologicalResult {
    data class Available(val reading: RjOfficialStationMetric) : RjMeteorologicalResult
    data object Unavailable : RjMeteorologicalResult
}

/**
 * Station observation only. INPE and Windy are forecasts with their own
 * separate provenance; they must NEVER become this object by JSON parsing.
 */
object RjMeteorologicalParser {
    fun parse(root: JSONObject, city: Int, variable: RjObservedVariable): RjOfficialStationMetric {
        require(root.getString("contract") == RJ_METEOROLOGY_PUBLIC_CONTRACT)
        require(root.getString("scope") == "RJ_MUNICIPAL_STATION_OR_MODEL_NOT_CITYWIDE_AVERAGE")
        require(root.getString("ibge") == city.toString())
        require(root.getString("variable") == variable.backendCode)
        require(root.getString("state") == "ONE_VERIFIED_OFFICIAL_SOURCE")
        require(root.getString("resultKind") == "OBSERVACAO_PONTUAL_OFICIAL_FONTE_UNICA")
        require(!root.getBoolean("isMunicipalAverage") && !root.getBoolean("warnsAutomatically"))
        require(root.getBoolean("weatherDataHasNotBeenSynthesized"))
        val sourceRows = root.getJSONArray("sourceRows")
        require(sourceRows.length() == 1)
        val row = sourceRows.getJSONObject(0)
        require(row.getString("dataType") == "OFFICIAL_STATION_OBSERVATION")
        val sourceId = row.getString("sourceId")
        require(sourceId == "INMET_STATION")
        val sourceUrl = row.getString("sourceUrl")
        require(sourceUrl.startsWith("https://apitempo.inmet.gov.br/estacao/"))
        val station = row.getString("stationId")
        val value = row.getDouble("value")
        val unit = row.getString("unit")
        val expectedUnit = when (variable) {
            RjObservedVariable.TEMPERATURE -> "°C"
            RjObservedVariable.HUMIDITY -> "%"
            RjObservedVariable.WIND, RjObservedVariable.GUST -> "km/h"
            RjObservedVariable.RAIN_1H -> "mm"
        }
        require(unit == expectedUnit)
        val validRange = when (variable) {
            RjObservedVariable.TEMPERATURE -> -30.0..60.0
            RjObservedVariable.HUMIDITY -> 0.0..100.0
            RjObservedVariable.WIND -> 0.0..400.0
            RjObservedVariable.GUST -> 0.0..450.0
            RjObservedVariable.RAIN_1H -> 0.0..400.0
        }
        require(value.isFinite() && value in validRange)
        require(root.getDouble("value") == value)
        return RjOfficialStationMetric(city, variable, value, unit, sourceId, station,
            Instant.parse(row.getString("observedAt")), sourceUrl,
            Instant.parse(root.getString("generatedAt")))
    }
}

class RjMeteorologicalHttpsClient private constructor(private val base: URI) {
    suspend fun fetch(ibge: Int, variable: RjObservedVariable): RjMeteorologicalResult =
        withContext(Dispatchers.IO) {
            try { fetchBlocking(ibge, variable) }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { RjMeteorologicalResult.Unavailable }
        }

    private fun fetchBlocking(ibge: Int, variable: RjObservedVariable): RjMeteorologicalResult {
        if (RioMunicipalities.byIbgeCode(ibge) == null) return RjMeteorologicalResult.Unavailable
        val query = "ibge=${ibge}&variable=${variable.backendCode}"
        val url = URI("https", null, base.host, base.port,
            RJ_METEOROLOGY_PUBLIC_PATH, query, null).toURL()
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 6_000
            conn.readTimeout = 6_000
            conn.requestMethod = "GET"
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Cache-Control", "no-store")
            if (conn.responseCode != 200) return RjMeteorologicalResult.Unavailable
            val output = java.io.ByteArrayOutputStream()
            conn.inputStream.use { stream ->
                val buffer = ByteArray(4096)
                while (true) {
                    val length = stream.read(buffer)
                    if (length < 0) break
                    require(output.size() + length <= 16 * 1024)
                    output.write(buffer, 0, length)
                }
            }
            val metric = RjMeteorologicalParser.parse(
                JSONObject(output.toString(Charsets.UTF_8.name())), ibge, variable)
            return if (metric.current(Instant.now())) RjMeteorologicalResult.Available(metric)
                else RjMeteorologicalResult.Unavailable
        } finally { conn.disconnect() }
    }

    companion object {
        fun create(baseUrl: String): RjMeteorologicalHttpsClient? = runCatching {
            val uri = URI(baseUrl.trim())
            require(uri.scheme == "https" && uri.host != null && uri.userInfo == null)
            require(uri.rawQuery == null && uri.rawFragment == null &&
                (uri.path == null || uri.path.isBlank() || uri.path == "/"))
            RjMeteorologicalHttpsClient(uri)
        }.getOrNull()
    }
}
