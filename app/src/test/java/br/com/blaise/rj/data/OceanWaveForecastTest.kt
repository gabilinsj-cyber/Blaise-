package br.com.blaise.rj.data

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class OceanWaveForecastTest {
    private val now = Instant.parse("2026-10-16T22:55:00Z")
    private fun fixture() = JSONObject("""{"oceanWaveForecast":{
      "sourceId":"noaa-pacioos-rj-wave-forecast",
      "sourceUrl":"https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json",
      "kind":"MODEL_FORECAST_NOT_OBSERVATION","scope":"OFFSHORE_POINT_NOT_COASTAL_BEACH",
      "latitude":-23.5,"longitude":-43,"gridResolutionDegrees":0.5,
      "issuedAt":null,"issuanceTimeKnown":false,"fetchedAt":"2026-10-16T22:55:00Z",
      "mayIssueWarning":false,"providesTides":false,"providesCurrents":false,
      "forecasts":[{"validAt":"2026-10-16T22:00:00Z","heightM":1.61,"peakPeriodS":8.264462,
      "peakFromDegrees":144,"swellHeightM":null,"swellPeriodS":null,"swellFromDegrees":null}]}}""")
    @Test fun forecastKeepsItsValidTimeUnknownIssuanceAndMissingSwell() {
        val s = parseOceanWaveForecast(fixture())!!
        assertTrue(s.current(now))
        assertEquals(1.61,s.nearest(now)!!.heightM!!,0.001)
        assertNull(s.nearest(now)!!.swellHeightM)
        assertEquals(Instant.parse("2026-10-16T22:00:00Z"),s.points.single().validAt)
        assertFalse(s.current(now.plusSeconds(301)))
    }
    @Test fun spoofedCoastalClaimOrTideAuthorizationCannotEnterUi() {
        for(change in listOf<(JSONObject)->Unit>(
            { it.put("scope","COASTAL_BEACH_MEASUREMENT") },
            { it.put("longitude",-41.0) },
            { it.put("mayIssueWarning",true) },
            { it.put("providesTides",true) },
            { it.getJSONArray("forecasts").getJSONObject(0).put("heightM",-1) }
        )) {
            val p = fixture();change(p.getJSONObject("oceanWaveForecast"))
            assertNull(parseOceanWaveForecast(p))
        }
    }
}
