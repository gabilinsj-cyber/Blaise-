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
}
