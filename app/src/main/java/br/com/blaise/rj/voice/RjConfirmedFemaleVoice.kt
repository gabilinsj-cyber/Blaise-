package br.com.blaise.rj.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import java.util.Locale

/**
 * Android Voice exposes language and audio quality, but NO reliable gender
 * metadata. Only a voice that the user has auditioned and explicitly
 * confirmed as feminine may be used by the public Blaise voice service.
 * Nothing about the voice identity is sent to the backend.
 */
object RjConfirmedFemaleVoice {
    private const val PREFS = "blaise_rj_voice_choice"
    private const val SELECTED_ENGINE = "confirmed_engine"
    private const val SELECTED_VOICE = "confirmed_pt_br_voice"

    fun isBrazilianPortuguese(locale: Locale?): Boolean =
        locale?.language.equals("pt", ignoreCase = true) &&
            locale?.country.equals("BR", ignoreCase = true)

    fun available(voices: Set<Voice>?): List<Voice> =
        voices.orEmpty()
            .filter { isBrazilianPortuguese(it.locale) }
            .sortedWith(compareBy<Voice> { it.isNetworkConnectionRequired }.thenBy { it.name })
            .take(40)

    fun confirmedName(context: Context, engine: String?): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val storedEngine = prefs.getString(SELECTED_ENGINE, null)
        val storedVoice = prefs.getString(SELECTED_VOICE, null)
        return storedVoice?.takeIf {
            !engine.isNullOrBlank() && storedEngine == engine && it.isNotBlank()
        }
    }

    fun confirm(context: Context, engine: String?, voice: Voice): Boolean {
        if (engine.isNullOrBlank() || !isBrazilianPortuguese(voice.locale)) return false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(SELECTED_ENGINE, engine)
            .putString(SELECTED_VOICE, voice.name)
            .apply()
        return true
    }

    fun match(voices: Set<Voice>?, chosen: String?): Voice? =
        voices?.firstOrNull {
            chosen != null && it.name == chosen && isBrazilianPortuguese(it.locale)
        }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(SELECTED_ENGINE).remove(SELECTED_VOICE).apply()
    }
}
