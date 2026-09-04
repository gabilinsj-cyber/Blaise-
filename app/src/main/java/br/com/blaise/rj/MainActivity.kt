package br.com.blaise.rj

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.cities.CitySelectionStore
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { BlaiseApp(CitySelectionStore(applicationContext)) }
    }
}

private val Navy = Color(0xFF071B33)
private val Gold = Color(0xFFD4AF37)
private val Panel = Color(0xFF102D4F)

@Composable
fun BlaiseApp(store: CitySelectionStore) {
    var city1 by remember { mutableStateOf(store.load(1)) }
    var city2 by remember { mutableStateOf(store.load(2)) }
    var pickerSlot by remember { mutableStateOf<Int?>(null) }

    BlaiseDashboard(
        city1 = city1,
        city2 = city2,
        onChooseCity1 = { pickerSlot = 1 },
        onChooseCity2 = { pickerSlot = 2 },
    )

    val slot = pickerSlot
    if (slot != null) {
        val other = if (slot == 1) city2 else city1
        CityPickerDialog(
            slot = slot,
            excludedIbgeCode = other.ibgeCode,
            onDismiss = { pickerSlot = null },
            onSelected = { selected ->
                if (slot == 1) city1 = selected else city2 = selected
                store.save(slot, selected)
                pickerSlot = null
            },
        )
    }
}

@Composable
private fun BlaiseDashboard(
    city1: City,
    city2: City,
    onChooseCity1: () -> Unit,
    onChooseCity2: () -> Unit,
) {
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
            Column(
                Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
                Text("Monitoramento integrado do Estado do Rio de Janeiro", color = Color.White)
                Text("TEMPO ESTÁVEL • SEM ALERTAS P0", color = Color(0xFF55DD88), fontWeight = FontWeight.Bold)
                Text("P0 oficial permanece disponível sem assinatura.", color = Gold, fontWeight = FontWeight.Bold)
                Text("Conteúdo premium exige entitlement ativo.", color = Color.LightGray)

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CityPanel("Cidade 1", city1, "Escolher cidade 1", onChooseCity1, Modifier.weight(1f))
                    Box(Modifier.width(2.dp).height(118.dp).background(Color.Black))
                    CityPanel("Cidade 2", city2, "Escolher cidade 2", onChooseCity2, Modifier.weight(1f))
                }

                Text("92 municípios do RJ • seleção simultânea de Cidade 1 e Cidade 2", color = Gold)
                Text("Clima • Alertas • Radar • Risco • Marinha • Trânsito", color = Color.White)
                Text("Notícias • Assinatura • Blaise/Voz • Configurações", color = Color.White)
                Text("Fontes oficiais têm prioridade. Dados exibem origem e atualização.", color = Gold)
            }
        }
    }
}

@Composable
private fun CityPanel(
    label: String,
    city: City,
    chooseLabel: String,
    onChoose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.background(Panel).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = Gold, fontWeight = FontWeight.Bold)
        Text(city.name, color = Color.White, fontWeight = FontWeight.Bold)
        Text("IBGE ${city.ibgeCode}", color = Color.LightGray)
        Text("Aguardando dados oficiais", color = Color.LightGray)
        Button(onClick = onChoose, modifier = Modifier.fillMaxWidth()) { Text(chooseLabel) }
    }
}

@Composable
private fun CityPickerDialog(
    slot: Int,
    excludedIbgeCode: Int,
    onDismiss: () -> Unit,
    onSelected: (City) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val cities = RioMunicipalities.search(query).filter { it.ibgeCode != excludedIbgeCode }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Escolher cidade $slot") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Buscar município") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("city-search"),
                )
                LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 380.dp)) {
                    items(cities, key = { it.ibgeCode }) { city ->
                        TextButton(
                            onClick = { onSelected(city) },
                            modifier = Modifier.fillMaxWidth().testTag("city-option-${city.ibgeCode}"),
                        ) {
                            Text(city.name, modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Fechar") } },
    )
}

@Preview(showBackground = true)
@Composable
private fun PreviewApp() {
    BlaiseDashboard(
        city1 = requireNotNull(RioMunicipalities.byIbgeCode(3304557)),
        city2 = requireNotNull(RioMunicipalities.byIbgeCode(3303302)),
        onChooseCity1 = {},
        onChooseCity2 = {},
    )
}
