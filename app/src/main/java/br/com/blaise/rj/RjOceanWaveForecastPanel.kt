package br.com.blaise.rj

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.data.OceanWaveForecast
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun RjOceanWaveForecastPanel(forecast: OceanWaveForecast?, now: Instant) {
    val current = forecast?.takeIf { it.current(now) }
    Card(Modifier.fillMaxWidth().testTag("rj-noaa-offshore-wave-forecast")) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("ONDAS OCEÂNICAS • WW3 / PacIOOS via NOAA", style = MaterialTheme.typography.titleSmall)
            if(current == null) Text("Sem previsão oceânica validada nesta consulta.")
            else current.nearest(now)?.let { point ->
                fun number(value: Double?, unit: String) = value?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.2f %s", it, unit) } ?: "indisponível"
                val time = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"))
                Text("Altura significativa: ${number(point.heightM,"m")} • período de pico: ${number(point.peakPeriodS,"s")}")
                Text("Direção de origem do pico: ${number(point.peakFromDegrees,"°")}")
                Text("Swell: ${number(point.swellHeightM,"m")} • período ${number(point.swellPeriodS,"s")} • origem ${number(point.swellFromDegrees,"°")}")
                Text("Validade: ${time.format(point.validAt)} • consulta: ${time.format(current.fetchedAt)} (Brasília)", style = MaterialTheme.typography.labelSmall)
                Text("Hora de emissão do modelo não fornecida pelo recorte; atualização da rodada não comprovada.", style = MaterialTheme.typography.labelSmall)
            }
            Text("Ponto oceânico 23,5°S / 43°W • grade 0,5°. Previsão de modelo; não é medição ou altura na praia. Não fornece maré ou correntes e não confirma ressaca, tsunami ou meteotsunami.", style = MaterialTheme.typography.bodySmall)
        }
    }
}
