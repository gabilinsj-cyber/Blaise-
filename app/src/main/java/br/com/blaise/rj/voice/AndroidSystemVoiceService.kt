package br.com.blaise.rj.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/**
 * Lightweight customer voice: uses the user's Android TTS engine, NOT a
 * bundled 300+ MB ONNX voice model or an unapproved paid cloud endpoint.
 * Portuguese (Brazil) voice availability depends on the Android device.
 */
class AndroidSystemVoiceService(context: Context) : BlaiseVoiceController {
    private val closed = AtomicBoolean(false)
    private val initialized = CompletableDeferred<Boolean>()
    private val mutex = Mutex()
    private val serial = AtomicLong()
    private val lock = Any()
    private var currentUtterance: String? = null
    private var completion: CompletableDeferred<Result<Unit>>? = null
    private val engine = TextToSpeech(context.applicationContext) { status ->
        if (!initialized.isCompleted) initialized.complete(status == TextToSpeech.SUCCESS)
    }

    override suspend fun speak(text: String): Result<Unit> {
        if (text.isBlank() || text.length > 4000) {
            return Result.failure(IllegalArgumentException("Resposta vazia ou muito longa"))
        }
        if (closed.get()) return Result.failure(IllegalStateException("Voz encerrada"))
        return try {
            withContext(Dispatchers.IO) {
                mutex.withLock {
                    if (!withTimeout(10000) { initialized.await() }) {
                        return@withLock Result.failure(IllegalStateException("Motor de voz Android indisponível"))
                    }
                    if (closed.get()) {
                        return@withLock Result.failure(IllegalStateException("Voz encerrada"))
                    }
                    val language = engine.setLanguage(Locale.forLanguageTag("pt-BR"))
                    if (language == TextToSpeech.LANG_MISSING_DATA ||
                        language == TextToSpeech.LANG_NOT_SUPPORTED) {
                        return@withLock Result.failure(IllegalStateException(
                            "A voz em português do Brasil não está instalada neste Android"
                        ))
                    }
                    val id = "blaise-rj-" + serial.incrementAndGet()
                    val done = CompletableDeferred<Result<Unit>>()
                    synchronized(lock) {
                        currentUtterance = id
                        completion = done
                    }
                    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String) = Unit
                        override fun onDone(utteranceId: String) {
                            synchronized(lock) {
                                if (currentUtterance == utteranceId) {
                                    done.complete(Result.success(Unit))
                                }
                            }
                        }
                        @Deprecated("Android TTS callback")
                        override fun onError(utteranceId: String) {
                            synchronized(lock) {
                                if (currentUtterance == utteranceId) {
                                    done.complete(Result.failure(IllegalStateException("Falha de voz do Android")))
                                }
                            }
                        }
                    })
                    val status = engine.speak(
                        VoicePronunciation.forSpeech(text),
                        TextToSpeech.QUEUE_FLUSH, null, id
                    )
                    if (status == TextToSpeech.ERROR) {
                        done.complete(Result.failure(IllegalStateException(
                            "O Android não conseguiu iniciar a resposta falada"
                        )))
                    }
                    try {
                        withTimeout(60000) { done.await() }
                    } finally {
                        synchronized(lock) {
                            if (completion === done) {
                                completion = null
                                currentUtterance = null
                            }
                        }
                    }
                }
            }
        } catch (error: CancellationException) {
            stop()
            throw error
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    override fun stop() {
        synchronized(lock) {
            engine.stop()
            completion?.complete(Result.failure(IllegalStateException("Resposta falada interrompida")))
            completion = null
            currentUtterance = null
        }
    }

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        stop()
        engine.shutdown()
    }
}
