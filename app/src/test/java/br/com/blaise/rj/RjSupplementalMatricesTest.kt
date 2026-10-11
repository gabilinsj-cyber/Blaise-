package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjSupplementalMatricesTest {
    @Test fun firstTenPreserveOpenWeatherMapAsThirdConsultation() {
        val matrix = RjMeteorologicalTables.table1ThirdSource
        assertEquals(10, matrix.size)
        assertEquals(10, matrix.map { it.code }.distinct().size)
        assertEquals("Temperatura", matrix.first().phenomenon)
        assertEquals("Granizo", matrix.last().phenomenon)
        assertTrue(matrix.all { it.thirdSource == "OpenWeatherMap" })
        assertTrue(matrix.all { it.primaryAuthorities.contains("Alerta Rio") &&
            it.primaryAuthorities.contains("Defesa Civil RJ") })
        assertTrue(matrix.all { !it.qualification.contains("INEA") })
    }

    @Test fun original25PhenomenaAndEightArbitrationRulesRemainUntouched() {
        assertEquals(25, RjMeteorologicalTables.table1.size)
        assertEquals(8, RjMeteorologicalTables.table2.size)
        assertTrue(RjMeteorologicalTables.table2.any { it.title.contains("INPE") })
        assertTrue(RjMeteorologicalTables.table2.any { it.title.contains("Windy") })
        assertFalse(RjMeteorologicalTables.table1.any { it.code.contains("INEA") })
    }

    @Test fun marineSupplementRetainsFivePhenomenaAndOfficialTsunamiAuthority() {
        val marine = RjMeteorologicalTables.marineComplement
        assertEquals(5, marine.size)
        assertTrue(marine.first().providers.contains("EUMETSAT"))
        assertTrue(marine.first().providers.contains("Copernicus Marine"))
        assertTrue(marine.any { it.code == "ONDAS_SWELL" && it.providers.contains("Copernicus") })
        assertTrue(marine.any { it.code == "RESSACA_LITORAL_RJ" && it.providers.contains("boias") })
        assertTrue(marine.any { it.code == "TSUNAMI" &&
            it.providers.contains("autoridades brasileiras") })
    }
}
