package br.com.blaise.rj.voice

/** Changes only the synthesis input; the displayed answer and brand stay unchanged. */
object VoicePronunciation {
    private val brand = Regex("(?<![\\p{L}\\p{N}_])Blaise(?![\\p{L}\\p{N}_])", RegexOption.IGNORE_CASE)
    fun forSpeech(text: String): String = brand.replace(text, "Bleiss")
}
