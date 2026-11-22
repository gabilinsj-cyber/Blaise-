package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.time.Duration
import java.time.Instant

/** Client-safe projection: only server-approved thermal fields.
 * HG and OpenWeather are E aggregated/estimated; DWD ICON is P model.
 * Climatempo radar, MET Norway/ECMWF and Visual Crossing cannot enter this DTO.
 * The client never receives keys, calculations, 14-agent activity or provider quotas.
 */
data class ApprovedThermalDisplay(
    val ibge: Int,
    val sourceId: String,
    val nature: String,
    val validAt: Instant,
    val checkedAt: Instant,
    val temperatureC: Double?,
    val feelsLikeC: Double?,
    val skyCondition: String?,
) {
    val sourceLabel = when(sourceId) {
        "HG_BRASIL_WEATHER_PRO" -> "HG Brasil • condições agregadas"
        "OPENWEATHER_ONECALL4_CURRENT" -> "OpenWeather • estimativa"
        else -> "DWD ICON • previsão de modelo"
    }
    fun valid(now: Instant): Boolean {
        val maxAge = when(sourceId) {
            "HG_BRASIL_WEATHER_PRO" -> 60L
            "OPENWEATHER_ONECALL4_CURRENT" -> 35L
            "DWD_ICON_GLOBAL" -> 60L
            else -> return false
        }
        return Duration.between(validAt,now).seconds in 0L..maxAge*60L &&
            Duration.between(checkedAt,now).seconds in 0L..720L
    }
}

object ApprovedThermalDisplayParser {
    private val keys = setOf(
        "ibge","sourceId","nature","validAt","checkedAt",
        "temperatureC","feelsLikeC","skyCondition","backendVerified",
        "commercialLicenseVerified","municipalityGeoVerified","contingencyAuthorized",
        "hgSubscriptionActive"
    )
    private fun reading(value: Any?, low: Double, high: Double): Double? {
        if(value == null)return null
        val n=(value as? Number)?.toDouble()
            ?: throw IllegalArgumentException("thermal_numeric_required")
        require(n.isFinite() && n in low..high)
        return n
    }
    fun parse(row: Any?, now: Instant): ApprovedThermalDisplay {
        val m=(row as? Map<*,*>) ?: throw IllegalArgumentException("invalid_thermal_row")
        require(m.keys == keys)
        require(m["backendVerified"]==true && m["commercialLicenseVerified"]==true &&
            m["municipalityGeoVerified"]==true)
        val ibge=(m["ibge"] as? String)?.toIntOrNull()
            ?: throw IllegalArgumentException("invalid_thermal_ibge")
        require(RioMunicipalities.byIbgeCode(ibge)!=null)
        val source=m["sourceId"] as? String ?: throw IllegalArgumentException("missing_thermal_source")
        val nature=m["nature"] as? String ?: throw IllegalArgumentException("missing_thermal_nature")
        require((source=="HG_BRASIL_WEATHER_PRO" && nature=="E") ||
            (source=="OPENWEATHER_ONECALL4_CURRENT" && nature=="E") ||
            (source=="DWD_ICON_GLOBAL" && nature=="P"))
        require(source!="OPENWEATHER_ONECALL4_CURRENT" ||
            m["contingencyAuthorized"]==true)
        // Written commercial permission alone does not authorize the paid
        // HG data feed before its account subscription and server collector.
        require(source!="HG_BRASIL_WEATHER_PRO" || m["hgSubscriptionActive"]==true)
        val valid=Instant.parse(m["validAt"] as? String
            ?: throw IllegalArgumentException("missing_thermal_valid"))
        val checked=Instant.parse(m["checkedAt"] as? String
            ?: throw IllegalArgumentException("missing_thermal_checked"))
        val temp=reading(m["temperatureC"],-60.0,65.0)
        val feels=reading(m["feelsLikeC"],-80.0,80.0)
        val sky=m["skyCondition"] as? String
        require(sky == null || (source=="HG_BRASIL_WEATHER_PRO" &&
            sky in setOf("SOL","CHUVA","NUBLADO","PARCIALMENTE_NUBLADO")))
        require(feels==null || source=="OPENWEATHER_ONECALL4_CURRENT")
        require(temp!=null || feels!=null || sky!=null)
        val result=ApprovedThermalDisplay(ibge,source,nature,valid,checked,temp,feels,sky)
        require(result.valid(now)) { "thermal_source_data_expired" }
        return result
    }
}
