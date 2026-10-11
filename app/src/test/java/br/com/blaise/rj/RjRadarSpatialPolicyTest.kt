package br.com.blaise.rj

import java.time.Instant
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjRadarSpatialPolicyTest {
    private val now = Instant.parse("2026-10-11T04:00:00Z")
    private fun frame(): RjRadarMeasuredFrame = RjRadarMeasuredFrame(
        providerId = "licensed-product",
        radarId = "radar-RJ-1",
        calibrationId = "real-calibration-2026",
        sourceUrl = "https://dados.example.gov.br/radar/quantitative-grid",
        observedAt = Instant.parse("2026-10-11T03:55:00Z"),
        dataType = "GEOREFERENCED_MEASURED_RADAR_RAIN_RATE",
        commercialUseVerifiedByBackend = true,
        cells = listOf(RjRadarMeasuredCell(-22.9,-43.2,8.0,1.5)),
    )

    @Test fun acceptedNativeGridRequiresRealSpatialAndLicenseMetadata() {
        assertTrue(RjRadarSpatialPolicy.current(frame(),now))
        assertFalse(RjRadarSpatialPolicy.current(null,now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            commercialUseVerifiedByBackend = false),now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            dataType = "INTERPOLATED_STATIONS"),now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            observedAt = Instant.parse("2026-10-11T03:40:00Z")),now))
    }

    @Test fun outOfBoundsAndImpossibleRainCannotCreateRadarPixels() {
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            cells = listOf(RjRadarMeasuredCell(-10.0,-43.2,8.0,1.5))),now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            cells = listOf(RjRadarMeasuredCell(-22.9,-43.2,999.0,1.5))),now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            cells = emptyList()),now))
        assertFalse(RjRadarSpatialPolicy.current(frame().copy(
            cells = listOf(
                RjRadarMeasuredCell(-22.9,-43.2,8.0,1.5),
                RjRadarMeasuredCell(-22.9,-43.2,12.0,1.5),
            )),now))
    }
}
