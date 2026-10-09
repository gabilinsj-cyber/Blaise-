package br.com.blaise.rj.billing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.BuildConfig
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser

/**
 * Google Play subscriber account. Email/password is provided by Firebase Auth;
 * no password or ID token is kept in SharedPreferences or logs.
 * The app's public weather and official alerts remain accessible without login.
 */
class SubscriberAccountActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { SubscriberAccountScreen() } }
    }
}

@Composable
private fun SubscriberAccountScreen() {
    val enabled = BuildConfig.BLAISE_SUBSCRIBER_AUTH_ENABLED
    val auth = remember(enabled) {
        if (!enabled) null else runCatching { FirebaseAuth.getInstance() }.getOrNull()
    }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var user by remember { mutableStateOf(auth?.currentUser) }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }

    DisposableEffect(auth) {
        val listener = FirebaseAuth.AuthStateListener { updated -> user = updated.currentUser }
        auth?.addAuthStateListener(listener)
        onDispose { auth?.removeAuthStateListener(listener) }
    }

    fun validInput(): Boolean = email.trim().contains('@') && password.length >= 8 && password.length <= 128
    fun createAccount() {
        if (auth == null || !validInput() || busy) {
            notice = "Informe um e-mail válido e senha entre 8 e 128 caracteres."
            return
        }
        busy = true
        auth.createUserWithEmailAndPassword(email.trim(), password).addOnCompleteListener { task ->
            busy = false
            password = ""
            if (!task.isSuccessful) {
                notice = "Não foi possível criar a conta. Verifique os dados e tente novamente."
            } else {
                task.result?.user?.sendEmailVerification()
                notice = "Conta criada. Verifique seu e-mail antes de utilizar a assinatura."
            }
        }
    }
    fun signIn() {
        if (auth == null || !validInput() || busy) {
            notice = "Informe seu e-mail e senha."
            return
        }
        busy = true
        auth.signInWithEmailAndPassword(email.trim(), password).addOnCompleteListener { task ->
            busy = false
            password = ""
            notice = if (task.isSuccessful) {
                if (auth.currentUser?.isEmailVerified == true) "Conta verificada." else
                    "Confira seu e-mail de verificação antes de assinar."
            } else "Não foi possível entrar. Confira os dados e tente novamente."
        }
    }

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Blaise V6 RJ • Minha conta", style = MaterialTheme.typography.titleLarge)
            Text("Sua conta protege o acesso à assinatura. Os alertas públicos não exigem login.")
            if (!enabled || auth == null) {
                Text("Login indisponível nesta versão. Configure o Firebase Authentication antes de ativar.")
            } else {
                val current: FirebaseUser? = user
                if (current == null) {
                    OutlinedTextField(
                        value = email, onValueChange = { email = it.take(254) },
                        modifier = Modifier.fillMaxWidth(), label = { Text("E-mail") },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = password, onValueChange = { password = it.take(128) },
                        modifier = Modifier.fillMaxWidth(), label = { Text("Senha") },
                        visualTransformation = PasswordVisualTransformation(), singleLine = true,
                    )
                    Button(onClick = ::signIn, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Entrar") }
                    OutlinedButton(onClick = ::createAccount, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Criar conta") }
                    OutlinedButton(onClick = {
                        val target = email.trim()
                        if (target.contains('@') && !busy) {
                            busy = true
                            auth.sendPasswordResetEmail(target).addOnCompleteListener {
                                busy = false
                                notice = "Se existir uma conta, você receberá instruções para recuperar sua senha."
                            }
                        } else notice = "Informe seu e-mail para solicitar a recuperação."
                    }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Esqueci minha senha") }
                } else {
                    Text(if (current.isEmailVerified) "E-mail verificado." else "Confirmação de e-mail pendente.")
                    if (!current.isEmailVerified) {
                        OutlinedButton(onClick = {
                            if (!busy) {
                                busy = true
                                current.sendEmailVerification().addOnCompleteListener { task ->
                                    busy = false
                                    notice = if (task.isSuccessful) "Verificação enviada ao e-mail da conta." else
                                        "Não foi possível enviar. Tente mais tarde."
                                }
                            }
                        }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Reenviar verificação") }
                        OutlinedButton(onClick = {
                            if (!busy) {
                                busy = true
                                current.reload().addOnCompleteListener { task ->
                                    busy = false
                                    user = auth.currentUser
                                    notice = if (task.isSuccessful && auth.currentUser?.isEmailVerified == true)
                                        "E-mail confirmado. Você pode atualizar sua assinatura." else
                                        "A confirmação ainda não foi identificada."
                                }
                            }
                        }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Conferir confirmação") }
                    }
                    OutlinedButton(onClick = {
                        auth.signOut()
                        user = null
                        password = ""
                        notice = "Sessão encerrada."
                    }, modifier = Modifier.fillMaxWidth()) { Text("Sair da conta") }
                }
            }
            if (notice.isNotBlank()) Text(notice)
        }
    }
}
