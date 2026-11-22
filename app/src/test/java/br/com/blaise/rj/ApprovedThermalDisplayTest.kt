package br.com.blaise.rj

import br.com.blaise.rj.data.ApprovedThermalDisplayParser
import br.com.blaise.rj.data.ApprovedThermalMunicipalSelection
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ApprovedThermalDisplayTest {
    private val now=Instant.parse("2026-11-22T12:00:00Z")
    private fun base(source:String="HG_BRASIL_WEATHER_PRO")=mapOf<String,Any?>(
        "ibge" to "3304557",
        "sourceId" to source,
        "nature" to "E",
        "validAt" to "2026-11-22T11:20:00Z",
        "checkedAt" to "2026-11-22T11:59:00Z",
        "temperatureC" to 27.0,
        "feelsLikeC" to null,
        "skyCondition" to "PARCIALMENTE_NUBLADO",
        "backendVerified" to true,
        "commercialLicenseVerified" to true,
        "municipalityGeoVerified" to true,
        "contingencyAuthorized" to false,
        "hgSubscriptionActive" to true
    )
    @Test fun hgRequiresAnActiveSubscriptionAndDoesNotInventDirectFeelsLike() {
        val row=ApprovedThermalDisplayParser.parse(base(),now)
        assertTrue(row.valid(now))
        assertEquals("PARCIALMENTE_NUBLADO",row.skyCondition)
        assertNull(row.feelsLikeC)
        assertTrue(runCatching {
            ApprovedThermalDisplayParser.parse(base()+("hgSubscriptionActive" to false),now)
        }.isFailure)
        assertTrue(runCatching {
            ApprovedThermalDisplayParser.parse(base()+("feelsLikeC" to 35.0),now)
        }.isFailure)
    }
    @Test fun openweatherDirectFeelsLikeRequiresContingency() {
        val candidate=base("OPENWEATHER_ONECALL4_CURRENT")+
            mapOf("skyCondition" to null,"feelsLikeC" to 32.0,
                "validAt" to "2026-11-22T11:30:00Z")
        assertTrue(runCatching { ApprovedThermalDisplayParser.parse(candidate,now) }.isFailure)
        val allowed=candidate+("contingencyAuthorized" to true)
        assertEquals(32.0,ApprovedThermalDisplayParser.parse(allowed,now).feelsLikeC!!,0.001)
        assertFalse(ApprovedThermalDisplayParser.parse(allowed,now.plusSeconds(390)).valid(now.plusSeconds(390)))
    }
    @Test fun dwdMaySupplyOnlyForecastTemperatureNotAStationThermometer() {
        val payload=base("DWD_ICON_GLOBAL") + mapOf(
            "nature" to "P","feelsLikeC" to null,"skyCondition" to null)
        assertEquals("P",ApprovedThermalDisplayParser.parse(payload,now).nature)
        assertTrue(runCatching { ApprovedThermalDisplayParser.parse(
            payload+("feelsLikeC" to 30.0),now) }.isFailure)
    }
    @Test fun hgTemperatureAndOpenweatherFeelsLikeRetainIndependentSourceTimes() {
        val hg=ApprovedThermalDisplayParser.parse(base(),now)
        val ow=ApprovedThermalDisplayParser.parse(
            base("OPENWEATHER_ONECALL4_CURRENT") + mapOf(
                "contingencyAuthorized" to true, "skyCondition" to null,
                "temperatureC" to null, "feelsLikeC" to 35.4,
                "validAt" to "2026-11-22T11:50:00Z"),now)
        val view=ApprovedThermalMunicipalSelection.select(listOf(ow,hg),now)
        assertNotNull(view)
        assertEquals(27.0,view!!.temperatureC!!,0.001)
        assertEquals(35.4,view.feelsLikeC!!,0.001)
        assertTrue(view.temperatureSourceLabel!!.contains("HG Brasil"))
        assertTrue(view.feelsLikeSourceLabel!!.contains("OpenWeather"))
        assertNotEquals(view.temperatureValidAt,view.feelsLikeValidAt)
        assertEquals("PARCIALMENTE_NUBLADO",view.skyCondition)
    }
    @Test fun visualCrossingAndWeatherApiAreNowEligibleWhenBackendExplicitlyVerifies() {
        val vc=ApprovedThermalDisplayParser.parse(base("VISUAL_CROSSING_FREE")+
            mapOf("skyCondition" to null,"feelsLikeC" to 31.5,
                "validAt" to "2026-11-22T11:40:00Z"),now)
        val wa=ApprovedThermalDisplayParser.parse(base("WEATHERAPI_FREE")+
            mapOf("feelsLikeC" to 32.0,"validAt" to "2026-11-22T11:48:00Z"),now)
        val chosen=ApprovedThermalMunicipalSelection.select(listOf(vc,wa),now)
        assertNotNull(chosen)
        assertEquals("WeatherAPI.com • estimativa",chosen!!.temperatureSourceLabel)
        assertEquals(32.0,chosen.feelsLikeC!!,0.001)
        assertEquals("PARCIALMENTE_NUBLADO",chosen.skyCondition)
    }
    @Test fun contradictoryBlaiseTemperatureReadingsAreNotArbitrarilySelected() {
        val vc=ApprovedThermalDisplayParser.parse(base("VISUAL_CROSSING_FREE")+
            mapOf("skyCondition" to null,"temperatureC" to 21.0,
                "validAt" to "2026-11-22T11:40:00Z"),now)
        val wa=ApprovedThermalDisplayParser.parse(base("WEATHERAPI_FREE")+
            mapOf("temperatureC" to 35.0,
                "validAt" to "2026-11-22T11:42:00Z"),now)
        val chosen=ApprovedThermalMunicipalSelection.select(listOf(vc,wa),now)
        assertNull(chosen?.temperatureC)
        assertEquals("PARCIALMENTE_NUBLADO",chosen?.skyCondition)
    }
    @Test fun rejectNonThermalSourcesStaleTimesOrSecretShapedExtraFields() {
        for(source in listOf("ECMWF_IFS",
            "CLIMATEMPO_ENTERPRISE_RADAR","METEOBLUE_FREE_FORECAST")){
            assertTrue(runCatching { ApprovedThermalDisplayParser.parse(
                base(source),now) }.isFailure)
        }
        assertTrue(runCatching { ApprovedThermalDisplayParser.parse(
            base()+("checkedAt" to "2026-11-22T11:40:00Z"),now) }.isFailure)
        assertTrue(runCatching { ApprovedThermalDisplayParser.parse(
            base()+("validAt" to "2026-11-22T10:59:00Z"),now) }.isFailure)
        assertTrue(runCatching { ApprovedThermalDisplayParser.parse(
            base()+("apikey" to "should-not-exist"),now) }.isFailure)
    }
}
