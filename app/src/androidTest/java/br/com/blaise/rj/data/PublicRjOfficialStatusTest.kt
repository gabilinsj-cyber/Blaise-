package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

@RunWith(AndroidJUnit4::class)
class PublicRjOfficialStatusTest {
    private val now = Instant.parse("2026-10-10T18:00:00Z")
    private val before = "2026-10-10T17:59:00Z"
    private val after = "2026-10-10T19:00:00Z"
    private fun fixture(): JSONObject {
        val rowList=JSONArray()
        RioMunicipalities.all.forEach { city ->
            val risk=if(city.ibgeCode==3304557) JSONObject()
                .put("level",4).put("label","ALTO")
                .put("sourceName","CEMADEN-RJ / Defesa Civil RJ")
                .put("observedAt",before)
                .put("sourceUrl",
                    "https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro")
                else JSONObject.NULL
            rowList.put(JSONObject()
                .put("ibge",city.ibgeCode.toString())
                .put("name",city.name)
                .put("seaFacing",false)
                .put("risk",risk)
                .put("warningIds",
                    if(city.ibgeCode==3304557) JSONArray().put("inmet-fixture") else JSONArray())
                .put("warningCoverage","EXACT_IBGE_ONLY"))
        }
        val warning=JSONObject()
            .put("id","inmet-fixture").put("event","Tempestade")
            .put("severity","Severe").put("sent",before)
            .put("onset",before).put("expires",after)
            .put("sourceUrl","https://apiprevmet3.inmet.gov.br/avisos/rss")
            .put("municipalityIbges",JSONArray().put("3304557"))
            .put("attribution","EXACT_IBGE")
        return JSONObject()
            .put("contract",PUBLIC_RJ_STATUS_CONTRACT)
            .put("scope","RJ_92_MUNICIPALITIES")
            .put("generatedAt",before)
            .put("workerActive",true).put("usableOfficialProducts",true)
            .put("thirdPartyImagesIncluded",false).put("subscriberDataIncluded",false)
            .put("municipalities",rowList).put("warnings",JSONArray().put(warning))
    }
    private fun healthFixture(): JSONObject {
        val ids = listOf("alerta-rio", "defesa-civil", "inmet", "inpe-cptec", "windy")
        val products = listOf("CHUVA_REDE_DE_ESTACOES",
            "ATIVOS_GEOGRAFICOS_SIRENES_E_APOIO", "AVISOS_CAP", null, null)
        val kinds = listOf("OFFICIAL_OBSERVATION", "OFFICIAL_GEOGRAPHIC_ASSETS",
            "OFFICIAL_WARNINGS", "FORECAST_PRODUCTS_NOT_STATION_OBSERVATIONS",
            "COMPARATIVE_FORECAST_MODELS_NOT_OBSERVATIONS")
        val rows = JSONArray()
        ids.forEachIndexed { index, id ->
            rows.put(JSONObject()
                .put("id", id)
                .put("label", listOf("Alerta Rio", "Defesa Civil RJ", "INMET",
                    "INPE/CPTEC", "Windy")[index])
                .put("product", products[index] ?: JSONObject.NULL)
                .put("kind", kinds[index])
                .put("coverage", "RJ_BY_EXACT_VERIFIED_COVERAGE")
                .put("status", if (index == 2) "CURRENT_PRODUCT_ONLY" else "NOT_CONNECTED")
                .put("observedAt", if (index == 2) before else JSONObject.NULL)
                .put("provenRealTimeFor92Cities", false)
                .put("temperatureServiceConnected", false)
                .put("radarFramesConnected", false))
        }
        return JSONObject()
            .put("contract", "BLAISE_RJ_FIVE_SOURCE_HEALTH_V1")
            .put("scope", "RJ_92_MUNICIPALITIES_BY_VERIFIED_COVERAGE")
            .put("generatedAt", before)
            .put("workerRunning", true)
            .put("sources", rows)
            .put("fiveSimultaneousLiveFeedsConfirmed", false)
            .put("weatherRadarSpatialFramesConfirmed", false)
            .put("noSubstitutedStateMeasurements", true)
    }
    @Test fun fiveSourceReadinessParsesOnlyProductEvidenceAndNeverClaimsFiveLiveFeeds() {
        val root = fixture().put("fiveSourceHealth", healthFixture())
        val status = PublicRjStatusParser.parse(root)
        assertEquals(5, status.fiveSourceHealth?.sources?.size)
        assertEquals("CURRENT_PRODUCT_ONLY", status.fiveSourceHealth?.sources?.get(2)?.status)
        assertEquals("AVISOS_CAP", status.fiveSourceHealth?.sources?.get(2)?.product)
        assertEquals("NOT_CONNECTED", status.fiveSourceHealth?.sources?.get(3)?.status)
        assertTrue(status.fiveSourceHealth?.current(now) == true)
        assertFalse(status.fiveSourceHealth?.current(now.plusSeconds(180)) == true)
    }
    @Test fun rejectsPhantomWindyFeedAndFalseRadarSuccess() {
        val falseWindy = healthFixture()
        falseWindy.getJSONArray("sources").getJSONObject(4)
            .put("status", "CURRENT_PRODUCT_ONLY")
        assertTrue(runCatching { PublicRjStatusParser.parse(
            fixture().put("fiveSourceHealth", falseWindy)) }.isFailure)
        val falseRadar = healthFixture().put("weatherRadarSpatialFramesConfirmed", true)
        assertTrue(runCatching { PublicRjStatusParser.parse(
            fixture().put("fiveSourceHealth", falseRadar)) }.isFailure)
    }

    @Test fun parsesOnlyExactOfficialMunicipalityAndRecentWarnings() {
        val result=PublicRjStatusParser.parse(fixture())
        assertEquals(92,result.municipalities.size)
        assertTrue(result.current(now))
        assertEquals(4,result.municipality(3304557,now)?.risk?.level)
        assertEquals(1,result.warningsFor(3304557,now).size)
        assertTrue(result.warningsFor(3303302,now).isEmpty())
        assertFalse(result.current(now.plusSeconds(180)))
        assertNull(result.municipality(3304557,now.plusSeconds(180)))
        assertTrue(result.warningsFor(3304557,now.plusSeconds(180)).isEmpty())
    }
    @Test fun rejectsFakeMunicipalityAssignmentAndUnknownContract() {
        val root=fixture()
        root.put("contract","ANOTHER_CONTRACT")
        assertTrue(runCatching { PublicRjStatusParser.parse(root) }.isFailure)
        val invalid=fixture()
        invalid.getJSONArray("municipalities").getJSONObject(0)
            .put("name","Other city")
        assertTrue(runCatching { PublicRjStatusParser.parse(invalid) }.isFailure)
    }
    @Test fun publicStatusClientRejectsHttpAndNeverNeedsPurchaseId() {
        assertNull(PublicRjStatusHttpsClient.create(""))
        assertNull(PublicRjStatusHttpsClient.create("http://example.test"))
        assertNull(PublicRjStatusHttpsClient.create("https://user:pass@example.test"))
        assertNull(PublicRjStatusHttpsClient.create("https://example.test/path"))
        assertNotNull(PublicRjStatusHttpsClient.create("https://example.test/"))
    }
}
