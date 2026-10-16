package br.com.blaise.rj.data

import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.Executor
import java.util.concurrent.Executors

const val CHM_TIDE_PAID_HTTPS_PATH = "/v1/data/chm/tide"
const val CHM_TIDE_ENTITLEMENT_VERIFY_PATH = "/v1/entitlements/verify"
const val CHM_TIDE_MAX_RESPONSE_BYTES = 1_100_000

object ChmTideEndpointPolicy {
    fun deriveFromEntitlementVerifier(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) return null
        if (uri.userInfo != null || uri.rawQuery != null || uri.rawFragment != null) return null
        if (uri.path != CHM_TIDE_ENTITLEMENT_VERIFY_PATH) return null
        return runCatching {
            URI("https", null, uri.host, uri.port, CHM_TIDE_PAID_HTTPS_PATH, null, null).toString()
        }.getOrNull()
    }
}

sealed interface ChmTideNetworkResult {
    data class Available(val delivery: ChmTideDelivery) : ChmTideNetworkResult
    data object Denied : ChmTideNetworkResult
    data object Unavailable : ChmTideNetworkResult
}

class ChmTideHttpsClient private constructor(
    endpoint: String,
    private val packageName: String,
    private val executor: Executor,
) {
    private val endpointUrl = URL(endpoint)

    fun fetch(
        candidate: PlayPurchaseCandidate,
        stationNumber: Int,
        calendarYear: Int,
        callback: (ChmTideNetworkResult) -> Unit,
    ) {
        if (candidate.state != LocalPurchaseState.PURCHASED ||
            candidate.purchaseToken.isBlank() ||
            candidate.productIds.isEmpty() ||
            stationNumber !in 1..99 ||
            calendarYear !in 2020..2100
        ) {
            callback(ChmTideNetworkResult.Unavailable)
            return
        }
        executor.execute {
            callback(
                runCatching { fetchBlocking(candidate, stationNumber, calendarYear) }
                    .getOrDefault(ChmTideNetworkResult.Unavailable),
            )
        }
    }

    private fun fetchBlocking(
        candidate: PlayPurchaseCandidate,
        stationNumber: Int,
        calendarYear: Int,
    ): ChmTideNetworkResult {
        val connection = endpointUrl.openConnection() as? HttpURLConnection
            ?: return ChmTideNetworkResult.Unavailable
        return try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.connectTimeout = 7_000
            connection.readTimeout = 7_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")

            val payload = JSONObject()
                .put("packageName", packageName)
                .put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds))
                .put("stationNumber", stationNumber)
                .put("calendarYear", calendarYear)
                .toString()
                .toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(payload.size)
            connection.outputStream.use { it.write(payload) }

            when (connection.responseCode) {
                HttpURLConnection.HTTP_FORBIDDEN -> ChmTideNetworkResult.Denied
                HttpURLConnection.HTTP_OK -> {
                    val body = readBoundedUtf8(connection) ?: return ChmTideNetworkResult.Unavailable
                    val json = runCatching { JSONObject(body) }.getOrNull()
                        ?: return ChmTideNetworkResult.Unavailable
                    val map = jsonObjectToMap(json)
                    val delivery = runCatching {
                        ChmTideDeliveryParser.parse(
                            map,
                            expectedStationNumber = stationNumber,
                            expectedCalendarYear = calendarYear,
                        )
                    }.getOrNull() ?: return ChmTideNetworkResult.Unavailable
                    ChmTideNetworkResult.Available(delivery)
                }
                else -> ChmTideNetworkResult.Unavailable
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
                if (output.size() + read > CHM_TIDE_MAX_RESPONSE_BYTES) return null
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
            Thread(runnable, "blaise-chm-tide-client").apply { isDaemon = true }
        }

        fun create(
            entitlementVerifierEndpoint: String,
            packageName: String,
            executor: Executor = sharedExecutor,
        ): ChmTideHttpsClient? {
            val endpoint = ChmTideEndpointPolicy.deriveFromEntitlementVerifier(entitlementVerifierEndpoint)
                ?: return null
            if (packageName.isBlank()) return null
            return ChmTideHttpsClient(endpoint, packageName, executor)
        }
    }
}
