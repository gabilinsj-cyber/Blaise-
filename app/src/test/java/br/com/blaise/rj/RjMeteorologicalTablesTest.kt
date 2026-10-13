package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjMeteorologicalTablesTest {
    @Test fun firstTenReproduceApprovedReferenceOrder() {
        val expected = listOf(
            "TEMPERATURA", "SENSACAO_TERMICA", "CHUVA_ATUAL",
            "CHUVA_ACUMULADA", "TEMPORAL", "VENTO", "RAJADA",
            "PRESSAO_ATMOSFERICA", "UMIDADE", "GRANIZO",
        )
        assertEquals(expected, RjMeteorologicalTables.table1.take(10).map { it.code })
        assertTrue(RjMeteorologicalTables.table1.take(10).all {
            it.priority.contains("OpenWeatherMap")
        })
    }

    @Test fun expandedTablesMatchThirtyDistinctCategoriesAndFiveExtraDisputeChecks() {
        assertEquals(30, RjMeteorologicalTables.PHENOMENA_COUNT)
        assertEquals(30, RjMeteorologicalTables.table1.size)
        assertEquals(30, RjMeteorologicalTables.table1.map { it.code }.distinct().size)
        assertEquals(5, RjMeteorologicalTables.ADDITIONAL_TIEBREAK_CHECKS)
        assertEquals(13, RjMeteorologicalTables.table2.size)
        assertEquals((1..13).map { "%02d".format(it) },
            RjMeteorologicalTables.table2.map { it.code })
    }

    @Test fun marineProductsAreRegisteredWithoutClaimingLiveConnectionsOrInea() {
        val byKey = RjMeteorologicalTables.table1.associateBy { it.code }
        listOf("ONDAS","SWELL","RESSACA","MARE","CORRENTES_MARINHAS",
            "TEMPERATURA_MAR").forEach {
            assertTrue(byKey[it]?.priority?.contains("Copernicus Marine") == true)
        }
        listOf("CICLONE_EXTRATROPICAL","CHUVA_ATLANTICO").forEach {
            assertTrue(byKey[it]?.priority?.contains("EUMETSAT") == true)
        }
        assertFalse(RjMeteorologicalTables.table1.any {
            it.priority.contains("INEA") || it.code.contains("INEA")
        })
        assertTrue(RjMeteorologicalTables.LIVE_STATUS.contains("não confirmada"))
    }
    @Test fun interfaceCatalogShowsBothStagesAndMaritimeProvidersWithoutInventedLiveStatus() {
        assertEquals(3, FinalDashboardSpec.table1PrincipalSources.size)
        assertEquals(5, FinalDashboardSpec.table2DisputeSources.size)
        assertEquals(5, FinalDashboardSpec.marineSourceViewers.size)
        assertTrue(FinalDashboardSpec.table1PrincipalSources[0].contains("Alerta Rio"))
        assertTrue(FinalDashboardSpec.table1PrincipalSources[2].contains("OpenWeatherMap"))
        assertTrue(FinalDashboardSpec.table2DisputeSources[0].contains("INPE/CPTEC"))
        assertTrue(FinalDashboardSpec.table2DisputeSources[4].contains("NOAA"))
        assertEquals(
            listOf("Alerta Rio", "Defesa Civil", "INMET",
                "INPE/CPTEC (previsões)", "Windy (modelos)"),
            FinalDashboardSpec.fiveSituationalWeatherSources
        )
        assertEquals(setOf("MARINHA_CHM","NOAA","COPERNICUS_MY_OCEAN","COPERNICUS_PRO","EUMETSAT"),
            FinalDashboardSpec.marineSourceViewers.map { it.sourceId }.toSet())
        assertTrue(FinalDashboardSpec.marineSourceViewers.all {
            it.url.startsWith("https://") && it.productStatus.contains("não validada")
        })
        assertTrue(FinalDashboardSpec.meteorologicalSourceViewers.any {
            it.sourceId == "OPENWEATHERMAP"
        })
        assertEquals(30,RjMeteorologicalTables.table1.size)
        assertEquals(13,RjMeteorologicalTables.table2.size)
    }

}
