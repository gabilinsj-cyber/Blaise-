package br.com.blaise.rj.data

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Hard freshness ceiling for displayed *current* observations, including fallback values. */
const val MAX_CURRENT_OBSERVATION_AGE_SECONDS = 12L * 60L

/** An observation is a station measurement, never a municipal average or forecast. */
data class CityWeatherObservation(
    val municipalityIbge: Int,
    val station: String,
    val source: String,
    val sourceUrl: String,
    val observedAt: Instant,
    val temperatureC: Double?,
    val humidityPercent: Double?,
    val windKmh: Double?,
    val maxAgeSeconds: Long,
) {
    fun current(now: Instant): Boolean = maxAgeSeconds in 1..7200 &&
        !observedAt.isAfter(now) && Duration.between(observedAt, now).toMillis() in 0..(minOf(maxAgeSeconds, MAX_CURRENT_OBSERVATION_AGE_SECONDS) * 1000L) &&
        sourceUrl.startsWith("https://") &&
        listOfNotNull(temperatureC, humidityPercent, windKmh).isNotEmpty() &&
        (temperatureC == null || temperatureC.isFinite() && temperatureC in -30.0..60.0) &&
        (humidityPercent == null || humidityPercent.isFinite() && humidityPercent in 0.0..100.0) &&
        (windKmh == null || windKmh.isFinite() && windKmh in 0.0..400.0)

    fun summary(now: Instant): String {
        if (!current(now)) return "Medição indisponível ou desatualizada."
        val values = listOfNotNull(
            temperatureC?.let { "Temperatura ${number(it)} °C" },
            humidityPercent?.let { "umidade ${number(it)}%" },
            windKmh?.let { "vento médio ${number(it)} km/h" },
        ).joinToString(", ")
        val ageMinutes = Duration.between(observedAt, now).toMinutes()
        val quality = if (ageMinutes >= 5) "contingência (medição com $ageMinutes min)" else "observação recente ($ageMinutes min)"
        return "$values. Fonte: $source, estação $station, ${observedAt.atZone(ZoneId.of("America/Sao_Paulo")).format(DateTimeFormatter.ofPattern("dd/MM HH:mm"))} (Brasília), $quality."
    }

    private fun number(value: Double) = String.format(Locale("pt", "BR"), "%.1f", value)
}

data class CityWeatherResult(
    val municipalityIbge: Int,
    val localScope: String?,
    val observation: CityWeatherObservation? = null,
    val unavailableReason: String = "Consulta oficial indisponível no momento.",
) {
    fun currentObservation(now: Instant): CityWeatherObservation? = observation?.takeIf {
        it.municipalityIbge == municipalityIbge && it.current(now)
    }
    fun summary(now: Instant): String = currentObservation(now)?.summary(now) ?: unavailableReason
}
