package br.com.blaise.rj.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import br.com.blaise.rj.data.VoiceService
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** Offline Kokoro v1.0, Brazilian Portuguese Dora (speaker 42). No public demo/API calls. */
class DoraVoiceService(context: Context) : VoiceService, AutoCloseable {
    private val context = context.applicationContext
    private val mutex = Mutex()
    private val closed = AtomicBoolean(false)
    private val generation = AtomicLong(0)
    private val playbackLock = Any()
    private val playing = AtomicReference<AudioTrack?>(null)
    private var engine: OfflineTts? = null // accessed only while holding mutex

    fun stop() {
        synchronized(playbackLock) {
            generation.incrementAndGet()
            playing.get()?.let { track -> runCatching { track.pause(); track.flush() } }
        }
    }

    override suspend fun speak(text: String): Result<Unit> {
        if (text.isBlank()) return Result.failure(IllegalArgumentException("Texto vazio"))
        if (text.length > 4000) return Result.failure(IllegalArgumentException("Resposta muito longa para leitura"))
        if (closed.get()) return Result.failure(IllegalStateException("Voz encerrada"))
        val ticket = synchronized(playbackLock) {
            val next = generation.incrementAndGet()
            playing.get()?.let { track -> runCatching { track.pause(); track.flush() } }
            next
        }
        return withContext(Dispatchers.IO) {
            mutex.withLock {
                var track: AudioTrack? = null
                try {
                    check(!closed.get() && ticket == generation.get()) { "Fala interrompida" }
                    val job = currentCoroutineContext()
                    val tts = engine ?: createEngine().also { engine = it }
                    job.ensureActive()
                    val audio = tts.generateWithCallback(
                        text = VoicePronunciation.forSpeech(text), sid = 42, speed = 1.0f,
                        callback = { if (job.isActive && !closed.get() && ticket == generation.get()) 1 else 0 },
                    )
                    job.ensureActive()
                    check(!closed.get() && ticket == generation.get()) { "Fala interrompida" }
                    check(audio.samples.isNotEmpty()) { "Dora não produziu áudio" }
                    val minimum = AudioTrack.getMinBufferSize(audio.sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
                    check(minimum > 0) { "Formato de áudio indisponível" }
                    track = AudioTrack.Builder()
                        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        .setAudioFormat(AudioFormat.Builder().setSampleRate(audio.sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_FLOAT).build())
                        .setBufferSizeInBytes(maxOf(minimum, 8192))
                        .setTransferMode(AudioTrack.MODE_STREAM).build()
                    check(track.state == AudioTrack.STATE_INITIALIZED) { "Reprodução indisponível" }
                    synchronized(playbackLock) {
                        check(!closed.get() && ticket == generation.get()) { "Fala interrompida" }
                        playing.set(track)
                        track.play()
                    }
                    val deadline = android.os.SystemClock.elapsedRealtime() + audio.samples.size.toLong() * 1000 / audio.sampleRate + 5000
                    var offset = 0
                    while (offset < audio.samples.size) {
                        job.ensureActive()
                        check(!closed.get() && ticket == generation.get()) { "Fala interrompida" }
                        check(android.os.SystemClock.elapsedRealtime() < deadline) { "Tempo de reprodução excedido" }
                        val count = track.write(audio.samples, offset, minOf(2048, audio.samples.size - offset), AudioTrack.WRITE_NON_BLOCKING)
                        check(count >= 0) { "Falha ao reproduzir a voz" }
                        offset += count
                        if (count == 0) delay(10)
                    }
                    // Success means playback completed, not merely that synthesis was queued.
                    while (track.playbackHeadPosition.toLong() < audio.samples.size) {
                        job.ensureActive()
                        check(!closed.get() && ticket == generation.get()) { "Fala interrompida" }
                        check(android.os.SystemClock.elapsedRealtime() < deadline) { "Tempo de reprodução excedido" }
                        delay(20)
                    }
                    Result.success(Unit)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    Result.failure(error)
                } catch (error: LinkageError) {
                    Result.failure(IllegalStateException("Mecanismo Dora indisponível neste aparelho", error))
                } finally {
                    synchronized(playbackLock) {
                        playing.compareAndSet(track, null)
                        track?.let { runCatching { it.stop() }; it.release() }
                    }
                }
            }
        }
    }

    private fun createEngine(): OfflineTts {
        // eSpeak needs its dictionaries on disk; large ONNX/voice files are read from APK assets.
        val data = File(context.filesDir, "dora-v1-espeak")
        if (!File(data, "ready").isFile) {
            data.deleteRecursively()
            copyAssets("dora/espeak-ng-data", data)
            File(data, "ready").writeText("kokoro-v1.0")
        }
        return OfflineTts(assetManager = context.assets, config = OfflineTtsConfig(
            model = OfflineTtsModelConfig(
                kokoro = OfflineTtsKokoroModelConfig(model = "dora/model.onnx", voices = "dora/voices.bin",
                    tokens = "dora/tokens.txt", dataDir = data.absolutePath, lang = "pt-br"),
                numThreads = 2, debug = false,
            ),
            maxNumSentences = 1,
        ))
    }

    private fun copyAssets(path: String, target: File) {
        val children = context.assets.list(path).orEmpty()
        if (children.isEmpty()) {
            target.parentFile?.mkdirs()
            context.assets.open(path).use { input -> target.outputStream().use { input.copyTo(it) } }
        } else {
            check(target.isDirectory || target.mkdirs()) { "Falha ao preparar a voz" }
            children.forEach { copyAssets("$path/$it", File(target, it)) }
        }
    }

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        stop()
        CoroutineScope(Dispatchers.IO).launch {
            mutex.withLock { engine?.release(); engine = null }
        }
    }
}
