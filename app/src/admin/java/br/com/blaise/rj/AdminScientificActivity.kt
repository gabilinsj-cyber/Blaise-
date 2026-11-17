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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth

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
                        Text("Cálculos atuais: INDISPONÍVEIS — aguardando dados autorizados, atualizados e validados no servidor.")
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
