package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FinalDashboardSpecTest {

    @Test
    fun `two public specialist sources appear in Table 1 without altering the 25 phenomenon categories`() {
        assertEquals(25, RjMeteorologicalTables.table1.size)
        assertEquals(8, RjMeteorologicalTables.table2.size)
        assertEquals(2, RjMeteorologicalTables.additionalSources.size)
        assertEquals(listOf("MONITORAR_RIO_SMAC", "MONITORA_RJ_SES"),
            RjMeteorologicalTables.additionalSources.map { it.code })
        assertTrue(RjMeteorologicalTables.table1.any { it.code == "TEMPERATURA" && it.priority.contains("MonitorAr-Rio") })
        assertTrue(RjMeteorologicalTables.table1.any { it.code == "SENSACAO_TERMICA" && it.priority.contains("Monitora RJ") })
        assertTrue(RjMeteorologicalTables.additionalSources[0].scope.contains("Município do Rio"))
        assertTrue(RjMeteorologicalTables.additionalSources[1].independenceRule.contains("não são"))
        assertTrue(RjMeteorologicalTables.table1.none { it.priority.contains("INEA") })
    }

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
}
