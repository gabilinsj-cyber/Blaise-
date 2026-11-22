package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.time.Duration
import java.time.Instant

/** WeatherAPI current = E aggregate, never a station reading or official alert. */
data class DashboardWeatherApiCurrent(
    val ibge:Int,
    val validAt:Instant,
    val checkedAt:Instant,
    val temperatureC:Double?,
    val feelsLikeC:Double?,
    val humidityPct:Double?,
    val windKmh:Double?,
    val gustKmh:Double?,
    val precipitationMm:Double?,
    val cloudPct:Double?,
    val pressureHpa:Double?,
    val uvIndex:Double?,
    val skyCondition:String?,
) {
    val sourceLabel="WeatherAPI.com"
    val attribution="Dados meteorológicos: WeatherAPI.com"
    val isStationObservation=false
    val mayIssueCriticalAlerts=false
    fun current(now:Instant):Boolean =
        Duration.between(validAt,now).seconds in 0L..2100L &&
        Duration.between(checkedAt,now).seconds in 0L..720L
}

/** Strict signed-snapshot parser; unknown fields (including secrets) fail. */
object DashboardWeatherApiCurrentParser {
    private val keys=setOf(
        "contract","ibge","sourceId","sourceLabel","attribution",
        "nature","validAt","checkedAt","temperatureC","feelsLikeC",
        "humidityPct","windKmh","gustKmh","precipitationMm","cloudPct",
        "pressureHpa","uvIndex","skyCondition","officialAlert",
        "actualStormConfirmed","criticalAlertEscalationAuthorized"
    )
    private fun bounded(v:Any?,lo:Double,hi:Double):Double? {
        if(v==null)return null
        val n=(v as? Number)?.toDouble()
            ?:throw IllegalArgumentException("invalid_weatherapi_number")
        require(n.isFinite() && n in lo..hi)
        return n
    }
    fun parse(raw:Any?,now:Instant):DashboardWeatherApiCurrent {
        @Suppress("UNCHECKED_CAST")
        val m=raw as? Map<String,Any?> ?:throw IllegalArgumentException("invalid_weatherapi_record")
        require(m.keys==keys)
        require(m["contract"]=="RJ_WEATHERAPI_FREE_CURRENT_E_V1")
        require(m["sourceId"]=="WEATHERAPI_FREE")
        require(m["sourceLabel"]=="WeatherAPI.com")
        require(m["attribution"]=="Dados meteorológicos: WeatherAPI.com")
        require(m["nature"]=="E_AGGREGATED_NOT_STATION")
        require(m["officialAlert"]==false && m["actualStormConfirmed"]==false &&
            m["criticalAlertEscalationAuthorized"]==false)
        val ibge=(m["ibge"] as? String)?.toIntOrNull()
            ?:throw IllegalArgumentException("invalid_weatherapi_ibge")
        require(RioMunicipalities.byIbgeCode(ibge)!=null)
        val valid=Instant.parse(m["validAt"] as? String
            ?:throw IllegalArgumentException("invalid_weatherapi_valid"))
        val checked=Instant.parse(m["checkedAt"] as? String
            ?:throw IllegalArgumentException("invalid_weatherapi_checked"))
        val sky=m["skyCondition"] as? String
        require(sky==null || sky in setOf(
            "SOL","PARCIALMENTE_NUBLADO","NUBLADO","CHUVA","TEMPESTADE"))
        val result=DashboardWeatherApiCurrent(
            ibge,valid,checked,
            bounded(m["temperatureC"],-60.0,65.0),
            bounded(m["feelsLikeC"],-80.0,80.0),
            bounded(m["humidityPct"],0.0,100.0),
            bounded(m["windKmh"],0.0,350.0),
            bounded(m["gustKmh"],0.0,450.0),
            bounded(m["precipitationMm"],0.0,500.0),
            bounded(m["cloudPct"],0.0,100.0),
            bounded(m["pressureHpa"],800.0,1100.0),
            bounded(m["uvIndex"],0.0,25.0),
            sky
        )
        require(result.current(now)) { "weatherapi_data_expired" }
        require(listOfNotNull(result.temperatureC,result.feelsLikeC,
            result.humidityPct,result.windKmh,result.gustKmh,
            result.precipitationMm,result.cloudPct,result.pressureHpa,
            result.uvIndex,result.skyCondition).isNotEmpty())
        return result
    }
}
