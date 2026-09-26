package br.com.blaise.rj

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.billing.BillingEntitlementSnapshot
import br.com.blaise.rj.billing.PlayBillingEntitlementSource
import br.com.blaise.rj.billing.PurchaseVerifierFactory
import br.com.blaise.rj.billing.SubscriptionOffer
import br.com.blaise.rj.billing.SubscriptionOffersSnapshot
import br.com.blaise.rj.data.DashboardDataHttpsClient
import br.com.blaise.rj.data.DashboardResultGenerationGate
import br.com.blaise.rj.data.DashboardDataNetworkResult
import br.com.blaise.rj.cities.CitySelectionStore
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialFeedEvidence
import br.com.blaise.rj.core.OfficialFeedState
import br.com.blaise.rj.core.OfficialFeedStatusPolicy
import com.android.billingclient.api.BillingClient
import java.time.Instant

class MainActivity : ComponentActivity() {
    private lateinit var billingSource: PlayBillingEntitlementSource
    private var billingSnapshot by mutableStateOf<BillingEntitlementSnapshot>(BillingEntitlementSnapshot.Unconfigured)
    private var offersSnapshot by mutableStateOf<SubscriptionOffersSnapshot>(SubscriptionOffersSnapshot.Unconfigured)
    private var purchaseLaunchCode by mutableStateOf<Int?>(null)
    private var dashboardDataResult by mutableStateOf<DashboardDataNetworkResult>(DashboardDataNetworkResult.Unavailable)
    private val dashboardRequestGeneration = DashboardResultGenerationGate()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val products = setOf(BuildConfig.BLAISE_MONTHLY_PRODUCT_ID, BuildConfig.BLAISE_ANNUAL_PRODUCT_ID)
            .map(String::trim)
            .filter(String::isNotEmpty)
            .toSet()
        val verifier = PurchaseVerifierFactory.create(
            endpoint = BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL,
            packageName = packageName,
        )
        billingSource = PlayBillingEntitlementSource(applicationContext, products, verifier)
        val dashboardClient = DashboardDataHttpsClient.create(
            entitlementVerifierEndpoint = BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL,
            packageName = packageName,
        )

        setContent {
            BlaiseApp(
                store = CitySelectionStore(applicationContext),
                billingSnapshot = billingSnapshot,
                offersSnapshot = offersSnapshot,
                purchaseLaunchCode = purchaseLaunchCode,
                dashboardDataResult = dashboardDataResult,
                onRefreshBilling = { billingSource.refresh() },
                onSubscribe = { offer ->
                    purchaseLaunchCode = null
                    billingSource.launchPurchase(this, offer) { responseCode ->
                        runOnUiThread { purchaseLaunchCode = responseCode }
                    }
                },
            )
        }

        billingSource.start(
            entitlementObserver = { snapshot -> runOnUiThread { billingSnapshot = snapshot } },
            offersObserver = { snapshot -> runOnUiThread { offersSnapshot = snapshot } },
            verifiedPurchaseObserver = { candidate ->
                val generation = dashboardRequestGeneration.invalidate()
                runOnUiThread { dashboardDataResult = DashboardDataNetworkResult.Unavailable }
                if (candidate != null && dashboardClient != null) {
                    dashboardClient.fetch(candidate) { result ->
                        if (dashboardRequestGeneration.isCurrent(generation)) {
                            runOnUiThread {
                                if (dashboardRequestGeneration.isCurrent(generation)) {
                                    dashboardDataResult = result
                                }
                            }
                        }
                    }
                }
            },
        )
    }

    override fun onDestroy() {
        dashboardRequestGeneration.invalidate()
        dashboardDataResult = DashboardDataNetworkResult.Unavailable
        if (::billingSource.isInitialized) billingSource.stop()
        super.onDestroy()
    }
}

private val Navy = Color(0xFF06182C)
private val NavyRaised = Color(0xFF0A223D)
private val Panel = Color(0xFF102D4F)
private val PanelSoft = Color(0xFF15385F)
private val Gold = Color(0xFFD9B64A)
private val GoldSoft = Color(0xFFFFE39A)
private val StableGreen = Color(0xFF57E389)
private val AlertRed = Color(0xFFFF5D62)
private val WarningAmber = Color(0xFFFFC857)
private val Muted = Color(0xFFA8B5C5)
private val Divider = Color(0xFF284A6D)

private val BlaiseScheme = darkColorScheme(
    primary = Gold,
    onPrimary = Navy,
    secondary = StableGreen,
    background = Navy,
    onBackground = Color.White,
    surface = Panel,
    onSurface = Color.White,
)

@Composable
fun BlaiseApp(
    store: CitySelectionStore,
    officialFeedEvidence: OfficialFeedEvidence? = null,
    billingSnapshot: BillingEntitlementSnapshot = BillingEntitlementSnapshot.Unconfigured,
    offersSnapshot: SubscriptionOffersSnapshot = SubscriptionOffersSnapshot.Unconfigured,
    purchaseLaunchCode: Int? = null,
    dashboardDataResult: DashboardDataNetworkResult = DashboardDataNetworkResult.Unavailable,
    onRefreshBilling: () -> Unit = {},
    onSubscribe: (SubscriptionOffer) -> Unit = {},
) {
    val context = LocalContext.current
    val uiPreferences = remember { context.getSharedPreferences("blaise-ui-state", Context.MODE_PRIVATE) }
    var city1 by remember { mutableStateOf(store.load(1)) }
    var city2 by remember { mutableStateOf(store.load(2)) }
    var pickerSlot by remember { mutableStateOf<Int?>(null) }
    var selectedSection by remember { mutableStateOf(FinalDashboardSpec.primaryNavigation.first()) }
    var powerOn by remember { mutableStateOf(uiPreferences.getBoolean("power_on", true)) }
    var silentMode by remember { mutableStateOf(uiPreferences.getBoolean("silent_mode", false)) }
    val officialFeedState = remember(officialFeedEvidence) {
        OfficialFeedStatusPolicy.state(officialFeedEvidence, Instant.now())
    }

    BlaiseDashboard(
        city1 = city1,
        city2 = city2,
        officialFeedState = officialFeedState,
        billingSnapshot = billingSnapshot,
        offersSnapshot = offersSnapshot,
        purchaseLaunchCode = purchaseLaunchCode,
        dashboardDataResult = dashboardDataResult,
        selectedSection = selectedSection,
        powerOn = powerOn,
        silentMode = silentMode,
        onSelectSection = { selectedSection = it },
        onPowerChange = {
            powerOn = it
            uiPreferences.edit().putBoolean("power_on", it).apply()
        },
        onSilentModeChange = {
            silentMode = it
            uiPreferences.edit().putBoolean("silent_mode", it).apply()
        },
        onRefreshBilling = onRefreshBilling,
        onSubscribe = onSubscribe,
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
    officialFeedState: OfficialFeedState,
    billingSnapshot: BillingEntitlementSnapshot,
    offersSnapshot: SubscriptionOffersSnapshot,
    purchaseLaunchCode: Int?,
    dashboardDataResult: DashboardDataNetworkResult,
    selectedSection: String,
    powerOn: Boolean,
    silentMode: Boolean,
    onSelectSection: (String) -> Unit,
    onPowerChange: (Boolean) -> Unit,
    onSilentModeChange: (Boolean) -> Unit,
    onRefreshBilling: () -> Unit,
    onSubscribe: (SubscriptionOffer) -> Unit,
    onChooseCity1: () -> Unit,
    onChooseCity2: () -> Unit,
) {
    MaterialTheme(colorScheme = BlaiseScheme) {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val wide = maxWidth >= 760.dp
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = if (wide) 24.dp else 14.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    AppHeader(powerOn)
                    AssistantPanel()
                    PrimaryNavigation(selectedSection, onSelectSection)
                    OfficialStatusBanner(officialFeedState)
                    AccessPolicyStrip()

                    when (selectedSection) {
                        "Início" -> HomeScreen(city1, city2, wide, dashboardDataResult, onChooseCity1, onChooseCity2)
                        "Cidades" -> CitiesScreen(city1, city2, onChooseCity1, onChooseCity2)
                        "Mapa" -> MapScreen(city1, city2)
                        "Alertas" -> AlertsScreen(city1, city2)
                        "Trânsito" -> TrafficScreen()
                        "Mar e Ondas" -> MarineScreen()
                        "Qualidade do Ar" -> AirQualityScreen()
                        "Notícias" -> NewsScreen()
                        "Histórico" -> HistoryScreen(city1, city2)
                        "Mais" -> MoreScreen(
                            powerOn = powerOn,
                            silentMode = silentMode,
                            onPowerChange = onPowerChange,
                            onSilentModeChange = onSilentModeChange,
                        )
                        else -> HomeScreen(city1, city2, wide, dashboardDataResult, onChooseCity1, onChooseCity2)
                    }

                    BillingPanel(
                        entitlement = billingSnapshot,
                        offers = offersSnapshot,
                        purchaseLaunchCode = purchaseLaunchCode,
                        onRefresh = onRefreshBilling,
                        onSubscribe = onSubscribe,
                    )

                    FooterSources()
                }
            }
        }
    }
}

@Composable
private fun AppHeader(powerOn: Boolean) {
    Card(
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                Text(FinalDashboardSpec.TAGLINE, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                Text("Última atualização: aguardando primeira consolidação oficial", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
            val statusColor = if (powerOn) StableGreen else AlertRed
            val statusBackground = if (powerOn) Color(0xFF123D2B) else Color(0xFF4A1F25)
            Surface(
                modifier = Modifier.testTag("power-indicator"),
                color = statusBackground,
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, statusColor),
            ) {
                Text(
                    if (powerOn) "● LIGADO" else "● DESLIGADO",
                    color = statusColor,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun AssistantPanel() {
    var question by remember { mutableStateOf("") }
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.48f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    modifier = Modifier.size(54.dp),
                    shape = CircleShape,
                    color = Color(0xFF183F66),
                    border = BorderStroke(1.dp, Gold),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("B", color = GoldSoft, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("Blaise", color = Color.White, fontWeight = FontWeight.ExtraBold)
                    Text(FinalDashboardSpec.ASSISTANT_PROMPT, color = Gold, style = MaterialTheme.typography.bodyMedium)
                    Text("Pergunte sobre clima, alertas, trânsito, risco, RJ e Oceano Atlântico.", color = Muted, style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(onClick = {}, enabled = false, modifier = Modifier.testTag("assistant-microphone")) {
                    Text("🎙")
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = question,
                    onValueChange = { question = it },
                    label = { Text("Digite o que deseja saber") },
                    singleLine = true,
                    modifier = Modifier.weight(1f).testTag("assistant-input"),
                )
                Button(onClick = {}, enabled = false) { Text("Enviar") }
            }
            Text("Microfone e resposta serão habilitados somente quando o serviço de voz/Q&A estiver conectado e validado.", color = Muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun PrimaryNavigation(selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("primary-navigation"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FinalDashboardSpec.primaryNavigation.forEach { item ->
            if (item == selected) {
                Button(onClick = { onSelect(item) }, modifier = Modifier.testTag("nav-$item")) { Text(item) }
            } else {
                OutlinedButton(onClick = { onSelect(item) }, modifier = Modifier.testTag("nav-$item")) { Text(item) }
            }
        }
    }
}

@Composable
private fun AccessPolicyStrip() {
    Card(
        colors = CardDefaults.cardColors(containerColor = PanelSoft),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("P0 oficial permanece disponível sem assinatura.", color = Gold, fontWeight = FontWeight.Bold)
            Text("Conteúdo premium exige entitlement ativo.", color = Color.LightGray)
        }
    }
}

@Composable
private fun HomeScreen(
    city1: City,
    city2: City,
    wide: Boolean,
    dashboardDataResult: DashboardDataNetworkResult,
    onChooseCity1: () -> Unit,
    onChooseCity2: () -> Unit,
) {
    if (wide) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            BlaiseHeroCard(Modifier.weight(0.86f))
            CityPair(city1, city2, onChooseCity1, onChooseCity2, Modifier.weight(1.55f))
        }
    } else {
        BlaiseHeroCard(Modifier.fillMaxWidth())
        Spacer(Modifier.height(14.dp))
        CityPair(city1, city2, onChooseCity1, onChooseCity2, Modifier.fillMaxWidth())
    }
    Spacer(Modifier.height(14.dp))
    QuickConditionsRow(dashboardDataResult)
    Spacer(Modifier.height(14.dp))
    MarineAndRiskRow(wide)
    Spacer(Modifier.height(14.dp))
    RadarPanel()
    Spacer(Modifier.height(14.dp))
    BulletinAndNewsRow(wide)
}

@Composable
private fun CitiesScreen(city1: City, city2: City, onChooseCity1: () -> Unit, onChooseCity2: () -> Unit) {
    CityPair(city1, city2, onChooseCity1, onChooseCity2, Modifier.fillMaxWidth())
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "CLIMA DO DIA • DUAS CIDADES",
        subtitle = "Temperatura, sensação térmica, chuva e severidade por município",
    ) {
        StatusLine(city1.name, "Aguardando temperatura, térmica, chuva e horário de fonte oficial")
        StatusLine(city2.name, "Aguardando temperatura, térmica, chuva e horário de fonte oficial")
        Text("A coluna preta mantém a separação visual entre Cidade 1 e Cidade 2.", color = Muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun MapScreen(city1: City, city2: City) {
    DashboardSection(
        title = "MAPA DE RISCO • ESTADO DO RJ",
        subtitle = "Visão adaptativa: Estado + ${city1.name} + ${city2.name}",
    ) {
        PlaceholderMap("Camadas: alertas, radar, trânsito, alagamentos, sirenes, pontos de apoio e risco geológico")
        StatusLine("COR.Rio / CET-Rio", "Aguardando eventos georreferenciados oficiais")
        StatusLine("Geo-Rio / Defesa Civil", "Aguardando risco, sirenes e pontos de apoio")
        StatusLine("INEA / Alerta Rio", "Aguardando radar e chuva com horário por frame")
    }
}

@Composable
private fun AlertsScreen(city1: City, city2: City) {
    DashboardSection(
        title = "ALERTAS POR MUNICÍPIO",
        subtitle = "Verde • Amarelo • Amarelo piscando • Vermelho • COR.Rio 1–5",
    ) {
        StatusLine(city1.name, "Sem conclusão até receber evidência oficial válida")
        StatusLine(city2.name, "Sem conclusão até receber evidência oficial válida")
        Text("Até 3 alertas ficam no painel da cidade. Com 4 ou mais, abre página adicional de alertas.", color = Gold)
        Text("Última hora: quando existir P0/urgência válida, a mensagem aparece em vermelho, negrito e borda dourada com fonte e horário.", color = Muted)
    }
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "ABALO SÍSMICO",
        subtitle = "Regra de notificação do Blaise V6 RJ",
    ) {
        Text("Notificar somente eventos de magnitude ≥ 7,0 que tenham sido sentidos no Brasil.", color = Color.White, fontWeight = FontWeight.SemiBold)
        Text("Eventos abaixo do limiar, ou sem evidência de impacto/sensação no Brasil, não geram notificação ao cliente.", color = Muted)
    }
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "CICLONES • ATLÂNTICO",
        subtitle = "Formação oceânica, proximidade e rota prevista",
    ) {
        StatusLine("Formação", "Aguardando fonte meteorológica válida")
        StatusLine("Rota prevista", "Exibida apenas quando sustentada por fonte válida")
        StatusLine("Impacto em solo", "P0 quando houver orientação oficial aplicável")
    }
}

@Composable
private fun TrafficScreen() {
    DashboardSection(
        title = "TRÂNSITO • EVENTOS",
        subtitle = "COR.Rio • CET-Rio • Geo-Rio • Defesa Civil • Guarda Municipal",
    ) {
        FinalDashboardSpec.trafficEvents.forEach { event -> StatusLine(event, "Aguardando ocorrência oficial") }
    }
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "ROTAS E OPERAÇÃO",
        subtitle = "Autoria, horário, área, validade e estado operacional preservados",
    ) {
        StatusLine("Rotas alternativas", "Somente quando houver evento confirmado")
        StatusLine("Estágio da cidade", "Aguardando COR.Rio")
        StatusLine("Câmeras/monitoramento", "Sem reprodução de fonte não autorizada")
    }
}

@Composable
private fun MarineScreen() {
    MarinePanel(Modifier.fillMaxWidth())
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "RESSACA • TSUNAMI • MAREMOTO",
        subtitle = "Marinha do Brasil / CHM",
    ) {
        StatusLine("Ressaca", "Regra destacada para ondas > 3,5 m quando houver aviso oficial")
        StatusLine("Tsunami meteorológica", "Aguardando aviso oficial")
        StatusLine("Tsunami / maremoto", "Aguardando aviso oficial")
        StatusLine("Surf / pesca", "Ondas, maré e direção do vento com fonte e horário")
    }
}

@Composable
private fun AirQualityScreen() {
    DashboardSection(
        title = "QUALIDADE DO AR • IQAr",
        subtitle = "5 faixas + umidade relativa + índice UV",
    ) {
        StatusLine("IQAr", "Aguardando índice oficial e faixa de severidade")
        StatusLine("Alerta IQAr", "Destacar muito ruim/severo para o Estado do RJ")
        StatusLine("Umidade", "Ideal 50–60% • alertar abaixo de 30%")
        StatusLine("Faixas UR", "20–30% • 12–20% • <12% com severidade crescente")
        StatusLine("UV", "Aguardando índice e severidade")
    }
}

@Composable
private fun NewsScreen() {
    NewsPanel(Modifier.fillMaxWidth())
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "NOTICIÁRIO LOCAL",
        subtitle = "3 principais notícias recentes com data/hora e fonte",
    ) {
        FinalDashboardSpec.newsScopes.take(4).forEach { scope -> StatusLine(scope, "Aguardando notícia recente validada") }
        Text("Vídeo somente via incorporação/link oficial; sem hospedagem ou download do conteúdo do veículo.", color = Muted)
    }
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "BOLETIM INTERNACIONAL",
        subtitle = "El Niño/La Niña • extremos • ciclones • terremoto/tsunami relevante",
    ) {
        NewsPlaceholder("1", "Aguardando notícia internacional recente traduzida com fonte")
        NewsPlaceholder("2", "Aguardando notícia internacional recente traduzida com fonte")
        NewsPlaceholder("3", "Aguardando notícia internacional recente traduzida com fonte")
    }
}

@Composable
private fun HistoryScreen(city1: City, city2: City) {
    DashboardSection(
        title = "HISTÓRICO E COMPARAÇÃO",
        subtitle = "Comparação V6 por cidade, período e fonte",
    ) {
        StatusLine(city1.name, "Aguardando dados históricos elegíveis")
        StatusLine(city2.name, "Aguardando dados históricos elegíveis")
        Text("A comparação não cria valores sintéticos; usa somente snapshots/dados consolidados válidos.", color = Muted)
    }
}

@Composable
private fun MoreScreen(
    powerOn: Boolean,
    silentMode: Boolean,
    onPowerChange: (Boolean) -> Unit,
    onSilentModeChange: (Boolean) -> Unit,
) {
    DashboardSection(
        title = "CONFIGURAÇÕES",
        subtitle = "Controle manual do aplicativo e áudio",
    ) {
        StatusLine("Estado inicial", "LIGADO")
        Button(
            onClick = { onPowerChange(!powerOn) },
            modifier = Modifier.fillMaxWidth().testTag("settings-power-toggle"),
            colors = ButtonDefaults.buttonColors(containerColor = if (powerOn) StableGreen else AlertRed, contentColor = Navy),
        ) {
            Text(if (powerOn) "Desligar aplicativo" else "Ligar aplicativo")
        }
        OutlinedButton(
            onClick = { onSilentModeChange(!silentMode) },
            modifier = Modifier.fillMaxWidth().testTag("settings-silent-toggle"),
        ) {
            Text(if (silentMode) "Modo silencioso: LIGADO" else "Modo silencioso: DESLIGADO")
        }
        Text("Não existe silêncio automático por horário; o controle é manual.", color = Muted)
    }
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "FONTES OFICIAIS",
        subtitle = "Prioridade local e origem preservada",
    ) {
        FinalDashboardSpec.officialSources.forEach { source -> StatusLine(source, "Monitoramento/configuração por adapter") }
    }
}

@Composable
private fun PlaceholderMap(detail: String) {
    Surface(
        modifier = Modifier.fillMaxWidth().height(180.dp),
        color = Color(0xFF071421),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(18.dp)) {
                Text("MAPA TERRITORIAL RJ", color = Gold, fontWeight = FontWeight.Bold)
                Text(detail, color = Muted, textAlign = TextAlign.Center)
                Text("Sem dados sintéticos • aguardando camadas oficiais", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun BlaiseHeroCard(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.48f)),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Surface(
                modifier = Modifier.size(96.dp),
                shape = CircleShape,
                color = Color(0xFF183F66),
                border = BorderStroke(2.dp, Gold),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("B", color = GoldSoft, fontWeight = FontWeight.Black, style = MaterialTheme.typography.displaySmall)
                }
            }
            Text("Blaise", color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
            Text("Assistente meteorológico e de alertas", color = Muted, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodySmall)
            Button(
                onClick = {},
                enabled = false,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(disabledContainerColor = Divider, disabledContentColor = Muted),
            ) {
                Text("Ouvir última atualização")
            }
            Text("Áudio será habilitado somente após existir boletim consolidado.", color = Muted, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun CityPair(
    city1: City,
    city2: City,
    onChooseCity1: () -> Unit,
    onChooseCity2: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("MUNICÍPIOS MONITORADOS", color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CityPanel("Cidade 1", city1, "Escolher cidade 1", onChooseCity1, Modifier.weight(1f))
                Box(Modifier.width(2.dp).height(190.dp).background(Color.Black))
                CityPanel("Cidade 2", city2, "Escolher cidade 2", onChooseCity2, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun QuickConditionsRow(dashboardDataResult: DashboardDataNetworkResult) {
    val rainfall = (dashboardDataResult as? DashboardDataNetworkResult.Available)?.snapshot?.rainfall
    val rainfallValue = rainfall?.max1hMm?.let { "%.1f mm".format(it) } ?: "—"
    val rainfallDetail = if (rainfall != null) "Alerta Rio • dado oficial atual" else "INDISPONÍVEL NO MOMENTO"
    Card(
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("CONDIÇÕES CONSOLIDADAS", color = Gold, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricTile("Temperatura", "— °C", "fonte oficial pendente", Modifier.weight(1f))
                MetricTile("Chuva", rainfallValue, rainfallDetail, Modifier.weight(1f))
                MetricTile("Vento", "— km/h", "rajadas pendentes", Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricTile("Umidade", "— %", "IQAr/UR pendente", Modifier.weight(1f))
                MetricTile("UV", "—", "índice pendente", Modifier.weight(1f))
                MetricTile("COR.Rio", "—", "estágio pendente", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun MetricTile(title: String, value: String, detail: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        color = Panel,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = Muted, style = MaterialTheme.typography.labelSmall)
            Text(value, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
            Text(detail, color = Muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun MarineAndRiskRow(wide: Boolean) {
    if (wide) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            MarinePanel(Modifier.weight(1f))
            RiskPanel(Modifier.weight(1f))
        }
    } else {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            MarinePanel(Modifier.fillMaxWidth())
            RiskPanel(Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun MarinePanel(modifier: Modifier) {
    DashboardSection(
        title = "MARINHA • OCEANO ATLÂNTICO",
        subtitle = "Maré, ondas, vento e ressaca",
        modifier = modifier,
    ) {
        StatusLine("Ondas", "Aguardando dado oficial CHM")
        StatusLine("Ressaca > 3,5 m", "Aguardando dado oficial CHM")
        StatusLine("Maré", "Aguardando dado oficial CHM")
        StatusLine("Direção do vento", "Aguardando consolidação")
    }
}

@Composable
private fun RiskPanel(modifier: Modifier) {
    DashboardSection(
        title = "RISCO • TRÂNSITO",
        subtitle = "COR.Rio • CET-Rio • Geo-Rio • Defesa Civil",
        modifier = modifier,
    ) {
        StatusLine("Alagamentos", "Sem conclusão até receber fonte válida")
        StatusLine("Interdições", "Aguardando fonte oficial")
        StatusLine("Deslizamento", "Aguardando Geo-Rio/Defesa Civil")
        StatusLine("Rotas alternativas", "Indisponíveis sem evento confirmado")
    }
}

@Composable
private fun RadarPanel() {
    DashboardSection(
        title = "RADAR • ÚLTIMOS 30 MIN",
        subtitle = "INEA Guaratiba/Macaé • Alerta Rio/Sumaré",
        modifier = Modifier.fillMaxWidth(),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth().height(150.dp),
            color = Color(0xFF071421),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Divider),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("RADAR REAL", color = Gold, fontWeight = FontWeight.Bold)
                    Text("Frames reais aparecerão aqui quando a ingestão oficial estiver disponível.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
                    Text("Sem interpolação • horário e fonte em cada frame", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun BulletinAndNewsRow(wide: Boolean) {
    if (wide) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            BulletinPanel(Modifier.weight(1f))
            NewsPanel(Modifier.weight(1f))
        }
    } else {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            BulletinPanel(Modifier.fillMaxWidth())
            NewsPanel(Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun BulletinPanel(modifier: Modifier) {
    DashboardSection(
        title = "BOLETINS DO BLAISE",
        subtitle = "06:00 • 12:00 • 16:00 + urgências",
        modifier = modifier,
    ) {
        StatusLine("06:00", "Aguardando fonte consolidada")
        StatusLine("12:00", "Aguardando fonte consolidada")
        StatusLine("16:00", "Aguardando fonte consolidada")
        OutlinedButton(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) {
            Text("Ouvir boletim mais recente")
        }
    }
}

@Composable
private fun NewsPanel(modifier: Modifier) {
    DashboardSection(
        title = "NOTÍCIAS",
        subtitle = "Rio • Niterói • São Gonçalo • Sudeste",
        modifier = modifier,
    ) {
        NewsPlaceholder("1", "Aguardando notícia recente com fonte oficial")
        NewsPlaceholder("2", "Aguardando notícia recente com fonte oficial")
        NewsPlaceholder("3", "Aguardando notícia recente com fonte oficial")
    }
}

@Composable
private fun DashboardSection(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, color = Gold, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Muted, style = MaterialTheme.typography.bodySmall)
            content()
        }
    }
}

@Composable
private fun StatusLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(0.36f))
        Text(value, color = Muted, modifier = Modifier.weight(0.64f))
    }
}

@Composable
private fun NewsPlaceholder(index: String, text: String) {
    Surface(color = Panel, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Divider)) {
        Row(Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = CircleShape, color = Gold) {
                Text(index, color = Navy, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
            Text(text, color = Muted, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun BillingPanel(
    entitlement: BillingEntitlementSnapshot,
    offers: SubscriptionOffersSnapshot,
    purchaseLaunchCode: Int?,
    onRefresh: () -> Unit,
    onSubscribe: (SubscriptionOffer) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.48f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Assinatura Google Play", color = Gold, fontWeight = FontWeight.Bold)
            val status = when (entitlement) {
                BillingEntitlementSnapshot.Unconfigured -> "Não configurada nesta build • premium bloqueado"
                BillingEntitlementSnapshot.Connecting -> "Conectando ao Google Play • premium bloqueado"
                BillingEntitlementSnapshot.Verifying -> "Verificando assinatura no backend • premium bloqueado até confirmação"
                BillingEntitlementSnapshot.Inactive -> "Assinatura inativa ou não verificada • premium bloqueado"
                is BillingEntitlementSnapshot.Active -> "Assinatura verificada • premium liberado"
                is BillingEntitlementSnapshot.Unavailable -> "Google Play indisponível (${entitlement.responseCode}) • premium bloqueado"
            }
            Text(status, color = Color.White)

            when (offers) {
                SubscriptionOffersSnapshot.Unconfigured -> Text("IDs de assinatura ainda não configurados para esta build.", color = Color.LightGray)
                SubscriptionOffersSnapshot.Loading -> Text("Consultando ofertas elegíveis no Google Play…", color = Color.LightGray)
                is SubscriptionOffersSnapshot.Unavailable -> Text("Ofertas indisponíveis (${offers.responseCode}).", color = Color.LightGray)
                is SubscriptionOffersSnapshot.Ready -> {
                    if (offers.offers.isEmpty()) {
                        Text("Nenhuma oferta elegível retornada pelo Google Play.", color = Color.LightGray)
                    } else {
                        offers.offers.forEach { offer ->
                            val trial = if (offer.hasFreeTrial) " • teste elegível" else ""
                            Button(onClick = { onSubscribe(offer) }, modifier = Modifier.fillMaxWidth()) {
                                Text("${offer.name} • ${offer.formattedRecurringPrice}$trial")
                            }
                        }
                    }
                }
            }
            purchaseLaunchCode?.let { code ->
                val message = if (code == BillingClient.BillingResponseCode.OK) {
                    "Fluxo de compra aberto pelo Google Play. Acesso só será liberado após verificação do backend."
                } else {
                    "Não foi possível abrir a compra (código $code). Nenhum acesso foi liberado."
                }
                Text(message, color = if (code == BillingClient.BillingResponseCode.OK) Gold else WarningAmber)
            }
            Button(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) { Text("Atualizar assinatura") }
        }
    }
}

@Composable
private fun OfficialStatusBanner(state: OfficialFeedState) {
    val (headline, detail, color) = when (state) {
        OfficialFeedState.CURRENT_CLEAR -> Triple(
            "SEM ALERTAS P0 OFICIAIS ATIVOS",
            "Ausência de P0 confirmada por evidência oficial válida.",
            StableGreen,
        )
        OfficialFeedState.CURRENT_P0 -> Triple(
            "ALERTA P0 OFICIAL ATIVO",
            "Prioridade máxima. Consulte a orientação da fonte oficial exibida.",
            AlertRed,
        )
        OfficialFeedState.STALE -> Triple(
            "STATUS OFICIAL DESATUALIZADO",
            "Não presumimos ausência de alerta com evidência vencida.",
            WarningAmber,
        )
        OfficialFeedState.UNAVAILABLE -> Triple(
            "STATUS OFICIAL • AGUARDANDO DADOS",
            "Não presumimos ausência de alerta sem evidência oficial válida.",
            WarningAmber,
        )
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.85f)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Surface(modifier = Modifier.size(14.dp), shape = CircleShape, color = color) {}
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(headline, color = color, fontWeight = FontWeight.ExtraBold)
                Text(detail, color = Color.White)
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
    Surface(
        modifier = modifier,
        color = Panel,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, color = Gold, fontWeight = FontWeight.Bold)
            Text(city.name, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
            Text("IBGE ${city.ibgeCode}", color = Muted, style = MaterialTheme.typography.labelSmall)
            Spacer(Modifier.height(2.dp))
            Text("— °C", color = Color.White, fontWeight = FontWeight.Black, style = MaterialTheme.typography.headlineSmall)
            Text("Aguardando dados oficiais", color = Muted, style = MaterialTheme.typography.bodySmall)
            Button(onClick = onChoose, modifier = Modifier.fillMaxWidth()) { Text(chooseLabel) }
        }
    }
}

@Composable
private fun FooterSources() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF071421)),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("92 municípios do RJ • seleção simultânea de Cidade 1 e Cidade 2", color = Gold)
            Text("Clima • Alertas • Radar • Risco • Marinha • Trânsito", color = Color.White)
            Text("Notícias • Assinatura • Blaise/Voz • Configurações", color = Color.White)
            Text("Fontes oficiais têm prioridade. Dados exibem origem e atualização.", color = Gold)
        }
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

@Preview(showBackground = true, widthDp = 412, heightDp = 915)
@Composable
private fun PreviewApp() {
    BlaiseDashboard(
        city1 = requireNotNull(RioMunicipalities.byIbgeCode(3304557)),
        city2 = requireNotNull(RioMunicipalities.byIbgeCode(3303302)),
        officialFeedState = OfficialFeedState.UNAVAILABLE,
        billingSnapshot = BillingEntitlementSnapshot.Unconfigured,
        offersSnapshot = SubscriptionOffersSnapshot.Unconfigured,
        purchaseLaunchCode = null,
        dashboardDataResult = DashboardDataNetworkResult.Unavailable,
        selectedSection = "Início",
        powerOn = true,
        silentMode = false,
        onSelectSection = {},
        onPowerChange = {},
        onSilentModeChange = {},
        onRefreshBilling = {},
        onSubscribe = {},
        onChooseCity1 = {},
        onChooseCity2 = {},
    )
}
