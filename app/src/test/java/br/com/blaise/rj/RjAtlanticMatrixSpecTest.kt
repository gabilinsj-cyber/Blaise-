package br.com.blaise.rj

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjAtlanticMatrixSpecTest {
    @Test fun twentyFivePhenomenaPreserveCanonicalNumberingAndScope() {
        assertEquals(25, RjAtlanticMatrixSpec.rows.size)
        assertEquals((1..25).toList(), RjAtlanticMatrixSpec.rows.map { it.number })
        assertEquals("Temperatura", RjAtlanticMatrixSpec.rows.first().title)
        assertEquals("Qualidade do ar", RjAtlanticMatrixSpec.rows.last().title)
        assertEquals(25, RjAtlanticMatrixSpec.rows.map { it.title }.distinct().size)
        assertTrue(RjAtlanticMatrixSpec.title.contains("Blaise V6 RJ"))
    }
    @Test fun firstTenHaveOnlyOpenWeatherAsNewSupplementaryProvider() {
        assertTrue(RjAtlanticMatrixSpec.rows.take(10).all { it.addedProviders == "OpenWeatherMap" })
        assertTrue(RjAtlanticMatrixSpec.rows.drop(10).none { it.addedProviders == "OpenWeatherMap" })
        assertTrue(RjAtlanticMatrixSpec.rows.first().primaryPriority.contains("Alerta Rio"))
        assertTrue(RjAtlanticMatrixSpec.secretPolicy.contains("nunca no APK"))
    }
    @Test fun europeanSourcesTargetOnlyEightApprovedNumbersAndKeepLimits() {
        assertEquals(setOf(11,12,13,14,15,16,22,24),RjAtlanticMatrixSpec.europeanNumbers)
        val euro=RjAtlanticMatrixSpec.rows.filter {
            it.addedProviders.contains("EUMETSAT") || it.addedProviders.contains("Copernicus")
        }.map { it.number }.toSet()
        assertEquals(RjAtlanticMatrixSpec.europeanNumbers,euro)
        assertTrue(RjAtlanticMatrixSpec.rows[10].addedSourceRole.contains("sem raios diretos"))
        assertTrue(RjAtlanticMatrixSpec.rows[21].addedSourceRole.contains("Não mede rua alagada"))
        assertTrue(RjAtlanticMatrixSpec.rows[23].addedSourceRole.contains("Não substitui UV"))
    }
    @Test fun noNewSourceClaimsAlreadyLiveOrAuthoritativeWarnings() {
        assertTrue(RjAtlanticMatrixSpec.rows.all { it.liveStatus.contains("pendente") })
        assertFalse(RjAtlanticMatrixSpec.openWeatherCredit.contains("INMET"))
        assertTrue(RjAtlanticMatrixSpec.unavailableMessage.contains("não confirmados"))
    }
}
