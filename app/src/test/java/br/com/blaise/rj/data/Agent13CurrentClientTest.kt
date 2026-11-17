package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class Agent13CurrentClientTest {
    private val validAt = Instant.parse("2026-11-17T09:00:00Z")
    private fun estimate() = Agent13CurrentEstimate(
        municipalityIbge = 3304557,
        validAt = validAt,
        retrievedAt = validAt.plusSeconds(10),
        temperatureC = 27.0,
        feelsLikeC = null,
        humidityPercent = 60.0,
        windKmh = 0.0,
        gustKmh = null,
        rainMm1h = null,
    )

    @Test fun `current estimate is valid up to twelve minutes, never future`() {
        val e = estimate()
        assertTrue(e.current(validAt.plusSeconds(12 * 60)))
        assertFalse(e.current(validAt.plusSeconds(12 * 60 + 1)))
        assertFalse(e.current(validAt.minusSeconds(1)))
        assertFalse(e.current(validAt.plusSeconds(9)))
    }

    @Test fun `estimated conditions are explicitly labelled, never invent rainfall`() {
        val summary = estimate().summary(validAt.plusSeconds(60))
        assertTrue(summary.contains("Estimativa de modelo"))
        assertTrue(summary.contains("OpenWeather One Call 4.0"))
        assertTrue(summary.contains("Não é medição de estação"))
        assertTrue(summary.contains("chuva 1h indisponível"))
        assertTrue(summary.contains("vento 0,0 km/h"))
        assertFalse(summary.contains("chuva 1h 0,0 mm"))
        assertEquals("Estimativa vencida ou indisponível.",
            estimate().summary(validAt.plusSeconds(721)))
    }
}
