package br.com.blaise.rj.data

import java.time.Duration
import java.time.Instant
import org.json.JSONObject

data class StationMeteorologyReading(val code: Int, val name: String, val observedAt: Instant,
    val temperatureC: Double?, val humidityPercent: Double?, val pressureHpa: Double?, val windKmh: Double?)
data class StationMeteorology(val fetchedAt: Instant, val stations: List<StationMeteorologyReading>) {
    fun currentStations(now: Instant): List<StationMeteorologyReading> =
        if (Duration.between(fetchedAt, now).seconds !in 0..300) emptyList()
        else stations.filter { Duration.between(it.observedAt, now).seconds in 0..300 }
}
fun parseStationMeteorology(root: JSONObject): StationMeteorology? = runCatching {
    val source = root.optJSONObject("stationMeteorology") ?: return null
    require(source.getString("sourceId") == "alerta-rio-meteorology-live")
    require(source.getString("sourceUrl") == "https://websempre.rio.rj.gov.br/estacoes/")
    require(source.getString("kind") == "OFFICIAL_STATION_OBSERVATIONS")
    require(source.getString("scope") == "RIO_CAPITAL_STATIONS_NOT_MUNICIPAL_MEAN")
    require(source.getString("municipalityIbge") == "3304557" && !source.getBoolean("mayIssueWarning"))
    require(source.isNull("weightedMean") && !source.getBoolean("qualityWeightsVerified"))
    val fetched = Instant.parse(source.getString("fetchedAt"))
    val rows = source.getJSONArray("stations")
    require(rows.length() in 1..50)
    val readings = (0 until rows.length()).map { index ->
        val s = rows.getJSONObject(index)
        require(s.getString("coverage") == "station" && s.getInt("municipalityIbge") == 3304557)
        val observed = Instant.parse(s.getString("observedAt"))
        require(Duration.between(observed, fetched).seconds in 0..300)
        fun n(key: String, min: Double, max: Double): Double? =
            if(s.isNull(key)) null else s.getDouble(key).also { require(it.isFinite() && it in min..max) }
        val name = s.getString("name").also { require(it.isNotBlank() && it.length <= 100) }
        StationMeteorologyReading(s.getInt("code"), name, observed, n("temperatureC",-30.0,60.0),
            n("relativeHumidityPercent",0.0,100.0), n("pressureHpa",800.0,1100.0), n("windSpeedKmh",0.0,400.0))
    }
    require(readings.map { it.code }.distinct().size == readings.size)
    StationMeteorology(fetched, readings)
}.getOrNull()
