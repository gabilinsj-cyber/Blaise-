package br.com.blaise.rj.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant

/**
 * Public USGS GeoJSON, global earthquakes M4.5+ in the preceding seven days.
 * Read-only; no subscriber identity, credentials or client location.
 * This is seismic information, never an automatic RJ tsunami/emergency alert.
 */
data class UsgsEarthquake(
    val id: String,
    val magnitude: Double,
    val location: String,
    val occurredAt: Instant,
    val officialUrl: String,
)
data class UsgsEarthquakeSnapshot(
    val generatedAt: Instant,
    val checkedAt: Instant,
    val events: List<UsgsEarthquake>,
) {
    fun current(now: Instant): Boolean {
        val age = Duration.between(generatedAt, now).seconds
        val fetchAge = Duration.between(checkedAt, now).seconds
        return age in 0L..1800L && fetchAge in 0L..1800L
    }
}

object UsgsRecentEarthquakes {
    const val FEED_URL =
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
    const val ALL_RECENT_URL = "https://earthquake.usgs.gov/earthquakes/map/"
    const val DISPLAY_COUNT = 3
    const val REFRESH_MINUTES = 30L
    const val FEED_MAX_BYTES = 1024 * 1024

    fun parse(raw: String, now: Instant): UsgsEarthquakeSnapshot {
        require(raw.length <= FEED_MAX_BYTES && raw.isNotBlank())
        val root = JSONObject(raw)
        require(root.optString("type") == "FeatureCollection")
        val metadata = root.getJSONObject("metadata")
        val generatedMs = metadata.getLong("generated")
        val generatedAt = Instant.ofEpochMilli(generatedMs)
        val feedAge = Duration.between(generatedAt, now).seconds
        require(feedAge in 0L..1800L) { "usgs_feed_expired" }
        val features = root.getJSONArray("features")
        require(features.length() in 0..2000)
        val events = (0 until features.length()).mapNotNull { index ->
            val feature = features.optJSONObject(index) ?: return@mapNotNull null
            val properties = feature.optJSONObject("properties") ?: return@mapNotNull null
            if (properties.optString("type", "earthquake") != "earthquake") return@mapNotNull null
            val id = feature.optString("id")
            if (!id.matches(Regex("[A-Za-z0-9_-]{3,80}"))) return@mapNotNull null
            if (properties.isNull("mag")) return@mapNotNull null
            val mag = properties.optDouble("mag")
            if (!mag.isFinite() || mag !in 4.5..9.9) return@mapNotNull null
            val whenMs = properties.optLong("time", 0L)
            if (whenMs <= 0L) return@mapNotNull null
            val at = Instant.ofEpochMilli(whenMs)
            if (Duration.between(at, now).seconds !in 0L..(7 * 24 * 3600L))
                return@mapNotNull null
            val location = properties.optString("place").trim()
            if (location.isEmpty() || location.length > 140) return@mapNotNull null
            val eventUrl = properties.optString("url")
            val path = runCatching { java.net.URI(eventUrl) }.getOrNull()
            if (path?.scheme != "https" || path.host != "earthquake.usgs.gov" ||
                path.rawQuery != null || path.rawFragment != null ||
                !(path.path ?: "").startsWith("/earthquakes/eventpage/"))
                return@mapNotNull null
            UsgsEarthquake(id, mag, location, at, eventUrl)
        }.distinctBy { it.id }
            .sortedWith(compareByDescending<UsgsEarthquake> { it.magnitude }
                .thenByDescending { it.occurredAt })
            .take(DISPLAY_COUNT)
        return UsgsEarthquakeSnapshot(generatedAt, now, events)
    }

    suspend fun fetch(now: Instant = Instant.now()): UsgsEarthquakeSnapshot =
        withContext(Dispatchers.IO) {
            val connection = (URL(FEED_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 7_000
                readTimeout = 7_000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/geo+json, application/json")
            }
            try {
                require(connection.responseCode == 200) { "usgs_unavailable" }
                val bytes = ByteArrayOutputStream()
                connection.inputStream.use { input ->
                    val chunk = ByteArray(8192)
                    while (true) {
                        val count = input.read(chunk)
                        if (count < 0) break
                        bytes.write(chunk, 0, count)
                        require(bytes.size() <= FEED_MAX_BYTES) { "usgs_feed_too_large" }
                    }
                }
                parse(bytes.toString(Charsets.UTF_8.name()), now)
            } finally {
                connection.disconnect()
            }
        }
}
