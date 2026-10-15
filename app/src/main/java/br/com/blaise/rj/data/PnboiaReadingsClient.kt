package br.com.blaise.rj.data

import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Values are obtained from Blaise's backend; the REMObs credential never enters the APK. */
data class PnboiaReading(val stationId: Int, val stationName: String, val variable: String,
    val value: Double, val unit: String, val observedAt: Instant,
    val latitude: Double, val longitude: Double, val qualityFlag: Int) {
    fun current(now: Instant): Boolean = stationId in 1..100 && stationName.isNotBlank() && stationName.length <= 160 &&
        latitude.isFinite() && longitude.isFinite() && latitude in -26.0..-20.0 && longitude in -45.5..-38.0 &&
        qualityFlag == 1 && Duration.between(observedAt, now).let { !it.isNegative && it <= Duration.ofMinutes(5) } &&
        value.isFinite() && when (variable) {
            "sig_wave_height" -> unit == "m" && value in 0.0..30.0
            "wind_speed" -> unit == "m/s" && value in 0.0..100.0
            else -> false
        }
}
data class PnboiaReadings(val state: String, val observations: List<PnboiaReading> = emptyList())
class PnboiaReadingsClient(baseUrl: String) {
    private val endpoint = runCatching {
        val base = URI(baseUrl.trim())
        require(base.scheme == "https" && base.host != null && base.userInfo == null && base.query == null && base.fragment == null)
        require(base.port == -1 || base.port == 443)
        URI("https", null, base.host, base.port, "/v1/public/rj/buoys", null, null)
    }.getOrNull()
    suspend fun fetch(): PnboiaReadings = withContext(Dispatchers.IO) {
        val uri = endpoint ?: return@withContext PnboiaReadings("BACKEND_NOT_CONFIGURED")
        try {
            val connection = uri.toURL().openConnection() as HttpURLConnection
            val root = try {
                connection.connectTimeout = 8000; connection.readTimeout = 8000
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Accept", "application/json")
                check(connection.responseCode == 200 && connection.contentType.orEmpty().contains("application/json", true))
                val bytes = connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        check(output.size() + count <= 512 * 1024)
                        output.write(buffer, 0, count)
                    }
                    output.toString("UTF-8")
                }
                JSONObject(bytes)
            } finally { connection.disconnect() }
            check(root.getString("contract") == "RJ_PNBOIA_OBSERVATIONS_V1")
            val state = root.getString("state")
            if (state != "CURRENT_POINT_OBSERVATIONS") return@withContext PnboiaReadings(state)
            val rows = root.getJSONArray("observations")
            check(rows.length() <= 24)
            val now = Instant.now()
            val readings = (0 until rows.length()).mapNotNull { i ->
                val r = rows.getJSONObject(i)
                if (r.optString("source") != "Marinha / PNBOIA / REMObs" ||
                    r.optString("scope") != "BUOY_POINT_NOT_BEACH_OR_MUNICIPALITY") return@mapNotNull null
                PnboiaReading(r.getInt("stationId"), r.getString("stationName"), r.getString("variable"),
                    r.getDouble("value"), r.getString("unit"), Instant.parse(r.getString("observedAt")),
                    r.getDouble("latitude"), r.getDouble("longitude"), r.getInt("qualityFlag"))
                    .takeIf { it.current(now) }
            }
            PnboiaReadings(if (readings.isEmpty()) "NO_VALID_CURRENT_OBSERVATIONS" else state, readings)
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) { PnboiaReadings("SOURCE_UNAVAILABLE") }
    }
}
