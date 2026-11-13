package br.com.blaise.rj.voice

import java.util.Locale
import org.junit.Assert.*
import org.junit.Test

class RjConfirmedFemaleVoiceTest {
    @Test fun brazilianPortugueseIsRequiredForConfirmedAvatarSpeech() {
        assertTrue(RjConfirmedFemaleVoice.isBrazilianPortuguese(Locale.forLanguageTag("pt-BR")))
        assertFalse(RjConfirmedFemaleVoice.isBrazilianPortuguese(Locale.forLanguageTag("pt-PT")))
        assertFalse(RjConfirmedFemaleVoice.isBrazilianPortuguese(Locale.forLanguageTag("en-US")))
        assertFalse(RjConfirmedFemaleVoice.isBrazilianPortuguese(null))
    }
}
