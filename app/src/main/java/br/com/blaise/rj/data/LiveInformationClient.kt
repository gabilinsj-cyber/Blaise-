package br.com.blaise.rj.data

import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.xml.parsers.DocumentBuilderFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.w3c.dom.Element

data class NewsHeadline(val title: String, val url: String, val publishedAt: Instant, val international: Boolean) {
    fun recent(now: Instant) = !publishedAt.isAfter(now) && Duration.between(publishedAt, now).seconds <= 172800
}
data class NewsSnapshot(val fetchedAt: Instant, val headlines: List<NewsHeadline>) {
    fun current(now: Instant) = !fetchedAt.isAfter(now) && Duration.between(fetchedAt, now).seconds <= 300
    fun forScope(scope: String, now: Instant): List<NewsHeadline> {
        if (!current(now)) return emptyList()
        return headlines.filter { it.recent(now) && when (scope) {
            "Internacional" -> it.international
            "Nacional" -> !it.international
            "Niterói" -> !it.international && Regex("(?i)\\b(niterói|niteroi)\\b").containsMatchIn(it.title)
            "São Gonçalo" -> !it.international && Regex("(?i)\\b(são gonçalo|sao goncalo)\\b").containsMatchIn(it.title)
            else -> !it.international && Regex("(?i)\\b(rio de janeiro|fluminense|niterói|niteroi|são gonçalo|sao goncalo)\\b").containsMatchIn(it.title)
        } }.sortedByDescending { it.publishedAt }.take(3)
    }
}
data class SeismicEvent(val id: String, val place: String, val magnitude: Double,
    val depthKm: Double, val occurredAt: Instant, val url: String)
data class SeismicSnapshot(val generatedAt: Instant, val fetchedAt: Instant, val events: List<SeismicEvent>) {
    fun current(now: Instant) = listOf(generatedAt, fetchedAt).all {
        !it.isAfter(now) && Duration.between(it, now).seconds <= 120
    }
    fun largestRecent(now: Instant) = if (!current(now)) emptyList() else events.filter {
        !it.occurredAt.isAfter(now) && Duration.between(it.occurredAt, now).seconds <= 86400
    }.sortedWith(compareByDescending<SeismicEvent> { it.magnitude }.thenByDescending { it.occurredAt }).take(2)
}

object NewsFeedParser {
    fun parse(xml: String, international: Boolean, now: Instant): List<NewsHeadline> {
        require(xml.length <= 2 * 1024 * 1024 && !xml.contains("<!DOCTYPE", true) && !xml.contains("<!ENTITY", true))
        val factory = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = false
            isExpandEntityReferences = false
        }
        val document = factory.newDocumentBuilder().parse(xml.byteInputStream())
        require(document.documentElement.tagName == "rss")
        val items = document.getElementsByTagName("item")
        require(items.length <= 500)
        return (0 until items.length).mapNotNull { index ->
            runCatching {
                val item = items.item(index) as Element
                fun field(name: String) = item.getElementsByTagName(name).item(0)?.textContent?.trim().orEmpty()
                val title = field("title").replace(Regex("<[^>]*>"), "").trim()
                val url = URI(field("link"))
                require(title.length in 1..400 && title.none { it.code < 32 })
                require(url.scheme == "https" && url.host == "agenciabrasil.ebc.com.br" && url.userInfo == null && url.port == -1)
                val publishedAt = ZonedDateTime.parse(field("pubDate"), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
                NewsHeadline(title, url.toString(), publishedAt,
                    international || url.path.startsWith("/internacional/")).takeIf { it.recent(now) }
            }.getOrNull()
        }.distinctBy { it.url }.sortedByDescending { it.publishedAt }
    }
}

/** Published RSS and GeoJSON interfaces; no article bodies, images or HTML scraping. */
class LiveInformationClient {
    suspend fun news(): NewsSnapshot? = withContext(Dispatchers.IO) {
        coroutineScope {
            val batches = listOf(false, true).map { international -> async {
                val section = if (international) "internacional" else "ultimasnoticias"
                try {
                    NewsFeedParser.parse(get("https://agenciabrasil.ebc.com.br/rss/$section/feed.xml"), international, Instant.now())
                } catch (error: CancellationException) { throw error }
                catch (_: Exception) { null }
            } }.map { it.await() }
            if (batches.all { it == null }) null else NewsSnapshot(Instant.now(), batches.filterNotNull().flatten().distinctBy { it.url })
        }
    }
    suspend fun seismic(): SeismicSnapshot? = withContext(Dispatchers.IO) {
        try {
            val root = JSONObject(get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"))
            require(root.getString("type") == "FeatureCollection")
            val metadata = root.getJSONObject("metadata")
            require(metadata.getInt("status") == 200)
            val generated = Instant.ofEpochMilli(metadata.getLong("generated"))
            val rows = root.getJSONArray("features")
            require(rows.length() <= 10000 && metadata.getInt("count") == rows.length())
            val events = (0 until rows.length()).mapNotNull { index -> runCatching {
                val row = rows.getJSONObject(index)
                val p = row.getJSONObject("properties")
                require(p.getString("type") == "earthquake")
                val coordinates = row.getJSONObject("geometry").getJSONArray("coordinates")
                val depth = coordinates.getDouble(2)
                val mag = p.getDouble("mag")
                val place = p.getString("place")
                val id = row.getString("id")
                val url = URI(p.getString("url"))
                require(mag.isFinite() && mag in -2.0..10.0 && depth.isFinite() && depth in -10.0..1000.0)
                require(place.length in 1..400 && id.matches(Regex("[A-Za-z0-9_-]{1,80}")))
                require(url.scheme == "https" && url.host == "earthquake.usgs.gov" && url.userInfo == null && url.port == -1)
                require(coordinates.getDouble(0) in -180.0..180.0 && coordinates.getDouble(1) in -90.0..90.0)
                SeismicEvent(id, place, mag, depth, Instant.ofEpochMilli(p.getLong("time")), url.toString())
            }.getOrNull() }.distinctBy { it.id }
            SeismicSnapshot(generated, Instant.now(), events).takeIf { it.current(Instant.now()) }
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) { null }
    }
    private fun get(url: String): String {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 7000; connection.readTimeout = 7000
            connection.setRequestProperty("Cache-Control", "no-cache")
            connection.setRequestProperty("Accept", "application/rss+xml, application/json, application/xml")
            require(connection.responseCode == 200)
            val output = java.io.ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 2 * 1024 * 1024)
                    output.write(buffer, 0, count)
                }
            }
            return output.toByteArray().toString(Charsets.UTF_8)
        } finally { connection.disconnect() }
    }
}
