package br.com.blaise.rj.voice

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

/**
 * Android TTS does not publish voice gender: the device owner auditions
 * a pt-BR voice and confirms its feminine sound. No voice-name guessing.
 */
@Composable
fun RjFemaleVoiceSettingsPanel() {
    val context = LocalContext.current
    var showPicker by remember { mutableStateOf(false) }
    var confirmed by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text("PERSONAGEM BLAISE • VOZ FEMININA")
        Text(
            "A fala deve ser feminina, em português brasileiro. " +
                "Ouça e confirme a voz do Android neste aparelho. " +
                "Sem confirmação, o aplicativo responde por escrito em vez de usar voz masculina."
        )
        if (confirmed) Text("Voz feminina confirmada neste aparelho.")
        OutlinedButton(
            modifier = Modifier.fillMaxWidth().testTag("choose-feminine-voice"),
            onClick = { showPicker = true }
        ) { Text("Ouvir e escolher a voz feminina") }
    }
    if (showPicker) {
        RjFemaleVoicePickerDialog(
            context = context,
            onDismiss = { showPicker = false },
            onConfirmed = { confirmed = true; showPicker = false }
        )
    }
}

@Composable
private fun RjFemaleVoicePickerDialog(
    context: Context,
    onDismiss: () -> Unit,
    onConfirmed: () -> Unit
) {
    var engine by remember { mutableStateOf<TextToSpeech?>(null) }
    var availableVoices by remember { mutableStateOf<List<Voice>>(emptyList()) }
    var loadStatus by remember { mutableStateOf("Consultando as vozes em português deste Android…") }
    var previewed by remember { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }

    DisposableEffect(context) {
        var disposed = false
        val refs = arrayOfNulls<TextToSpeech>(1)
        val tts = TextToSpeech(context.applicationContext) { status ->
            Handler(Looper.getMainLooper()).post {
                if (!disposed) {
                    val service = refs[0]
                    if (status == TextToSpeech.SUCCESS && service != null) {
                        engine = service
                        availableVoices = RjConfirmedFemaleVoice.available(service.voices)
                        loadStatus = if (availableVoices.isEmpty())
                            "Nenhuma voz em português brasileiro disponível. " +
                                "Instale uma voz pt-BR nas configurações de fala do Android."
                        else "Ouça as amostras e confirme qual tem timbre feminino."
                    } else loadStatus = "Motor de voz indisponível. Confira as configurações do Android."
                }
            }
        }
        refs[0] = tts
        onDispose {
            disposed = true
            refs[0] = null
            tts.stop()
            tts.shutdown()
            engine = null
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("rj-feminine-voice-dialog"),
        title = { Text("Escolher voz feminina da Blaise") },
        text = {
            Column(
                Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Text(loadStatus)
                for (voice in availableVoices) {
                    Text(voice.name + if (voice.isNetworkConnectionRequired)
                        " • requer internet" else " • voz local")
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            problem = null
                            previewed = null
                            val service = engine
                            if (service == null ||
                                service.setVoice(voice) != TextToSpeech.SUCCESS ||
                                service.speak(
                                    "Olá! Eu sou a Blaise. Clima e Tempo do Rio de Janeiro.",
                                    TextToSpeech.QUEUE_FLUSH,
                                    null,
                                    "blaise-voice-preview"
                                ) != TextToSpeech.SUCCESS
                            ) problem = "Não foi possível ouvir essa voz. Selecione outra."
                            else previewed = voice.name
                        }
                    ) { Text("Ouvir amostra") }
                    if (previewed == voice.name) {
                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                // The user's manual confirmation, after the
                                // audible sample, is the only gender evidence.
                                if (RjConfirmedFemaleVoice.confirm(
                                        context, engine?.defaultEngine, voice
                                    )
                                ) {
                                    engine?.stop()
                                    onConfirmed()
                                } else problem = "Não foi possível guardar essa seleção."
                            }
                        ) { Text("Confirmar: esta voz é feminina") }
                    }
                }
                problem?.let { Text(it) }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Fechar") } }
    )
}
