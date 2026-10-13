package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Derive exactly what the RJ dashboard can verify TODAY from a fresh station.
 * Source availability remains a per-variable state, never a single "all live"
 * claim for the 92 municipalities or for a source catalog.
 */
data class RjLiveTableReading(
    val code: String,
    val label: String,
    val display: String,
    val status: String,
    val source: String?,
    val observedAt: Instant?,
    val method: String,
)

object RjLiveTableReadouts {
    private const val LIVE = "ESTACAO_OFICIAL_RECENTE"
    private const val DERIVED = "CALCULO_BLAISE_SOBRE_ESTACAO"
    private const val UNAVAILABLE = "SEM_PRODUTO_ATUAL_VALIDADO"
    private val timeZone = ZoneId.of("America/Sao_Paulo")
    private val timeFormat = DateTimeFormatter.ofPattern("dd/MM HH:mm")

    fun fromStation(observation: CityWeatherObservation?, now: Instant): List<RjLiveTableReading> {
        val station = observation?.takeIf { it.current(now) }
        val computations = ScientificDashboardPolicy.derive(station, now)
        val sensation = computations.firstOrNull { it.title == "Sensação térmica" }
        fun measured(code: String, value: Double?, unit: String, method: String): RjLiveTableReading {
            if (station == null || value == null || !value.isFinite())
                return empty(code)
            val display = String.format(Locale("pt", "BR"), "%.1f %s", value, unit)
            return RjLiveTableReading(code, codeToTitle(code), display, LIVE, station.source,
                station.observedAt, method)
        }
        return RjMeteorologicalTables.table1.take(10).map { row ->
            when (row.code) {
                "TEMPERATURA" -> measured(row.code, station?.temperatureC, "°C", "Medição por estação")
                "SENSACAO_TERMICA" -> if (station != null && sensation != null)
                    RjLiveTableReading(row.code, row.phenomenon, sensation.value, DERIVED,
                        station.source, station.observedAt, sensation.method)
                    else empty(row.code)
                "CHUVA_ACUMULADA" -> measured(row.code, station?.hourlyRainMm,
                    "mm/1h", "Acumulado observado da própria estação • 60 minutos")
                "VENTO" -> measured(row.code, station?.windKmh,
                    "km/h", "Vento médio observado")
                "RAJADA" -> measured(row.code, station?.windGustKmh,
                    "km/h", "Rajada máxima observada")
                "UMIDADE" -> measured(row.code, station?.humidityPercent,
                    "%", "Umidade relativa observada")
                else -> empty(row.code)
            }
        }
    }

    fun evidence(reading: RjLiveTableReading): String =
        if (reading.observedAt == null || reading.source == null)
            "Sem dado atual verificado • não significa valor zero"
        else "${reading.source} • ${reading.observedAt.atZone(timeZone).format(timeFormat)} (Brasília) • ${reading.method}"

    private fun empty(code: String) = RjLiveTableReading(
        code, codeToTitle(code), "—", UNAVAILABLE, null, null, "Nenhuma estimativa inventada"
    )
    private fun codeToTitle(code: String): String =
        RjMeteorologicalTables.table1.first { it.code == code }.phenomenon
}
