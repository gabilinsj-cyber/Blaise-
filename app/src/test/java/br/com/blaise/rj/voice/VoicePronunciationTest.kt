package br.com.blaise.rj.voice

import org.junit.Assert.assertEquals
import org.junit.Test

class VoicePronunciationTest {
    @Test fun substitutesBrandOnlyInSpeech() {
        assertEquals("Olá! Eu sou a Bleiss. Bleiss V6 RJ", VoicePronunciation.forSpeech("Olá! Eu sou a Blaise. BLAISE V6 RJ"))
    }
    @Test fun preservesWeatherValuesAndOtherWords() {
        assertEquals("Niterói: 27,5 °C. térmica: 30 °C. Blaiseana préBlaise Blaise_1", VoicePronunciation.forSpeech("Niterói: 27,5 °C. térmica: 30 °C. Blaiseana préBlaise Blaise_1"))
    }
}
