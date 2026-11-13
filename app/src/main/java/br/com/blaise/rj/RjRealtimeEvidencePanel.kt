package br.com.blaise.rj

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.DashboardDataNetworkResult
import br.com.blaise.rj.data.StatewideDataResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class RjLiveEvidence(
    val source: String,
    val product: String,
    val observedAt: Instant?,
    val detail: String
)

object RjLiveEvidencePolicy {
    fun format(instant: Instant): String = DateTimeFormatter.ofPattern("dd/MM HH:mm:ss")
        .withZone(ZoneId.of("America/Sao_Paulo")).format(instant) + " (Brasília)"

    fun build(
        cityWeather: Map<Int, CityWeatherResult>,
        rioStations: List<CityWeatherObservation>,
        statewide: StatewideDataResult,
        backend: DashboardDataNetworkResult,
        now: Instant
    ): List<RjLiveEvidence> {
        val observations = (rioStations + cityWeather.values.mapNotNull { it.currentObservation(now) })
            .filter { it.current(now) && RjOperationalPolicy.mayUseSource(it.source) }
        val inmet = observations.filter { it.source == "INMET" }.maxByOrNull { it.observedAt }
        val alerta = observations.filter { it.source == "Alerta Rio" }.maxByOrNull { it.observedAt }
        val states = (statewide as? StatewideDataResult.Available)?.snapshot
            ?.takeIf { it.workerActive && it.current(now) }
        val hydrological = states?.municipalities.orEmpty().filter { it.risk.current(now) }
        val backendData = (backend as? DashboardDataNetworkResult.Available)?.snapshot
            ?.takeIf { it.current(now) }
        val rain = backendData?.rainfall
        val marine = backendData?.marine?.takeIf { it.current(now) }
        return listOf(
            RjLiveEvidence("Alerta Rio / COR.Rio", "Estações e chuva",
                listOfNotNull(alerta?.observedAt, rain?.observedAt).maxOrNull(),
                if (rain == null) "Radar oficial georreferenciado ainda pendente" else
                    "Chuva: máximos da rede de estações; não representa média municipal"),
            RjLiveEvidence("Defesa Civil RJ", "Avisos oficiais", null,
                "Produto com emissão/área não comprovado neste painel; alertas P0 são independentes"),
            RjLiveEvidence("INMET", "Medição por estação", inmet?.observedAt,
                inmet?.station ?: "Sem estação INMET recente entre as cidades selecionadas"),
            RjLiveEvidence("INPE / CPTEC", "Previsões", null,
                "Hora de emissão e produto ainda não validados na interface"),
            RjLiveEvidence("CEMADEN", "Risco hidrológico", 
                hydrological.mapNotNull { it.risk.observedAt }.maxOrNull(),
                if (hydrological.isEmpty()) "Sem produto válido nesta consulta" else
                    hydrological.size.toString() + " municípios com risco informado, não avisos oficiais"),
            RjLiveEvidence("NOAA", "Ondas por modelo", marine?.validAt,
                if (marine == null) "Modelo NOAA não validado nesta consulta" else
                    "Previsão oceânica, não detecção de tsunami"),
            RjLiveEvidence("EUMETSAT", "Satélite e temperatura do mar", null,
                "Produto geográfico/temporal não verificado"),
            RjLiveEvidence("JAXA / GSMaP", "Precipitação por satélite", null,
                "Produto geográfico/temporal não verificado")
        )
    }
}

/** Shows evidence from existing paid backend + official station collections; creates no network work. */
@Composable
fun RjRealtimeEvidencePanel(
    first: City,
    second: City,
    cityWeather: Map<Int, CityWeatherResult>,
    rioStations: List<CityWeatherObservation>,
    statewide: StatewideDataResult,
    backend: DashboardDataNetworkResult,
    now: Instant
) {
    val evidence = RjLiveEvidencePolicy.build(cityWeather, rioStations, statewide, backend, now)
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF0D2944))) {
        Column(Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("MEDIÇÕES E FONTES • ATUALIZAÇÃO CONTÍNUA",
                color = Color(0xFFF5D17B), fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium)
            Text("Verificação de validade: " + RjLiveEvidencePolicy.format(now) +
                " | Nova consulta não significa medição nova",
                color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
            listOf(first, second).distinctBy { it.ibgeCode }.forEach { city ->
                val obs = cityWeather[city.ibgeCode]?.currentObservation(now)
                    ?.takeIf { RjOperationalPolicy.mayUseSource(it.source) }
                val metric = obs?.let { row ->
                    listOfNotNull(
                        row.temperatureC?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f °C", it) },
                        row.humidityPercent?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.0f%% UR", it) },
                        row.windKmh?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f km/h", it) }
                    ).joinToString(" / ") + " | " + row.source + " / " + row.station +
                        " | " + RjLiveEvidencePolicy.format(row.observedAt)
                } ?: "Medição municipal não comprovada ou desatualizada"
                Text(city.name + ": " + metric, color = Color.White,
                    style = MaterialTheme.typography.bodySmall)
            }
            evidence.forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (row.observedAt == null) "○" else "●",
                        color = if (row.observedAt == null) Color.LightGray else Color(0xFF83D6A6))
                    Column {
                        Text(row.source + " • " + row.product, color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodySmall)
                        Text((if (row.observedAt == null) "CONEXÃO NÃO COMPROVADA" else "MEDIÇÃO RECENTE") +
                            (row.observedAt?.let { " • " + RjLiveEvidencePolicy.format(it) } ?: ""),
                            color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                        Text(row.detail, color = Color.LightGray,
                            style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            Text("Ausência de dado não confirma ausência de risco. INEA, Marinha/CHM, Windy e Copernicus excluídos.",
                color = Color(0xFFF5D17B), style = MaterialTheme.typography.labelSmall)
        }
    }
}
