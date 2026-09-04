package br.com.blaise.rj.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import br.com.blaise.rj.data.VoiceService
import java.util.Locale
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

object TtsCapabilityPolicy {
    val preferredLocales: List<Locale> = listOf(Locale("pt", "BR"), Locale("pt", "PT"), Locale("pt"))
}

class AndroidTextToSpeechVoiceService(context: Context) : VoiceService, AutoCloseable {
    private enum class InitState { INITIALIZING, READY, FAILED, CLOSED }

    private val lock = Any()
    private var state = InitState.INITIALIZING
    private val waiters = mutableListOf<Continuation<Boolean>>()
    private val tts = TextToSpeech(context.applicationContext) { status ->
        val continuations: List<Continuation<Boolean>>
        val ready = status == TextToSpeech.SUCCESS
        synchronized(lock) {
            if (state == InitState.CLOSED) return@TextToSpeech
            state = if (ready) InitState.READY else InitState.FAILED
            continuations = waiters.toList()
            waiters.clear()
        }
        continuations.forEach { it.resume(ready) }
    }

    override suspend fun speak(text: String): Result<Unit> {
        if (text.isBlank()) return Result.failure(IllegalArgumentException("Speech text must not be blank"))
        if (!awaitReady()) return Result.failure(IllegalStateException("Android TTS is unavailable"))

        val selected = TtsCapabilityPolicy.preferredLocales.firstOrNull { locale ->
            tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE
        } ?: return Result.failure(IllegalStateException("Portuguese TTS language data is unavailable"))

        if (tts.setLanguage(selected) < TextToSpeech.LANG_AVAILABLE) {
            return Result.failure(IllegalStateException("Android TTS rejected the selected Portuguese locale"))
        }

        val utteranceId = "blaise-${System.nanoTime()}"
        return if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId) == TextToSpeech.SUCCESS) {
            Result.success(Unit)
        } else {
            Result.failure(IllegalStateException("Android TTS failed to accept the utterance"))
        }
    }

    private suspend fun awaitReady(): Boolean = suspendCoroutine { continuation ->
        synchronized(lock) {
            when (state) {
                InitState.READY -> continuation.resume(true)
                InitState.FAILED, InitState.CLOSED -> continuation.resume(false)
                InitState.INITIALIZING -> waiters += continuation
            }
        }
    }

    override fun close() {
        val continuations: List<Continuation<Boolean>>
        synchronized(lock) {
            if (state == InitState.CLOSED) return
            state = InitState.CLOSED
            continuations = waiters.toList()
            waiters.clear()
        }
        continuations.forEach { it.resume(false) }
        tts.stop()
        tts.shutdown()
    }
}
