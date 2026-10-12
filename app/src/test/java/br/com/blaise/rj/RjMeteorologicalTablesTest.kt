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

    @Test fun screenshotTableOneHasExactlyTenRowsSeparateColumnsAndJointP1() {
        val table = RjMeteorologicalTables.referenceTable1
        assertEquals(10, table.size)
        assertEquals(RjMeteorologicalTables.table1.take(10).map { it.code },
            table.map { it.code })
        assertEquals("Chuva intensa e temporais", table[4].phenomenon)
        assertEquals("Vento sustentado", table[5].phenomenon)
        assertEquals("Rajadas fortes", table[6].phenomenon)
        assertTrue(table.all { it.jointP1 == "Alerta Rio + Defesa Civil RJ*" })
        assertTrue(table.all { it.thirdComplement == "OpenWeatherMap" })
        assertTrue(table.single { it.code == "CHUVA_ACUMULADA" }.conditionalProduct)
        assertTrue(table.single { it.code == "GRANIZO" }.conditionalProduct)
        assertEquals("2026-10-12.v3-tabela1", RjMeteorologicalTables.VERSION)
        assertTrue(RjMeteorologicalTables.THIRD_COMPLEMENT.contains("terceira consulta"))
    }

    @Test fun separateMarineTableMatchesFiveReferencePhenomenaWithoutUnsafeTsunamiInference() {
        val marine = RjMeteorologicalTables.maritimeReference
        assertEquals(5, marine.size)
        assertEquals(listOf(
            "Ciclones oceânicos", "Tempestades no Atlântico", "Ondas e swell",
            "Ressaca no litoral RJ", "Tsunami",
        ), marine.map { it.phenomenon })
        assertTrue(marine[0].consultationSources.contains("EUMETSAT"))
        assertTrue(marine[0].consultationSources.contains("Copernicus"))
        assertTrue(marine[1].consultationSources.contains("NOAA"))
        assertTrue(marine[3].consultationSources.contains("boias"))
        assertTrue(marine[4].consultationSources.contains("autoridades brasileiras"))
        assertFalse(marine[4].consultationSources.contains("EUMETSAT"))
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
