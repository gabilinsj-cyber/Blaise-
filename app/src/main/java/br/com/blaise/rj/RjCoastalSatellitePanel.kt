package br.com.blaise.rj

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.data.CoastalMission
import br.com.blaise.rj.data.CoastalSatelliteClient
import br.com.blaise.rj.data.CoastalSatelliteScene
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

@Composable
fun RjCoastalSatellitePanel() {
    val browser = LocalUriHandler.current
    var openFailed by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().testTag("rj-coastal-satellite-panel"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("SATÉLITES • ORLA RJ E ATLÂNTICO", style = MaterialTheme.typography.titleMedium)
        Text("Duas missões ópticas: Landsat e Sentinel-2. Cenas de passagem orbital, sem transmissão ao vivo. Nuvens podem ocultar praias; cada cena cobre parte da região. Catálogo consultado a cada 5 minutos nesta tela; prévias são carregadas ao tocar.", style = MaterialTheme.typography.bodySmall)
        CoastalMission.entries.forEach { mission -> CoastalSatelliteCard(mission) }
        Text("Imagens apoiam a análise da costa. Não medem automaticamente ondas, marés, correntes ou balneabilidade e não confirmam ressaca ou tsunami.", style = MaterialTheme.typography.bodySmall)
        listOf("Sentinel-2 • Copernicus Browser" to CoastalSatelliteClient.COPERNICUS_URL,
            "NASA Earthdata • catálogo" to CoastalSatelliteClient.EARTHDATA_URL,
            "USGS • Landsat / EarthExplorer" to CoastalSatelliteClient.USGS_URL).forEach { (label, url) ->
            TextButton(onClick = { openFailed = runCatching { browser.openUri(url) }.isFailure }) { Text(label) }
        }
        Text("Radar da ESA: Sentinel-1; Sentinel-2 é óptico. Os visualizadores oficiais permitem escolher cenas e comparar datas.", style = MaterialTheme.typography.labelSmall)
        if(openFailed) Text("Não foi possível abrir o visualizador.")
    }
}

@Composable
private fun CoastalSatelliteCard(mission: CoastalMission) {
    val scope = rememberCoroutineScope()
    val browser = LocalUriHandler.current
    var scene by remember(mission) { mutableStateOf<CoastalSatelliteScene?>(null) }
    var image by remember(mission) { mutableStateOf<ImageBitmap?>(null) }
    var busy by remember(mission) { mutableStateOf(false) }
    var message by remember(mission) { mutableStateOf("Consulta ainda não realizada") }
    suspend fun refresh() {
        if(busy) return
        busy = true
        try {
            val next = CoastalSatelliteClient.latest(mission)
            if(next?.title != scene?.title) image = null
            scene = next
            message = if(next == null) "Nenhuma cena encontrada para o recorte RJ" else "Cena localizada • cobertura parcial • HLS 30 m"
        } catch(e: CancellationException) { throw e }
        catch(_: Exception) {
            scene = null; image = null
            message = "Catálogo indisponível; sem imagem atual confirmada"
        } finally { busy = false }
    }
    LaunchedEffect(mission) {
        while(true) { refresh(); delay(300_000) }
    }
    Card(Modifier.fillMaxWidth().testTag("coastal-mission-${mission.name}")) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(mission.label, style = MaterialTheme.typography.titleSmall)
            Text(message, style = MaterialTheme.typography.bodySmall)
            Button(enabled = !busy, onClick = {
                scope.launch { refresh() }
            }) { Text(if(busy) "Aguarde…" else "Consultar cena mais recente") }
            scene?.let { current ->
                val fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ZoneId.of("America/Sao_Paulo"))
                Text("Aquisição: ${fmt.format(current.acquiredAt)} (Brasília)\nConsulta: ${fmt.format(current.checkedAt)}\n${current.title}", style = MaterialTheme.typography.labelSmall)
                Text("A data de consulta não renova a imagem. Confira a área e as nuvens no visualizador.", style = MaterialTheme.typography.labelSmall)
                if(current.previewUrl == null) Text("Prévia pública não fornecida no catálogo. Abra a cena no visualizador oficial.", style = MaterialTheme.typography.labelSmall)
                if(current.previewUrl != null) TextButton(enabled = !busy, onClick = {
                    busy = true; image = null
                    scope.launch {
                        try {
                            val bytes = CoastalSatelliteClient.preview(current)
                            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                            require(bounds.outWidth in 1..4096 && bounds.outHeight in 1..4096)
                            val options = BitmapFactory.Options().apply { inSampleSize = 4 }
                            image = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)).asImageBitmap()
                        } catch(e: CancellationException) { throw e }
                        catch(_: Exception) { message = "Prévia indisponível. Consulte a cena no visualizador oficial." }
                        finally { busy = false }
                    }
                }) { Text("Carregar prévia • até 2 MB") }
                image?.let { Image(it, "Cena parcial da costa RJ • ${mission.label} • aquisição ${current.acquiredAt}",
                    Modifier.fillMaxWidth().heightIn(max = 280.dp), contentScale = ContentScale.Fit) }
                TextButton(onClick = { if(runCatching { browser.openUri(current.worldviewUrl) }.isFailure) message = "Não foi possível abrir NASA Worldview" }) { Text("Ver recorte RJ no NASA Worldview") }
            }
        }
    }
}
