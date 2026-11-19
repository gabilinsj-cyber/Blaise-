package br.com.blaise.rj

import android.os.Bundle
import java.time.Instant
import br.com.blaise.rj.BuildConfig
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import java.util.Locale
import com.google.firebase.auth.FirebaseAuth
import br.com.blaise.rj.push.FirebaseBootstrap
import androidx.compose.ui.text.input.PasswordVisualTransformation

/**
 * Separate admin APK activity, never exported or packaged in client variants.
 * A Firebase custom claim is an additional UI gate; production data endpoints
 * MUST separately verify the signed ID token and admin role on every request.
 */
class AdminScientificActivity : ComponentActivity() {
    private var checked by mutableStateOf(false)
    private var authorized by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (packageName != "br.com.blaise.rj.admin") {
            finish()
            return
        }
        setContent {
            var adminEmail by remember { mutableStateOf("") }
            var adminPassword by remember { mutableStateOf("") }
            var loginMessage by remember { mutableStateOf("") }
            var meteorologicalMemory by remember { mutableStateOf<AdminMeteorologicalMemorySnapshot?>(null) }
            var memoryStatus by remember { mutableStateOf("Somente leitura • ainda não consultada.") }
            var memoryLoading by remember { mutableStateOf(false) }
            var selectedMeteorologicalIbge by remember { mutableStateOf("3304557") }
            MaterialTheme {
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(20.dp)
                ) {
                    Text("BLAISE V6 RJ • ADMINISTRADOR", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(12.dp))
                    if (!checked) {
                        Text("Verificando autorização administrativa…")
                    } else if (!authorized) {
                        Text("ACESSO RESTRITO — identidade administrativa não verificada.")
                        Spacer(Modifier.height(12.dp))
                        if (!FirebaseBootstrap.isConfigured()) {
                            Text("Firebase do administrador não configurado neste APK. Nenhum acesso é liberado.")
                        } else {
                            Text("Entre com uma conta Firebase autorizada para administração.")
                            OutlinedTextField(
                                value = adminEmail,
                                onValueChange = { adminEmail = it.trim().take(254); loginMessage = "" },
                                label = { Text("E-mail da conta administrativa") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().testTag("admin-login-email")
                            )
                            OutlinedTextField(
                                value = adminPassword,
                                onValueChange = { adminPassword = it; loginMessage = "" },
                                label = { Text("Senha") },
                                singleLine = true,
                                visualTransformation = PasswordVisualTransformation(),
                                modifier = Modifier.fillMaxWidth().testTag("admin-login-password")
                            )
                            Button(
                                onClick = {
                                    val email = adminEmail
                                    val password = adminPassword
                                    if (!email.contains("@") || password.isBlank()) {
                                        loginMessage = "Informe o e-mail e a senha da conta administrativa."
                                    } else {
                                        val auth = runCatching { FirebaseAuth.getInstance() }.getOrNull()
                                        if (auth == null) {
                                            loginMessage = "Serviço de autenticação indisponível."
                                        } else {
                                            checked = false
                                            auth.signInWithEmailAndPassword(email, password)
                                                .addOnCompleteListener { signIn ->
                                                    adminPassword = ""
                                                    if (!signIn.isSuccessful) {
                                                        checked = true
                                                        loginMessage = "Autenticação não concluída."
                                                    } else {
                                                        val current = auth.currentUser
                                                        if (current == null) {
                                                            checked = true
                                                            loginMessage = "Sessão inválida."
                                                        } else {
                                                            current.getIdToken(true).addOnCompleteListener { token ->
                                                                authorized = token.isSuccessful &&
                                                                    token.result?.claims?.get("blaise_admin") == true
                                                                checked = true
                                                                if (!authorized)
                                                                    loginMessage = "Conta sem permissão administrativa."
                                                            }
                                                        }
                                                    }
                                                }
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().testTag("admin-login-submit")
                            ) { Text("Entrar como administrador") }
                            if (loginMessage.isNotEmpty()) Text(loginMessage)
                        }
                    } else {
                        Text("SITUAÇÃO DOS COLETORES E CONTRATOS",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.testTag("admin-provider-readiness-title"))
                        Text("Base documentada em ${AdminCollectorReadiness.SNAPSHOT_DATE}. " +
                            "Não é saldo da API em tempo real, aprovação de release ou conexão de produção.")
                        AdminCollectorReadiness.integrations.forEach { integration ->
                            Spacer(Modifier.height(8.dp))
                            Card(modifier = Modifier.fillMaxWidth()
                                .testTag("admin-provider-${integration.id}")) {
                                Column(Modifier.padding(12.dp)) {
                                    Text(integration.title,
                                        style = MaterialTheme.typography.titleMedium)
                                    Text(integration.state)
                                    Text(integration.explanation,
                                        style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Card(modifier = Modifier.fillMaxWidth()
                            .testTag("admin-meteoblue-free-field-audit")) {
                            Column(Modifier.padding(12.dp)) {
                                Text("METEOBLUE FREE • 7 CAMPOS DE PREVISÃO",
                                    style = MaterialTheme.typography.titleMedium)
                                Text("Auditoria administrativa do pacote basic-6h • natureza P. " +
                                    "UMA resposta REAL privada validou campos, unidades, emissão e coordenadas. " +
                                    "Não é medição observada nem dado vivo do cliente.")
                                Text("Oferta inicial: 10.000.000 créditos • limite interno: " +
                                    "8.000.000 • reserva planejada: 2.000.000.")
                                Text("Cada consulta basic-6h: 4.000 créditos registrados no fornecedor. " +
                                    "Máximo 1/dia UTC no Firestore; 24h por município; cache 6h.")
                                Text("Vencimento informado: ${AdminCollectorReadiness.METEOBLUE_EXPIRY_DATE}.")
                                Text("Uso no painel meteoblue (${AdminCollectorReadiness.METEOBLUE_PROVIDER_PERIOD_LABEL}): " +
                                    "${AdminCollectorReadiness.METEOBLUE_PROVIDER_USED_IN_SELECTED_PERIOD} créditos.")
                                Text("A titular confirmou ter SALVO o limite diário da chave atual: " +
                                    "${AdminCollectorReadiness.METEOBLUE_KEY_DAILY_LIMIT_OPERATOR_REPORTED_SAVED} " +
                                    "créditos/dia UTC. Confirmação independente na API: PENDENTE.")
                                Text("A captura ANTERIOR mostrava limite de " +
                                    "${AdminCollectorReadiness.METEOBLUE_KEY_DAILY_LIMIT_OBSERVED} por dia. " +
                                    "Limite diário e saldo anual são informações diferentes.")
                                Text("SEGURANÇA: chave mostrada em captura. Com a chave antiga exposta, " +
                                    "o coletor bloqueia novas consultas após o PRIMEIRO ensaio privado da campanha. " +
                                    "Não há atualização contínua, mesmo com o novo dia UTC, sem revisão de segurança. " +
                                    "Não revelar a chave na interface.")
                                Text("Saldo atual no fornecedor: " +
                                    (AdminCollectorReadiness.meteoblueCurrentProviderCredits
                                        ?.toString() ?: "NÃO CONSULTADO"))
                                Text("Consumo reservado no Firestore: " +
                                    (AdminCollectorReadiness.meteoblueActualLocalCreditsReserved
                                        ?.toString() ?: "NÃO CONSULTADO"))
                                Text("EVIDÊNCIA ${AdminCollectorReadiness.METEOBLUE_PRIVATE_AUDIT_DATE}: " +
                                    "resposta de fornecedor validada com 7/7 campos, 29 períodos de seis horas, " +
                                    "metadados de emissão, unidades e coordenadas confirmados.")
                                Text("Contabilização da auditoria: ${AdminCollectorReadiness.METEOBLUE_ONE_PRIVATE_FORECAST_CREDITS_RESERVED} " +
                                    "créditos RESERVADOS no Firestore; saldo/cobrança do fornecedor após consulta NÃO CONSULTADOS.")
                                Text("Coletor automático: DESLIGADO • publicação aos assinantes: NÃO.")
                                Spacer(Modifier.height(8.dp))
                                AdminCollectorReadiness.meteoblueFieldAudit.forEach { field ->
                                    Text("${field.label} (${field.unit})",
                                        style = MaterialTheme.typography.bodyMedium)
                                    Text("P • ${field.meaning} • " +
                                        (if (field.presentInOneRealPrivateResponse)
                                            "CAMPO PRESENTE EM RESPOSTA REAL PRIVADA; VALOR NÃO EXIBIDO/HOMOLOGADO"
                                         else "SEM EVIDÊNCIA REAL"),
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.testTag("admin-meteoblue-field-${field.jsonKey}"))
                                    Spacer(Modifier.height(4.dp))
                                }
                                Text("A resposta real de 19/11 confirma 7 campos numéricos e metadados, " +
                                    "mas não exibe números individuais neste painel, não comprova saldo atual " +
                                    "nem disponibilidade contínua. Sem valores fictícios.")
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Card(modifier=Modifier.fillMaxWidth()
                            .testTag("admin-meteorological-memory-live")) {
                            Column(Modifier.padding(12.dp)) {
                                Text("MEMÓRIA METEOROLÓGICA • FONTES E VALIDADE",
                                    style=MaterialTheme.typography.titleMedium)
                                OutlinedTextField(
                                    value=selectedMeteorologicalIbge,
                                    onValueChange={ input ->
                                        selectedMeteorologicalIbge=input.filter{it.isDigit()}.take(7)
                                        meteorologicalMemory=null
                                    },
                                    label={Text("Código IBGE do município RJ (7 dígitos)")},
                                    singleLine=true,
                                    modifier=Modifier.fillMaxWidth().testTag("admin-meteorological-ibge")
                                )
                                Text("Selecione um dos 92 municípios cadastrados. " +
                                    "Leitura somente do cache autorizado: sem novas chamadas ao fornecedor.")
                                Text("Atualiza a leitura do cache no servidor, NÃO consulta a meteoblue " +
                                    "nem faz nova coleta das outras fontes. " +
                                    "Somente previsões reais e atuais entram; medição ausente = indisponível.")
                                Button(
                                    enabled=!memoryLoading,
                                    modifier=Modifier.testTag("admin-refresh-meteorological-cache"),
                                    onClick={
                                        memoryLoading=true
                                        memoryStatus="Verificando cache autenticado…"
                                        meteorologicalMemory=null
                                        val endpoint=AdminMeteorologicalMemoryClient.endpointFromVerifier(
                                            BuildConfig.BLAISE_ENTITLEMENT_VERIFY_URL)
                                        val auth=runCatching {FirebaseAuth.getInstance().currentUser}.getOrNull()
                                        if(endpoint==null||auth==null){
                                            memoryStatus="Backend admin indisponível ou sem sessão."
                                            memoryLoading=false
                                        } else {
                                            auth.getIdToken(true).addOnCompleteListener { task ->
                                                val token=if(task.isSuccessful) task.result?.token else null
                                                if(!task.isSuccessful||token.isNullOrBlank()){
                                                    memoryStatus="Autorização administrativa indisponível."
                                                    memoryLoading=false
                                                } else {
                                                    AdminMeteorologicalMemoryClient.fetch(
                                                        endpoint,token,selectedMeteorologicalIbge
                                                    ){ snapshot ->
                                                        runOnUiThread {
                                                            if(authorized) {
                                                                meteorologicalMemory=snapshot
                                                                memoryStatus=if(snapshot==null)
                                                                    "Memória indisponível: recurso privado ainda não ativado no backend."
                                                                else "Consulta privada concluída. Sem chamada às APIs meteorológicas."
                                                            }
                                                            memoryLoading=false
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ) { Text(if(memoryLoading) "Consultando cache…" else "Atualizar fontes no cache") }
                                Text(memoryStatus,style=MaterialTheme.typography.bodySmall)
                                meteorologicalMemory?.let { snapshot ->
                                    Text("Checado em: ${snapshot.evaluatedAt} (UTC)")
                                    Text("Meteoblue: ${snapshot.cacheState} • modelo: " +
                                        (snapshot.modelRun?.toString()?:"indisponível") +
                                        " • validade: " +
                                        (snapshot.forecastValidAt?.toString()?:"indisponível"))
                                    if(snapshot.readable(Instant.now())) {
                                        Text("7 CAMPOS P • PREVISÃO DE MODELO • NÃO OBSERVAÇÃO",
                                            style=MaterialTheme.typography.titleSmall)
                                        snapshot.fields.forEach { field ->
                                            Text(field.description(),
                                                modifier=Modifier.testTag("admin-live-${field.jsonKey}"))
                                        }
                                    } else {
                                        Text("Valores indisponíveis ou vencidos — não repetir consulta ao fornecedor.")
                                    }
                                    Text("Reservas no Firestore: " +
                                        (snapshot.localCreditsReserved?.toString()?:"indisponível") +
                                        " créditos • chamadas UTC hoje: " +
                                        (snapshot.reservedCallsToday?.toString()?:"indisponível") +
                                        " • saldo real da meteoblue NÃO verificado.")
                                    if(snapshot.noaaWaveReadable(Instant.now())) {
                                        Text("NOAA GFS-Wave (P) • altura prevista: " +
                                            String.format(Locale("pt", "BR"), "%.2f m",
                                                snapshot.noaaWaveHeightM) +
                                            " • validade UTC: ${snapshot.noaaWaveValidAt}",
                                            modifier=Modifier.testTag("admin-live-noaa-wave-height"))
                                    } else {
                                        Text("NOAA GFS-Wave: sem previsão recente no cache do backend.")
                                    }
                                    snapshot.metNorwayValidAt?.let { validAt ->
                                        val age=java.time.Duration.between(validAt,Instant.now()).seconds
                                        if(age in 0L..5400L)
                                            Text("ECMWF/IFS via MET Norway (P): cache válido em " +
                                                "$validAt UTC • não é estação local.")
                                        else Text("ECMWF/IFS: cache desatualizado.")
                                    }
                                    Text("VISUAL CROSSING FREE • ${snapshot.visualCrossingIbge} • " +
                                        "${snapshot.visualCrossingStatus}",
                                        style=MaterialTheme.typography.titleSmall)
                                    if(snapshot.visualCrossingReadable(Instant.now())) {
                                        Text("Condições agregadas (E), não estação física • validade: " +
                                            "${snapshot.visualCrossingValidAt} UTC")
                                        snapshot.visualCrossingCurrentFields.forEach { field ->
                                            Text(field.description(),
                                                modifier=Modifier.testTag("admin-live-vc-${field.jsonKey}"))
                                        }
                                    } else {
                                        Text("Visual Crossing: valores atuais ausentes ou vencidos.")
                                    }
                                    Text("Visual Crossing: ${snapshot.visualCrossingForecastSlots} " +
                                        "horários futuros com previsão P no cache • " +
                                        "sem aviso oficial de tempestade.")
                                    Text(snapshot.visualCrossingAttribution)
                                    Text("Conta Free: 1000 registros/dia anunciados. " +
                                        "Créditos adicionais = 0 no painel; significado ainda em revisão. " +
                                        "Chave exposta, coleta automática DESLIGADA.")
                                    snapshot.sourceStates.forEach { (name,state) ->
                                        Text("${name}: ${state}",
                                            style=MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                        Text("Sem contrato pago novo • Sem publicação para assinantes • " +
                            "Ausência de dado é indisponível, não zero.")
                        Spacer(Modifier.height(16.dp))
                        Text("ARQUIVO DOS 14 AGENTES RJ",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.testTag("admin-agents-historical-roster"))
                        Text(AdminRjAgentsArchive.STATUS)
                        Text("Cadastro de funções, não prova de execução, integração em produção " +
                            "ou autorização para usar fontes antigas excluídas.")
                        AdminRjAgentsArchive.entries.forEach { entry ->
                            Spacer(Modifier.height(7.dp))
                            Card(modifier = Modifier.fillMaxWidth()
                                .testTag("admin-agent-role-${entry.number}")) {
                                Column(Modifier.padding(10.dp)) {
                                    Text("${entry.number}. ${entry.title}",
                                        style = MaterialTheme.typography.titleMedium)
                                    Text(entry.responsibility,
                                        style = MaterialTheme.typography.bodySmall)
                                    Text(entry.evidenceState,
                                        style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Text("CALCULADORA CIENTÍFICA BLAISE",
                            style = MaterialTheme.typography.titleLarge)
                        Text("Memória científica: ${ScientificMemoryPolicy.BACKEND_REGISTERED_METHOD_COUNT} métodos backend.")
                        ScientificMemoryPolicy.backendGroups.forEach { group ->
                            Spacer(Modifier.height(10.dp))
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp)) {
                                    Text(group.name, style = MaterialTheme.typography.titleMedium)
                                    Text(group.methods.joinToString(" • "))
                                }
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Text("CÁLCULOS OPERACIONAIS: indisponíveis até chegar dado internacional homologado.")
                        Text("CALCULADORA MANUAL • ENTRADAS DO ADMINISTRADOR",
                            style = MaterialTheme.typography.titleMedium)
                        Text("Use números apenas para análise privada. Não são leituras de estação nem dados atuais.")
                        var tempText by remember { mutableStateOf("") }
                        var humidityText by remember { mutableStateOf("") }
                        var windText by remember { mutableStateOf("") }
                        var attempted by remember { mutableStateOf(false) }
                        var results by remember { mutableStateOf<List<AdminManualScientificResult>>(emptyList()) }
                        fun asNumber(text: String): Double? = text.trim().replace(',', '.').toDoubleOrNull()
                        OutlinedTextField(
                            value = tempText,
                            onValueChange = { tempText = it; results = emptyList(); attempted = false },
                            label = { Text("Temperatura (°C)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("admin-science-temperature"),
                        )
                        OutlinedTextField(
                            value = humidityText,
                            onValueChange = { humidityText = it; results = emptyList(); attempted = false },
                            label = { Text("Umidade relativa (%)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("admin-science-humidity"),
                        )
                        OutlinedTextField(
                            value = windText,
                            onValueChange = { windText = it; results = emptyList(); attempted = false },
                            label = { Text("Vento (km/h) • opcional") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().testTag("admin-science-wind"),
                        )
                        Button(
                            onClick = {
                                attempted = true
                                results = ScientificMemoryPolicy.calculateManualInputs(
                                    asNumber(tempText), asNumber(humidityText),
                                    if (windText.isBlank()) null else asNumber(windText)
                                )
                            },
                            modifier = Modifier.fillMaxWidth().testTag("admin-science-calculate"),
                        ) { Text("Calcular — análise privada") }
                        if (attempted && results.isEmpty())
                            Text("Entradas ausentes ou inválidas. Temperatura: −20 a 50 °C; umidade: 1–100%; vento: 0–250 km/h.")
                        results.forEach { result ->
                            Text(
                                result.title + ": " + String.format(Locale("pt", "BR"), "%.2f %s", result.value, result.unit) +
                                " • " + result.method,
                                modifier = Modifier.testTag("admin-science-result"),
                            )
                        }
                        if (results.isNotEmpty())
                            Text("CÁLCULO MANUAL — NÃO É MEDIÇÃO OFICIAL, ALERTA OU PREVISÃO VALIDADA.")
                        Text("Nenhum valor digitado é enviado ao backend ou guardado como histórico pessoal.")
                        Text("Somente cálculos internos; nenhuma saída constitui aviso oficial ou cria alerta.")
                    }
                }
            }
        }
        val signedInUser = runCatching { FirebaseAuth.getInstance().currentUser }.getOrNull()
        if (signedInUser == null) {
            checked = true
            return
        }
        signedInUser.getIdToken(true).addOnCompleteListener { task ->
            authorized = task.isSuccessful && task.result?.claims?.get("blaise_admin") == true
            checked = true
        }
    }
}
