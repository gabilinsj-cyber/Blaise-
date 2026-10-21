package br.com.blaise.rj.data

import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

object MarineDataParser {
    private fun text(o: JSONObject, k: String): String? =
        if (o.isNull(k)) null else o.getString(k).also {
            require(it.isNotBlank() && it.length <= 512)
        }
    private fun number(o: JSONObject, k: String): Double? =
        if (o.isNull(k)) null else o.getDouble(k).also {
            require(it.isFinite())
        }
    private fun time(o: JSONObject, k: String): Instant? =
        text(o, k)?.let(Instant::parse)

    fun parse(rows: JSONArray?): List<MarineReading> {
        if (rows == null) return emptyList()
        require(rows.length() <= 512)
        return (0 until rows.length()).map { i ->
            val o = rows.getJSONObject(i)
            MarineReading(
                o.getInt("cityIbge"),
                o.getString("sourceName"),
                o.getString("sourceUrl"),
                o.getString("nature"),
                Instant.parse(o.getString("issuedAt")),
                Instant.parse(o.getString("validAt")),
                Instant.parse(o.getString("expiresAt")),
                number(o, "waveHeightM"),
                number(o, "wavePeriodS"),
                number(o, "waveDirectionDeg"),
                number(o, "windSpeedKmh"),
                time(o, "startsAt"),
                time(o, "endsAt"),
                text(o, "affectedRegion"),
                if (o.isNull("blaiseScale")) null
                else o.getInt("blaiseScale"),
                text(o, "dangerSummary")
            )
        }
    }
}
