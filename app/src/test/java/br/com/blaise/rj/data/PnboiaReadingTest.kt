package br.com.blaise.rj.data
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test
class PnboiaReadingTest {
    private val now = Instant.parse("2026-10-15T12:00:00Z")
    private val wave = PnboiaReading(48, "Cabo Frio", "sig_wave_height", 1.2, "m", now.minusSeconds(60), -23.582, -42.1711, 1)
    @Test fun `only current qualified point measurements render`() {
        assertTrue(wave.current(now))
        assertFalse(wave.copy(qualityFlag = 3).current(now))
        assertFalse(wave.copy(unit = "cm").current(now))
        assertFalse(wave.copy(observedAt = now.minusSeconds(301)).current(now))
        assertFalse(wave.copy(observedAt = now.plusSeconds(1)).current(now))
        assertFalse(wave.copy(stationId = 101).current(now))
        assertFalse(wave.copy(value = Double.NaN).current(now))
    }
    @Test fun `wind keeps provider units and cannot masquerade as waves`() {
        assertTrue(wave.copy(variable = "wind_speed", value = 5.0, unit = "m/s").current(now))
        assertFalse(wave.copy(variable = "wind_speed", unit = "km/h").current(now))
        assertFalse(wave.copy(variable = "sea_temperature").current(now))
    }
}
