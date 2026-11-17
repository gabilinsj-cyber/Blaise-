package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FinalDashboardSpecTest {

    @Test
    fun `home dashboard preserves approved compact content counts`() {
        assertEquals(2, FinalDashboardSpec.HOME_LOCAL_NEWS_COUNT)
        assertEquals(1, FinalDashboardSpec.HOME_INTERNATIONAL_NEWS_COUNT)
        assertEquals(2, FinalDashboardSpec.HOME_SEISMIC_EVENT_COUNT)
        assertEquals(30, FinalDashboardSpec.RADAR_WINDOW_MINUTES)
    }

    @Test
    fun `store channels have explicit display names`() {
        assertEquals("Google Play", FinalDashboardSpec.storeDisplayName(FinalDashboardSpec.STORE_GOOGLE_PLAY))
        assertEquals("Samsung Galaxy Store", FinalDashboardSpec.storeDisplayName(FinalDashboardSpec.STORE_SAMSUNG))
        assertEquals("Amazon Appstore", FinalDashboardSpec.storeDisplayName(FinalDashboardSpec.STORE_AMAZON))
    }
    @Test fun `more than three city alerts opens additional page`() {
        assertFalse(FinalDashboardSpec.shouldOpenAdditionalAlertsPage(3))
        assertTrue(FinalDashboardSpec.shouldOpenAdditionalAlertsPage(4))
    }

    @Test fun `seismic notification requires magnitude seven and felt in Brazil`() {
        assertFalse(FinalDashboardSpec.shouldNotifySeismicEvent(6.9, true))
        assertFalse(FinalDashboardSpec.shouldNotifySeismicEvent(7.2, false))
        assertTrue(FinalDashboardSpec.shouldNotifySeismicEvent(7.0, true))
        assertTrue(FinalDashboardSpec.shouldNotifySeismicEvent(8.1, true))
    }
    @Test fun `thermal source hierarchy stays internal and is not active on subscriber UI`() {
        assertTrue(FinalDashboardSpec.THERMAL_DIAGNOSTICS_ADMIN_ONLY)
        assertFalse(FinalDashboardSpec.THERMAL_FALLBACK_INTEGRATED)
        assertEquals(35, FinalDashboardSpec.THERMAL_FALLBACK_INTERVAL_MINUTES)
        assertEquals(900, FinalDashboardSpec.THERMAL_DAILY_PROVIDER_BUDGET)
        assertEquals("OpenWeather/Agente 13", FinalDashboardSpec.THERMAL_LAST_RESORT)
        assertFalse(FinalDashboardSpec.officialSources.any { it.contains("Agente 13") })
    }

    @Test fun `no active color without independently validated Blaise notice`() {
        for (level in 1..5) {
            assertEquals(null, FinalDashboardSpec.validatedBlaiseNoticeColorArgb(level, false))
        }
        assertEquals(null, FinalDashboardSpec.validatedBlaiseNoticeColorArgb(null, true))
        assertEquals(null, FinalDashboardSpec.validatedBlaiseNoticeColorArgb(0, true))
        assertEquals(null, FinalDashboardSpec.validatedBlaiseNoticeColorArgb(6, true))
    }

    @Test fun `validated Blaise 1 to 5 risk levels have distinct colors`() {
        val colors = (1..5).map { level ->
            FinalDashboardSpec.validatedBlaiseNoticeColorArgb(level, true)
        }
        assertTrue(colors.all { it != null })
        assertEquals(5, colors.filterNotNull().toSet().size)
        assertEquals(0xFF16803D.toInt(), colors.first())
        assertEquals(0xFF7F1D1D.toInt(), colors.last())
    }

}
