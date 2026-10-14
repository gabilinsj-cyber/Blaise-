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

    @Test fun explicitlyLabeledOpenWeatherMapThirdConsultationCoversAllTenOriginalPhenomena() {
        val firstTen = RjMeteorologicalTables.originalTenPhenomena
        assertEquals(10, firstTen.size)
        assertEquals(firstTen.map { it.code }.toSet(),
            RjMeteorologicalTables.openWeatherMapThirdComplement.keys)
        assertTrue(firstTen.all {
            RjMeteorologicalTables.openWeatherMapThirdComplement.getValue(it.code)
                .contains("OpenWeatherMap")
        })
        for (code in listOf("CHUVA_ACUMULADA", "GRANIZO")) {
            assertTrue(RjMeteorologicalTables.openWeatherMapThirdComplement.getValue(code)
                .contains("apenas se"))
        }
    }

    @Test fun maritimeSourceComplementPreservesOriginalFiveScreenshotCategories() {
        assertEquals(listOf(
            "CICLONES_MAR", "TEMPESTADE_ATLANTICO", "ONDAS_SWELL",
            "RESSACA_LITORAL", "TSUNAMI_MAREMOTO",
        ), RjMeteorologicalTables.marineComplement.map { it.code })
        val marine = RjMeteorologicalTables.marineComplement.associateBy { it.code }
        assertTrue(marine.getValue("CICLONES_MAR").priority.contains("EUMETSAT"))
        assertTrue(marine.getValue("ONDAS_SWELL").priority.contains("Copernicus Marine"))
        assertTrue(marine.getValue("RESSACA_LITORAL").priority.contains("Marinha"))
        assertTrue(marine.getValue("TSUNAMI_MAREMOTO").priority.contains("autoridades brasileiras"))
        assertTrue(RjMeteorologicalTables.marineComplement.none { it.priority.contains("INEA") })
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
    @Test fun everyRegisteredPhenomenonHasLinkedDecisionCriteria() {
        for (phenomenon in RjMeteorologicalTables.table1) {
            val linked = RjMeteorologicalTables.table2ForPhenomenon(phenomenon.code)
            assertTrue(linked.isNotEmpty())
            assertTrue(linked.any { it.code == "13" })
            assertEquals(linked.map { it.code }.distinct().size, linked.size)
        }
        assertTrue(RjMeteorologicalTables.table2ForPhenomenon("TEMPERATURA")
            .any { it.code == "11" })
    }

    @Test fun theTwoTablesNeverAverageWarningCategoriesOrPhenomenaWithoutObservedNumericInputs() {
        for (code in listOf("TEMPORAL","GRANIZO","TEMPESTADE","SISMO",
            "TSUNAMI","RESSACA","SENSACAO_TERMICA")) {
            assertFalse(RjMeteorologicalTables.canWeightOfficialObservations(code))
        }
        assertTrue(RjMeteorologicalTables.canWeightOfficialObservations("PRESSAO_ATMOSFERICA"))
        assertTrue(RjMeteorologicalTables.canWeightOfficialObservations("CHUVA_ACUMULADA"))
    }

    @Test fun marineReferenceContainsAllFiveCategoriesAndDirectLinksToTableOne() {
        assertEquals(5,RjMeteorologicalTables.marineTable.size)
        val available=RjMeteorologicalTables.table1.map { it.code }.toSet()
        for (entry in RjMeteorologicalTables.marineTable) {
            assertTrue(entry.linkedPhenomena.isNotEmpty())
            assertTrue(entry.linkedPhenomena.all { it in available })
            assertTrue(entry.sources.contains("Marinha") || entry.sources.contains("NOAA"))
        }
        val by=RjMeteorologicalTables.marineTable.associateBy { it.code }
        assertTrue(by.getValue("CICLONES_OCEANICOS").sources.contains("EUMETSAT"))
        assertTrue(by.getValue("ONDAS_SWELL").sources.contains("Copernicus"))
        assertFalse(by.getValue("TSUNAMI").sources.contains("EUMETSAT"))
    }

}
