package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test

class WeatherSourceResponsibilityTest {
    @Test fun sourceMatrixPreservesProvenanceAndNeverClaimsUnverifiedRealTimeData() {
        val list = WeatherSourceResponsibilities.providers
        assertEquals(12, list.size)
        assertEquals(list.size, list.map { it.id }.toSet().size)
        val met = list.single { it.id == "MET_NO_ECMWF" }
        assertEquals("ECMWF_IFS", met.originFamily)
        assertFalse(list.any {
            it.id.contains("INMET") || it.id.contains("CEMADEN") ||
                it.id.contains("JAXA") || it.id.contains("NASA")
        })
        val coast = list.single { it.id == "NOAA_COASTWATCH" }
        val eumetsat = list.single { it.id == "EUMETSAT_OSI_SAF" }
        assertEquals(coast.originFamily, eumetsat.originFamily)
        assertEquals("E", eumetsat.nature)
        val owm = list.single { it.id == "OPENWEATHER_AGENT13" }
        assertEquals("E", owm.nature)
        assertFalse(owm.currentlyIntegratedProduct)
        assertTrue(owm.sectors.contains("temperatura e sensação térmica"))
        assertFalse(owm.sectors.contains("avisos"))
        val meteoblue = list.single { it.id == "METEOBLUE_NEMS10" }
        assertEquals("P", meteoblue.nature)
        assertEquals("METEOBLUE_NEMS10", meteoblue.originFamily)
        assertFalse(meteoblue.currentlyIntegratedProduct)
        assertTrue(meteoblue.sectors.contains("não homologada"))
        val slider = list.single { it.id == "RAMMB_CIRA_SLIDER" }
        assertEquals("GOES_EAST", slider.originFamily)
        assertEquals("O", slider.nature)
        assertFalse(slider.currentlyIntegratedProduct)
        assertTrue(slider.sectors.contains("Não mede chuva"))
    }

    @Test fun sourceCannotAppearLiveMerelyBecauseItIsInTheCatalog() {
        for (item in WeatherSourceResponsibilities.providers) {
            val state = WeatherSourceResponsibilities.availability(
                item.id, false, false, false)
            assertTrue(state.contains("SEM") || state.contains("NÃO HOMOLOGADA") ||
                state.contains("CONSULTA VISUAL EXTERNA") ||
                state.contains("PREVISÃO CANDIDATA") ||
                state.contains("CONTINGÊNCIA TÉRMICA CONDICIONAL"))
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
