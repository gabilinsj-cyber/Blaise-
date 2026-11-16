package br.com.blaise.rj.alerts

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Colored official-link-only card. Never accepts unsigned or stale warnings.
 * Text in every stage is black and bold as requested. No original bulletin
 * body, map, severity description or personal location trace is reproduced.
 */
@Composable
fun VerifiedRjStageAlertCard(alert: VerifiedBlaisePublicStage, now: Instant) {
    if (!alert.isCurrent(now)) return
    val uriHandler = LocalUriHandler.current
    val black = Color.Black
    val checked = alert.checkedAt.atZone(ZoneId.of("America/Sao_Paulo"))
        .format(DateTimeFormatter.ofPattern("dd/MM HH:mm"))
    Surface(
        color = Color(alert.stage.backgroundArgb.toInt()),
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Color.Black),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = alert.stage.number.toString(),
                color = black, fontWeight = FontWeight.Black,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(alert.stage.shortPhrase, color = black, fontWeight = FontWeight.Bold)
                Text(
                    "Fonte: ${alert.sourceId} • conferido em ${checked}",
                    color = black, fontWeight = FontWeight.Bold,
                )
            }
            TextButton(onClick = { uriHandler.openUri(alert.officialUrl) }) {
                Text("Ver fonte oficial", color = black, fontWeight = FontWeight.Bold)
            }
        }
    }
}
