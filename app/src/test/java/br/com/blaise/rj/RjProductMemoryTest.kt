package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjProductMemoryTest {
    @Test fun geographyAndPublicContractStayRJOnly() {
        assertEquals("Blaise V6 RJ", RjProductMemory.PRODUCT)
        assertEquals(92, RjProductMemory.MUNICIPALITIES)
        assertEquals("LIGADO", RjProductMemory.DEFAULT_POWER_STATE)
        assertFalse(RjProductMemory.approvedSources.any {
            forbidden -> RjProductMemory.excludedSources.any { excluded ->
                forbidden.contains(excluded, ignoreCase = true)
            }
        })
        assertEquals(RjProductMemory.approvedSources, FinalDashboardSpec.officialSources)
    }

    @Test fun cadenceAndFailClosedRemainExplicit() {
        assertEquals(300, RjProductMemory.refreshTargetSeconds(0))
        assertEquals(300, RjProductMemory.refreshTargetSeconds(3))
        assertEquals(60, RjProductMemory.refreshTargetSeconds(4))
        assertEquals(30, RjProductMemory.refreshTargetSeconds(5))
        val now = 1_700_000_000_000L
        assertFalse(RjProductMemory.isCurrentReading(null, now, 60_000L, true))
        assertFalse(RjProductMemory.isCurrentReading(now, now, 60_000L, false))
        assertFalse(RjProductMemory.isCurrentReading(now + 1, now, 60_000L, true))
        assertFalse(RjProductMemory.isCurrentReading(now - 60_001L, now, 60_000L, true))
        assertTrue(RjProductMemory.isCurrentReading(now - 60_000L, now, 60_000L, true))
        assertFalse(RjProductMemory.alertWithdrawalCanRemoveImmediately(false))
        assertTrue(RjProductMemory.alertWithdrawalCanRemoveImmediately(true))
    }

    @Test fun alertAndPrivacyProductPolicies() {
        assertEquals(3, RjProductMemory.ALERT_REVIEW_AFTER_HOURS)
        assertEquals(4, RjProductMemory.ALERT_DOWNGRADE_AFTER_HOURS)
        assertEquals(12, RjProductMemory.ALERT_HISTORY_HOURS)
        assertEquals(24, RjProductMemory.SCIENTIFIC_REPORT_RETENTION_HOURS)
        assertTrue(RjProductMemory.OFFICIAL_P0_ALERTS_REACH_NON_SUBSCRIBERS)
    }
}
