package com.blaise.opentennis

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

/**
 * Lightweight, original procedural applause for MEMORABLE_CONFIRMED.
 * No broadcast/third-party recording is bundled. The competitive event remains
 * authoritative; this class is presentation-only and never affects scoring.
 */
class MemorableAudioEngine {
    private var track: AudioTrack? = null

    fun playStandingOvation() {
        release()
        val sampleRate = 22050
        val seconds = 1.65
        val frames = (sampleRate * seconds).toInt()
        val pcm = ShortArray(frames * 2)
        val rng = Random(0xB1A15E)

        for (i in 0 until frames) {
            val t = i.toDouble() / sampleRate
            val attack = (t / 0.10).coerceIn(0.0, 1.0)
            val release = ((seconds - t) / 0.38).coerceIn(0.0, 1.0)
            val envelope = attack * release
            val clapPulse = if ((i % 1850) < 150 || (i % 2370) < 120 || (i % 3010) < 135) 1.0 else 0.28
            val noise = rng.nextDouble(-1.0, 1.0)
            val body = sin(2.0 * PI * 170.0 * t) * 0.10
            val value = ((noise * 0.54 * clapPulse + body) * envelope * Short.MAX_VALUE * 0.52)
                .toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            // Slight stereo asymmetry gives width without claiming physical 3D positioning.
            pcm[i * 2] = value
            pcm[i * 2 + 1] = (value * 0.92).toInt().toShort()
        }

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()
        val bytes = pcm.size * 2
        val created = AudioTrack(attributes, format, bytes, AudioTrack.MODE_STATIC, AudioTrack.AUDIO_SESSION_ID_GENERATE)
        created.write(pcm, 0, pcm.size)
        created.setVolume(0.72f)
        track = created
        created.play()
    }

    fun release() {
        track?.let {
            runCatching { it.stop() }
            runCatching { it.release() }
        }
        track = null
    }
}
