package br.com.blaise.rj.core

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class AlertLifetimePolicyTest {
    private val now = Instant.parse("2026-10-14T16:00:00Z")
    private val alert = OfficialAlert("test", null, "Aviso", "INMET", Severity.P0, now.minusSeconds(10), now.plusSeconds(20))
    @Test fun `timeout closes notification at original expiry even when offline`() {
        assertEquals(20000L, AlertLifetimePolicy.remainingMillis(alert, now))
        assertNull(AlertLifetimePolicy.remainingMillis(alert, now.plusSeconds(20)))
        assertNull(AlertLifetimePolicy.remainingMillis(alert.copy(issuedAt = now.plusSeconds(1)), now))
    }
    @Test fun `UI clock wakes at nearest expiry and stays bounded`() {
        assertEquals(500L, AlertLifetimePolicy.nextRecheckMillis(listOf(now.plusMillis(500), now.plusSeconds(60)), now))
        assertEquals(30000L, AlertLifetimePolicy.nextRecheckMillis(listOf(now.minusSeconds(1)), now))
        assertEquals(1L, AlertLifetimePolicy.nextRecheckMillis(listOf(now.plusNanos(1)), now))
    }
}
