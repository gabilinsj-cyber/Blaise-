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

private val Navy = Color(0xFF071B33)
private val Gold = Color(0xFFD4AF37)
private val Panel = Color(0xFF102D4F)
private val StableGreen = Color(0xFF55DD88)
private val AlertRed = Color(0xFFFF5252)
private val WarningAmber = Color(0xFFFFC857)

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
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
                Text("Monitoramento integrado do Estado do Rio de Janeiro", color = Color.White)
                OfficialStatusBanner(officialFeedState)
                Text("P0 oficial permanece disponível sem assinatura.", color = Gold, fontWeight = FontWeight.Bold)
                Text("Conteúdo premium exige entitlement ativo.", color = Color.LightGray)

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CityPanel("Cidade 1", city1, "Escolher cidade 1", onChooseCity1, Modifier.weight(1f))
                    Box(Modifier.width(2.dp).height(118.dp).background(Color.Black))
                    CityPanel("Cidade 2", city2, "Escolher cidade 2", onChooseCity2, Modifier.weight(1f))
                }

                BillingPanel(
                    entitlement = billingSnapshot,
                    offers = offersSnapshot,
                    purchaseLaunchCode = purchaseLaunchCode,
                    onRefresh = onRefreshBilling,
                    onSubscribe = onSubscribe,
                )

                Text("92 municípios do RJ • seleção simultânea de Cidade 1 e Cidade 2", color = Gold)
                Text("Clima • Alertas • Radar • Risco • Marinha • Trânsito", color = Color.White)
                Text("Notícias • Assinatura • Blaise/Voz • Configurações", color = Color.White)
                Text("Fontes oficiais têm prioridade. Dados exibem origem e atualização.", color = Gold)
            }
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
    Column(Modifier.background(Panel).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

    Column(Modifier.background(Panel).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(headline, color = color, fontWeight = FontWeight.Bold)
        Text(detail, color = Color.White)
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
