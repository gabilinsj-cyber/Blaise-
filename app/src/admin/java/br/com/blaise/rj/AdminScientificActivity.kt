package br.com.blaise.rj

import android.os.Bundle
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
