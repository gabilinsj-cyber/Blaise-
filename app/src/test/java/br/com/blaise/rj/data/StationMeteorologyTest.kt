package br.com.blaise.rj.data

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class StationMeteorologyTest {
    private fun fixture() = JSONObject("""{"stationMeteorology":{
        "sourceId":"alerta-rio-meteorology-live","sourceUrl":"https://websempre.rio.rj.gov.br/estacoes/",
        "kind":"OFFICIAL_STATION_OBSERVATIONS","scope":"RIO_CAPITAL_STATIONS_NOT_MUNICIPAL_MEAN",
        "municipalityIbge":"3304557","mayIssueWarning":false,"weightedMean":null,"qualityWeightsVerified":false,
        "fetchedAt":"2026-10-17T02:00:00Z","stations":[{"code":32,"name":"São Cristóvão",
        "observedAt":"2026-10-17T01:58:00Z","coverage":"station","municipalityIbge":3304557,
        "temperatureC":25.2,"relativeHumidityPercent":94.2,"pressureHpa":1009.8,"windSpeedKmh":null}]}}""")
    @Test fun preservesOriginalClockAndMissingWindAndExpiresByMeasurementTime() {
        val data = requireNotNull(parseStationMeteorology(fixture()))
        val reading = data.currentStations(Instant.parse("2026-10-17T02:00:00Z")).single()
        assertEquals(25.2, requireNotNull(reading.temperatureC), 0.001)
        assertNull(reading.windKmh)
        assertTrue(data.currentStations(Instant.parse("2026-10-17T02:03:01Z")).isEmpty())
    }
    @Test fun rejectsOtherMunicipalityStaleReadingsAndFabricatedMean() {
        val mutations: List<(JSONObject) -> Unit> = listOf(
            { it.put("municipalityIbge", "3303302") },
            { it.put("weightedMean", 25.0) },
            { it.getJSONArray("stations").getJSONObject(0).put("observedAt","2026-10-17T01:00:00Z") },
            { it.getJSONArray("stations").getJSONObject(0).put("temperatureC",100.0) }
        )
        mutations.forEach { mutate -> val root=fixture(); mutate(root.getJSONObject("stationMeteorology")); assertNull(parseStationMeteorology(root)) }
    }
}
