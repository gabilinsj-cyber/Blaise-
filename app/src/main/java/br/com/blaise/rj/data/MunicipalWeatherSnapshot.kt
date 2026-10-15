package br.com.blaise.rj.data

import java.time.Instant
import java.time.ZoneId
import br.com.blaise.rj.assistant.WeatherRequest
import br.com.blaise.rj.ScientificDashboardPolicy

/** A single immutable acquisition, keyed by municipality rather than slot number. */
data class MunicipalWeatherSnapshot(
    val report: CityWeatherResult,
    val series: InmetHourlySeries?,
    val fetchedAt: Instant,
    val failureCode: String? = null,
    val sourceFailures: List<String> = emptyList(),
) {
    val municipalityIbge: Int get() = report.municipalityIbge

    fun coherent(): Boolean {
        val observation = report.observation
        if (observation != null && observation.municipalityIbge != municipalityIbge) return false
        val history = series ?: return true
        if (history.municipalityIbge != municipalityIbge || !history.trustedMetadata()) return false
        if (observation == null) return true
        if (observation.source != "INMET" || observation.sourceUrl != history.sourceUrl) return false
        val row = history.points.firstOrNull { it.observedAt == observation.observedAt } ?: return false
        return observation.temperatureC == row.temperatureC && observation.humidityPercent == row.humidityPercent &&
            observation.windKmh == row.windKmh && observation.hourlyRainMm == row.rainfallMm &&
            observation.windGustKmh == row.windGustKmh
    }

    fun currentReport(now: Instant): CityWeatherResult {
        if (!coherent()) return CityWeatherResult(municipalityIbge, report.localScope,
            unavailableReason = "Snapshot inconsistente; dados bloqueados para auditoria.")
        if (report.currentObservation(now) != null) return report
        val reason = when (failureCode) {
            "SOURCE_NO_OBSERVATIONS", "HTTP_204" ->
                "INMET não forneceu observações nesta consulta. Sem medição atual confirmada para este município."
            "SOURCE_TIMEOUT" -> "A consulta à fonte excedeu o tempo de espera. Sem medição atual confirmada."
            "SOURCE_NETWORK_ERROR" -> "Não foi possível conectar à fonte. Sem medição atual confirmada."
            "HTTP_401", "HTTP_403" -> "A fonte não autorizou esta consulta. Sem medição atual confirmada."
            else -> null
        }
        return if (reason == null) report else report.copy(unavailableReason = reason)
    }

    fun historySeries(): InmetHourlySeries? = series?.takeIf { coherent() }

    fun currentSeries(now: Instant): InmetHourlySeries? = series?.takeIf {
        coherent() && report.currentObservation(now) != null
    }

    fun answer(request: WeatherRequest, now: Instant): String {
        if (request.city.ibgeCode != municipalityIbge ||
            request.localScope != null && request.localScope != report.localScope)
            return "Não há um snapshot validado para a cidade e área solicitadas."
        val today = now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate()
        if (request.date != today) return "Previsão ou histórico para ${request.date}: sem produto validado no snapshot de ${request.city.name}."
        val question = br.com.blaise.rj.assistant.normalizedSpeech(request.question)
        if (listOf("vai", "previsao", "amanha", "maxima", "minima", "praia", "quando").any(question::contains))
            return "Previsão ainda não validada para ${request.city.name}; a medição atual não é uma previsão."
        val validated = currentReport(now)
        val observation = validated.currentObservation(now) ?: return validated.summary(now)
        val thermal = ScientificDashboardPolicy.derive(observation, now)
            .firstOrNull { it.title == "Sensação térmica" }
        return validated.summary(now) + (thermal?.let { " Sensação térmica calculada: ${it.value} (${it.method})." }
            ?: " Sensação térmica indisponível com estas entradas.")
    }

    companion object {
        fun fromSeries(ibge: Int, series: InmetHourlySeries?, now: Instant): MunicipalWeatherSnapshot {
            val bound = series?.takeIf { it.municipalityIbge == ibge && it.trustedMetadata() }
            val latest = bound?.points?.filter { !it.observedAt.isAfter(now) &&
                !it.observedAt.isBefore(now.minusSeconds(300)) }?.maxByOrNull { it.observedAt }
            val observation = if (bound != null && latest != null) CityWeatherObservation(
                ibge, bound.stationName, "INMET", bound.sourceUrl, latest.observedAt,
                latest.temperatureC, latest.humidityPercent, latest.windKmh, 300,
                latest.windGustKmh, latest.rainfallMm,
            ).takeIf { it.current(now) } else null
            val report = CityWeatherResult(ibge, null, observation,
                "Sem medição atual validada para este município; gráficos e mapa usam a mesma verificação.")
            return MunicipalWeatherSnapshot(report, bound, now)
        }
    }
}

data class MunicipalWeatherAudit(val checkedAt: Instant, val municipalityIbge: Int, val reason: String)

/** Rejects late responses after a city change; hourly audit is active while the app runs. */
class MunicipalWeatherSnapshotStore {
    private var generation = 0L
    private var expectedCities = emptySet<Int>()
    private var snapshots = emptyMap<Int, MunicipalWeatherSnapshot>()
    private var lastHourlyAudit: Instant? = null
    private val auditTrail = mutableListOf<MunicipalWeatherAudit>()

    fun begin(cities: Set<Int>): Long {
        generation += 1
        expectedCities = cities.toSet()
        lastHourlyAudit = null
        snapshots = emptyMap()
        return generation
    }

    fun publish(ticket: Long, batch: Map<Int, MunicipalWeatherSnapshot>, now: Instant): Boolean {
        if (ticket != generation) return false
        if (batch.keys != expectedCities || batch.any { (ibge, value) ->
                value.municipalityIbge != ibge || !value.coherent() }) {
            record(now, 0, "MUNICIPALITY_OR_SNAPSHOT_MISMATCH")
            return false
        }
        snapshots = batch.toMap()
        batch.forEach { (ibge, value) ->
            value.sourceFailures.forEach { record(now, ibge, "SOURCE_ATTEMPT_FAILURE:" + it) }
            if (value.currentReport(now).currentObservation(now) == null)
                record(now, ibge, "SOURCE_FAILURE:" + (value.failureCode ?: "UNAVAILABLE_OR_DELAYED"))
        }
        return true
    }

    fun snapshot(): Map<Int, MunicipalWeatherSnapshot> = snapshots.toMap()
    fun audits(): List<MunicipalWeatherAudit> = auditTrail.toList()

    fun auditHourly(now: Instant): Boolean {
        if (snapshots.isEmpty()) return false
        if (lastHourlyAudit?.let { !now.isBefore(it.plusSeconds(3600)) } == false) return false
        lastHourlyAudit = now
        snapshots.forEach { (ibge, value) ->
            record(now, ibge, if (value.coherent() && value.report.currentObservation(now) != null)
                "HOURLY_CHECK_CURRENT" else "HOURLY_CHECK_UNAVAILABLE_OR_INCONSISTENT")
        }
        return true
    }

    private fun record(now: Instant, ibge: Int, reason: String) {
        auditTrail.add(MunicipalWeatherAudit(now, ibge, reason))
        if (auditTrail.size > 256) auditTrail.removeAt(0)
    }
}
