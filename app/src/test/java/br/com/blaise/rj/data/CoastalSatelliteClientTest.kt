package br.com.blaise.rj.data

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CoastalSatelliteClientTest {
    private val now = Instant.parse("2026-10-16T22:00:00Z")
    private fun payload() = JSONObject("""{"feed":{"entry":[{
      "title":"HLS.L30.T23KQQ.2026283T124557.v2.0","time_start":"2026-10-10T12:45:57.330Z",
      "polygons":[["-23.5 -43.0 -23.5 -42.0 -22.5 -42.0 -22.5 -43.0 -23.5 -43.0"]],
      "links":[{"rel":"http://esipfed.org/ns/fedsearch/1.1/browse#",
      "href":"https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-public/HLSL30.020/HLS.L30.T23KQQ.2026283T124557.v2.0/image.jpg"}]
    }]}}""")
    @Test fun sceneKeepsOriginalAcquisitionAndSeparateConsultationTime() {
        val scene = CoastalSatelliteClient.parse(payload().toString(), CoastalMission.LANDSAT, now)!!
        assertEquals(Instant.parse("2026-10-10T12:45:57.330Z"), scene.acquiredAt)
        assertEquals(now, scene.checkedAt)
        assertNotNull(scene.previewUrl)
        assertTrue(scene.worldviewUrl.contains("t=2026-10-10"))
        assertTrue(scene.worldviewUrl.contains("v=-44.8,-23.6,-40.8,-20.8"))
    }
    @Test fun futureTimeWrongMissionAndSceneOutsideRjAreRejected() {
        for(change in listOf<(JSONObject)->Unit>(
            { it.put("time_start", "2026-10-17T12:00:00Z") },
            { it.put("title", "HLS.S30.T23KQQ.fixture") },
            { it.put("polygons", org.json.JSONArray("[[\"10 10 10 11 11 11 11 10\"]]")) }
        )) {
            val p = payload(); change(p.getJSONObject("feed").getJSONArray("entry").getJSONObject(0))
            assertTrue(runCatching { CoastalSatelliteClient.parse(p.toString(), CoastalMission.LANDSAT, now) }.isFailure)
        }
    }
    @Test fun untrustedPreviewIsNeverDownloadedAndEmptyInventoryDoesNotInventScene() {
        val p = payload()
        p.getJSONObject("feed").getJSONArray("entry").getJSONObject(0).getJSONArray("links")
            .getJSONObject(0).put("href", "https://evil.invalid/image.jpg")
        assertNull(CoastalSatelliteClient.parse(p.toString(), CoastalMission.LANDSAT, now)!!.previewUrl)
        assertNull(CoastalSatelliteClient.parse("{\"feed\":{\"entry\":[]}}", CoastalMission.SENTINEL, now))
        assertFalse(CoastalSatelliteClient.previewAllowed("https://data.lpdaac.earthdatacloud.nasa.gov.evil.invalid/lp-prod-public/HLSL30.020/HLS.L30.x.jpg", CoastalMission.LANDSAT))
        assertTrue(CoastalSatelliteClient.catalogueUrl(CoastalMission.SENTINEL).contains("short_name=HLSS30"))
    }
}
