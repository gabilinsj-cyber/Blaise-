package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.InmetMetric
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RjMunicipalPointPolicyTest {
    private val now = Instant.parse("2026-10-12T20:00:00Z")
    private fun station(
        ibge: Int, code: String, latitude: Double, longitude: Double,
        observedAt: Instant = now.minusSeconds(900),
        source: String = "INMET",
        rainfallMm: Double? = 0.0,
    ): CityWeatherResult {
        return CityWeatherResult(ibge, null, CityWeatherObservation(
            municipalityIbge = ibge,
            station = "Estação $code",
            source = source,
            sourceUrl = "https://apitempo.inmet.gov.br/estacao/2026-10-11/2026-10-12/$code",
            observedAt = observedAt,
            temperatureC = 28.5,
            humidityPercent = 70.0,
            windKmh = 14.4,
            maxAgeSeconds = 7200,
            hourlyRainMm = rainfallMm,
            stationLatitude = latitude,
            stationLongitude = longitude,
        ))
    }

    @Test fun twoActuallyGeoreferencedRjStationReadingsAppearAsTwoPoints() {
        val data = mapOf(
            3304557 to station(3304557,"A652",-22.9,-43.2),
            3303302 to station(3303302,"A610",-22.88,-43.11),
        )
        val points = RjMunicipalPointPolicy.points(data,now,InmetMetric.TEMPERATURE)
        assertEquals(2, points.size)
        assertEquals(listOf(28.5,28.5), points.map { it.measuredValue })
        assertEquals("°C",points[0].unit)
        assertEquals(-22.9,points[0].latitude,0.001)
        assertTrue(points.all { it.sourceUrl.contains("apitempo.inmet.gov.br") })
        assertEquals(1, RjMunicipalPointPolicy.points(data,now,InmetMetric.TEMPERATURE,
            excludeSourceUrl=points.first().sourceUrl).size)
    }

    @Test fun staleUnlocatedInvalidOrUntrustedStationCannotCreateMapDot() {
        val examples = listOf(
            station(3304557,"A652",-22.9,-43.2, observedAt=now.minusSeconds(9000)),
            station(3304557,"A652",-22.9,-43.2, source="Windy"),
            station(3304557,"A652",0.0,-43.2),
        )
        for (item in examples) {
            assertTrue(RjMunicipalPointPolicy.points(
                mapOf(3304557 to item),now,InmetMetric.TEMPERATURE).isEmpty())
        }
        val withoutCoordinates=station(3304557,"A652",-22.9,-43.2).copy(
            observation=station(3304557,"A652",-22.9,-43.2).observation?.copy(
                stationLatitude=null,stationLongitude=null))
        assertTrue(RjMunicipalPointPolicy.points(
            mapOf(3304557 to withoutCoordinates),now,InmetMetric.WIND).isEmpty())
    }

    @Test fun zeroRainMeansZeroOnlyAtActualStationNotAcrossMunicipality() {
        val points=RjMunicipalPointPolicy.points(
            mapOf(3304557 to station(3304557,"A652",-22.9,-43.2,rainfallMm=0.0)),
            now,InmetMetric.HOURLY_RAINFALL)
        assertEquals(1,points.size)
        assertEquals(0.0,points.first().measuredValue,0.0)
        assertEquals("mm (1h)",points.first().unit)
        val missing=RjMunicipalPointPolicy.points(
            mapOf(3304557 to station(3304557,"A652",-22.9,-43.2,rainfallMm=null)),
            now,InmetMetric.HOURLY_RAINFALL)
        assertTrue(missing.isEmpty())
    }
}
