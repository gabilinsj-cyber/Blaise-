package br.com.blaise.rj

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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

/**
 * User's requested scientific/agent inventory. Debug APK only: there is no
 * authenticated telemetry/agent execution endpoint in the Android contracts.
 * DO NOT claim that a registered agent is currently executing.
 */
data class RjAgentInventoryItem(
    val number: Int,
    val title: String,
    val responsibility: String,
    val cadence: String
)

object RjAgentInventory {
    val declared = listOf(
        RjAgentInventoryItem(1, "Integridade", "Identificar falhas e preparar correções seguras", "Verificação horária"),
        RjAgentInventoryItem(2, "Verificação horária", "Conferir fontes, horários e qualidade", "1 hora"),
        RjAgentInventoryItem(3, "Rotina 01h", "Revisão e consolidação noturna", "01h, horário de Brasília"),
        RjAgentInventoryItem(4, "Auditoria", "Limpeza controlada, registros e retenção", "24 horas"),
        RjAgentInventoryItem(5, "Tempo severo", "Diagnósticos científicos e severidade", "5 min normal / 1 min severo / 25–30 s extremo"),
        RjAgentInventoryItem(6, "Trânsito", "Interdições, alagamentos e eventos urbanos", "5 min; depende de produtos oficiais"),
        RjAgentInventoryItem(7, "Marítimo", "Ondas, swell, vento e fenômenos costeiros", "5 min; depende de produtos NOAA/CPTEC"),
        RjAgentInventoryItem(8, "Voz", "Perguntas meteorológicas e respostas faladas", "Sob demanda"),
        RjAgentInventoryItem(9, "Fontes", "Fiscalização de domínios, acesso e licenças", "1 hora"),
        RjAgentInventoryItem(10, "Segurança", "Assinaturas, proteção, desempenho e escalabilidade", "Monitoramento previsto")
    )
}

/** Only debug builds expose internal agent definitions to the Android tester. */
@Composable
fun RjAgentDebugPanel() {
    if (!BuildConfig.DEBUG) return
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF102B46))) {
        Column(Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("DIAGNÓSTICO INTERNO • DEZ AGENTES",
                color = Color(0xFFF4D477), fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium)
            Text("Ambiente de teste: funções registradas, execução em produção NÃO verificada. " +
                "A presença nesta lista não ativa nenhum agente.",
                color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
            for (item in RjAgentInventory.declared) {
                Text(item.number.toString() + ". " + item.title,
                    color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(item.responsibility + " • Cadência planejada: " + item.cadence,
                    color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                Text("ESTADO: NÃO COMPROVADO POR TELEMETRIA",
                    color = Color(0xFFF4D477), style = MaterialTheme.typography.labelSmall)
            }
            Text("Somente um endpoint autenticado de telemetria poderá confirmar início, últimas execuções, fonte e falhas. Não mostra dados administrativos para clientes da versão de publicação.",
                color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
        }
    }
}
