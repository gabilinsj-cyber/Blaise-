package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test

class WeatherSourceResponsibilityTest {
    @Test fun sourceMatrixPreservesProvenanceAndNeverClaimsUnverifiedRealTimeData() {
        val list = WeatherSourceResponsibilities.providers
        assertEquals(14, list.size)
        assertEquals(list.size, list.map { it.id }.toSet().size)
        val german = list.single { it.id == "DWD_ICON" }
        assertEquals("DWD_ICON", german.originFamily)
        assertEquals("P", german.nature)
        assertTrue(german.sectors.contains("Temperatura do ar a 2 m"))
        assertTrue(german.sectors.contains("PREVISTA"))
        assertTrue(german.sectors.contains("não estação física"))
        assertFalse(german.currentlyIntegratedProduct)
        val met = list.single { it.id == "MET_NO_ECMWF" }
        assertEquals("ECMWF_IFS", met.originFamily)
        assertFalse(list.any {
            it.id.contains("INMET") || it.id.contains("CEMADEN") ||
                it.id.contains("JAXA") || it.id.contains("NASA") ||
                it.id.contains("EUMETSAT")
        })
        assertTrue(met.sectors.contains("SEM temperatura ou sensação térmica"))
        assertTrue(list.single { it.id == "NOAA_GFS_ATMOS" }.sectors.contains("EXCLUÍDO de temperatura"))
        val coast = list.single { it.id == "NOAA_COASTWATCH_SST" }
        assertEquals("E", coast.nature)
        assertTrue(coast.sectors.contains("somente pixel validado"))
        val owm = list.single { it.id == "OPENWEATHER_AGENT13" }
        assertEquals("E", owm.nature)
        assertFalse(owm.currentlyIntegratedProduct)
        assertTrue(owm.sectors.contains("Temperatura e sensação térmica"))
        assertFalse(owm.sectors.contains("avisos"))
        val hg = list.single { it.id == "HG_BRASIL_WEATHER_PRO" }
        assertEquals("E", hg.nature)
        assertEquals("HG_BRASIL_AGGREGATED", hg.originFamily)
        assertFalse(hg.currentlyIntegratedProduct)
        assertTrue(hg.sectors.contains("autorização comercial escrita recebida"))
        assertTrue(hg.sectors.contains("Origem individual das estações não é informada"))
        val vc = list.single { it.id == "VISUAL_CROSSING_FREE" }
        assertEquals("E/P", vc.nature)
        assertEquals("VISUAL_CROSSING_FREE", vc.originFamily)
        assertFalse(vc.currentlyIntegratedProduct)
        assertTrue(vc.sectors.contains("cache não foi salvo"))
        val weatherApi = list.single { it.id == "WEATHERAPI_FREE" }
        assertEquals("WEATHERAPI_FREE", weatherApi.originFamily)
        assertEquals("E/P", weatherApi.nature)
        assertFalse(weatherApi.currentlyIntegratedProduct)
        assertTrue(weatherApi.sectors.contains("SEM CHAVE OU TESTE REAL"))
        assertTrue(weatherApi.sectors.contains("alertas oficiais"))
        val meteoblue = list.single { it.id == "METEOBLUE_FREE_FORECAST" }
        assertEquals("P", meteoblue.nature)
        assertEquals("METEOBLUE_MLM", meteoblue.originFamily)
        assertFalse(meteoblue.currentlyIntegratedProduct)
        assertTrue(meteoblue.sectors.contains("não homologada") ||
            meteoblue.sectors.contains("não homologado"))
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
                state.contains("CONTINGÊNCIA TÉRMICA CONDICIONAL") ||
                state.contains("ASSINATURA ADIADA") ||
                state.contains("1 RESPOSTA REAL PRIVADA") ||
                state.contains("CANDIDATA FREE"))
        }
        assertTrue(WeatherSourceResponsibilities.availability(
            "HG_BRASIL_WEATHER_PRO", true, true, true).contains("ASSINATURA ADIADA"))
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
