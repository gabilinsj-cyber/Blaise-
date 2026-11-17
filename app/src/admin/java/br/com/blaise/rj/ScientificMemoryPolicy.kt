package br.com.blaise.rj

import java.time.Duration
import java.time.Instant
import kotlin.math.atan
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt

/** Pure, bounded, non-persistent science memory.
 * The Android app does NOT contact providers or infer danger from calculations.
 * Inputs must be backend-proven, internationally licensed, geoverified and fresh.
 */
data class BlaiseScientificInput(
    val municipalityIbge: String,
    val sourceId: String,
    val sourceUrl: String,
    val nature: String,
    val temperatureC: Double,
    val humidityPercent: Double,
    val windKmh: Double?,
    val validAt: Instant,
    val checkedAt: Instant,
    val verifiedByBackend: Boolean,
    val licensedForCommercialUse: Boolean,
    val municipalityGeoVerified: Boolean,
)
data class BlaiseScientificResult(
    val title: String,
    val value: Double,
    val unit: String,
    val method: String,
    val sourceId: String,
    val validAt: Instant,
    val nature: String = "CÁLCULO BLAISE • ESTIMATIVA",
    val officialMeasurement: Boolean = false,
    val officialAlert: Boolean = false,
    val mayTriggerAlert: Boolean = false,
)
/** Input is typed by the administrator; not a reading downloaded from an agency. */
data class AdminManualScientificResult(
    val title: String,
    val value: Double,
    val unit: String,
    val method: String,
    val nature: String = "CÁLCULO MANUAL — NÃO É OBSERVAÇÃO",
    val officialAlert: Boolean = false,
    val officialMeasurement: Boolean = false,
    val mayTriggerAlert: Boolean = false,
)

data class BlaiseScienceGroup(val name: String, val methods: List<String>)

object ScientificMemoryPolicy {
    // Methods already present in backend/src/blaise-scientific-kernels.mjs.
    // Registration is not evidence of scheduled, online or calibrated operation.
    val backendGroups = listOf(
        BlaiseScienceGroup("Termodinâmica e atmosfera", listOf(
            "equivalentPotentialTemperatureApprox", "clausiusClapeyronDerivative",
            "precipitableWater", "referenceEvapotranspirationDaily", "soilWaterBalance")),
        BlaiseScienceGroup("Ventos e tempestades", listOf(
            "neutralMeanWindProfile", "calibratedTurbulentGust", "bulkWindShear",
            "stormRelativeHelicity", "horizontalWindDiagnostics", "stationPressureTendency",
            "calibratedKdpRainRate")),
        BlaiseScienceGroup("Estatística e ajuste", listOf("calibratedMos", "scalarKalmanUpdate")),
        BlaiseScienceGroup("Oceano e física marinha", listOf(
            "oceanWindStress", "tropicalCycloneHeatPotential", "significantWaveSpectrum",
            "linearWaveDispersion", "conditionalMarineTravelTime")),
    )
    const val BACKEND_REGISTERED_METHOD_COUNT = 19
    val androidDerivedMethods = listOf("Magnus (orvalho)", "VPD", "Stull (bulbo úmido)",
        "Rothfusz (índice de calor)", "Vento-frio")

    private val weatherSources = setOf("DWD_ICON_GLOBAL", "NOAA_GFS",
        "ECMWF_IFS", "MET_NORWAY_LOCATIONFORECAST_2")

    private fun valid(x: Double, lo: Double, hi: Double) = x.isFinite() && x in lo..hi
    fun calculate(input: BlaiseScientificInput?, now: Instant): List<BlaiseScientificResult> {
        if (input == null || !input.verifiedByBackend || !input.licensedForCommercialUse ||
            !input.municipalityGeoVerified || !input.municipalityIbge.matches(Regex("33\\d{5}")) ||
            input.sourceId !in weatherSources || !input.sourceUrl.startsWith("https://") ||
            input.nature != "P" ||
            input.validAt.isAfter(now) || input.checkedAt.isAfter(now) ||
            Duration.between(input.checkedAt, now).seconds !in 0L..720L ||
            Duration.between(input.validAt, now).seconds !in 0L..43_200L ||
            !valid(input.temperatureC, -20.0, 50.0) ||
            !valid(input.humidityPercent, 1.0, 100.0)) return emptyList()
        val t = input.temperatureC
        val rh = input.humidityPercent
        val out = mutableListOf<BlaiseScientificResult>()
        fun add(title: String, value: Double, unit: String, method: String) {
            if (value.isFinite() && kotlin.math.abs(value) < 1e9)
                out.add(BlaiseScientificResult(title, value, unit, method, input.sourceId, input.validAt))
        }

        val gamma = ln(rh / 100.0) + 17.625 * t / (243.04 + t)
        val dew = 243.04 * gamma / (17.625 - gamma)
        if (valid(dew, -70.0, 50.0)) add("Ponto de orvalho", dew, "°C", "Magnus")

        val saturationKpa = 0.6108 * exp(17.27 * t / (t + 237.3))
        add("Déficit de pressão de vapor", saturationKpa * (1 - rh / 100), "kPa", "VPD")

        if (rh in 5.0..99.0) {
            val wet = t * atan(0.151977 * sqrt(rh + 8.313659)) +
                atan(t + rh) - atan(rh - 1.676331) +
                0.00391838 * rh.pow(1.5) * atan(0.023101 * rh) - 4.686035
            if (valid(wet, -30.0, 50.0))
                add("Bulbo úmido estimado", wet, "°C", "Stull (aproximação)")
        }
        if (t <= 10.0 && input.windKmh != null && valid(input.windKmh, 4.8, 250.0)) {
            val v = input.windKmh.pow(0.16)
            add("Sensação térmica estimada", 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v,
                "°C", "Vento-frio")
        } else if (t >= 27.0 && rh >= 40.0) {
            val f = t * 1.8 + 32.0
            var heat = -42.379 + 2.04901523 * f + 10.14333127 * rh -
                0.22475541 * f * rh - 0.00683783 * f.pow(2) - 0.05481717 * rh.pow(2) +
                0.00122874 * f.pow(2) * rh + 0.00085282 * f * rh.pow(2) -
                0.00000199 * f.pow(2) * rh.pow(2)
            if (rh > 85 && f in 80.0..87.0)
                heat += (rh - 85) / 10 * ((87.0 - f) / 5)
            add("Sensação térmica estimada", (heat - 32) / 1.8, "°C", "Rothfusz")
        }
        return out.toList()
    }
    /** Scientific scratchpad available ONLY in the separate admin APK.
     * No history, network calls, role escalation, location, or alert publication.
     * No default values or fabricated meteorological readings.
     */
    fun calculateManualInputs(
        temperatureC: Double?, humidityPercent: Double?, windKmh: Double?
    ): List<AdminManualScientificResult> {
        val t = temperatureC?.takeIf { valid(it, -20.0, 50.0) } ?: return emptyList()
        val rh = humidityPercent?.takeIf { valid(it, 1.0, 100.0) } ?: return emptyList()
        if (windKmh != null && !valid(windKmh, 0.0, 250.0)) return emptyList()
        val results = mutableListOf<AdminManualScientificResult>()
        fun add(title: String, value: Double, unit: String, method: String) {
            if (value.isFinite() && kotlin.math.abs(value) < 1e7)
                results.add(AdminManualScientificResult(title, value, unit, method))
        }
        // Pair the temperature and relative humidity entered by the administrator.
        val gamma = ln(rh / 100.0) + 17.625 * t / (243.04 + t)
        val dewPoint = 243.04 * gamma / (17.625 - gamma)
        if (valid(dewPoint, -80.0, 50.0))
            add("Ponto de orvalho", dewPoint, "°C", "Magnus")

        val saturationKpa = 0.6108 * exp(17.27 * t / (t + 237.3))
        add("Déficit de pressão de vapor", saturationKpa * (1.0 - rh / 100.0), "kPa", "VPD")

        if (rh in 5.0..99.0) {
            val wetBulb = t * atan(0.151977 * sqrt(rh + 8.313659)) +
                atan(t + rh) - atan(rh - 1.676331) +
                0.00391838 * rh.pow(1.5) * atan(0.023101 * rh) - 4.686035
            if (valid(wetBulb, -40.0, 55.0))
                add("Bulbo úmido aproximado", wetBulb, "°C", "Stull")
        }
        if (t <= 10.0 && windKmh != null && windKmh >= 4.8) {
            val factor = windKmh.pow(0.16)
            add("Vento-frio estimado", 13.12 + 0.6215 * t -
                11.37 * factor + 0.3965 * t * factor, "°C", "Wind chill")
        } else if (t >= 27.0 && rh >= 40.0) {
            val f = 1.8 * t + 32.0
            var hi = -42.379 + 2.04901523 * f + 10.14333127 * rh -
                0.22475541 * f * rh - 0.00683783 * f.pow(2.0) -
                0.05481717 * rh.pow(2.0) + 0.00122874 * f.pow(2.0) * rh +
                0.00085282 * f * rh.pow(2.0) - 0.00000199 * f.pow(2.0) * rh.pow(2.0)
            if (rh > 85.0 && f in 80.0..87.0)
                hi += (rh - 85.0) / 10.0 * ((87.0 - f) / 5.0)
            add("Índice de calor estimado", (hi - 32.0) / 1.8, "°C", "Rothfusz")
        }
        return results.toList()
    }

}
