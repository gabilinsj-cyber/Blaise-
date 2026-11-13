package br.com.blaise.rj

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.DashboardDataNetworkResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Visual refresh of the EXISTING original home screen, with no new data fetchers.
 * A valid station observation is NOT a meteorological average of the municipality.
 * All unreadable or unavailable feeds remain unavailable, never "zero" or "safe".
 */
object RjHomeObservedEvidence {
    private val sourceAllowlist = setOf("INMET", "Alerta Rio")
    fun cityObservation(
        city: City, reports: Map<Int, CityWeatherResult>, now: Instant
    ): CityWeatherObservation? = reports[city.ibgeCode]?.currentObservation(now)?.takeIf {
        it.municipalityIbge == city.ibgeCode && it.source in sourceAllowlist
    }
    fun rioObservationCount(stations: List<CityWeatherObservation>, now: Instant): Int =
        stations.count { it.municipalityIbge == 3304557 && it.source == "Alerta Rio" && it.current(now) }

    fun localTime(time: Instant): String =
        DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo")).format(time)
    fun celsius(v: Double?): String =
        v?.takeIf { it.isFinite() && it in -30.0..60.0 }
            ?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f °C", it) } ?: "— °C"
    fun millimeters(v: Double?): String =
        v?.takeIf { it.isFinite() && it in 0.0..400.0 }
            ?.let { String.format(Locale.forLanguageTag("pt-BR"), "%.1f mm", it) } ?: "— mm"
}

private val rjGold = Color(0xFFF1CE70)
private val rjText = Color(0xFFEFF6FF)
private val rjMuted = Color(0xFFB1C4D5)
private val rjBlue = Color(0xFF163F63)
private val rjLine = Color(0xFF397CB1)

@Composable
private fun RjObservedCityTile(
    city: City, observation: CityWeatherObservation?, modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(Color(0xB00B2948), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFF2D668F), RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(city.name, color = rjGold, fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium)
        Text(RjHomeObservedEvidence.celsius(observation?.temperatureC),
            color = rjText, fontWeight = FontWeight.Black,
            style = MaterialTheme.typography.headlineMedium)
        if (observation == null) {
            Text("Medição municipal não confirmada",
                color = rjMuted, style = MaterialTheme.typography.labelSmall)
        } else {
            val metrics = listOfNotNull(
                observation.humidityPercent?.let {
                    String.format(Locale.forLanguageTag("pt-BR"), "UR %.0f%%", it)
                },
                observation.windKmh?.let {
                    String.format(Locale.forLanguageTag("pt-BR"), "Vento %.1f km/h", it)
                }
            )
            Text(metrics.joinToString(" • ").ifBlank { "Variáveis indisponíveis" },
                color = rjText, style = MaterialTheme.typography.labelSmall)
            Text(observation.source + " • " + observation.station + " • " +
                RjHomeObservedEvidence.localTime(observation.observedAt),
                color = rjMuted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

/** Compact observation strip above the original owned 92-city map. */
@Composable
fun RjOriginalLiveOverview(
    first: City,
    second: City,
    reports: Map<Int, CityWeatherResult>,
    rioStations: List<CityWeatherObservation>,
    backend: DashboardDataNetworkResult,
    now: Instant,
    onSources: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val currentRain = (backend as? DashboardDataNetworkResult.Available)
        ?.snapshot?.takeIf { it.current(now) }?.rainfall
    val stations = RjHomeObservedEvidence.rioObservationCount(rioStations, now)
    val a = RjHomeObservedEvidence.cityObservation(first, reports, now)
    val b = RjHomeObservedEvidence.cityObservation(second, reports, now)

    Column(
        modifier = modifier
            .background(Brush.linearGradient(listOf(Color(0xFF123B61), Color(0xFF071A30))),
                RoundedCornerShape(17.dp))
            .border(1.dp, rjLine, RoundedCornerShape(17.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text("CONDIÇÕES OFICIAIS • AGORA",
                    color = rjGold, fontWeight = FontWeight.ExtraBold,
                    style = MaterialTheme.typography.titleSmall)
                Text("Dados de estação com fonte e hora; nunca previsão fictícia",
                    color = rjMuted, style = MaterialTheme.typography.labelSmall)
            }
            TextButton(onClick = onSources) {
                Text("Fontes ›", color = rjGold, style = MaterialTheme.typography.labelSmall)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            RjObservedCityTile(first, a, Modifier.weight(1f))
            RjObservedCityTile(second, b, Modifier.weight(1f))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                if (stations > 0)
                    "ALERTA RIO • $stations estação(ões) meteorológica(s) com leitura vigente"
                else "ALERTA RIO • nenhuma leitura de estação recente confirmada",
                color = if (stations > 0) Color(0xFF90E4B3) else rjMuted,
                style = MaterialTheme.typography.labelSmall)
            Text(
                if (currentRain == null) "CHUVA DA REDE • dado oficial indisponível ou acesso não verificado"
                else "CHUVA OBSERVADA • maior acumulado 15 min " +
                    RjHomeObservedEvidence.millimeters(currentRain.max15mMm) +
                    " • medido " + RjHomeObservedEvidence.localTime(currentRain.observedAt),
                color = rjText, style = MaterialTheme.typography.labelSmall)
        }
        Text(
            "Consultas periódicas não significam novas medições. Sem valor válido não significa sem chuva, sem alerta ou mar seguro.",
            color = rjMuted, style = MaterialTheme.typography.labelSmall,
        )
    }
}
