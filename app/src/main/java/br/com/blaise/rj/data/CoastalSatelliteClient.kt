package br.com.blaise.rj.data

import java.net.URI
import java.time.Instant
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

enum class CoastalMission(val shortName: String, val prefix: String, val label: String, val layer: String) {
    LANDSAT("HLSL30", "HLS.L30.", "NASA/USGS • Landsat 8/9", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"),
    SENTINEL("HLSS30", "HLS.S30.", "ESA/Copernicus • Sentinel-2", "HLS_S30_Nadir_BRDF_Adjusted_Reflectance"),
}
data class CoastalSatelliteScene(val mission: CoastalMission, val title: String,
    val acquiredAt: Instant, val checkedAt: Instant, val previewUrl: String?, val footprint: String) {
    val worldviewUrl: String get() = "https://worldview.earthdata.nasa.gov/?v=-44.8,-23.6,-40.8,-20.8&l=${mission.layer},Coastlines_15m&t=${acquiredAt.toString().take(10)}"
}

/** Public NASA catalogue; each granule is a partial scene, never full coastal coverage or live video. */
object CoastalSatelliteClient {
    const val COPERNICUS_URL = "https://browser.dataspace.copernicus.eu/?zoom=9&lat=-22.9&lng=-43.2&datasetId=S2_L2A_CDAS"
    const val EARTHDATA_URL = "https://search.earthdata.nasa.gov/search?q=HLS&sb=-44.8%2C-23.6%2C-40.8%2C-20.8"
    const val USGS_URL = "https://earthexplorer.usgs.gov/"
    fun catalogueUrl(mission: CoastalMission) = "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${mission.shortName}&version=2.0&bounding_box=-44.8,-23.6,-40.8,-20.8&sort_key=-start_date&page_size=1"
    fun previewAllowed(url: String, mission: CoastalMission): Boolean = runCatching {
        val u = URI(url)
        u.scheme == "https" && u.host == "data.lpdaac.earthdatacloud.nasa.gov" &&
            u.rawUserInfo == null && u.port == -1 && u.rawQuery == null && u.rawFragment == null &&
            u.path.startsWith("/lp-prod-public/${mission.shortName}.020/${mission.prefix}") &&
            u.path.endsWith(".jpg") && !u.path.contains("..")
    }.getOrDefault(false)
    fun parse(text: String, mission: CoastalMission, now: Instant): CoastalSatelliteScene? {
        val rows = JSONObject(text).getJSONObject("feed").getJSONArray("entry")
        require(rows.length() <= 1)
        if (rows.length() == 0) return null
        val row = rows.getJSONObject(0)
        val title = row.getString("title")
        require(title.startsWith(mission.prefix) && title.length <= 160 && title.all { it.isLetterOrDigit() || it in "._-" })
        val acquired = Instant.parse(row.getString("time_start"))
        require(!acquired.isAfter(now))
        val polygon = row.getJSONArray("polygons").getJSONArray(0).getString(0)
        val coordinates = polygon.trim().split(Regex("\\s+")).map { it.toDouble() }
        require(coordinates.size in 8..256 && coordinates.size % 2 == 0 && coordinates.all { it.isFinite() })
        val points = coordinates.chunked(2)
        require(points.all { it[0] in -90.0..90.0 && it[1] in -180.0..180.0 })
        require(points.minOf { it[0] } <= -20.8 && points.maxOf { it[0] } >= -23.6 &&
            points.minOf { it[1] } <= -40.8 && points.maxOf { it[1] } >= -44.8)
        val links = row.optJSONArray("links")
        val preview = links?.let { values -> (0 until values.length()).map { values.getJSONObject(it) }
            .firstOrNull { it.optString("rel") == "http://esipfed.org/ns/fedsearch/1.1/browse#" &&
                previewAllowed(it.optString("href"), mission) }?.getString("href") }
        return CoastalSatelliteScene(mission, title, acquired, now, preview, polygon)
    }
    suspend fun latest(mission: CoastalMission): CoastalSatelliteScene? = withContext(Dispatchers.IO) {
        val bytes = download(catalogueUrl(mission), "cmr.earthdata.nasa.gov", "application/json", 512 * 1024)
        parse(bytes.toString(Charsets.UTF_8), mission, Instant.now())
    }
    suspend fun preview(scene: CoastalSatelliteScene): ByteArray = withContext(Dispatchers.IO) {
        val url = requireNotNull(scene.previewUrl)
        require(previewAllowed(url, scene.mission))
        download(url, "data.lpdaac.earthdatacloud.nasa.gov", "image/jpeg", 2 * 1024 * 1024)
    }
    private fun download(url: String, host: String, contentType: String, limit: Int): ByteArray {
        val uri = URI(url)
        require(uri.scheme == "https" && uri.host == host && uri.rawUserInfo == null)
        val c = uri.toURL().openConnection() as HttpsURLConnection
        try {
            c.instanceFollowRedirects = false
            c.connectTimeout = 10_000; c.readTimeout = 10_000
            c.setRequestProperty("Accept", contentType)
            val receivedType = c.contentType?.substringBefore(';')
            require(c.responseCode == 200 && (receivedType == contentType ||
                contentType == "image/jpeg" && receivedType in setOf("binary/octet-stream", "application/octet-stream")))
            require(c.contentLengthLong <= limit)
            return c.inputStream.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= limit)
                    output.write(buffer, 0, count)
                }
                output.toByteArray().also { bytes ->
                    if(contentType == "image/jpeg") require(bytes.size >= 3 &&
                        bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte())
                }
            }
        } finally { c.disconnect() }
    }
}
