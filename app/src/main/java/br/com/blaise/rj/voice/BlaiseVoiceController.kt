package br.com.blaise.rj.voice

import br.com.blaise.rj.data.VoiceService

/** Same user-facing speech contract for offline Dora and Android device TTS. */
interface BlaiseVoiceController : VoiceService, AutoCloseable {
    fun stop()
}
