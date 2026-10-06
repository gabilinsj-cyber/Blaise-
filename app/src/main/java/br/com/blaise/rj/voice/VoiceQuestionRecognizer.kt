package br.com.blaise.rj.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/** Main-thread owned recognizer; final result is submitted directly, never via a text form. */
class VoiceQuestionRecognizer(context: Context, private val onQuestion: (String) -> Unit, private val onError: (String) -> Unit, private val onListening: (Boolean) -> Unit) : AutoCloseable {
    private val recognizer = if (SpeechRecognizer.isRecognitionAvailable(context)) SpeechRecognizer.createSpeechRecognizer(context) else null
    private var active = false
    init {
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { onListening(true) }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { onListening(false) }
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
            override fun onError(error: Int) {
                if (!active) return
                active = false; onListening(false)
                onError(when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permita o microfone para fazer perguntas por voz."
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "O reconhecimento de voz não conseguiu acessar a rede. Tente novamente."
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Não consegui compreender. Toque no microfone e repita."
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "O microfone está ocupado. Aguarde e tente novamente."
                    else -> "Falha no reconhecimento de voz (código $error). Tente novamente."
                })
            }
            override fun onResults(results: Bundle?) {
                if (!active) return
                active = false; onListening(false)
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim()
                if (text.isNullOrEmpty()) onError("Não consegui compreender. Pode repetir?") else onQuestion(text)
            }
        })
    }
    fun start() {
        if (recognizer == null) { onError("Reconhecimento de voz indisponível neste aparelho."); return }
        if (active) return
        active = true; onListening(true)
        runCatching { recognizer?.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }) }.onFailure { cancel(); onError("Não foi possível iniciar o microfone.") }
    }
    fun cancel() { active = false; recognizer?.cancel(); onListening(false) }
    override fun close() { active = false; recognizer?.destroy() }
}
