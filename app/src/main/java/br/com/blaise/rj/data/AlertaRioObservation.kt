package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.normalizedSpeech
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

/** Pure parser; source station coverage is never silently expanded to a municipality. */
data class AlertaRioObservation(val station: String, val observedAt: Instant, val temperatureC: Double?, val humidityPercent: Double?, val windKmh: Double?)
object AlertaRioObservationParser {
    val stations = listOf("Jardim Botânico", "Barra/Riocentro", "Guaratiba", "Santa Cruz", "Alto da Boa Vista", "São Cristóvão", "Vidigal", "Irajá")
    private val stamp = DateTimeFormatter.ofPattern("dd/MM/uuuu - HH:mm:ss").withResolverStyle(ResolverStyle.STRICT)
    private fun text(raw: String) = raw.replace(Regex("<[^>]+>"), " ")
        .replace("&nbsp;", " ").replace("&atilde;", "ã").replace("&oacute;", "ó").replace("&aacute;", "á").replace("&iacute;", "í").replace("&ccedil;", "ç")
        .replace(Regex("\\s+"), " ").trim()
    fun parse(html: String, now: Instant = Instant.now()): List<AlertaRioObservation> {
        require(html.length <= 1048576 && html.contains("Dados Meteorol"))
        val table = Regex("<table\\b[^>]*>([\\s\\S]*?)</table>", RegexOption.IGNORE_CASE).findAll(html)
            .firstOrNull { it.value.contains("P. de Orvalho") && it.value.contains("Umi. do Ar") } ?: return emptyList()
        fun number(raw: String, min: Double, max: Double): Double? {
            if (raw in listOf("-", "ND", "", "N/D")) return null
            val n = raw.replace(',', '.').toDoubleOrNull() ?: error("Invalid observation")
            require(n.isFinite() && n in min..max)
            return n
        }
        val result = Regex("<tr\\b[^>]*>([\\s\\S]*?)</tr>", RegexOption.IGNORE_CASE).findAll(table.value).mapNotNull { row ->
            val cells = Regex("<t[dh]\\b[^>]*>([\\s\\S]*?)</t[dh]>", RegexOption.IGNORE_CASE).findAll(row.value).map { text(it.groupValues[1]) }.toList()
            if (cells.firstOrNull()?.toIntOrNull() == null) return@mapNotNull null
            require(cells.size == 9)
            require(stations.any { normalizedSpeech(it) == normalizedSpeech(cells[1]) })
            val time = LocalDateTime.parse(cells[2], stamp).atZone(ZoneId.of("America/Sao_Paulo")).toInstant()
            val age = java.time.Duration.between(time, now).seconds
            val temperature = number(cells[3], -30.0, 60.0)
            val humidity = number(cells[4], 0.0, 100.0)
            val wind = number(cells[7], 0.0, 400.0)
            if (age !in 0..1800) return@mapNotNull null
            AlertaRioObservation(cells[1], time, temperature, humidity, wind)
        }.toList()
        require(result.map { normalizedSpeech(it.station) }.distinct().size == result.size)
        return result
    }
}
