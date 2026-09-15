package br.com.blaise.rj

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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

        setContent {
            BlaiseApp(
                store = CitySelectionStore(applicationContext),
                billingSnapshot = billingSnapshot,
                offersSnapshot = offersSnapshot,
                purchaseLaunchCode = purchaseLaunchCode,
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
        )
    }

    override fun onDestroy() {
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
    onRefreshBilling: () -> Unit = {},
    onSubscribe: (SubscriptionOffer) -> Unit = {},
) {
    var city1 by remember { mutableStateOf(store.load(1)) }
    var city2 by remember { mutableStateOf(store.load(2)) }
    var pickerSlot by remember { mutableStateOf<Int?>(null) }
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
                    AppHeader()
                    OfficialStatusBanner(officialFeedState)
                    AccessPolicyStrip()

                    if (wide) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            BlaiseHeroCard(Modifier.weight(0.86f))
                            CityPair(
                                city1 = city1,
                                city2 = city2,
                                onChooseCity1 = onChooseCity1,
                                onChooseCity2 = onChooseCity2,
                                modifier = Modifier.weight(1.55f),
                            )
                        }
                    } else {
                        BlaiseHeroCard(Modifier.fillMaxWidth())
                        CityPair(
                            city1 = city1,
                            city2 = city2,
                            onChooseCity1 = onChooseCity1,
                            onChooseCity2 = onChooseCity2,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    QuickConditionsRow()
                    MarineAndRiskRow(wide)
                    RadarPanel()
                    BulletinAndNewsRow(wide)

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
private fun AppHeader() {
    Card(
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.headlineSmall)
                Text("Clima • Alertas • Risco • Trânsito • Marinha", color = Color.White, style = MaterialTheme.typography.bodyMedium)
                Text("Última atualização: aguardando primeira consolidação oficial", color = Muted, style = MaterialTheme.typography.bodySmall)
            }
            Surface(
                color = Color(0xFF123D2B),
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, StableGreen),
            ) {
                Text("● LIGADO", color = StableGreen, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
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
            Text("BLAISE", color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
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
private fun QuickConditionsRow() {
    Card(
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("CONDIÇÕES CONSOLIDADAS", color = Gold, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricTile("Temperatura", "— °C", "fonte oficial pendente", Modifier.weight(1f))
                MetricTile("Chuva", "— %", "probabilidade pendente", Modifier.weight(1f))
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
        onRefreshBilling = {},
        onSubscribe = {},
        onChooseCity1 = {},
        onChooseCity2 = {},
    )
}
