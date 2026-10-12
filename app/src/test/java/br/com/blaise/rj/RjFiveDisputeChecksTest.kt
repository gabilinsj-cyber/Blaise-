package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjFiveDisputeChecksTest {
    @Test fun inpeAndInmetAreTheFirstTwoQualityChecks() {
        val checks = RjMeteorologicalTables.fiveDisputeChecks
        assertEquals(5, checks.size)
        assertTrue(checks[0].title.startsWith("INPE/CPTEC"))
        assertTrue(checks[1].title.startsWith("INMET"))
        assertTrue(checks[2].title.contains("OpenWeatherMap"))
        assertTrue(checks[3].title.contains("Windy"))
        assertTrue(checks[4].title.contains("Copernicus"))
        assertFalse(checks.any { it.decision.contains("INEA") })
    }

    @Test fun alertsAndRawForecastsStaySeparateFromObservedWeightedMeasurements() {
        assertTrue(RjMeteorologicalTables.METHOD.contains("medição + previsão separadas"))
        assertTrue(RjMeteorologicalTables.LIVE_STATUS.contains("não confirmada"))
        assertEquals(30, RjMeteorologicalTables.table1.size)
        assertEquals(13, RjMeteorologicalTables.table2.size)
    }
}
