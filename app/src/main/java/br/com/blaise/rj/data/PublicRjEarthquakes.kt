package br.com.blaise.rj.data

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

const val RJ_EARTHQUAKES_PATH = "/v1/public/rj-earthquakes"
const val RJ_EARTHQUAKES_CONTRACT = "BLAISE_RJ_GLOBAL_USGS_RECENT_V1"

data class RjEarthquakeEvent(
    val id: String,
    val magnitude: Double,
    val place: String,
    val occurredAt: Instant,
    val depthKm: Double,
    val sourceUrl: String,
    val reviewStatus: String,
) {
    fun valid(now: Instant): Boolean =
        id.matches(Regex("[a-zA-Z0-9_-]{3,64}")) &&
        magnitude in 2.5..10.0 && depthKm in -20.0..750.0 &&
        place.isNotBlank() && place.length <= 180 &&
        !occurredAt.isAfter(now.plusSeconds(60)) &&
        Duration.between(occurredAt, now).seconds <= 26L * 3600 &&
        sourceUrl.startsWith("https://earthquake.usgs.gov/") &&
        reviewStatus in setOf("REVIEWED", "NOT_CONFIRMED_REVIEWED")
}

data class RjEarthquakeSnapshot(
    val generatedAt: Instant,
    val observedFeedGeneratedAt: Instant,
    val events: List<RjEarthquakeEvent>,
) {
    fun current(now: Instant): Boolean =
        !generatedAt.isAfter(now) &&
        Duration.between(generatedAt, now).seconds in 0..120 &&
        !observedFeedGeneratedAt.isAfter(now) &&
        Duration.between(observedFeedGeneratedAt, now).seconds in 0..4500 &&
        events.size <= 2 && events.all { it.valid(now) }
}
sealed interface PublicRjEarthquakeResult {
    data class Available(val snapshot: RjEarthquakeSnapshot) : PublicRjEarthquakeResult
    data object Unavailable : PublicRjEarthquakeResult
}

object PublicRjEarthquakeParser {
    fun parse(json: JSONObject): RjEarthquakeSnapshot {
        require(json.getString("contract") == RJ_EARTHQUAKES_CONTRACT)
        require(json.getString("scope") == "WORLDWIDE_PAST_DAY_MAGNITUDE_2_5_PLUS")
        require(json.getString("source") == "USGS")
        require(json.getString("sourceUrl") ==
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson")
        require(json.getBoolean("informationalOnly") &&
            !json.getBoolean("impactOnRioConfirmed") &&
            !json.getBoolean("tsunamiWarningConfirmed") &&
            !json.getBoolean("thirdPartyImagesIncluded") &&
            !json.getBoolean("subscriberDataIncluded"))
        val payload=json.getJSONArray("events")
        require(payload.length() <= 2)
        val events=(0 until payload.length()).map { i ->
            val item=payload.getJSONObject(i)
            require(item.getString("source")=="USGS" &&
                !item.getBoolean("officialTsunamiWarning") &&
                !item.getBoolean("mayTriggerRjAlert"))
            RjEarthquakeEvent(
                item.getString("id"),item.getDouble("magnitude"),
                item.getString("place"),Instant.parse(item.getString("occurredAt")),
                item.getDouble("depthKm"),item.getString("sourceUrl"),
                item.getString("reviewStatus"))
        }
        require(events.map { it.id }.distinct().size == events.size)
        return RjEarthquakeSnapshot(
            Instant.parse(json.getString("generatedAt")),
            Instant.parse(json.getString("observedFeedGeneratedAt")),
            events)
    }
}

/** Public source; never sends purchase, account, GPS or subscription data. */
class PublicRjEarthquakeClient private constructor(private val endpoint: URI) {
    suspend fun fetch(): PublicRjEarthquakeResult = withContext(Dispatchers.IO) {
        try { fetchBlocking() }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { PublicRjEarthquakeResult.Unavailable }
    }
    private fun fetchBlocking(): PublicRjEarthquakeResult {
        val connection=endpoint.toURL().openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects=false
            connection.requestMethod="GET"
            connection.connectTimeout=5_000
            connection.readTimeout=5_000
            connection.setRequestProperty("Accept","application/json")
            if(connection.responseCode!=200) return PublicRjEarthquakeResult.Unavailable
            val output=ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer=ByteArray(4096)
                while(true) {
                    val count=input.read(buffer)
                    if(count<0)break
                    require(output.size()+count<=12*1024)
                    output.write(buffer,0,count)
                }
            }
            val snapshot=PublicRjEarthquakeParser.parse(
                JSONObject(output.toString(Charsets.UTF_8.name())))
            if(!snapshot.current(Instant.now()))return PublicRjEarthquakeResult.Unavailable
            return PublicRjEarthquakeResult.Available(snapshot)
        }finally {connection.disconnect()}
    }
    companion object {
        fun create(baseUrl: String): PublicRjEarthquakeClient? = runCatching {
            val uri=URI(baseUrl.trim())
            require(uri.scheme=="https"&&uri.host!=null&&uri.userInfo==null
                &&uri.rawQuery==null&&uri.rawFragment==null
                &&(uri.path==null||uri.path.isEmpty()||uri.path=="/")
                &&uri.port in -1..65535)
            PublicRjEarthquakeClient(URI("https",null,uri.host,uri.port,
                RJ_EARTHQUAKES_PATH,null,null))
        }.getOrNull()
    }
}
