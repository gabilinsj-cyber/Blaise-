package br.com.blaise.rj.data

import java.time.Duration
import java.time.Instant
import org.json.JSONObject

data class OceanWavePoint(val validAt: Instant, val heightM: Double?, val peakPeriodS: Double?,
    val peakFromDegrees: Double?, val swellHeightM: Double?, val swellPeriodS: Double?, val swellFromDegrees: Double?)
data class OceanWaveForecast(val fetchedAt: Instant, val points: List<OceanWavePoint>) {
    fun current(now: Instant) = !fetchedAt.isAfter(now) && Duration.between(fetchedAt, now).seconds in 0..300 &&
        points.any { Duration.between(it.validAt, now).seconds in -3600..3600 }
    fun nearest(now: Instant) = points.minByOrNull { kotlin.math.abs(Duration.between(it.validAt, now).seconds) }
}
fun parseOceanWaveForecast(root: JSONObject): OceanWaveForecast? = runCatching {
    val row = root.optJSONObject("oceanWaveForecast") ?: return null
    require(row.getString("sourceId") == "noaa-pacioos-rj-wave-forecast")
    require(row.getString("sourceUrl") == "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json")
    require(row.getString("kind") == "MODEL_FORECAST_NOT_OBSERVATION" && row.getString("scope") == "OFFSHORE_POINT_NOT_COASTAL_BEACH")
    require(row.getDouble("latitude") == -23.5 && row.getDouble("longitude") == -43.0 && row.getDouble("gridResolutionDegrees") == 0.5)
    require(!row.getBoolean("issuanceTimeKnown") && row.isNull("issuedAt") && !row.getBoolean("mayIssueWarning"))
    require(!row.getBoolean("providesTides") && !row.getBoolean("providesCurrents"))
    val fetched = Instant.parse(row.getString("fetchedAt"))
    val rows = row.getJSONArray("forecasts")
    require(rows.length() in 1..8)
    val points = (0 until rows.length()).map { index ->
        val point = rows.getJSONObject(index)
        fun n(key: String, max: Double): Double? = if(point.isNull(key)) null else point.getDouble(key).also { require(it.isFinite() && it in 0.0..max) }
        val valid = Instant.parse(point.getString("validAt"))
        require(Duration.between(fetched, valid).seconds in -3600..25200)
        OceanWavePoint(valid, n("heightM",30.0), n("peakPeriodS",60.0), n("peakFromDegrees",360.0),
            n("swellHeightM",30.0),n("swellPeriodS",60.0),n("swellFromDegrees",360.0))
    }
    require(points.map { it.validAt }.distinct().size == points.size && points.any { it.heightM != null })
    OceanWaveForecast(fetched, points)
}.getOrNull()
