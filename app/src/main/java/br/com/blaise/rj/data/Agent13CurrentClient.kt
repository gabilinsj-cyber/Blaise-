package br.com.blaise.rj.data

import br.com.blaise.rj.BuildConfig
import br.com.blaise.rj.billing.FirebaseSubscriberAccess
import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.Executor
import java.util.concurrent.Executors

const val AGENT13_PAID_CURRENT_PATH = "/v1/data/agent13/current"
const val AGENT13_CURRENT_CONTRACT = "BLAISE_RJ_AGENT13_PAID_CURRENT_V1"
private const val AGENT13_MAX_BYTES = 16 * 1024

/**
 * OpenWeather modeled estimate is never a station observation or an official
 * meteorological alert. It may only be shown up to 12 minutes after validAt.
 */
data class Agent13CurrentEstimate(
    val municipalityIbge: Int,
    val validAt: Instant,
    val retrievedAt: Instant,
    val temperatureC: Double,
    val feelsLikeC: Double?,
    val humidityPercent: Double?,
    val windKmh: Double?,
    val gustKmh: Double?,
    val rainMm1h: Double?,
) {
    fun current(now: Instant): Boolean {
        val age = Duration.between(validAt, now).toMillis()
        val fetchedAge = Duration.between(retrievedAt, now).toMillis()
        return age in 0..(12 * 60_000L) && fetchedAge in 0..(12 * 60_000L)
    }

    fun summary(now: Instant): String {
        if (!current(now)) return "Estimativa vencida ou indisponível."
        fun display(value: Double?, unit: String): String =
            value?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f %s", it, unit) } ?: "indisponível"
        val brasilia = DateTimeFormatter.ofPattern("dd/MM HH:mm")
            .withZone(ZoneId.of("America/Sao_Paulo")).format(validAt)
        return "Estimativa de modelo: temperatura ${display(temperatureC, "°C")}, " +
            "sensação ${display(feelsLikeC, "°C")}, umidade ${display(humidityPercent, "%")}, " +
            "vento ${display(windKmh, "km/h")}, chuva 1h ${display(rainMm1h, "mm")}. " +
            "Fonte: OpenWeather One Call 4.0 • $brasilia (Brasília). Não é medição de estação."
    }
}

sealed interface Agent13CurrentResult {
    data class Available(val estimate: Agent13CurrentEstimate) : Agent13CurrentResult
    data object Loading : Agent13CurrentResult
    data object Denied : Agent13CurrentResult
    data object Unavailable : Agent13CurrentResult
}

object Agent13CurrentParser {
    fun parse(json: JSONObject, expectedIbge: Int): Agent13CurrentEstimate {
        require(json.optString("contract") == AGENT13_CURRENT_CONTRACT)
        require(json.optString("status") == "CURRENT_ESTIMATE_AVAILABLE")
        require(json.optString("source") == "OpenWeather One Call 4.0")
        require(json.optString("sourceUrl") == "https://openweathermap.org/api/one-call-4")
        require(json.optString("nature") == "ESTIMATIVA_DE_MODELO")
        require(json.optBoolean("officialObservation", true) == false)
        require(json.optBoolean("officialAlert", true) == false)
        require(json.optInt("maximumAgeSeconds", -1) == 720)
        require(json.optString("ibge") == expectedIbge.toString())
        val privacy = json.getJSONObject("privacy")
        require(privacy.optBoolean("purchaseTokenExposed", true) == false)
        require(privacy.optBoolean("userLocationStored", true) == false)
        val values = json.getJSONObject("values")
        fun number(key: String, min: Double, max: Double): Double? {
            val raw = values.opt(key)
            if (raw == null || raw == JSONObject.NULL) return null
            val v = (raw as? Number)?.toDouble() ?: throw IllegalArgumentException("invalid_agent13_value")
            require(v.isFinite() && v in min..max)
            return v
        }
        return Agent13CurrentEstimate(
            municipalityIbge = expectedIbge,
            validAt = Instant.parse(json.getString("validAt")),
            retrievedAt = Instant.parse(json.getString("retrievedAt")),
            temperatureC = number("temperatureC", -60.0, 65.0)
                ?: throw IllegalArgumentException("missing_temperature"),
            feelsLikeC = number("feelsLikeC", -80.0, 80.0),
            humidityPercent = number("humidityPercent", 0.0, 100.0),
            windKmh = number("windKmh", 0.0, 400.0),
            gustKmh = number("gustKmh", 0.0, 504.0),
            rainMm1h = number("rainMm1h", 0.0, 500.0),
        )
    }
}

class Agent13CurrentHttpsClient private constructor(
    private val endpoint: URL,
    private val packageName: String,
    private val executor: Executor,
) {
    fun fetch(
        candidate: PlayPurchaseCandidate,
        municipalityIbge: Int,
        callback: (Agent13CurrentResult) -> Unit,
    ) {
        if (candidate.state != LocalPurchaseState.PURCHASED ||
            candidate.purchaseToken.isBlank() ||
            candidate.productIds.isEmpty()
        ) {
            callback(Agent13CurrentResult.Denied)
            return
        }
        executor.execute {
            callback(runCatching { fetchBlocking(candidate, municipalityIbge) }
                .getOrDefault(Agent13CurrentResult.Unavailable))
        }
    }

    private fun fetchBlocking(candidate: PlayPurchaseCandidate, municipalityIbge: Int): Agent13CurrentResult {
        val auth = if (BuildConfig.BLAISE_SUBSCRIBER_AUTH_ENABLED)
            FirebaseSubscriberAccess.authorizationHeader() ?: return Agent13CurrentResult.Unavailable
        else null
        val connection = endpoint.openConnection() as? HttpURLConnection
            ?: return Agent13CurrentResult.Unavailable
        return try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.connectTimeout = 7_000
            connection.readTimeout = 8_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            if (auth != null) connection.setRequestProperty("Authorization", auth)
            val body = JSONObject()
                .put("packageName", packageName)
                .put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds))
                .put("municipalityIbge", municipalityIbge)
                .toString().toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(body.size)
            connection.outputStream.use { it.write(body) }

            when (connection.responseCode) {
                HttpURLConnection.HTTP_FORBIDDEN, HttpURLConnection.HTTP_UNAUTHORIZED ->
                    Agent13CurrentResult.Denied
                HttpURLConnection.HTTP_OK -> {
                    val json = readJson(connection) ?: return Agent13CurrentResult.Unavailable
                    val estimate = runCatching {
                        Agent13CurrentParser.parse(json, municipalityIbge)
                    }.getOrNull() ?: return Agent13CurrentResult.Unavailable
                    if (estimate.current(Instant.now())) Agent13CurrentResult.Available(estimate)
                    else Agent13CurrentResult.Unavailable
                }
                else -> Agent13CurrentResult.Unavailable
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readJson(connection: HttpURLConnection): JSONObject? {
        val stream = ByteArrayOutputStream()
        connection.inputStream.use { input ->
            val buffer = ByteArray(4096)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                if (stream.size() + read > AGENT13_MAX_BYTES) return null
                stream.write(buffer, 0, read)
            }
        }
        return runCatching { JSONObject(stream.toByteArray().toString(Charsets.UTF_8)) }.getOrNull()
    }

    companion object {
        private val executor = Executors.newFixedThreadPool(2) { runnable ->
            Thread(runnable, "blaise-agent13-current").apply { isDaemon = true }
        }

        fun create(entitlementVerifierEndpoint: String, packageName: String): Agent13CurrentHttpsClient? {
            val uri = runCatching { URI(entitlementVerifierEndpoint.trim()) }.getOrNull() ?: return null
            if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank() ||
                uri.userInfo != null || uri.rawQuery != null || uri.rawFragment != null ||
                uri.path != DASHBOARD_DATA_ENTITLEMENT_VERIFY_PATH || packageName.isBlank()) return null
            val endpoint = runCatching {
                URI("https", null, uri.host, uri.port, AGENT13_PAID_CURRENT_PATH, null, null).toURL()
            }.getOrNull() ?: return null
            return Agent13CurrentHttpsClient(endpoint, packageName, executor)
        }
    }
}
