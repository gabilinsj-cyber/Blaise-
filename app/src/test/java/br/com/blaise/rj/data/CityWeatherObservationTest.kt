package br.com.blaise.rj.data

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class CityWeatherObservationTest {
    private val now = Instant.parse("2026-10-06T21:00:00Z")
    private fun measurement() = CityWeatherObservation(3303302, "Fixture Niterói", "INMET",
        "https://apitempo.inmet.gov.br/estacao/fixture", now.minusSeconds(60), 27.5, 78.0, 10.8, 7200)

    @Test fun `current observation keeps missing values and station scope`() {
        val sample = measurement().copy(temperatureC = null)
        assertTrue(sample.current(now))
        assertFalse(sample.summary(now).contains("Temperatura"))
        assertTrue(sample.summary(now).contains("estação Fixture Niterói"))
        assertNull(CityWeatherResult(3304557, "Centro do Rio", sample).currentObservation(now))
    }

    @Test fun `expired future and nonphysical readings are never rendered current`() {
        assertFalse(measurement().copy(observedAt = now.minusSeconds(7201)).current(now))
        assertFalse(measurement().copy(observedAt = now.plusSeconds(1)).current(now))
        assertFalse(measurement().copy(humidityPercent = 101.0).current(now))
        assertFalse(measurement().copy(temperatureC = Double.NaN).current(now))
        assertFalse(measurement().copy(temperatureC = null, humidityPercent = null, windKmh = null).current(now))
    }

    @Test fun `local clock expires a previously valid display without refreshing source timestamp`() {
        val sample = measurement()
        val report = CityWeatherResult(3303302, null, sample)
        assertNotNull(report.currentObservation(now))
        assertNull(report.currentObservation(now.plusSeconds(7200)))
        assertEquals(now.minusSeconds(60), sample.observedAt)
    }
}
