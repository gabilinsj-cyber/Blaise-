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

    @Test fun latestTwoTablesPreserveThreePrimaryAndFiveFallbackSources() {
        assertEquals(3, RjMeteorologicalTables.table1PrimaryChannels.size)
        assertEquals(5, RjMeteorologicalTables.table2TieBreakChannels.size)
        assertTrue(RjMeteorologicalTables.table1PrimaryChannels[0].contains("Alerta Rio"))
        assertTrue(RjMeteorologicalTables.table1PrimaryChannels[1].contains("Defesa Civil"))
        assertTrue(RjMeteorologicalTables.table1PrimaryChannels[2].contains("OpenWeatherMap"))
        assertTrue(RjMeteorologicalTables.table2TieBreakChannels[0].contains("INPE"))
        assertTrue(RjMeteorologicalTables.table2TieBreakChannels[1].contains("INMET"))
        assertTrue(RjMeteorologicalTables.table2TieBreakChannels[2].contains("CEMADEN"))
        assertTrue(RjMeteorologicalTables.table2TieBreakChannels[3].contains("Windy"))
        assertTrue(RjMeteorologicalTables.table2TieBreakChannels[4].contains("NOAA"))
        assertTrue(RjMeteorologicalTables.TWO_SOURCE_RULE.contains("Duas medições oficiais"))
        assertTrue(RjMeteorologicalTables.TWO_TABLES_LIVE_NOTICE.contains("não comprovam"))
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
}
