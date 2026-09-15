package br.com.blaise.rj.data

import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
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

data class DashboardDataSnapshot(
    val generatedAt: Instant,
    val mode: String,
    val sourceCount: Int,
    val currentSourceCount: Int,
    val rainfall: DashboardRainfallSummary,
    val sources: List<DashboardOfficialSourceState>,
)

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
        require(payload.keys == topLevelKeys)
        require(payload["contract"] == DASHBOARD_DATA_CONTRACT)
        require(payload["scope"] == "RJ_OFFICIAL_SOURCES_WITH_RIO_CITY_RAINFALL")

        val generatedAt = instant(payload["generatedAt"])
        val mode = string(payload["mode"], 3, 16)
        require(mode == "normal" || mode == "severe")
        val sourceCount = boundedInt(payload["sourceCount"], 1, 64)
        val currentSourceCount = boundedInt(payload["currentSourceCount"], 1, sourceCount)

        val rainfallMap = stringMap(payload["rainfall"])
        require(rainfallMap.keys == rainfallKeys)
        require(rainfallMap["sourceId"] == DASHBOARD_DATA_RAINFALL_SOURCE_ID)
        require(rainfallMap["coverage"] == DASHBOARD_DATA_RAINFALL_COVERAGE)
        val rainfallState = string(rainfallMap["state"], 3, 32)
        require(rainfallState == "CURRENT" || rainfallState == "CURRENT_DEGRADED")
        string(rainfallMap["reason"], 1, 96)
        val stationCount = boundedInt(rainfallMap["stationCount"], DASHBOARD_DATA_ALERTA_RIO_STATION_COUNT, DASHBOARD_DATA_ALERTA_RIO_STATION_COUNT)
        val wetStationCount = boundedInt(rainfallMap["wetStationCount"], 0, stationCount)
        val missingValueCount = nullableBoundedInt(rainfallMap["missingValueCount"], 0, stationCount * 14)
        val rainfall = DashboardRainfallSummary(
            state = rainfallState,
            observedAt = instant(rainfallMap["observedAt"]),
            fetchedAt = nullableInstant(rainfallMap["fetchedAt"]),
            stationCount = stationCount,
            wetStationCount = wetStationCount,
            missingValueCount = missingValueCount,
            max15mMm = nullableRainMm(rainfallMap["max15mMm"]),
            max1hMm = nullableRainMm(rainfallMap["max1hMm"]),
            max24hMm = nullableRainMm(rainfallMap["max24hMm"]),
        )

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

        val privacy = stringMap(payload["privacy"])
        require(privacy.keys == privacyKeys)
        require(privacy["purchaseTokenExposed"] == false)
        require(privacy["rawStationPayloadExposed"] == false)
        require(privacy["userLocationStored"] == false)

        return DashboardDataSnapshot(
            generatedAt = generatedAt,
            mode = mode,
            sourceCount = sourceCount,
            currentSourceCount = currentSourceCount,
            rainfall = rainfall,
            sources = sources,
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

    fun fetch(candidate: PlayPurchaseCandidate, callback: (DashboardDataNetworkResult) -> Unit) {
        if (candidate.state != LocalPurchaseState.PURCHASED
            || candidate.purchaseToken.isBlank()
            || candidate.productIds.isEmpty()
        ) {
            callback(DashboardDataNetworkResult.Unavailable)
            return
        }
        executor.execute {
            callback(
                runCatching { fetchBlocking(candidate) }
                    .getOrDefault(DashboardDataNetworkResult.Unavailable),
            )
        }
    }

    private fun fetchBlocking(candidate: PlayPurchaseCandidate): DashboardDataNetworkResult {
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

            val payload = JSONObject()
                .put("packageName", packageName)
                .put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds))
                .toString()
                .toByteArray(Charsets.UTF_8)
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
