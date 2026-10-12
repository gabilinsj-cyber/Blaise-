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

    @Test fun tenOpenWeatherAndFiveMarineReferencesMatchApprovedTables() {
        assertEquals(10, RjMeteorologicalTables.table1ThirdSource.size)
        assertTrue(RjMeteorologicalTables.table1ThirdSource.all {
            it.complementarySource == "OpenWeatherMap"
        })
        assertTrue(RjMeteorologicalTables.table1ThirdSource.first().p1Sources.contains("Defesa Civil"))
        assertEquals("GRANIZO",RjMeteorologicalTables.table1ThirdSource.last().code)
        assertEquals(5,RjMeteorologicalTables.marineComplement.size)
        assertTrue(RjMeteorologicalTables.marineComplement.any {
            it.code == "CICLONE_OCEANICO" && it.sources.contains("EUMETSAT")
        })
        assertTrue(RjMeteorologicalTables.marineComplement.any {
            it.code == "ONDAS_SWELL" && it.sources.contains("Copernicus Marine")
        })
        assertTrue(RjMeteorologicalTables.marineComplement.any {
            it.code == "TSUNAMI" && it.sources.contains("autoridades brasileiras")
        })
    }

    @Test fun alertsAndRawForecastsStaySeparateFromObservedWeightedMeasurements() {
        assertTrue(RjMeteorologicalTables.METHOD.contains("medição + previsão separadas"))
        assertTrue(RjMeteorologicalTables.LIVE_STATUS.contains("não confirmada"))
        assertEquals(30, RjMeteorologicalTables.table1.size)
        assertEquals(13, RjMeteorologicalTables.table2.size)
    }
}
