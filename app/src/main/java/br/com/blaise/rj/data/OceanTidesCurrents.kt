package br.com.blaise.rj.data

import java.time.Duration
import java.time.Instant
import org.json.JSONObject
import kotlin.math.atan2
import kotlin.math.hypot

private const val COPERNICUS_URL = "https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description"
data class OceanModelRow(val validAt: Instant, val tideM: Double? = null, val levelM: Double? = null,
    val eastMs: Double? = null, val northMs: Double? = null) {
    val speedMs: Double? get() = if(eastMs != null && northMs != null) hypot(eastMs,northMs) else null
    val towardsDegrees: Double? get() = if(speedMs != null && speedMs!! > 0) (Math.toDegrees(atan2(eastMs!!,northMs!!))+360)%360 else null
}
data class OceanModelPoint(val latitude: Double, val longitude: Double, val depthM: Double?, val rows: List<OceanModelRow>) {
    fun nearest(now: Instant) = rows.filter { kotlin.math.abs(Duration.between(it.validAt,now).seconds) <= 3600 }
        .minByOrNull { kotlin.math.abs(Duration.between(it.validAt,now).seconds) }
}
data class OceanTidesCurrents(val fetchedAt: Instant, val seaLevel: OceanModelPoint, val currents: OceanModelPoint) {
    fun current(now: Instant) = Duration.between(fetchedAt,now).seconds in 0..300 && !fetchedAt.isAfter(now) &&
        seaLevel.nearest(now)?.tideM != null && seaLevel.nearest(now)?.levelM != null && currents.nearest(now)?.speedMs != null
}
internal fun parseOceanTidesCurrents(root: JSONObject): OceanTidesCurrents? = runCatching {
    val raw=root.optJSONObject("oceanTidesCurrents") ?: return null
    require(raw.getString("sourceId")=="copernicus-rj-tides-currents" && raw.getString("sourceUrl")==COPERNICUS_URL)
    require(raw.getString("productId")=="GLOBAL_ANALYSISFORECAST_PHY_001_024")
    require(raw.getString("kind")=="MODEL_FORECAST_NOT_OBSERVATION" && raw.getString("scope")=="OFFSHORE_POINT_NOT_COASTAL_BEACH")
    require(raw.getString("verticalDatum")=="MEAN_SEA_LEVEL_NOT_CHART_DATUM" && !raw.getBoolean("mayIssueWarning"))
    require(raw.isNull("issuedAt") && !raw.getBoolean("issuanceTimeKnown"))
    val fetched=Instant.parse(raw.getString("fetchedAt"))
    fun point(key: String, id: String, variables: List<String>, unit: String, bound: Double): OceanModelPoint {
        val p=raw.getJSONObject("products").getJSONObject(key)
        require(p.getString("datasetId")==id)
        val lat=p.getDouble("latitude");val lon=p.getDouble("longitude")
        require(lat.isFinite() && lat in -23.55..-23.45 && lon.isFinite() && lon in -43.05..-42.95)
        val depth=if(p.isNull("depthM")) null else p.getDouble("depthM")
        require(if(key=="currents") depth != null && depth.isFinite() && depth in 0.0..1.0 else depth==null)
        require(variables.all { p.getJSONObject("units").getString(it)==unit })
        val array=p.getJSONArray("rows");require(array.length() in 1..8)
        val rows=(0 until array.length()).map { i ->
            val r=array.getJSONObject(i);val valid=Instant.parse(r.getString("validAt"))
            require(Duration.between(fetched,valid).seconds in -3600..25200)
            fun quantity(v: String): Double? = if(r.isNull(v)) null else r.getDouble(v).also { require(it.isFinite() && it in -bound..bound) }
            if(key=="seaLevel") OceanModelRow(valid,tideM=quantity("ocean_tide"),levelM=quantity("total_sea_level"))
            else OceanModelRow(valid,eastMs=quantity("utotal"),northMs=quantity("vtotal"))
        }
        require(rows.map { it.validAt }.toSet().size==rows.size)
        return OceanModelPoint(lat,lon,depth,rows)
    }
    OceanTidesCurrents(fetched,
        point("seaLevel","cmems_mod_glo_phy_anfc_merged-sl_PT1H-i",listOf("ocean_tide","total_sea_level"),"m",20.0),
        point("currents","cmems_mod_glo_phy_anfc_merged-uv_PT1H-i",listOf("utotal","vtotal"),"m s-1",15.0))
        .also { require(it.current(fetched)) }
}.getOrNull()
