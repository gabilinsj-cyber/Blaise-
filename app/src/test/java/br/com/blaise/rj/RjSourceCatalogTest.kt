package br.com.blaise.rj

import br.com.blaise.rj.data.StatewideSource
import org.junit.Assert.*
import org.junit.Test

class RjSourceCatalogTest {
    @Test fun exactlyEightApprovedPrimaryMeteorologicalSources() {
        val expected = listOf(
            "Alerta Rio / COR.Rio", "Defesa Civil RJ", "INMET", "INPE / CPTEC",
            "CEMADEN", "NOAA", "EUMETSAT", "JAXA / GSMaP",
        )
        assertEquals(expected, RjSourceCatalog.meteorological.map { it.name })
        assertEquals(expected.distinct().size, expected.size)
        assertEquals(expected, FinalDashboardSpec.officialSources.take(8))
    }

    @Test fun bannedSourcesCannotBecomeVisibleViaBackendLabels() {
        for (forbidden in listOf("INEA", "Marinha do Brasil", "CHM", "Copernicus", "Windy")) {
            assertFalse(RjSourceCatalog.mayShowBackendSource(
                StatewideSource("inmet", forbidden, listOf("tempo"), "RJ", "CURRENT", "temperatura")
            ))
            assertFalse(RjSourceCatalog.mayShowBackendSource(
                StatewideSource("noaa", "NOAA", listOf("ondas"), "RJ", "CURRENT", forbidden)
            ))
        }
        assertFalse(RjSourceCatalog.mayShowBackendSource(
            StatewideSource("chm", "CHM", emptyList(), "RJ", "CURRENT", "waves")
        ))
    }

    @Test fun maritimePanelsRejectLegacyAndUnrecognizedSourceNames() {
        for (forbidden in listOf("INEA", "Marinha do Brasil", "CHM", "Copernicus", "Windy",
            "NOAA from CHM cache", "Unknown vendor")) {
            assertFalse(RjSourceCatalog.mayShowMarineSource(forbidden))
        }
        assertTrue(RjSourceCatalog.mayShowMarineSource("NOAA GFS-Wave"))
        assertTrue(RjSourceCatalog.mayShowMarineSource("INPE / CPTEC"))
        assertTrue(RjSourceCatalog.mayShowMarineSource("EUMETSAT"))
    }

    @Test fun catalogNeverInventsLiveAvailability() {
        val noaa = RjSourceCatalog.meteorological.first { it.id == "noaa" }
        assertEquals("Conexão em tempo real não comprovada", RjSourceCatalog.connectionLabel(noaa, null))
        assertTrue(RjSourceCatalog.mayShowBackendSource(
            StatewideSource("noaa", "NOAA", listOf("waves"), "RJ", "UNAVAILABLE", null)
        ))
    }

    @Test fun optionalVisualizationNotMisclassifiedAsOfficialMeteorology() {
        val primary = RjSourceCatalog.meteorological.map { it.name }.toSet()
        assertFalse("Weather.com" in primary)
        assertFalse("Earth Nullschool" in primary)
        assertFalse(FinalDashboardSpec.officialSources.any {
            it.contains("INEA", ignoreCase = true) ||
                it.contains("Marinha", ignoreCase = true) ||
                it.contains("Copernicus", ignoreCase = true) ||
                it.contains("Windy", ignoreCase = true)
        })
    }
}
