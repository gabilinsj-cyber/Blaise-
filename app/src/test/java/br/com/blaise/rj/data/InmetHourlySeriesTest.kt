package br.com.blaise.rj.data

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InmetHourlySeriesTest {
    private val now = Instant.parse("2026-10-10T18:00:00Z")
    private fun row(age: Long, temp: Double? = 27.0, rain: Double? = 0.0, wind: Double? = 12.6) =
        InmetHourlyPoint(now.minusSeconds(age), temp, rain, wind)

    private fun series(vararg rows: InmetHourlyPoint) = InmetHourlySeries(
        "A652", "RIO DE JANEIRO / ESTACAO TESTE (A652)",
        "https://apitempo.inmet.gov.br/estacao/2026-10-09/2026-10-10/A652",
        -22.9, -43.1, rows.toList(),
    )

    @Test fun `observations retain source station and allow real zero rain`() {
        val s = series(row(7200), row(3600, rain = 0.0))
        val readings = s.recentPoints(InmetMetric.HOURLY_RAINFALL, now)
        assertEquals(2, readings.size)
        assertEquals(0.0, readings.last().second, 0.0)
        assertTrue(s.stationName.contains("ESTACAO TESTE"))
        assertEquals("A652", s.stationCode)
    }

    @Test fun `future values and stale station never become current`() {
        assertNull(series(row(-1), row(3600, temp = null)).currentPoint(InmetMetric.TEMPERATURE, now))
        assertTrue(series(row(7400), row(10_800)).recentPoints(InmetMetric.TEMPERATURE, now).isEmpty())
        assertNull(series(row(7400)).currentPoint(InmetMetric.HOURLY_RAINFALL, now))
    }

    @Test fun `null sentinel and physically impossible readings fail closed for each variable`() {
        val s = series(row(3600, temp = null, rain = 9999.0, wind = Double.NaN), row(7100))
        assertTrue(s.recentPoints(InmetMetric.HOURLY_RAINFALL, now).isEmpty())
        assertTrue(s.recentPoints(InmetMetric.WIND, now).isEmpty())
        assertEquals(0.0, s.currentPoint(InmetMetric.HOURLY_RAINFALL, now)!!.second, 0.0)
        assertEquals(12.6, s.currentPoint(InmetMetric.WIND, now)!!.second, 0.0)
    }

    @Test fun `source not official coordinates outside RJ and duplicate timestamps block all`() {
        val s = series(row(3600), row(7200))
        assertNull(s.copy(sourceUrl = "http://example.test/foo").currentPoint(InmetMetric.TEMPERATURE, now))
        assertNull(s.copy(latitude = -15.0).currentPoint(InmetMetric.TEMPERATURE, now))
        assertTrue(s.copy(points = listOf(row(3600), row(3600))).recentPoints(InmetMetric.TEMPERATURE, now).isEmpty())
        assertNull(s.copy(stationCode = "BAD-CODE").currentPoint(InmetMetric.TEMPERATURE, now))
    }

    @Test fun `metric requires its own fresh value and two distinct hours to draw`() {
        val s = series(row(1800, temp = 29.0, rain = null), row(5400, temp = null, rain = 12.5), row(10800, temp = 26.0, rain = 2.5))
        assertEquals(2, s.recentPoints(InmetMetric.TEMPERATURE, now).size)
        assertTrue(s.recentPoints(InmetMetric.HOURLY_RAINFALL, now).isEmpty())
        assertEquals(29.0, s.currentPoint(InmetMetric.TEMPERATURE, now)!!.second, 0.0)
    }

    @Test fun `insufficient history does not draw synthetic graph`() {
        assertTrue(series(row(500)).recentPoints(InmetMetric.TEMPERATURE, now).isEmpty())
        assertNull(series(row(500, temp = null)).currentPoint(InmetMetric.TEMPERATURE, now))
    }
}
