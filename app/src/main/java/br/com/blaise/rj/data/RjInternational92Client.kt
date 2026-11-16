package br.com.blaise.rj.data

import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import br.com.blaise.rj.cities.RioMunicipalities
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant

const val RJ_INTL_92_PATH = "/v1/data/international-weather"
const val RJ_INTL_92_CONTRACT = "BLAISE_RJ_INTERNATIONAL_92_V1"

data class RjInternationalWeather(
    val ibge: Int,
    val source: String,
    val sourceUrl: String,
    val validAt: Instant,
    val latitude: Double,
    val longitude: Double,
    val temperatureC: Double,
    val feelsLikeC: Double?,
    val humidityPct: Double?,
    val windKmh: Double?,
    val gustKmh: Double?,
    val rainMm1h: Double?,
    val pressureHpa: Double?,
) {
    fun current(now: Instant): Boolean =
        !validAt.isAfter(now.plusSeconds(60)) &&
        Duration.between(validAt, now).seconds in 0..1800 &&
        source == "OpenWeather One Call 4.0"
}

data class RjInternational92Snapshot(
    val generatedAt: Instant,
    val values: Map<Int, RjInternationalWeather>,
) {
    fun current(now: Instant): Boolean =
        !generatedAt.isAfter(now.plusSeconds(60)) &&
        Duration.between(generatedAt, now).seconds in 0..120
    fun municipality(ibge: Int, now: Instant) =
        values[ibge]?.takeIf { current(now) && it.current(now) }
}

object RjInternational92Parser {
    private fun optionalNumber(row: JSONObject, key: String, low: Double, high: Double): Double? =
        if (row.isNull(key) || !row.has(key)) null
        else row.optDouble(key, Double.NaN).takeIf { it.isFinite() && it in low..high }

    fun parse(root: JSONObject): RjInternational92Snapshot {
        require(root.getString("contract") == RJ_INTL_92_CONTRACT)
        require(root.getString("scope") == "RJ_92_MUNICIPALITIES")
        require(root.getString("sourceNature") == "PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_OBSERVATION")
        require(!root.getBoolean("radarAvailable") && !root.getBoolean("warningsIssuedByThisFeed"))
        require(root.getInt("totalMunicipalities") == 92)
        val cities = root.getJSONArray("municipalities")
        require(cities.length() == 92)
        val found = mutableSetOf<Int>()
        val readings = mutableMapOf<Int,RjInternationalWeather>()
        for (index in 0 until cities.length()) {
            val city = cities.getJSONObject(index)
            val ibge = city.getString("ibge").toInt()
            require(found.add(ibge))
            require(RioMunicipalities.byIbgeCode(ibge)?.name == city.getString("name"))
            val status = city.getString("status")
            require(status in setOf("CURRENT_MODELED_ESTIMATE", "NO_CURRENT_INTERNATIONAL_DATA"))
            if (status == "NO_CURRENT_INTERNATIONAL_DATA") {
                require(city.isNull("weather"))
                continue
            }
            val item = city.getJSONObject("weather")
            require(item.getString("sourceId") == "OPENWEATHER_ONECALL4_CURRENT")
            require(item.getString("sourceName") == "OpenWeather One Call 4.0")
            require(item.getString("type") == "MODELED_CURRENT_ESTIMATE")
            require(item.getString("sourceUrl") == "https://openweathermap.org/api/one-call-4")
            val locLat = item.getDouble("latitude")
            val locLon = item.getDouble("longitude")
            require(locLat in -23.37..-20.75 && locLon in -44.9..-40.9)
            val numbers = item.getJSONObject("values")
            val temp = optionalNumber(numbers, "temperatureC", -60.0, 65.0)
            require(temp != null)
            readings[ibge] = RjInternationalWeather(
                ibge, item.getString("sourceName"), item.getString("sourceUrl"),
                Instant.parse(item.getString("validAt")),
                locLat, locLon, temp,
                optionalNumber(numbers,"feelsLikeC",-80.0,80.0),
                optionalNumber(numbers,"humidityPct",0.0,100.0),
                optionalNumber(numbers,"windKmh",0.0,400.0),
                optionalNumber(numbers,"gustKmh",0.0,500.0),
                optionalNumber(numbers,"rainMm1h",0.0,500.0),
                optionalNumber(numbers,"pressureHpa",800.0,1150.0),
            )
        }
        require(readings.size == root.getInt("currentMunicipalities"))
        return RjInternational92Snapshot(Instant.parse(root.getString("generatedAt")), readings.toMap())
    }
}

/**
 * Read-only, entitlement-protected client to Blaise's own backend.
 * No direct OpenWeather call, no API key in the APK, and no user GPS.
 */
class RjInternational92Client private constructor(private val endpoint: URI, private val packageName: String) {
    suspend fun fetch(candidate: PlayPurchaseCandidate): RjInternational92Snapshot? =
        withContext(Dispatchers.IO) {
            if (candidate.state != LocalPurchaseState.PURCHASED ||
                candidate.purchaseToken.isBlank() || candidate.productIds.isEmpty())
                return@withContext null
            runCatching {
                val connection = endpoint.toURL().openConnection() as HttpURLConnection
                try {
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "POST"
                    connection.doOutput = true
                    connection.connectTimeout = 7000
                    connection.readTimeout = 7000
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    connection.setRequestProperty("Accept", "application/json")
                    val request = JSONObject().put("packageName", packageName)
                        .put("purchaseToken", candidate.purchaseToken)
                        .put("productIds", JSONArray(candidate.productIds))
                        .toString().toByteArray(Charsets.UTF_8)
                    connection.setFixedLengthStreamingMode(request.size)
                    connection.outputStream.use { it.write(request) }
                    if (connection.responseCode != 200) return@runCatching null
                    val bytes = java.io.ByteArrayOutputStream()
                    connection.inputStream.use { input ->
                        val buffer = ByteArray(8192)
                        while (true) {
                            val length = input.read(buffer)
                            if (length < 0) break
                            require(bytes.size() + length <= 128*1024)
                            bytes.write(buffer,0,length)
                        }
                    }
                    RjInternational92Parser.parse(JSONObject(bytes.toString(Charsets.UTF_8)))
                } finally {
                    connection.disconnect()
                }
            }.getOrNull()
        }

    companion object {
        fun create(verifier: String, packageName: String): RjInternational92Client? {
            val existing = DashboardDataEndpointPolicy.deriveFromEntitlementVerifier(verifier)
                ?.let(::URI) ?: return null
            if (packageName.isBlank()) return null
            return RjInternational92Client(
                URI("https", null, existing.host, existing.port, RJ_INTL_92_PATH, null, null),packageName
            )
        }
    }
}
