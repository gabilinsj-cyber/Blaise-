package br.com.blaise.rj

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import br.com.blaise.rj.data.StationMeteorology
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun RjStationMeteorologyPanel(data: StationMeteorology?, now: Instant) {
    val rows = data?.currentStations(now).orEmpty()
    Text("Alerta Rio • medições por estação", style = MaterialTheme.typography.titleSmall)
    if(rows.isEmpty()) Text("Sem medições meteorológicas atuais validadas nesta consulta.")
    val time = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"))
    fun n(value: Double?, unit: String) = value?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f %s", it, unit) } ?: "indisponível"
    rows.forEach { s ->
        Text("${s.name} • ${time.format(s.observedAt)} (Brasília)", style = MaterialTheme.typography.labelSmall)
        Text("Temperatura ${n(s.temperatureC,"°C")} • umidade ${n(s.humidityPercent,"%")}")
        Text("Vento ${n(s.windKmh,"km/h")} • pressão ${n(s.pressureHpa,"hPa")}")
    }
    Text("Medições pontuais da capital. Média entre fontes ainda não validada.", style = MaterialTheme.typography.bodySmall)
}
