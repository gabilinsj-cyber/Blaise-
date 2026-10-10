package br.com.blaise.rj

import br.com.blaise.rj.bulletin.BulletinPolicy
import java.time.ZonedDateTime
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.delay
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.clickable
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.compose.runtime.rememberUpdatedState
import br.com.blaise.rj.assistant.WeatherConversation
import br.com.blaise.rj.assistant.ConversationAction
import br.com.blaise.rj.data.OfficialWeatherClient
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.InmetHourlySeries
import br.com.blaise.rj.data.InmetMetric
import br.com.blaise.rj.data.StatewideDataHttpsClient
import br.com.blaise.rj.data.StatewideDataResult
import br.com.blaise.rj.data.DashboardDataHttpsClient
import br.com.blaise.rj.data.DashboardDataNetworkResult
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import br.com.blaise.rj.voice.VoiceQuestionRecognizer
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.foundation.layout.safeDrawingPadding
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.billing.BillingEntitlementSnapshot
import br.com.blaise.rj.billing.PlayBillingEntitlementSource
import br.com.blaise.rj.billing.PurchaseVerifierFactory
import br.com.blaise.rj.billing.SubscriptionOffer
import br.com.blaise.rj.billing.SubscriptionOffersSnapshot
import br.com.blaise.rj.assistant.AssistantPolicy
import br.com.blaise.rj.voice.DoraVoiceService
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import br.com.blaise.rj.cities.CitySelectionStore
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialFeedEvidence
import br.com.blaise.rj.core.OfficialFeedState
import br.com.blaise.rj.core.OfficialFeedStatusPolicy
import com.android.billingclient.api.BillingClient
import java.time.Instant

class MainActivity : ComponentActivity() {
    private var billingSource: PlayBillingEntitlementSource? = null
    private var billingSnapshot by mutableStateOf<BillingEntitlementSnapshot>(BillingEntitlementSnapshot.Unconfigured)
    private var offersSnapshot by mutableStateOf<SubscriptionOffersSnapshot>(SubscriptionOffersSnapshot.Unconfigured)
    private var purchaseLaunchCode by mutableStateOf<Int?>(null)
    private var verifiedPurchase by mutableStateOf<PlayPurchaseCandidate?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (BuildConfig.BLAISE_STORE_CHANNEL == FinalDashboardSpec.STORE_GOOGLE_PLAY) {
            val products = setOf(BuildConfig.BLAISE_MONTHLY_PRODUCT_ID, BuildConfig.BLAISE_ANNUAL_PRODUCT_ID)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .toSet()
            val verifier = PurchaseVerifierFactory.create(
                endpoint = BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL,
                packageName = packageName,
            )
            billingSource = PlayBillingEntitlementSource(applicationContext, products, verifier) { candidate ->
                runOnUiThread { verifiedPurchase = candidate }
            }
        }

        setContent {
            BlaiseApp(
                store = CitySelectionStore(applicationContext),
                billingSnapshot = billingSnapshot,
                offersSnapshot = offersSnapshot,
                purchaseLaunchCode = purchaseLaunchCode,
                verifiedPurchase = verifiedPurchase,
                onRefreshBilling = { billingSource?.refresh() },
                onSubscribe = { offer ->
                    purchaseLaunchCode = null
                    billingSource?.launchPurchase(this, offer) { responseCode ->
                        runOnUiThread { purchaseLaunchCode = responseCode }
                    }
                },
            )
        }

        billingSource?.start(
            entitlementObserver = { snapshot -> runOnUiThread { billingSnapshot = snapshot } },
            offersObserver = { snapshot -> runOnUiThread { offersSnapshot = snapshot } },
        )
    }

    override fun onDestroy() {
        billingSource?.stop()
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
private val LocalRioStations = compositionLocalOf<List<br.com.blaise.rj.data.CityWeatherObservation>> { emptyList() }
private val LocalCityWeather = compositionLocalOf<Map<Int, CityWeatherResult>> { emptyMap() }
private val LocalInmetHourlySeries = compositionLocalOf<InmetHourlySeries?> { null }
private val LocalObservationClock = compositionLocalOf { Instant.EPOCH }
private val LocalStatewideDashboard = compositionLocalOf<StatewideDataResult> { StatewideDataResult.Unavailable }
private val LocalBackendDashboard = compositionLocalOf<DashboardDataNetworkResult> { DashboardDataNetworkResult.Unavailable }

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
    verifiedPurchase: PlayPurchaseCandidate? = null,
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
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val weatherClient = remember { OfficialWeatherClient() }
    var rioStations by remember { mutableStateOf<List<br.com.blaise.rj.data.CityWeatherObservation>>(emptyList()) }
    var cityWeather by remember { mutableStateOf<Map<Int, CityWeatherResult>>(emptyMap()) }
    var inmetHourlySeries by remember { mutableStateOf<InmetHourlySeries?>(null) }
    var observationClock by remember { mutableStateOf(Instant.now()) }
    var backendDashboard by remember { mutableStateOf<DashboardDataNetworkResult>(DashboardDataNetworkResult.Unavailable) }
    var statewideDashboard by remember { mutableStateOf<StatewideDataResult>(StatewideDataResult.Unavailable) }
    val statewideClient = remember(context) {
        StatewideDataHttpsClient.create(BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL, context.packageName)
    }
    val dashboardClient = remember(context) {
        DashboardDataHttpsClient.create(BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL, context.packageName)
    }
    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) { observationClock = Instant.now(); delay(30_000) }
        }
    }
    LaunchedEffect(powerOn, lifecycle) {
        rioStations = emptyList()
        if (!powerOn) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                rioStations = weatherClient.currentRioStations()
                delay(60_000)
            }
        }
    }
    LaunchedEffect(powerOn, city1.ibgeCode, city2.ibgeCode, lifecycle) {
        cityWeather = emptyMap()
        if (!powerOn) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                val rio = RioMunicipalities.all.first { it.ibgeCode == 3304557 }
                val cities = listOf(rio, city1, city2).distinctBy { it.ibgeCode }
                cityWeather = coroutineScope {
                    cities.map { city -> async {
                        city.ibgeCode to weatherClient.currentCity(br.com.blaise.rj.assistant.WeatherRequest(
                            city, "temperatura umidade vento", java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")),
                            if (city.ibgeCode == rio.ibgeCode) "Centro do Rio" else null,
                        ))
                    } }.map { it.await() }.toMap()
                }
                observationClock = Instant.now()
                delay(60_000)
            }
        }
    }
    // Public INMET station data is free for every user, independent of store billing.
    // Rate-limit polling; no fake cache extension when a source becomes stale.
    LaunchedEffect(powerOn, lifecycle) {
        inmetHourlySeries = null
        if (!powerOn) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                inmetHourlySeries = weatherClient.recentRioHourlySeries()
                delay(300_000)
            }
        }
    }
    LaunchedEffect(powerOn, verifiedPurchase, billingSnapshot, lifecycle) {
        backendDashboard = DashboardDataNetworkResult.Unavailable
        val candidate = verifiedPurchase
        val client = dashboardClient
        if (!powerOn || billingSnapshot !is BillingEntitlementSnapshot.Active || candidate == null || client == null) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                backendDashboard = suspendCancellableCoroutine { continuation ->
                    client.fetch(candidate) { result -> if (continuation.isActive) continuation.resume(result) }
                }
                delay(30_000)
            }
        }
    }
    LaunchedEffect(powerOn, verifiedPurchase, billingSnapshot, lifecycle) {
        statewideDashboard = StatewideDataResult.Unavailable
        val candidate = verifiedPurchase
        val client = statewideClient
        if (!powerOn || billingSnapshot !is BillingEntitlementSnapshot.Active || candidate == null || client == null) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                statewideDashboard = suspendCancellableCoroutine { continuation ->
                    client.fetch(candidate) { result -> if (continuation.isActive) continuation.resume(result) }
                }
                delay(30_000)
            }
        }
    }
    val officialFeedState = remember(officialFeedEvidence, observationClock) {
        OfficialFeedStatusPolicy.state(officialFeedEvidence, observationClock)
    }

    CompositionLocalProvider(LocalStatewideDashboard provides if (powerOn && billingSnapshot is BillingEntitlementSnapshot.Active && verifiedPurchase != null) statewideDashboard else StatewideDataResult.Unavailable, LocalRioStations provides if (powerOn) rioStations else emptyList(), LocalCityWeather provides if (powerOn) cityWeather else emptyMap(), LocalInmetHourlySeries provides if (powerOn) inmetHourlySeries else null, LocalObservationClock provides observationClock,
        LocalBackendDashboard provides if (powerOn && billingSnapshot is BillingEntitlementSnapshot.Active && verifiedPurchase != null) backendDashboard else DashboardDataNetworkResult.Unavailable) {
    BlaiseDashboard(
        city1 = city1,
        city2 = city2,
        officialFeedState = officialFeedState,
        billingSnapshot = billingSnapshot,
        offersSnapshot = offersSnapshot,
        purchaseLaunchCode = purchaseLaunchCode,
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
    }

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
        Surface(modifier = Modifier.fillMaxSize().background(Navy).safeDrawingPadding(), color = Navy) {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val wide = maxWidth >= 760.dp
                Column(Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = if (wide) 16.dp else 10.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(9.dp),
                    ) {
                        if (wide) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                AppHeader(powerOn, onPowerChange, onSelectSection, Modifier.weight(0.42f), compact = true)
                                AssistantPanel(
                                    selectedCity = city1,
                                    onNavigate = onSelectSection,
                                    voiceEnabled = powerOn && !silentMode,
                                    appEnabled = powerOn,
                                    modifier = Modifier.weight(0.58f),
                                    compact = true,
                                )
                            }
                        } else {
                            AppHeader(powerOn, onPowerChange, onSelectSection)
                            AssistantPanel(selectedCity = city1, onNavigate = onSelectSection, voiceEnabled = powerOn && !silentMode, appEnabled = powerOn)
                        }
                        OfficialStatusBanner(officialFeedState, onSelectSection)

                        when (selectedSection) {
                            "Início" -> HomeScreen(city1, city2, wide, onChooseCity1, onChooseCity2, onSelectSection)
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
                            else -> HomeScreen(city1, city2, wide, onChooseCity1, onChooseCity2, onSelectSection)
                        }

                        if (selectedSection == "Mais") {
                            AccessPolicyStrip()
                            BillingPanel(
                                storeChannel = BuildConfig.BLAISE_STORE_CHANNEL,
                                entitlement = billingSnapshot,
                                offers = offersSnapshot,
                                purchaseLaunchCode = purchaseLaunchCode,
                                onRefresh = onRefreshBilling,
                                onSubscribe = onSubscribe,
                            )

                        }
                        FooterSources()
                    }
                    Surface(color = NavyRaised, modifier = Modifier.fillMaxWidth()) {
                        Box(Modifier.padding(horizontal = 14.dp, vertical = 6.dp)) {
                            PrimaryNavigation(selectedSection, onSelectSection)
                        }
                    }
                }
            }
        }
    }
}

/** Render only the character's viewport from the approved reference, never its illustrative weather. */
@Composable
private fun BlaiseAvatar(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val portrait = remember(context) {
        val reference = BitmapFactory.decodeResource(context.resources, R.drawable.blaise_reference)
        Bitmap.createBitmap(reference, 84, 47, 80, 69).asImageBitmap()
    }
    Image(bitmap = portrait, contentDescription = "Blaise, assistente feminina", modifier = modifier,
        contentScale = ContentScale.Fit)
}

@Composable
private fun AppHeader(powerOn: Boolean, onPowerChange: (Boolean) -> Unit, onNavigate: (String) -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val clock = LocalObservationClock.current
    val latest = LocalCityWeather.current.values.mapNotNull { it.currentObservation(clock)?.observedAt }.maxOrNull()
    val time = clock.atZone(java.time.ZoneId.of("America/Sao_Paulo"))
        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM • HH:mm"))
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NavyRaised),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color(0xFF1762A2)),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Surface(
                    modifier = Modifier.size(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = Panel,
                    border = BorderStroke(1.dp, Gold),
                ) {
                    BlaiseAvatar(Modifier.fillMaxSize())
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text("BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                    Text("Clima e Tempo", color = Color.White, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelMedium)
                    Text("Rio de Janeiro • $time", color = Muted, style = MaterialTheme.typography.labelSmall)
                }
                val powerColor = if (powerOn) StableGreen else AlertRed
                Surface(
                    modifier = Modifier.testTag("power-indicator").clickable { onPowerChange(!powerOn) },
                    color = if (powerOn) Color(0xFF0D3B2B) else Color(0xFF4A1F25),
                    shape = RoundedCornerShape(50),
                    border = BorderStroke(1.dp, powerColor),
                ) {
                    Text(
                        if (powerOn) "● LIGADO" else "● DESLIGADO",
                        color = powerColor, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
            }
            if (!compact) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    latest?.let { "Medição oficial: ${it.atZone(java.time.ZoneId.of("America/Sao_Paulo")).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))}" }
                        ?: "Medições oficiais: aguardando dados válidos",
                    color = Muted,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { onNavigate("Alertas") }, modifier = Modifier.testTag("top-notifications")) { Text("Alertas") }
                TextButton(onClick = { onNavigate("Mais") }, modifier = Modifier.testTag("top-settings")) { Text("⚙") }
            }
            }
        }
    }
}

@Composable
private fun AssistantPanel(selectedCity: City, onNavigate: (String) -> Unit, voiceEnabled: Boolean, appEnabled: Boolean, modifier: Modifier = Modifier, compact: Boolean = false) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val voice = remember(context) { DoraVoiceService(context) }
    val scope = rememberCoroutineScope()
    var speechJob by remember { mutableStateOf<Job?>(null) }
    var speechRequest by remember { mutableStateOf(0) }
    var speaking by remember { mutableStateOf(false) }
    var typedQuestion by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf("Pronto para orientar sem criar dados ou alertas.") }
    var voiceError by remember { mutableStateOf<String?>(null) }
    fun stopSpeaking() {
        speechRequest += 1
        speechJob?.cancel()
        voice.stop()
        speaking = false
    }
    fun readAloud(text: String) {
        stopSpeaking()
        if (!voiceEnabled) {
            voiceError = "A resposta por voz está silenciada. Desative o modo silencioso para ouvir."
            return
        }
        val request = speechRequest
        voiceError = null
        speaking = true
        speechJob = scope.launch {
            try {
                voice.speak(text).onFailure {
                    if (request == speechRequest) voiceError = "Não foi possível reproduzir a voz Dora. Tente novamente."
                }
            } finally {
                if (request == speechRequest) speaking = false
            }
        }
    }
    LaunchedEffect(voiceEnabled) { if (!voiceEnabled) stopSpeaking() }
    DisposableEffect(lifecycle, voice) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) stopSpeaking()
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            stopSpeaking()
            voice.close()
        }
    }
    val conversation = remember { WeatherConversation() }
    val weather = remember { OfficialWeatherClient() }
    var queryJob by remember { mutableStateOf<Job?>(null) }
    var queryVersion by remember { mutableStateOf(0) }
    var listening by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var showBulletin by remember { mutableStateOf(false) }
    var showQuickHelp by remember { mutableStateOf(false) }
    val statewideSnapshot = (LocalStatewideDashboard.current as? StatewideDataResult.Available)?.snapshot
    val reports = LocalCityWeather.current
    val clock = LocalObservationClock.current
    val bulletinPeriod = BulletinPolicy.currentPeriod(clock.atZone(java.time.ZoneId.of("America/Sao_Paulo")))
    val centre = reports[3304557]?.summary(clock) ?: "Consultando medição oficial do Centro do Rio."
    val chosen = reports[selectedCity.ibgeCode]?.summary(clock) ?: "Consultando medição oficial de ${selectedCity.name}."
    val bulletinText = "Centro do Rio: $centre\n\n${selectedCity.name}: $chosen\n\nSensação térmica, UV, previsão e alertas: integração ainda indisponível. Fonte e horário referem-se à medição de cada estação."
    fun brief(text: String) = text.trim().replace(". ", "; ").trimEnd('.')
    val bulletinSummary = "Centro do Rio: ${brief(centre)}. ${if (selectedCity.ibgeCode == 3304557) "Demais dados" else selectedCity.name}: ${brief(if (selectedCity.ibgeCode == 3304557) "Sensação térmica, UV e previsão ainda indisponíveis" else chosen)}."
    if (showQuickHelp) {
        AlertDialog(
            onDismissRequest = { showQuickHelp = false },
            title = { Text("Ajuda • Blaise V6 RJ") },
            text = {
                Text("Selecione uma cidade do Rio de Janeiro, consulte o mapa, os gráficos e os avisos. " +
                    "Faça perguntas pelo microfone ou digite. Os dados só aparecem com fonte e horário válidos. " +
                    "A falta de informações não significa ausência de risco. Em emergência, siga a Defesa Civil.")
            },
            confirmButton = {
                TextButton(onClick = { showQuickHelp = false }) { Text("Entendi") }
            },
        )
    }
    if (showBulletin) {
        Dialog(onDismissRequest = { showBulletin = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Surface(Modifier.fillMaxSize(), color = Navy) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    TextButton(onClick = { showBulletin = false }) { Text("← Voltar") }
                    Text("Informativo Blaise V6 RJ", color = Gold, style = MaterialTheme.typography.headlineSmall)
                    Text("Período: ${bulletinPeriod.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))} • Brasília", color = Color.White)
                    Text(bulletinText, color = Color.White)
                    Text("Horários: 06:00 • 12:00 • 16:00. Fonte e horário pertencem a cada medição. Dados indisponíveis não representam ausência de risco.", color = Muted)
                }
            }
        }
    }
    fun ask(raw: String, spoken: Boolean) {
        if (!appEnabled) return
        stopSpeaking()
        queryJob?.cancel()
        queryVersion += 1
        val version = queryVersion
        voiceError = null
        val action = conversation.accept(raw, selectedCity)
        when (action) {
            is ConversationAction.Reply -> {
                loading = false
                answer = action.text
                if (spoken) readAloud(answer)
            }
            is ConversationAction.Query -> {
                loading = true
                answer = "Consultando fonte oficial para ${action.request.localScope ?: action.request.city.name}…"
                queryJob = scope.launch {
                    val result = try {
                        val request = action.request
                        val regional = br.com.blaise.rj.assistant.statewideAnswer(statewideSnapshot, request, Instant.now())
                        val weatherQuestion = br.com.blaise.rj.assistant.normalizedSpeech(request.question)
                        val needsWeather = listOf("temperatura", "termica", "sensacao", "umidade", "vento", "tempo", "calor", "friaca", "mormaco", "frio", "chuva", "chover").any(weatherQuestion::contains)
                        if (regional != null && !needsWeather) regional
                        else {
                            val measured = withTimeout(12_000L) { weather.answer(request) }
                            val freshRegional = br.com.blaise.rj.assistant.statewideAnswer(statewideSnapshot, request, Instant.now())
                            listOfNotNull(measured, freshRegional).joinToString("\n\n")
                        }
                    } catch (error: CancellationException) {
                        if (error !is TimeoutCancellationException) throw error
                        "A consulta para ${action.request.city.name} demorou além do limite. Não tenho uma medição atual confirmada. Tente novamente."
                    } catch (_: Exception) {
                        "Não consegui consultar os dados oficiais de ${action.request.city.name} agora. Não tenho uma medição atual confirmada. Tente novamente."
                    }
                    if (version == queryVersion) {
                        loading = false
                        answer = result
                        if (spoken) readAloud(result)
                    }
                }
            }
        }
    }
    val latestAsk by rememberUpdatedState<(String) -> Unit>({ ask(it, true) })
    val latestVoiceError by rememberUpdatedState<(String) -> Unit>({ message ->
        readAloud(message)
        voiceError = message
    })
    val recognizer = remember(context) {
        VoiceQuestionRecognizer(context, { latestAsk(it) }, { latestVoiceError(it) }, { listening = it })
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && appEnabled) recognizer.start() else voiceError = "Permita o microfone para perguntar por voz."
    }
    DisposableEffect(recognizer, lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                recognizer.cancel()
                queryJob?.cancel()
                queryVersion += 1
                loading = false
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); recognizer.close(); queryJob?.cancel() }
    }
    LaunchedEffect(appEnabled) {
        if (!appEnabled) { recognizer.cancel(); queryJob?.cancel(); queryVersion += 1; loading = false }
    }
    fun submit() { ask(typedQuestion, false) }
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.50f)),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(if (compact) 6.dp else 8.dp),
            verticalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 5.dp),
        ) {
            if (compact) {
                // Reference-style horizontal command strip: one short row,
                // not three vertically stacked cards obscuring the weather map.
                Row(
                    Modifier.fillMaxWidth().testTag("assistant-compact-strip"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    OutlinedButton(
                        onClick = {
                            voiceError = null
                            stopSpeaking()
                            if (listening) recognizer.cancel()
                            else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) recognizer.start()
                            else permission.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        modifier = Modifier.testTag("assistant-microphone"),
                        enabled = appEnabled,
                    ) { Text(if (listening) "■" else "🎙") }
                    Surface(
                        modifier = Modifier.weight(1f).height(45.dp),
                        color = Navy, shape = RoundedCornerShape(9.dp),
                        border = BorderStroke(1.dp, Divider),
                    ) {
                        Box(
                            Modifier.fillMaxSize().padding(horizontal = 9.dp),
                            contentAlignment = Alignment.CenterStart,
                        ) {
                            BasicTextField(
                                value = typedQuestion,
                                onValueChange = { typedQuestion = it },
                                modifier = Modifier.fillMaxWidth().testTag("assistant-input"),
                                singleLine = true,
                                textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                                decorationBox = { innerTextField ->
                                    Box {
                                        if (typedQuestion.isEmpty()) {
                                            Text("Como posso ajudar? Digite aqui…", color = Muted,
                                                style = MaterialTheme.typography.labelSmall)
                                        }
                                        innerTextField()
                                    }
                                },
                            )
                        }
                    }
                    Button(onClick = ::submit,
                        enabled = appEnabled && typedQuestion.isNotBlank(),
                        modifier = Modifier.testTag("assistant-send"),
                        colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Navy)) {
                        Text("Enviar", style = MaterialTheme.typography.labelSmall)
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Blaise • Boletim 06h / 12h / 16h", color = Gold,
                        style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                    Text(
                        "Leia mais ›", color = Gold, style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.clickable { showBulletin = true }
                            .padding(horizontal = 6.dp, vertical = 5.dp),
                    )
                    Text("🔔", color = WarningAmber, style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.testTag("top-notifications")
                            .clickable { onNavigate("Alertas") }
                            .padding(horizontal = 6.dp, vertical = 7.dp))
                    Text("⚙", color = Gold, style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.testTag("top-settings")
                            .clickable { onNavigate("Mais") }
                            .padding(horizontal = 6.dp, vertical = 7.dp))
                    Text("?", color = Gold, style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.testTag("top-help")
                            .clickable { showQuickHelp = true }
                            .padding(horizontal = 6.dp, vertical = 7.dp))
                }
                if (answer != "Pronto para orientar sem criar dados ou alertas." || loading) {
                    Text(answer, color = Color.White,
                        style = MaterialTheme.typography.labelSmall, maxLines = 2,
                        modifier = Modifier.testTag("assistant-answer"))
                    TextButton(
                        onClick = { if (speaking) stopSpeaking() else readAloud(answer) },
                        enabled = voiceEnabled,
                        modifier = Modifier.testTag("assistant-read-answer"),
                    ) { Text(if (speaking) "Parar voz" else "Ouvir resposta") }
                }
                voiceError?.let { Text(it, color = WarningAmber, style = MaterialTheme.typography.labelSmall) }
            } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Blaise • ${FinalDashboardSpec.ASSISTANT_PROMPT}", color = Gold, fontWeight = FontWeight.Bold)
                    Text(
                        if (listening) "Ouvindo sua pergunta…" else if (loading) "Consultando fontes oficiais…" else "Pergunte por voz ou digite abaixo.",
                        color = Muted, style = MaterialTheme.typography.labelSmall,
                    )
                }
                OutlinedButton(
                    onClick = {
                        voiceError = null
                        stopSpeaking()
                        if (listening) recognizer.cancel()
                        else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) recognizer.start()
                        else permission.launch(Manifest.permission.RECORD_AUDIO)
                    },
                    modifier = Modifier.testTag("assistant-microphone"),
                    enabled = appEnabled,
                ) { Text(if (listening) "■ Parar" else "🎙 Voz") }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = typedQuestion,
                    onValueChange = { typedQuestion = it },
                    placeholder = { Text("Digite aqui…") },
                    singleLine = true,
                    modifier = Modifier.weight(1f).testTag("assistant-input"),
                )
                Button(
                    onClick = ::submit,
                    enabled = appEnabled && typedQuestion.isNotBlank(),
                    modifier = Modifier.testTag("assistant-send"),
                    colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Navy),
                ) { Text("Enviar") }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Boletim • 06h / 12h / 16h", color = Gold, style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                TextButton(onClick = { showBulletin = true }) { Text("Leia mais") }
                TextButton(onClick = { showQuickHelp = true },
                    modifier = Modifier.testTag("top-help")) { Text("Ajuda") }
            }
            if (!compact) {
                Text("Resumo: $bulletinSummary", color = Muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            }
            if (answer != "Pronto para orientar sem criar dados ou alertas." || loading) {
                Text(answer, color = Color.White, style = MaterialTheme.typography.bodySmall, modifier = Modifier.testTag("assistant-answer"))
            }
            if (!compact) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { if (speaking) stopSpeaking() else readAloud(answer) },
                        enabled = voiceEnabled, modifier = Modifier.testTag("assistant-read-answer")) {
                        Text(if (speaking) "Parar voz" else "Ouvir resposta")
                    }
                    TextButton(
                        onClick = { readAloud("Olá! Eu sou a Blaise, sua assistente de clima e tempo do Rio de Janeiro. Como posso ajudar?") },
                        enabled = voiceEnabled, modifier = Modifier.testTag("assistant-test-dora"),
                    ) { Text("Testar voz feminina") }
                }
                Text("Informações atuais somente com fonte oficial e horário.", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
            voiceError?.let { Text(it, color = WarningAmber, style = MaterialTheme.typography.labelSmall) }
            } // Expanded portrait assistant
        }
    }
}

@Composable
private fun PrimaryNavigation(selected: String, onSelect: (String) -> Unit) {
    // One horizontally scrollable bottom ribbon for phones; full row on large screens.
    val labels = mapOf(
        "Início" to "⌂", "Cidades" to "⌖", "Mapa" to "▣",
        "Alertas" to "⚠", "Trânsito" to "≋", "Mar e Ondas" to "≈",
        "Qualidade do Ar" to "◉", "Notícias" to "▤", "Histórico" to "◷", "Mais" to "⋯",
    )
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("primary-navigation"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FinalDashboardSpec.primaryNavigation.forEach { item ->
            val active = item == selected
            Surface(
                modifier = Modifier.testTag("nav-$item").clickable { onSelect(item) },
                color = if (active) Gold else Color(0xFF092648),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, if (active) Gold else Divider),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Text(labels[item] ?: "•", color = if (active) Navy else Gold, fontWeight = FontWeight.Bold)
                    Text(item, color = if (active) Navy else Color.White, style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
                }
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
    onChooseCity1: () -> Unit,
    onChooseCity2: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    // The approved reference is a three-column CONTROL CENTER on landscape,
    // but remains a single vertically scrollable dashboard on phones.
    if (wide) {
        Row(
            Modifier.fillMaxWidth().testTag("reference-three-column-dashboard"),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(Modifier.weight(0.91f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                CityPanel("Cidade 1", city1, "Escolher cidade 1", onChooseCity1, Modifier.fillMaxWidth(), onNavigate)
                MarinePanel(Modifier.fillMaxWidth(), onNavigate)
                ForecastPanel(Modifier.fillMaxWidth())
            }
            Column(Modifier.weight(1.92f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                ExpandedRadarPanel(Modifier.fillMaxWidth(), onNavigate)
                DailyChartPanel(Modifier.fillMaxWidth())
                ScientificReadoutsPanel(city1, Modifier.fillMaxWidth())
            }
            Column(Modifier.weight(0.94f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                CityPanel("Cidade 2", city2, "Escolher cidade 2", onChooseCity2, Modifier.fillMaxWidth(), onNavigate)
                TrafficSummaryPanel(Modifier.fillMaxWidth(), onNavigate)
                RiskPanel(Modifier.fillMaxWidth())
                AirQualitySummaryPanel(Modifier.fillMaxWidth(), onNavigate)
                CompactNewsAndSeismicPanel(Modifier.fillMaxWidth(), onNavigate)
            }
        }
    } else {
        // Portrait: preserve the weather map as the first, largest panel.
        ExpandedRadarPanel(Modifier.fillMaxWidth(), onNavigate)
        Spacer(Modifier.height(10.dp))
        CityPair(city1, city2, onChooseCity1, onChooseCity2, Modifier.fillMaxWidth(), onNavigate)
        Spacer(Modifier.height(10.dp))
        MarineAndRiskRow(false)
        Spacer(Modifier.height(10.dp))
        CompactServicesRow(onNavigate)
        Spacer(Modifier.height(10.dp))
        ForecastPanel(Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        DailyChartPanel(Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        ScientificReadoutsPanel(city1, Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        CompactNewsAndSeismicPanel(Modifier.fillMaxWidth(), onNavigate)
    }
    Spacer(Modifier.height(10.dp))
    AgentStatusPanel()
}
@Composable
private fun CompactServicesRow(onNavigate: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TrafficSummaryPanel(Modifier.weight(1f), onNavigate)
        AirQualitySummaryPanel(Modifier.weight(1f), onNavigate)
    }
}

@Composable
private fun TrafficSummaryPanel(modifier: Modifier = Modifier, onNavigate: (String) -> Unit) {
    Surface(
        modifier = modifier.clickable { onNavigate("Trânsito") }.testTag("traffic-official-status"),
        color = PanelSoft, shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.padding(9.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("TRÂNSITO • COR.Rio / CET-Rio", color = Gold, fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.labelSmall)
            Text("Interdições • acidentes • alagamentos", color = Color.White,
                style = MaterialTheme.typography.labelSmall)
            Text("Ocorrências: dados oficiais indisponíveis", color = WarningAmber,
                style = MaterialTheme.typography.labelSmall)
            Text("Ver trânsito e rotas →", color = Color.White, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun AirQualitySummaryPanel(modifier: Modifier = Modifier, onNavigate: (String) -> Unit) {
    Surface(
        modifier = modifier.clickable { onNavigate("Qualidade do Ar") }.testTag("air-quality-official-status"),
        color = PanelSoft, shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Divider),
    ) {
        Column(Modifier.padding(9.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("QUALIDADE DO AR • RJ", color = Gold, fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.labelSmall)
            Text("IQAr —  •  PM2,5 —", color = Color.White,
                style = MaterialTheme.typography.labelSmall)
            Text("Sem leitura oficial recente validada", color = WarningAmber,
                style = MaterialTheme.typography.labelSmall)
            Text("Ver qualidade do ar →", color = Color.White, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun ScientificReadoutsPanel(city: City, modifier: Modifier = Modifier) {
    val now = LocalObservationClock.current
    val observation = LocalCityWeather.current[city.ibgeCode]?.currentObservation(now)
    val readings = ScientificDashboardPolicy.derive(observation, now)
    DashboardSection(
        title = "CALCULADORA CIENTÍFICA BLAISE",
        subtitle = "Sensação térmica • ponto de orvalho • medições compatíveis",
        modifier = modifier.testTag("scientific-calculator-panel"),
    ) {
        Text(ScientificDashboardPolicy.STATUS, color = Gold, style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold)
        if (readings.isEmpty()) {
            Text("Sem entradas oficiais recentes suficientes para cálculos em ${city.name}.",
                color = WarningAmber, style = MaterialTheme.typography.labelSmall)
        } else {
            readings.forEach { reading ->
                StatusLine(reading.title, "${reading.value} • ${reading.method}")
            }
            val first = readings.first()
            Text(
                "Fonte de entrada: ${first.source} • estação ${first.station} • " +
                    first.observedAt.atZone(java.time.ZoneId.of("America/Sao_Paulo"))
                        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm")) +
                    " (Brasília). Resultado local derivado, não média municipal.",
                color = Muted, style = MaterialTheme.typography.labelSmall,
            )
        }
        Text("Outros cálculos (advecção, cisalhamento, CAPE, CIN, chuva acumulada e radar) " +
            "dependem de entradas, perfis e calibração oficiais. Nenhum cálculo isolado emite alerta.",
            color = Muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun AgentStatusPanel(modifier: Modifier = Modifier) {
    var details by remember { mutableStateOf(false) }
    DashboardSection(
        title = "BLAISE • 10 AGENTES CIENTÍFICOS E DE SEGURANÇA",
        subtitle = "Roteamento por fenômeno, 92 municípios e Atlântico adjacente",
        modifier = modifier.testTag("ten-agents-panel"),
    ) {
        Text("10 agentes cadastrados • execução autônoma em produção ainda não validada.",
            color = WarningAmber, style = MaterialTheme.typography.labelSmall)
        OutlinedButton(onClick = { details = !details }, modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Gold)) {
            Text(if (details) "Recolher funções dos 10 agentes" else "Ver funções dos 10 agentes")
        }
        if (details) {
            BlaiseAgentDashboard.tenAgents.forEach { agent ->
                Text("${agent.index}. ${agent.name}", color = Color.White, fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.labelSmall)
                Text(agent.responsibility, color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        }
        Text("Dados e recálculos: somente se a origem e o horário forem válidos. " +
            "Alertas sonoros apenas mediante autorização do nível 5.",
            color = Muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun ExpandedRadarPanel(modifier: Modifier = Modifier, onNavigate: (String) -> Unit = {}) {
    val availableLayers = listOf("Radar", "Chuva", "Temperatura", "Vento", "Nuvens")
    var selectedLayer by remember { mutableStateOf("Radar") }
    val stationSeries = LocalInmetHourlySeries.current
    val snapshotTime = LocalObservationClock.current
    val stationMetric = when (selectedLayer) {
        "Temperatura" -> InmetMetric.TEMPERATURE
        "Chuva" -> InmetMetric.HOURLY_RAINFALL
        "Vento" -> InmetMetric.WIND
        else -> null
    }
    val stationSample = stationMetric?.let { stationSeries?.currentPoint(it, snapshotTime) }
    var enlarged by remember { mutableStateOf(false) }
    var showStations by remember { mutableStateOf(false) }
    var mapZoom by remember { mutableStateOf(1f) }
    val supplementalLayers = listOf("Cidades", "Rodovias", "CET-Rio", "Sirenes", "Deslizamentos", "Pluviômetros", "Satélite")
    var selectedSupplement by remember { mutableStateOf("Cidades") }
    DashboardSection(
        title = "ESTADO DO RIO DE JANEIRO",
        subtitle = "Mapa geográfico com 92 municípios • visão estadual",
        modifier = modifier,
    ) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            availableLayers.forEach { layer ->
                if (layer == selectedLayer) {
                    Button(
                        onClick = { selectedLayer = layer },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1265CB), contentColor = Color.White),
                    ) { Text(layer, style = MaterialTheme.typography.labelSmall) }
                } else {
                    OutlinedButton(onClick = { selectedLayer = layer }) {
                        Text(layer, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        Surface(
            modifier = Modifier.fillMaxWidth()
                .height(if (enlarged) 510.dp else 360.dp)
                .testTag("expanded-radar-map"),
            color = Color(0xFF071421),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Color(0xFF2777B0)),
        ) {
            BoxWithConstraints {
                RioGeographicBase(Modifier.fillMaxSize(), mapZoom)
                if (stationMetric != null) {
                    InmetMapStationOverlay(stationMetric, stationSeries, snapshotTime, Modifier.fillMaxSize(), mapZoom)
                }
                Surface(
                    modifier = Modifier.align(Alignment.TopStart).padding(9.dp),
                    color = Color(0xEB06182C), shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, Divider),
                ) {
                    Column(Modifier.padding(horizontal = 9.dp, vertical = 6.dp)) {
                        Text("MAPA PRÓPRIO • BLAISE V6 RJ", color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                        Text("92 municípios • não é radar", color = Color.White, style = MaterialTheme.typography.labelSmall)
                    }
                }
                Column(
                    modifier = Modifier.align(Alignment.TopStart)
                        .padding(start = 8.dp, top = 70.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Surface(
                        modifier = Modifier.testTag("map-zoom-in")
                            .clickable { mapZoom = (mapZoom + 0.2f).coerceAtMost(1.8f) },
                        color = Color(0xE80B2541), shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Gold),
                    ) { Text("+", modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp), color = Color.White, fontWeight = FontWeight.Bold) }
                    Surface(
                        modifier = Modifier.testTag("map-zoom-out")
                            .clickable { mapZoom = (mapZoom - 0.2f).coerceAtLeast(1f) },
                        color = Color(0xE80B2541), shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Gold),
                    ) { Text("−", modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp), color = Color.White, fontWeight = FontWeight.Bold) }
                }
                if (maxWidth >= 470.dp) {
                    Surface(
                        modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp)
                            .width(134.dp).testTag("map-overlay-menu"),
                        color = Color(0xEB09233F),
                        shape = RoundedCornerShape(11.dp),
                        border = BorderStroke(1.dp, Color(0xFF2977B2)),
                    ) {
                        Column(Modifier.padding(5.dp),
                            verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            supplementalLayers.forEach { layer ->
                                Text(
                                    (if (selectedSupplement == layer) "● " else "◦ ") + layer,
                                    color = if (selectedSupplement == layer) Gold else Color.White,
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.fillMaxWidth()
                                        .testTag("map-overlay-${layer}")
                                        .clickable { selectedSupplement = layer }
                                        .padding(horizontal = 6.dp, vertical = 5.dp),
                                )
                            }
                        }
                    }
                }
                Surface(
                    modifier = Modifier.align(Alignment.BottomCenter).padding(start = 7.dp, end = 7.dp, bottom = 30.dp),
                    color = Color(0xF005192F), shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, WarningAmber),
                ) {
                    Text(
                        if (stationSample != null && stationSeries != null)
                            "$selectedLayer • ponto medido INMET: ${stationSeries.stationName} • ${stationSample.first.observedAt.atZone(java.time.ZoneId.of("America/Sao_Paulo")).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))} (Brasília). Não é radar nem cobertura municipal."
                        else "$selectedLayer: sem medição pontual recente validada; radar e mapas interpolados indisponíveis.",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        color = if (stationSample != null) Color.White else WarningAmber,
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("● Mapa desenhado pelo Blaise • estação INMET só com medição válida", modifier = Modifier.weight(1f),
                color = Muted, style = MaterialTheme.typography.labelSmall)
            TextButton(onClick = { enlarged = !enlarged }) {
                Text(if (enlarged) "Reduzir" else "Ampliar")
            }
        }
        Text("SOBREPOSIÇÕES DO MAPA • verificar disponibilidade", color = Gold,
            style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            supplementalLayers.forEach { extra ->
                OutlinedButton(
                    modifier = Modifier.testTag("map-extra-${extra}"),
                    onClick = { selectedSupplement = extra },
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = if (selectedSupplement == extra) Gold else Color.White,
                    ),
                ) { Text(extra, style = MaterialTheme.typography.labelSmall) }
            }
        }
        Text(if (selectedSupplement == "Cidades")
            "Cidades: desenho próprio do Blaise, limites de base cartográfica aberta dos 92 municípios; sem chuva ou radar simulados."
            else "${selectedSupplement}: camada geográfica/meteorológica adicional indisponível até fonte oficial autorizada, dados atuais e georreferenciamento validado.",
            color = Muted, style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.testTag("map-extra-status"))
        OutlinedButton(
            onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth(),
        ) { Text("▶ Últimos 30 minutos de radar • aguardando frames oficiais") }
        OutlinedButton(onClick = { onNavigate("Mapa") }, modifier = Modifier.fillMaxWidth()) {
            Text("Mais camadas e mapa do RJ")
        }
        TextButton(onClick = { showStations = !showStations }) {
            Text(if (showStations) "Ocultar estações oficiais" else "Ver medições oficiais disponíveis")
        }
        if (showStations) RioStationMeasurementsPanel()
    }
}

@Composable
private fun RioStationMeasurementsPanel() {
    val clock = LocalObservationClock.current
    val stations = LocalRioStations.current.filter { it.current(clock) }
    var expanded by remember { mutableStateOf(false) }
    Text("MEDIÇÕES • ESTAÇÕES ALERTA RIO", color = Gold, fontWeight = FontWeight.Bold)
    Text("Cobertura de cada estação; não são dados do Centro, de Niterói ou de São Gonçalo.", color = Muted, style = MaterialTheme.typography.labelSmall)
    if (stations.isEmpty()) {
        Text("Nenhuma medição recente validada nesta consulta.", color = Muted)
    } else {
        Text("${stations.size} estações com medições recentes.", color = Color.White)
        TextButton(onClick = { expanded = !expanded }) {
            Text(if (expanded) "Recolher medições" else "Ver temperatura, umidade e vento")
        }
        if (expanded) stations.forEach { station ->
            Text(station.station, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(station.summary(clock), color = Muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun ForecastPanel(modifier: Modifier = Modifier) {
    val periods = listOf("Hoje", "3 dias", "Fim de semana")
    var period by remember { mutableStateOf("Hoje") }
    val labels = when (period) {
        "3 dias" -> listOf("Hoje", "Amanhã", "3º dia")
        "Fim de semana" -> listOf("Sábado", "Domingo")
        else -> listOf("Manhã", "Tarde", "Noite")
    }
    DashboardSection(
        title = "PREVISÃO DO TEMPO",
        subtitle = "Rio de Janeiro • boletins oficiais com horário",
        modifier = modifier,
    ) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            periods.forEach { tab ->
                if (period == tab) {
                    Button(onClick = { period = tab }, colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1265CB), contentColor = Color.White)) {
                        Text(tab, style = MaterialTheme.typography.labelSmall)
                    }
                } else {
                    OutlinedButton(onClick = { period = tab }) { Text(tab, style = MaterialTheme.typography.labelSmall) }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            labels.forEach { label ->
                Surface(
                    modifier = Modifier.weight(1f), color = Color(0xFF0B2340),
                    shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, Divider),
                ) {
                    Column(Modifier.padding(horizontal = 6.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(label, color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                        Text("— °C", color = Color.White, fontWeight = FontWeight.ExtraBold,
                            style = MaterialTheme.typography.titleMedium)
                        Text("Aguardando", color = Muted, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        Text("Previsão ainda não validada • sem valores demonstrativos ou probabilidades inventadas.",
            color = Muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun DailyChartPanel(modifier: Modifier = Modifier) {
    val choices = listOf("Temperatura", "Chuva", "Vento")
    var variable by remember { mutableStateOf("Temperatura") }
    var showRainfall by remember { mutableStateOf(false) }
    val stationSeries = LocalInmetHourlySeries.current
    val now = LocalObservationClock.current
    val metric = when (variable) {
        "Temperatura" -> InmetMetric.TEMPERATURE
        "Chuva" -> InmetMetric.HOURLY_RAINFALL
        else -> InmetMetric.WIND
    }
    val readings = stationSeries?.recentPoints(metric, now).orEmpty()
    val last = readings.lastOrNull()?.first?.observedAt
    val zone = java.time.ZoneId.of("America/Sao_Paulo")
    val metricColor = when (metric) {
        InmetMetric.TEMPERATURE -> WarningAmber
        InmetMetric.HOURLY_RAINFALL -> Color(0xFF58B9FF)
        InmetMetric.WIND -> StableGreen
    }
    val unit = when (metric) {
        InmetMetric.TEMPERATURE -> "°C"
        InmetMetric.HOURLY_RAINFALL -> "mm na hora"
        InmetMetric.WIND -> "km/h"
    }
    DashboardSection(
        title = "GRÁFICOS DO DIA • RIO DE JANEIRO",
        subtitle = "INMET • estação identificada • últimas 24 horas",
        modifier = modifier,
    ) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            choices.forEach { option ->
                if (variable == option) {
                    Button(onClick = { variable = option }, colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1265CB), contentColor = Color.White)) {
                        Text(option, style = MaterialTheme.typography.labelSmall)
                    }
                } else {
                    OutlinedButton(onClick = { variable = option }) { Text(option, style = MaterialTheme.typography.labelSmall) }
                }
            }
        }
        Surface(
            modifier = Modifier.fillMaxWidth().height(158.dp).testTag("expanded-daily-chart"),
            color = Color(0xFF06182C), shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, Divider),
        ) {
            Box(contentAlignment = Alignment.Center) {
                androidx.compose.foundation.Canvas(Modifier.fillMaxSize().padding(12.dp)) {
                    for (i in 0..5) {
                        val x = size.width * i / 5f
                        drawLine(Color(0xFF27608B).copy(alpha = 0.6f),
                            androidx.compose.ui.geometry.Offset(x, 0f),
                            androidx.compose.ui.geometry.Offset(x, size.height),
                            strokeWidth = 1.dp.toPx())
                    }
                    for (i in 0..4) {
                        val y = size.height * i / 4f
                        drawLine(Color(0xFF27608B).copy(alpha = 0.6f),
                            androidx.compose.ui.geometry.Offset(0f, y),
                            androidx.compose.ui.geometry.Offset(size.width, y),
                            strokeWidth = 1.dp.toPx())
                    }
                    if (readings.size >= 2) {
                        val minValue = if (metric == InmetMetric.TEMPERATURE) readings.minOf { it.second } - 1.0 else 0.0
                        val maxValue = maxOf(minValue + 1.0, readings.maxOf { it.second } + 1.0)
                        fun place(point: Pair<br.com.blaise.rj.data.InmetHourlyPoint, Double>): androidx.compose.ui.geometry.Offset {
                            val age = java.time.Duration.between(point.first.observedAt, now).seconds
                            val x = size.width * (1f - age.toFloat() / 86_400f).coerceIn(0f, 1f)
                            val y = size.height * (1f - ((point.second - minValue) / (maxValue - minValue)).toFloat()).coerceIn(0f, 1f)
                            return androidx.compose.ui.geometry.Offset(x, y)
                        }
                        readings.forEachIndexed { index, point ->
                            val p = place(point)
                            if (metric == InmetMetric.HOURLY_RAINFALL) {
                                // Hourly accumulation: measured bars, with missing hours LEFT blank.
                                drawLine(metricColor, androidx.compose.ui.geometry.Offset(p.x, size.height),
                                    p, strokeWidth = 4.dp.toPx())
                            } else if (index > 0) {
                                val before = readings[index - 1]
                                val gapSeconds = java.time.Duration.between(before.first.observedAt, point.first.observedAt).seconds
                                // A gap > 90 minutes must not become a fabricated continuous trend.
                                if (gapSeconds in 1..5400) drawLine(metricColor, place(before), p, strokeWidth = 2.dp.toPx())
                            }
                            drawCircle(metricColor, radius = 2.5.dp.toPx(), center = p)
                        }
                    }
                }
                if (readings.size < 2) {
                    Surface(color = Color(0xEF07192F), shape = RoundedCornerShape(9.dp),
                        border = BorderStroke(1.dp, WarningAmber)) {
                        Text("$variable: série oficial recente indisponível",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                            color = WarningAmber, style = MaterialTheme.typography.labelSmall,
                            textAlign = TextAlign.Center)
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf("−24h", "−18h", "−12h", "−6h", "Agora").forEach { tick ->
                Text(tick, color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        }
        if (readings.size >= 2 && stationSeries != null && last != null) {
            Text("Fonte: INMET • ${stationSeries.stationName} • $unit • última medição: ${last.atZone(zone).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))} (Brasília).",
                color = Color.White, style = MaterialTheme.typography.labelSmall)
            Text("Dado bruto de estação, não média municipal. Lacunas não são preenchidas; série some se a última leitura vencer.",
                color = Muted, style = MaterialTheme.typography.labelSmall)
        } else {
            Text("Não há medições INMET recentes suficientes para este gráfico; nenhum valor foi estimado.",
                color = Muted, style = MaterialTheme.typography.labelSmall)
        }
        TextButton(onClick = { showRainfall = !showRainfall }) {
            Text(if (showRainfall) "Ocultar chuva de estações" else "Ver chuva oficial das estações")
        }
        if (showRainfall) BackendRainfallPanel()
    }
}
@Composable
private fun CompactNewsAndSeismicPanel(modifier: Modifier = Modifier, onNavigate: (String) -> Unit) {
    var seismicDetails by remember { mutableStateOf(false) }
    if (seismicDetails) {
        AlertDialog(onDismissRequest = { seismicDetails = false },
            title = { Text("Abalos sísmicos • fontes e confirmação") },
            text = { Text("Eventos e avisos ainda não integrados nesta tela. Magnitude isolada não confirma tsunami ou impacto no RJ. Não há conclusão de ausência de risco.") },
            confirmButton = { TextButton(onClick = { seismicDetails = false }) { Text("Voltar") } })
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DashboardSection(
            title = "ABALOS SÍSMICOS",
            subtitle = "Dois maiores eventos recentes • USGS",
            modifier = Modifier.fillMaxWidth(),
        ) {
            StatusLine("Evento 1", "Aguardando magnitude, local e horário")
            StatusLine("Evento 2", "Aguardando magnitude, local e horário")
            OutlinedButton(onClick = { seismicDetails = true }, modifier = Modifier.fillMaxWidth()) { Text("Mais") }
        }
        DashboardSection(
            title = "NOTÍCIAS",
            subtitle = "Rio de Janeiro + internacional",
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Local • aguardando notícia validada", color = Muted, style = MaterialTheme.typography.labelSmall)
            Text("Local • aguardando notícia validada", color = Muted, style = MaterialTheme.typography.labelSmall)
            Text("Internacional • aguardando notícia meteorológica traduzida", color = Gold, style = MaterialTheme.typography.labelSmall)
            OutlinedButton(onClick = { onNavigate("Notícias") }, modifier = Modifier.fillMaxWidth()) { Text("Mais") }
        }
    }
}

@Composable
private fun StatewideMunicipalitiesPanel() {
    val clock = LocalObservationClock.current
    val response = LocalStatewideDashboard.current
    val snapshot = (response as? StatewideDataResult.Available)?.snapshot?.takeIf { it.current(clock) }
    var query by remember { mutableStateOf("") }
    DashboardSection("ESTADO DO RJ • 92 MUNICÍPIOS", "Riscos e avisos por município, fonte e horário") {
        OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Buscar município do RJ") },
            singleLine = true, modifier = Modifier.fillMaxWidth())
        if (snapshot == null) {
            Text(if (response is StatewideDataResult.Denied) "Acesso aos dados estaduais não confirmado." else "Dados estaduais indisponíveis no momento.", color = Muted)
        } else if (!snapshot.workerActive) {
            Text("Coleta estadual indisponível. O cadastro de municípios não confirma monitoramento ativo.", color = WarningAmber)
        }
        val cities = RioMunicipalities.search(query)
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 360.dp)) {
            items(cities, key = { it.ibgeCode }) { city ->
                val row = snapshot?.municipalities?.firstOrNull { it.ibge == city.ibgeCode }
                Column(Modifier.padding(vertical = 8.dp)) {
                    Text(city.name, color = Color.White, fontWeight = FontWeight.Bold)
                    val risk = row?.risk?.takeIf { it.current(clock) }
                    Text(if (risk == null) "Risco hidrológico: indisponível ou desatualizado." else
                        "Risco hidrológico: ${risk.label} • CEMADEN-RJ • ${risk.observedAt?.atZone(java.time.ZoneId.of("America/Sao_Paulo"))?.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))} (Brasília).", color = Muted, style = MaterialTheme.typography.labelSmall)
                    val warnings = snapshot?.warnings?.filter { it.id in (row?.warningIds ?: emptyList()) && it.current(clock) }.orEmpty()
                    warnings.forEach { warning ->
                        Text("INMET • ${warning.event} • ${warning.severity} • válido até ${warning.expires.atZone(java.time.ZoneId.of("America/Sao_Paulo")).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))}.", color = WarningAmber, style = MaterialTheme.typography.labelSmall)
                    }
                    if (warnings.isEmpty()) Text(if (row?.warningCoverage == "EXACT_IBGE_ONLY")
                        "Nenhum aviso municipal atribuído nesta consulta; não confirma ausência de risco."
                        else "Consulta de avisos municipais indisponível ou com cobertura parcial.",
                        color = Muted, style = MaterialTheme.typography.labelSmall)
                    if (row?.warningCoverage == "PARTIAL_UNRESOLVED_AREAS") Text("Há avisos estaduais cuja área municipal ainda não foi confirmada.", color = WarningAmber, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        if (snapshot != null) {
            Text("FONTES E COBERTURA", color = Gold, fontWeight = FontWeight.Bold)
            snapshot.sources.forEach { source ->
                Text("${source.name}: ${source.connectedProduct?.replace('-', ' ') ?: "dados ainda não conectados"} • ${when(source.state) {
                    "CURRENT", "CURRENT_DEGRADED" -> "produto recebido; cobertura e validade por local"
                    "STALE" -> "desatualizado"
                    else -> "indisponível"
                }}", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun CitiesScreen(city1: City, city2: City, onChooseCity1: () -> Unit, onChooseCity2: () -> Unit) {
    CityPair(city1, city2, onChooseCity1, onChooseCity2, Modifier.fillMaxWidth())
    Spacer(Modifier.height(14.dp))
    StatewideMunicipalitiesPanel()
    Spacer(Modifier.height(14.dp))
    DashboardSection(
        title = "CLIMA DO DIA • DUAS CIDADES",
        subtitle = "Temperatura, sensação térmica, chuva e severidade por município",
    ) {
        StatusLine(city1.name, LocalCityWeather.current[city1.ibgeCode]?.summary(LocalObservationClock.current) ?: "Consultando medição oficial…")
        StatusLine(city2.name, LocalCityWeather.current[city2.ibgeCode]?.summary(LocalObservationClock.current) ?: "Consultando medição oficial…")
        Text("A coluna preta mantém a separação visual entre Cidade 1 e Cidade 2.", color = Muted, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun MapScreen(city1: City, city2: City) {
    DashboardSection(
        title = "MAPA DE RISCO • ESTADO DO RJ",
        subtitle = "Visão adaptativa: Estado + ${city1.name} + ${city2.name}",
    ) {
        RioGeographicBase(Modifier.fillMaxWidth().height(290.dp))
        Text("Limites geográficos reais; ainda não é uma camada meteorológica ou de risco.", color = WarningAmber)
        Text("As camadas radar, sirenes e ocorrências só serão ativadas com dados oficiais georreferenciados e válidos.", color = Muted)
        StatusLine("COR.Rio / CET-Rio", "Aguardando eventos georreferenciados oficiais")
        StatusLine("Geo-Rio / Defesa Civil", "Aguardando risco, sirenes e pontos de apoio")
        StatusLine("Alerta Rio / CEMADEN", "Aguardando radar e chuva com horário por frame")
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
        Text("Cinco fontes meteorológicas por situação: " +
            FinalDashboardSpec.fiveSituationalWeatherSources.joinToString(" • ") +
            ". Alerta Rio limitado ao município do Rio; INMET é medição por estação, " +
            "CPTEC/INPE oferece previsões oficiais e Windy compara modelos.",
            color = Muted, style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.testTag("five-weather-sources-status"))
        Text("INEA excluído. Para hidrologia, litoral e Atlântico, também ANA, CEMADEN, " +
            "SGB/SACE, Marinha e NOAA conforme fenômeno. " +
            "Consulta ao vivo e uso comercial somente após validação de origem, horário e autorização.",
            color = Muted, style = MaterialTheme.typography.labelSmall)
    }
    Spacer(Modifier.height(10.dp))
    AgentStatusPanel()
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
                    BlaiseAvatar(Modifier.fillMaxSize())
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
    onNavigate: ((String) -> Unit)? = null,
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
                CityPanel("Cidade 1", city1, "Escolher cidade 1", onChooseCity1, Modifier.weight(1f), onNavigate)
                Box(Modifier.width(2.dp).height(190.dp).background(Color.Black))
                CityPanel("Cidade 2", city2, "Escolher cidade 2", onChooseCity2, Modifier.weight(1f), onNavigate)
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
        subtitle = "Alerta Rio • CEMADEN",
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
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
            Text(subtitle, color = Muted, style = MaterialTheme.typography.labelSmall)
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
    storeChannel: String,
    entitlement: BillingEntitlementSnapshot,
    offers: SubscriptionOffersSnapshot,
    purchaseLaunchCode: Int?,
    onRefresh: () -> Unit,
    onSubscribe: (SubscriptionOffer) -> Unit,
) {
    val storeName = FinalDashboardSpec.storeDisplayName(storeChannel)
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.48f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Assinatura • $storeName", color = Gold, fontWeight = FontWeight.Bold)
            if (storeChannel != FinalDashboardSpec.STORE_GOOGLE_PLAY) {
                Text(
                    "Canal separado com acesso bloqueado até a integração e validação do faturamento oficial da loja.",
                    color = WarningAmber,
                )
                return@Column
            }
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
private fun OfficialStatusBanner(state: OfficialFeedState, onNavigate: (String) -> Unit) {
    val (headline, detail, accent) = when (state) {
        OfficialFeedState.CURRENT_CLEAR -> Triple(
            "STATUS OFICIAL • SEM P0 CONFIRMADO",
            "Somente para a cobertura e vigência da evidência oficial consultada.",
            StableGreen,
        )
        OfficialFeedState.CURRENT_P0 -> Triple(
            "ÚLTIMA HORA • ALERTA P0",
            "Alerta oficial ativo. Consulte orientações, fonte e horário no painel de alertas.",
            AlertRed,
        )
        OfficialFeedState.STALE -> Triple(
            "STATUS OFICIAL • DESATUALIZADO",
            "Sem confirmação atual; consulte os canais da Defesa Civil.",
            WarningAmber,
        )
        OfficialFeedState.UNAVAILABLE -> Triple(
            "STATUS OFICIAL • AGUARDANDO DADOS",
            "Não presumimos ausência de alerta sem evidência oficial válida.",
            WarningAmber,
        )
    }
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("official-alert-ribbon"),
        color = if (state == OfficialFeedState.CURRENT_P0) Color(0xFF4B101B) else Color(0xFF14283F),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, accent),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("⚠", color = accent, fontWeight = FontWeight.Black)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(headline, color = accent, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.labelSmall)
                Text(detail, color = Color.White, style = MaterialTheme.typography.labelSmall)
            }
            TextButton(onClick = { onNavigate("Alertas") }, modifier = Modifier.testTag("alerts-ribbon-open")) {
                Text("Ver alertas", color = Gold, style = MaterialTheme.typography.labelSmall)
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
    onNavigate: ((String) -> Unit)? = null,
) {
    val report = LocalCityWeather.current[city.ibgeCode]
    val clock = LocalObservationClock.current
    val observation = report?.currentObservation(clock)
    val scientificValues = ScientificDashboardPolicy.derive(observation, clock)
    val feelsLike = scientificValues.firstOrNull { it.title == "Sensação térmica" }
    val context = LocalContext.current
    var details by remember(city.ibgeCode) { mutableStateOf(false) }
    // Scenic header cropped from the approved visual reference. Only use for
    // Rio and Niterói, and NEVER crop weather readings or alerts from the mock.
    val skyline = remember(city.ibgeCode) {
        val frame = when (city.ibgeCode) {
            3304557 -> intArrayOf(16, 190, 350, 49)
            3303302 -> intArrayOf(1178, 190, 338, 49)
            else -> null
        }
        frame?.let { slice ->
            runCatching {
                val image = BitmapFactory.decodeResource(context.resources, R.drawable.blaise_reference)
                Bitmap.createBitmap(image, slice[0], slice[1], slice[2], slice[3]).asImageBitmap()
            }.getOrNull()
        }
    }
    Surface(
        modifier = modifier,
        color = Panel,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFF2777B0)),
    ) {
        Column(Modifier.fillMaxWidth().padding(9.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(label, color = Gold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.weight(1f))
                Text("RJ", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
            if (skyline != null) {
                Image(
                    bitmap = skyline,
                    contentDescription = "Imagem ilustrativa de ${city.name}; não representa condições meteorológicas.",
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Surface(
                    color = Color(0xFF12436B),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.fillMaxWidth().height(32.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("Estado do Rio de Janeiro", color = Color.White, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            Text(city.name, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall)
            Text("IBGE ${city.ibgeCode}", color = Muted, style = MaterialTheme.typography.labelSmall)
            Text(
                observation?.temperatureC?.let { String.format(java.util.Locale("pt", "BR"), "%.1f °C", it) } ?: "— °C",
                color = Color.White, fontWeight = FontWeight.Black, style = MaterialTheme.typography.headlineMedium,
            )
            Text(
                if (observation == null) "Medição oficial indisponível" else "Medição oficial com horário válido",
                color = if (observation == null) WarningAmber else StableGreen,
                style = MaterialTheme.typography.labelSmall,
            )
            if (feelsLike != null) {
                Text("Sensação térmica calculada: ${feelsLike.value}",
                    color = Gold, style = MaterialTheme.typography.labelSmall)
            }
            if (observation != null) {
                Text(
                    "Fonte: ${observation.source} • estação ${observation.station} • " +
                        observation.observedAt.atZone(java.time.ZoneId.of("America/Sao_Paulo"))
                            .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm")) +
                        " (Brasília)",
                    color = Muted, style = MaterialTheme.typography.labelSmall,
                )
            }
            fun metric(value: Double?, unit: String) = value?.let {
                String.format(java.util.Locale("pt", "BR"), "%.1f %s", it, unit)
            } ?: "—"
            Text("Umidade ${metric(observation?.humidityPercent, "%")}  •  Vento ${metric(observation?.windKmh, "km/h")}",
                color = Muted, style = MaterialTheme.typography.labelSmall)
            Text("Rajada ${metric(observation?.windGustKmh, "km/h")}  •  Chuva 1h ${metric(observation?.hourlyRainMm, "mm")}",
                color = Muted, style = MaterialTheme.typography.labelSmall)
            if (onNavigate != null) {
                TextButton(
                    onClick = { onNavigate("Alertas") },
                    modifier = Modifier.fillMaxWidth().testTag("city-alerts-${city.ibgeCode}"),
                ) {
                    Text("⚠ Alertas da cidade • ver todos ›",
                        color = WarningAmber, style = MaterialTheme.typography.labelSmall)
                }
            }
            OutlinedButton(onClick = onChoose, modifier = Modifier.fillMaxWidth()) {
                Text(chooseLabel, style = MaterialTheme.typography.labelSmall)
            }
            TextButton(onClick = { details = !details }, modifier = Modifier.fillMaxWidth()) {
                Text(if (details) "Ocultar detalhes" else "Ver detalhes")
            }
            if (details) {
                Text(report?.summary(clock) ?: "Nenhum dado meteorológico atual confirmado para este município.",
                    color = Muted, style = MaterialTheme.typography.labelSmall)
                Text("Sensação térmica, UV, chance de chuva e rajadas: apenas com fonte oficial válida.",
                    color = Muted, style = MaterialTheme.typography.labelSmall)
                Text("Avisos: ver seção Alertas. Ausência de dados não significa ausência de risco.",
                    color = WarningAmber, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun BackendRainfallPanel() {
    val response = LocalBackendDashboard.current
    val clock = LocalObservationClock.current
    val snapshot = (response as? DashboardDataNetworkResult.Available)?.snapshot?.takeIf { it.current(clock) }
    DashboardSection(title = "CHUVA OBSERVADA • REDE ALERTA RIO", subtitle = "Município do Rio • resumo das estações") {
        if (snapshot == null) {
            Text(if (response is DashboardDataNetworkResult.Denied) "Dados completos disponíveis após verificação de acesso." else "Dados de chuva indisponíveis no momento.", color = Muted)
        } else {
            val rain = snapshot.rainfall
            fun mm(value: Double?) = value?.let { String.format(java.util.Locale("pt", "BR"), "%.1f mm", it) } ?: "Indisponível"
            StatusLine("Maior acumulado em estação • 15 min", mm(rain.max15mMm))
            StatusLine("Maior acumulado em estação • 1 hora", mm(rain.max1hMm))
            StatusLine("Maior acumulado em estação • 24 horas", mm(rain.max24hMm))
            Text("Fonte: Alerta Rio • ${rain.stationCount} estações • medição ${rain.observedAt.atZone(java.time.ZoneId.of("America/Sao_Paulo")).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"))} (Brasília).", color = Muted)
            Text("Máximos da rede, não média da cidade nem medição do Centro ou de Niterói.", color = Muted, style = MaterialTheme.typography.labelSmall)
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
