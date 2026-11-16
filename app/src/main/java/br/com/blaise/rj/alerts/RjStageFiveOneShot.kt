package br.com.blaise.rj.alerts

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import br.com.blaise.rj.voice.AndroidSystemVoiceService
import java.security.MessageDigest
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/**
 * Atomic, per-official-alert, persisted stage transitions. The app must pass
 * an authenticated, reviewed alert, NEVER a raw network string or an inferred
 * risk from satellite/weather models.
 *
 * Stored: salted? No personal data. Only SHA-256 event key, stage and last
 * verification time. No location history, voice or weather values.
 */
class RjStageFiveOnceStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        "rj-alert-5-once", Context.MODE_PRIVATE
    )

    @Synchronized
    fun accept(event: VerifiedBlaisePublicStage, now: Instant): Boolean {
        if (!event.isCurrent(now)) return false
        // A single published alert covering both selected cities must not sound twice.
        val plain = "${event.sourceId}|${event.alertId}"
        val key = MessageDigest.getInstance("SHA-256")
            .digest(plain.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        val observed = event.checkedAt.toEpochMilli()
        val lastChecked = preferences.getLong("$key.checked", Long.MIN_VALUE)
        if (observed < lastChecked) return false // stale state must not rearm
        val previous = RjBlaiseStage.from(preferences.getInt("$key.stage", 0))
        // Commit BEFORE starting playback: restart/network retry never repeats it.
        if (!preferences.edit()
                .putInt("$key.stage", event.stage.number)
                .putLong("$key.checked", observed)
                .commit()) return false
        return RjStageFiveTransition.shouldDispatch(previous, event.stage)
    }
}

/**
 * One spoken briefing, then three audible beeps; three vibration pulses
 * when enabled by the customer AND supported/permitted by the Android OS.
 *
 * This is an opt-in foreground player, not a bypass of DND, notification
 * permissions or background execution restrictions. Until the server sends
 * an authenticated mapped stage, NO alarm is triggered.
 */
class RjStageFiveOneShot(private val context: Context) {
    private val store = RjStageFiveOnceStore(context)

    suspend fun notifyOnce(
        event: VerifiedBlaisePublicStage,
        now: Instant,
        soundEnabled: Boolean,
        vibrationEnabled: Boolean,
    ): Boolean {
        if (!store.accept(event, now)) return false
        if (soundEnabled) {
            val speaker = AndroidSystemVoiceService(context)
            try {
                speaker.speak(
                    "Blaise V6 Rio de Janeiro. Atenção: alerta no estágio cinco " +
                        "confirmado para uma cidade selecionada. " +
                        "Abra a fonte oficial para orientações e informações."
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                // The TTS engine or selected female voice may be unavailable;
                // the three beeps remain an independent fallback.
            } finally {
                speaker.close()
            }
            val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85)
            try {
                repeat(3) { index ->
                    tone.startTone(ToneGenerator.TONE_PROP_BEEP, 180)
                    delay(360)
                }
            } finally {
                tone.release()
            }
        }
        if (vibrationEnabled) {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    context.getSystemService(VibratorManager::class.java)?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    (context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)
                }
                if (vibrator?.hasVibrator() == true) {
                    // 3 independent vibration pulses (200ms ON, 180ms OFF).
                    vibrator.vibrate(
                        VibrationEffect.createWaveform(
                            longArrayOf(0, 200, 180, 200, 180, 200), -1
                        )
                    )
                }
            } catch (_: SecurityException) {
                // Missing permission/system restriction: silent fallback.
            }
        }
        return true
    }
}
