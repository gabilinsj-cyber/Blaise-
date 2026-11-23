package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.time.Duration
import java.time.Instant

/** Client-safe projection: only server-approved thermal fields.
 * HG, OpenWeather, Visual Crossing, WeatherAPI are E aggregates; ICON is P.
 * Climatempo radar, MET Norway/ECMWF cannot enter this DTO.
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
        "VISUAL_CROSSING_FREE" -> "Visual Crossing • estimativa"
        "WEATHERAPI_FREE" -> "WeatherAPI.com • estimativa"
        else -> "DWD ICON • previsão de modelo"
    }
    fun valid(now: Instant): Boolean {
        val maxAge = when(sourceId) {
            "HG_BRASIL_WEATHER_PRO" -> 60L
            "OPENWEATHER_ONECALL4_CURRENT" -> 35L
            "VISUAL_CROSSING_FREE" -> 30L
            "WEATHERAPI_FREE" -> 35L
            "DWD_ICON_GLOBAL" -> 60L
            else -> return false
        }
        val maxCheckAge = when(sourceId) {
            "VISUAL_CROSSING_FREE", "WEATHERAPI_FREE" -> maxAge*60L
            else -> 720L
        }
        return Duration.between(validAt,now).seconds in 0L..maxAge*60L &&
            Duration.between(checkedAt,now).seconds in 0L..maxCheckAge
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
            (source=="DWD_ICON_GLOBAL" && nature=="P") ||
            (source=="VISUAL_CROSSING_FREE" && nature=="E") ||
            (source=="WEATHERAPI_FREE" && nature=="E"))
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
        require(sky == null || (source in setOf("HG_BRASIL_WEATHER_PRO","WEATHERAPI_FREE") &&
            sky in setOf("SOL","CHUVA","NUBLADO","PARCIALMENTE_NUBLADO","TEMPESTADE")))
        require(feels==null || source in setOf(
            "OPENWEATHER_ONECALL4_CURRENT","VISUAL_CROSSING_FREE","WEATHERAPI_FREE"))
        require(temp!=null || feels!=null || sky!=null)
        val result=ApprovedThermalDisplay(ibge,source,nature,valid,checked,temp,feels,sky)
        require(result.valid(now)) { "thermal_source_data_expired" }
        return result
    }
}


/** One municipality can legitimately have HG temperature and OpenWeather
 * feels-like at DIFFERENT timestamps. Keep field-level provenance instead of
 * attributing everything to a single provider.
 */
data class ApprovedThermalMunicipalView(
    val temperatureC: Double?,
    val feelsLikeC: Double?,
    val skyCondition: String?,
    val sourceLabel: String,
    val nature: String,
    val validAt: Instant,
    val temperatureSourceLabel: String?,
    val temperatureValidAt: Instant?,
    val feelsLikeSourceLabel: String?,
    val feelsLikeValidAt: Instant?,
    val skySourceLabel: String?,
) {
    fun valid(now: Instant): Boolean =
        !validAt.isAfter(now) && Duration.between(validAt,now).seconds in 0L..3600L
}

object ApprovedThermalMunicipalSelection {
    private val priority=listOf(
        "HG_BRASIL_WEATHER_PRO","WEATHERAPI_FREE","VISUAL_CROSSING_FREE",
        "OPENWEATHER_ONECALL4_CURRENT","DWD_ICON_GLOBAL")
    fun select(records: List<ApprovedThermalDisplay>, now: Instant):
        ApprovedThermalMunicipalView? {
        val valid=records.filter { it.valid(now) }
        if(valid.isEmpty())return null
        val ordered=priority.mapNotNull { id ->
            valid.filter { it.sourceId==id }.maxByOrNull { it.validAt }
        }
        val temperature=ordered.firstOrNull { it.temperatureC!=null }
        val feels=ordered.firstOrNull { it.feelsLikeC!=null }
        val sky=ordered.firstOrNull { it.skyCondition!=null }
        val main=temperature ?: feels ?: sky ?: return null
        // Backend must first resolve contradictory comparable measurements.
        // The client also refuses to choose arbitrarily if a future server
        // accidentally passes contradictory independently sourced values.
        val candidateTemps=ordered.filter { it.temperatureC!=null && it.nature=="E" }
        val candidateFeels=ordered.filter { it.feelsLikeC!=null && it.nature=="E" }
        fun conflicting(items:List<ApprovedThermalDisplay>, feelsLike:Boolean):Boolean =
            items.any { a -> items.any { b ->
                a.sourceId!=b.sourceId &&
                    kotlin.math.abs(java.time.Duration.between(a.validAt,b.validAt).seconds)<=900 &&
                    kotlin.math.abs((if(feelsLike)a.feelsLikeC!! else a.temperatureC!!) -
                        (if(feelsLike)b.feelsLikeC!! else b.temperatureC!!)) >
                        (if(feelsLike)6.0 else 4.0)
            }}
        val temperatureResult=temperature?.takeUnless { conflicting(candidateTemps,false) }
        val feelsResult=feels?.takeUnless { conflicting(candidateFeels,true) }
        return ApprovedThermalMunicipalView(
            temperatureC=temperatureResult?.temperatureC,
            feelsLikeC=feelsResult?.feelsLikeC,
            skyCondition=sky?.skyCondition,
            sourceLabel=main.sourceLabel,
            nature=main.nature,
            validAt=main.validAt,
            temperatureSourceLabel=temperatureResult?.sourceLabel,
            temperatureValidAt=temperatureResult?.validAt,
            feelsLikeSourceLabel=feelsResult?.sourceLabel,
            feelsLikeValidAt=feelsResult?.validAt,
            skySourceLabel=sky?.sourceLabel,
        )
    }
}
