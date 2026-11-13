package br.com.blaise.rj.science

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.core.City
import br.com.blaise.rj.RjOperationalPolicy
import br.com.blaise.rj.data.CityWeatherResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Somente leituras da mesma estação e com frescor já validado pelo cliente existente. */
@Composable
fun RjScientificCityPanel(
    cities: List<City>,
    reports: Map<Int, CityWeatherResult>,
    now: Instant,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("ANÁLISE CIENTÍFICA • BLAISE V6 RJ", fontWeight = FontWeight.Bold)
            Text("Diagnósticos derivados de observações oficiais validadas. Não são avisos meteorológicos.", color = Color.LightGray)
            for (city in cities.distinctBy { it.ibgeCode }) {
                val obs = reports[city.ibgeCode]?.currentObservation(now)
                Text(city.name, fontWeight = FontWeight.SemiBold)
                if (obs == null || !RjOperationalPolicy.mayUseSource(obs.source)) {
                    Text("Cálculos indisponíveis: medição recente e verificável não recebida.", color = Color.LightGray)
                    continue
                }
                val t = obs.temperatureC
                val rh = obs.humidityPercent
                val rows = buildList {
                    if (t != null && rh != null) {
                        RjScientificCalculations.dewPointC(t, rh)?.let { add("Ponto de orvalho" to it) }
                        RjScientificCalculations.wetBulbApproxC(t, rh)?.let { add("Bulbo úmido aproximado" to it) }
                        RjScientificCalculations.heatIndexC(t, rh)?.let { add("Índice de calor" to it) }
                    }
                    if (t != null && obs.windKmh != null) {
                        RjScientificCalculations.windChillC(t, obs.windKmh)?.let { add("Índice de frio" to it) }
                    }
                }
                if (rows.isEmpty()) {
                    Text("Sem variáveis suficientes para índices no domínio científico.", color = Color.LightGray)
                } else {
                    rows.forEach { (label, value) ->
                        Text(label + ": " + String.format(Locale("pt", "BR"), "%.1f °C", value))
                    }
                }
                val time = obs.observedAt.atZone(ZoneId.of("America/Sao_Paulo"))
                    .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                Text("Fonte: " + obs.source + " • " + obs.station + " • " + time + " (Brasília)", color = Color.LightGray)
            }
            Text("CAPE, CIN, LI, PWAT, cisalhamento e helicidade exigem perfis atmosféricos válidos; não são calculados a partir de uma única estação.", color = Color.LightGray)
        }
    }
}
