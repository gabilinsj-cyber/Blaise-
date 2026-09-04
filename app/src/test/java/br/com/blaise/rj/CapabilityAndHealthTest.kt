package br.com.blaise.rj

import br.com.blaise.rj.core.SourceHealthMonitor
import br.com.blaise.rj.core.SourceHealthPolicy
import br.com.blaise.rj.core.SourceHealthState
import br.com.blaise.rj.observability.AggregatingObservability
import br.com.blaise.rj.voice.TtsCapabilityPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class CapabilityAndHealthTest {
    private val now = Instant.parse("2026-09-04T14:00:00Z")

    @Test fun `source health fails closed when never successful and degrades after failure`() {
        val monitor = SourceHealthMonitor()
        monitor.recordFailure("defesa-civil-rj", now)
        val unavailable = monitor.snapshot().single()
        assertEquals(SourceHealthState.UNAVAILABLE, SourceHealthPolicy.state(unavailable, now, 60))

        monitor.recordSuccess("defesa-civil-rj", now)
        monitor.recordFailure("defesa-civil-rj", now.plusSeconds(30))
        val degraded = monitor.snapshot().single()
        assertEquals(SourceHealthState.DEGRADED, SourceHealthPolicy.state(degraded, now.plusSeconds(30), 60))
        assertEquals(SourceHealthState.STALE, SourceHealthPolicy.state(degraded, now.plusSeconds(61), 60))
    }

    @Test fun `observability stores only allowlisted aggregate keys`() {
        val observability = AggregatingObservability(
            allowedComponents = setOf("alerts", "weather"),
            allowedMetrics = setOf("refresh.success"),
        )
        observability.metric("refresh.success", 2)
        observability.metric("user.email", 1)
        observability.error("alerts", IllegalStateException("sensitive payload must not be retained"))
        observability.error("unknown-user-component", IllegalStateException("ignored"))

        val snapshot = observability.snapshot()
        assertEquals(2L, snapshot["metric.refresh.success"])
        assertEquals(1L, snapshot["error.alerts"])
        assertFalse(snapshot.keys.any { it.contains("email") || it.contains("unknown-user") })
    }

    @Test fun `tts fallback remains Portuguese only and prefers Brazil`() {
        assertEquals("pt", TtsCapabilityPolicy.preferredLocales.first().language)
        assertEquals("BR", TtsCapabilityPolicy.preferredLocales.first().country)
        assertTrue(TtsCapabilityPolicy.preferredLocales.all { it.language == "pt" })
    }
}
