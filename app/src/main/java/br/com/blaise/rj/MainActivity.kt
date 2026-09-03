package br.com.blaise.rj

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { BlaiseApp() }
    }
}

private val Navy = Color(0xFF071B33)
private val Gold = Color(0xFFD4AF37)

@Composable
fun BlaiseApp() {
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
                Text("Monitoramento integrado do Estado do Rio de Janeiro", color = Color.White)
                Text("TEMPO ESTÁVEL • SEM ALERTAS P0", color = Color(0xFF55DD88), fontWeight = FontWeight.Bold)
                Text("P0 oficial permanece disponível sem assinatura.", color = Gold, fontWeight = FontWeight.Bold)
                Text("Conteúdo premium exige entitlement ativo.", color = Color.LightGray)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CityPanel("Cidade 1", "Rio de Janeiro", Modifier.weight(1f))
                    CityPanel("Cidade 2", "Niterói", Modifier.weight(1f))
                }
                Text("Clima • Alertas • Radar • Risco • Marinha • Trânsito", color = Color.White)
                Text("Notícias • Assinatura • Blaise/Voz • Configurações", color = Color.White)
                Text("Fontes oficiais têm prioridade. Dados exibem origem e atualização.", color = Gold)
            }
        }
    }
}

@Composable
private fun CityPanel(label: String, city: String, modifier: Modifier = Modifier) {
    Column(modifier.background(Color(0xFF102D4F)).padding(12.dp)) {
        Text(label, color = Gold, fontWeight = FontWeight.Bold)
        Text(city, color = Color.White)
        Text("Aguardando dados oficiais", color = Color.LightGray)
    }
}

@Preview(showBackground = true)
@Composable private fun PreviewApp() = BlaiseApp()
