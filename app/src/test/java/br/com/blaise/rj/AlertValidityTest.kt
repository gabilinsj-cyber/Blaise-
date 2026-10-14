package br.com.blaise.rj

import br.com.blaise.rj.core.AlertValidity
import br.com.blaise.rj.core.AlertValidityPolicy
import br.com.blaise.rj.core.AlertUpdateAge
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class AlertValidityTest {
    @Test fun updateAgeUsesOfficialEmissionAndExactThreeFourHourBoundaries() {
        assertEquals(AlertUpdateAge.CURRENT, AlertValidityPolicy.updateAge(issued, issued.plusSeconds(10799)))
        assertEquals(AlertUpdateAge.NO_UPDATE_3H, AlertValidityPolicy.updateAge(issued, issued.plusSeconds(10800)))
        assertEquals(AlertUpdateAge.NO_UPDATE_3H, AlertValidityPolicy.updateAge(issued, issued.plusSeconds(14399)))
        assertEquals(AlertUpdateAge.NO_UPDATE_4H, AlertValidityPolicy.updateAge(issued, issued.plusSeconds(14400)))
        assertEquals(AlertUpdateAge.INVALID, AlertValidityPolicy.updateAge(issued, issued.minusNanos(1)))
    }

    @Test fun lackOfUpdateNeverLowersAnUnexpiredOfficialWarning() {
        val longExpiry = issued.plusSeconds(24 * 3600)
        val now = issued.plusSeconds(4 * 3600)
        assertEquals(AlertUpdateAge.NO_UPDATE_4H, AlertValidityPolicy.updateAge(issued, now))
        assertEquals(AlertValidity.REVIEW_DUE,
            AlertValidityPolicy.evaluate(issued, onset, longExpiry, now, true))
    }

    @Test fun historyEndsExactlyTwelveHoursAfterOfficialExpiry() {
        org.junit.Assert.assertTrue(AlertValidityPolicy.retainHistory(issued, expiry, expiry.plusSeconds(43199)))
        org.junit.Assert.assertFalse(AlertValidityPolicy.retainHistory(issued, expiry, expiry.plusSeconds(43200)))
        org.junit.Assert.assertTrue(AlertValidityPolicy.retainHistory(issued, expiry, issued))
    }
    @Test fun noNewEmissionExpiresLocallyAtTwelveHoursEvenWithLongOfficialValidity() {
        val longExpiry = issued.plusSeconds(7 * 86400)
        assertEquals(AlertValidity.REVIEW_DUE,
            AlertValidityPolicy.evaluate(issued, onset, longExpiry, issued.plusSeconds(43199), true))
        assertEquals(AlertValidity.LOCAL_EXPIRED,
            AlertValidityPolicy.evaluate(issued, onset, longExpiry, issued.plusSeconds(43200), true))
        assertEquals(AlertValidity.LOCAL_EXPIRED,
            AlertValidityPolicy.evaluate(issued, onset, longExpiry, issued.plusSeconds(43200), false))
        org.junit.Assert.assertTrue(AlertValidityPolicy.retainHistory(issued, longExpiry, issued.plusSeconds(86399)))
        org.junit.Assert.assertFalse(AlertValidityPolicy.retainHistory(issued, longExpiry, issued.plusSeconds(86400)))
    }

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
