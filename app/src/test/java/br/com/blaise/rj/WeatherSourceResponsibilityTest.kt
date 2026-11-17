package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test

class WeatherSourceResponsibilityTest {
    @Test fun sourceMatrixPreservesProvenanceAndNeverClaimsUnverifiedRealTimeData() {
        val list = WeatherSourceResponsibilities.providers
        assertEquals(9, list.size)
        assertEquals(list.size, list.map { it.id }.toSet().size)
        val met = list.single { it.id == "MET_NO_ECMWF" }
        assertEquals("ECMWF_IFS", met.originFamily)
        assertFalse(list.any {
            it.id.contains("INMET") || it.id.contains("CEMADEN") ||
                it.id.contains("JAXA") || it.id.contains("NASA_IMERG")
        })
        val coast = list.single { it.id == "NOAA_COASTWATCH" }
        val eumetsat = list.single { it.id == "EUMETSAT_OSI_SAF" }
        assertEquals(coast.originFamily, eumetsat.originFamily)
        assertEquals("E", eumetsat.nature)
    }

    @Test fun sourceCannotAppearLiveMerelyBecauseItIsInTheCatalog() {
        for (item in WeatherSourceResponsibilities.providers) {
            val state = WeatherSourceResponsibilities.availability(
                item.id, false, false, false)
            assertTrue(state.contains("SEM") || state.contains("NÃO HOMOLOGADA"))
        }
        assertEquals("COLETA DO PRODUTO NÃO HOMOLOGADA",
            WeatherSourceResponsibilities.availability("DWD_ICON", true, true, true))
        assertEquals("PREVISÃO VALIDADA NO BACKEND",
            WeatherSourceResponsibilities.availability("MET_NO_ECMWF", true, false, false))
        assertEquals("MODELO MARÍTIMO VALIDADO",
            WeatherSourceResponsibilities.availability("NOAA_GFS_WAVE", false, true, false))
        assertEquals("PREVISÃO DE CÉU LIMPO VALIDADA",
            WeatherSourceResponsibilities.availability("CAMS_UV_VIA_MET", true, false, true))
    }
}
