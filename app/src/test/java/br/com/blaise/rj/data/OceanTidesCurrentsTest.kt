package br.com.blaise.rj.data
import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
class OceanTidesCurrentsTest {
 private val now=Instant.parse("2026-10-17T03:30:00Z")
 private fun fixture(): JSONObject {
  val sea=JSONObject().put("datasetId","cmems_mod_glo_phy_anfc_merged-sl_PT1H-i").put("latitude",-23.5).put("longitude",-43).put("depthM",JSONObject.NULL)
   .put("units",JSONObject("""{"ocean_tide":"m","total_sea_level":"m"}"""))
   .put("rows",org.json.JSONArray("""[{"validAt":"2026-10-17T03:00:00Z","ocean_tide":-0.2,"total_sea_level":0.1}]"""))
  val flow=JSONObject().put("datasetId","cmems_mod_glo_phy_anfc_merged-uv_PT1H-i").put("latitude",-23.5).put("longitude",-43).put("depthM",0.494)
   .put("units",JSONObject("""{"utotal":"m s-1","vtotal":"m s-1"}"""))
   .put("rows",org.json.JSONArray("""[{"validAt":"2026-10-17T03:00:00Z","utotal":0.3,"vtotal":0.4}]"""))
  val raw=JSONObject().put("sourceId","copernicus-rj-tides-currents").put("sourceUrl","https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description")
   .put("productId","GLOBAL_ANALYSISFORECAST_PHY_001_024").put("kind","MODEL_FORECAST_NOT_OBSERVATION").put("scope","OFFSHORE_POINT_NOT_COASTAL_BEACH")
   .put("verticalDatum","MEAN_SEA_LEVEL_NOT_CHART_DATUM").put("issuedAt",JSONObject.NULL).put("issuanceTimeKnown",false).put("mayIssueWarning",false)
   .put("fetchedAt",now.toString()).put("products",JSONObject().put("seaLevel",sea).put("currents",flow))
  return JSONObject().put("oceanTidesCurrents",raw)
 }
 @Test fun vectorAndValidity() {
  val s=parseOceanTidesCurrents(fixture())!!;assertTrue(s.current(now));assertEquals(0.5,s.currents.nearest(now)!!.speedMs!!,0.000001)
  assertEquals(36.8698976,s.currents.nearest(now)!!.towardsDegrees!!,0.00001);assertFalse(s.current(now.plusSeconds(301)))
 }
 @Test fun rejectsUnverifiedDatumAndUnits() {
  val r=fixture();r.getJSONObject("oceanTidesCurrents").put("verticalDatum","CHART_DATUM");assertNull(parseOceanTidesCurrents(r))
  val p=fixture();p.getJSONObject("oceanTidesCurrents").getJSONObject("products").getJSONObject("currents").getJSONObject("units").put("utotal","knots");assertNull(parseOceanTidesCurrents(p))
 }
}
