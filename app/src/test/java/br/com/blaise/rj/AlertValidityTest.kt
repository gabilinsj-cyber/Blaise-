package br.com.blaise.rj

import br.com.blaise.rj.core.AlertValidity
import br.com.blaise.rj.core.AlertValidityPolicy
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class AlertValidityTest {
    private val issued = Instant.parse("2026-10-14T12:00:00Z")
    private val onset = issued.plusSeconds(600)
    private val expiry = issued.plusSeconds(7200)
    private fun state(now: Instant, current: Boolean = true) =
        AlertValidityPolicy.evaluate(issued, onset, expiry, now, current)

    @Test fun futureOnsetIsNotAnActiveEvent() {
        assertEquals(AlertValidity.SCHEDULED, state(issued))
    }
    @Test fun reviewAfterOneHourDoesNotRevokeTheIssuer() {
        assertEquals(AlertValidity.ACTIVE, state(onset.plusSeconds(3599)))
        assertEquals(AlertValidity.REVIEW_DUE, state(onset.plusSeconds(3600)))
    }
    @Test fun staleSourceIsNotExpiration() {
        assertEquals(AlertValidity.UNVERIFIED, state(onset.plusSeconds(3600), false))
    }
    @Test fun expiryBoundaryWorksEvenOffline() {
        assertEquals(AlertValidity.EXPIRED, state(expiry, false))
    }
    @Test fun futureIssuanceAndInvalidWindowAreUnverified() {
        assertEquals(AlertValidity.UNVERIFIED, state(issued.minusSeconds(1)))
        assertEquals(AlertValidity.UNVERIFIED,
            AlertValidityPolicy.evaluate(issued, onset, onset, onset, true))
    }
}
