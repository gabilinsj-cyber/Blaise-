package br.com.blaise.rj

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.data.OceanTidesCurrents
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun RjOceanTidesCurrentsPanel(data: OceanTidesCurrents?, now: Instant) {
    val current=data?.takeIf { it.current(now) }
    val time=DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"))
    fun number(v: Double?, unit: String)=v?.let { String.format(Locale.forLanguageTag("pt-BR"),"%.2f %s",it,unit) } ?: "indisponível"
    Card(Modifier.fillMaxWidth().testTag("rj-copernicus-tides-currents")) {
        Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
            Text("MARÉ E CORRENTES • Copernicus Marine",style=MaterialTheme.typography.titleSmall)
            if(current==null) Text("Sem previsão de maré e correntes validada nesta consulta.")
            else {
                val sea=current.seaLevel.nearest(now)!!;val flow=current.currents.nearest(now)!!
                Text("Maré astronômica prevista: ${number(sea.tideM,"m")}")
                Text("Nível total previsto: ${number(sea.levelM,"m")} • referência: nível médio do mar")
                Text("Validade do nível: ${time.format(sea.validAt)} • ponto ${current.seaLevel.latitude} / ${current.seaLevel.longitude}")
                Text("Corrente total prevista: ${number(flow.speedMs,"m/s")} • rumo para ${number(flow.towardsDegrees,"°")}")
                Text("Validade da corrente: ${time.format(flow.validAt)} • profundidade ${number(current.currents.depthM,"m")} • ponto ${current.currents.latitude} / ${current.currents.longitude}")
                Text("Consulta: ${time.format(current.fetchedAt)} • horários de Brasília",style=MaterialTheme.typography.labelSmall)
            }
            Text("Modelo horário em ponto oceânico ao largo do RJ. Não é marégrafo, medição na praia ou tábua de porto. Não determina preamar/baixamar exatas, ressaca ou tsunami. Hora de emissão da rodada não comprovada.",style=MaterialTheme.typography.bodySmall)
            Text("Fonte: E.U. Copernicus Marine Service / Mercator Ocean",style=MaterialTheme.typography.labelSmall)
        }
    }
}
