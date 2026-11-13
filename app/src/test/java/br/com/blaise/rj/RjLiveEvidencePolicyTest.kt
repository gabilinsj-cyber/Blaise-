package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.DashboardDataNetworkResult
import br.com.blaise.rj.data.StatewideDataResult
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class RjLiveEvidencePolicyTest {
    private val now = Instant.parse("2026-11-13T13:00:00Z")

    @Test fun noSnapshotNeverClaimsAnyLiveOfficialProduct() {
        val evidence = RjLiveEvidencePolicy.build(
            emptyMap(), emptyList(), StatewideDataResult.Unavailable,
            DashboardDataNetworkResult.Unavailable, now
        )
        assertEquals(8, evidence.size)
        assertTrue(evidence.all { it.observedAt == null })
    }

    @Test fun freshInmetStationProducesTimestampAndOldStationExpires() {
        fun sample(time: Instant) = CityWeatherObservation(
            municipalityIbge = 3304557, station = "TEST ONLY", source = "INMET",
            sourceUrl = "https://example.org/test", observedAt = time,
            temperatureC = 27.0, humidityPercent = 50.0, windKmh = 15.0,
            maxAgeSeconds = 3600
        )
        val fresh = RjLiveEvidencePolicy.build(
            mapOf(3304557 to CityWeatherResult(3304557, null, sample(now.minusSeconds(120)))),
            emptyList(), StatewideDataResult.Unavailable, DashboardDataNetworkResult.Unavailable, now
        )
        assertEquals(now.minusSeconds(120), fresh.first { it.source == "INMET" }.observedAt)
        val expired = RjLiveEvidencePolicy.build(
            mapOf(3304557 to CityWeatherResult(3304557, null, sample(now.minusSeconds(7200)))),
            emptyList(), StatewideDataResult.Unavailable, DashboardDataNetworkResult.Unavailable, now
        )
        assertNull(expired.first { it.source == "INMET" }.observedAt)
    }

    @Test fun explicitlyExcludedSourceCannotBeDisplayedAsLiveEvidence() {
        val obs = CityWeatherObservation(3304557,"TEST", "CHM",
            "https://example.org/test",now.minusSeconds(60),28.0,80.0,12.0,1800)
        val evidence = RjLiveEvidencePolicy.build(
            mapOf(3304557 to CityWeatherResult(3304557,null,obs)),
            listOf(obs), StatewideDataResult.Unavailable,
            DashboardDataNetworkResult.Unavailable, now
        )
        assertTrue(evidence.all { it.observedAt == null })
        assertTrue(evidence.none { it.source == "CHM" })
    }
}
