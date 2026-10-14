package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import java.time.Instant
import java.util.Locale
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Read-only Android scientific summary of ONE fresh official station.
 * Any result is a derived diagnostic, NEVER a municipal observation, a risk
 * grade or an authorization to publish an alert.
 */
data class ScientificReading(
    val title: String,
    val value: String,
    val method: String,
    val observedAt: Instant,
    val station: String,
    val source: String,
    val officialMeasurement: Boolean = false,
    val mayTriggerAlert: Boolean = false,
)

object ScientificDashboardPolicy {
    const val STATUS = "CÁLCULO BLAISE • NÃO É MEDIÇÃO OFICIAL"
    private fun format(value: Double) = String.format(Locale("pt", "BR"), "%.1f °C", value)

    fun thermalCelsius(temperatureC: Double?, humidityPercent: Double?, windKmh: Double?): Double? {
        val t = temperatureC?.takeIf { it.isFinite() && it in -30.0..60.0 } ?: return null
        if (t <= 10.0) {
            val wind = windKmh?.takeIf { it.isFinite() && it in 4.8..250.0 } ?: return null
            val factor = wind.pow(0.16)
            return (13.12 + 0.6215 * t - 11.37 * factor + 0.3965 * t * factor).takeIf { it.isFinite() }
        }
        val rh = humidityPercent?.takeIf { it.isFinite() && it in 40.0..100.0 } ?: return null
        if (t < 27.0) return null
        val f = t * 1.8 + 32.0
        var heat = -42.379 + 2.04901523 * f + 10.14333127 * rh -
            0.22475541 * f * rh - 0.00683783 * f.pow(2.0) -
            0.05481717 * rh.pow(2.0) + 0.00122874 * f.pow(2.0) * rh +
            0.00085282 * f * rh.pow(2.0) - 0.00000199 * f.pow(2.0) * rh.pow(2.0)
        if (rh > 85.0 && f in 80.0..87.0) heat += (rh - 85.0) / 10.0 * ((87.0 - f) / 5.0)
        return ((heat - 32.0) / 1.8).takeIf { it.isFinite() && it in -30.0..80.0 }
    }

    fun derive(observation: CityWeatherObservation?, now: Instant): List<ScientificReading> {
        if (observation == null || !observation.current(now)) return emptyList()
        val t = observation.temperatureC ?: return emptyList()
        if (!t.isFinite() || t !in -30.0..60.0) return emptyList()
        val rh = observation.humidityPercent?.takeIf { it.isFinite() && it in 1.0..100.0 }
        val base = { title: String, value: Double, method: String ->
            ScientificReading(title, format(value), method, observation.observedAt,
                observation.station, observation.source)
        }
        val readings = mutableListOf<ScientificReading>()
        if (rh != null) {
            val a = 17.625
            val b = 243.04
            val gamma = ln(rh / 100.0) + a * t / (b + t)
            val dew = b * gamma / (a - gamma)
            if (dew.isFinite() && dew in -65.0..60.0)
                readings.add(base("Ponto de orvalho", dew, "Magnus • T/UR"))
        }
        thermalCelsius(t, rh, observation.windKmh)?.let { value ->
            readings.add(base("Sensação térmica", value,
                if (t >= 27.0) "Rothfusz • calor" else "Vento-frio"))
        }
        return readings
    }
}

data class BlaiseAgentUi(
    val index: Int, val name: String, val responsibility: String,
    val deploymentStatus: String = "Planejado no backend • operação autônoma não validada",
)

/** Display names follow the RJ backend's agent registry; never show as ONLINE. */
object BlaiseAgentDashboard {
    val tenAgents: List<BlaiseAgentUi> = listOf(
        BlaiseAgentUi(1, "Blaise Sentinel RJ", "Origem, autorização e frescor das fontes"),
        BlaiseAgentUi(2, "Blaise Vector RJ", "Cálculos, física e recálculos"),
        BlaiseAgentUi(3, "Blaise Fusion RJ", "Fusão de observações comparáveis"),
        BlaiseAgentUi(4, "Blaise Track RJ", "Deslocamento, velocidade e hora estimada"),
        BlaiseAgentUi(5, "Blaise Hydro RJ", "Chuva, rios, cheias e alagamentos"),
        BlaiseAgentUi(6, "Blaise Ocean RJ", "Mar, ressaca, ciclones e Atlântico"),
        BlaiseAgentUi(7, "Blaise Seismo RJ", "Abalos e avisos de tsunami"),
        BlaiseAgentUi(8, "Blaise Audit RJ", "Revisão de evidências e alertas"),
        BlaiseAgentUi(9, "Correção Horária RJ", "Regressões e integridade periódica"),
        BlaiseAgentUi(10, "Auditoria Profunda RJ", "Segurança, escala e marcos de 500 mil assinantes"),
    )
    init {
        require(tenAgents.size == 10)
        require(tenAgents.map { it.index } == (1..10).toList())
    }
}
