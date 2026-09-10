package com.blaise.opentennis

enum class ReplayFilter { ALL, LOCAL, OPPONENT }

data class MemorableReplay(
    val eventId: String,
    val sequenceId: String,
    val setNumber: Int,
    val player: MemorablePlayer,
    val similarity: Double,
    val deterministicReplayRef: String,
    val watched: Boolean = false,
)

/**
 * Match-scoped catalog for deterministic Blaise replay reconstructions.
 * It stores references/metadata only; it never records the device screen.
 */
class MemorableReplayCatalog {
    private val entries = LinkedHashMap<String, MemorableReplay>()

    fun register(replay: MemorableReplay): Boolean {
        require(replay.eventId.isNotBlank() && replay.sequenceId.isNotBlank())
        require(replay.setNumber >= 1)
        require(replay.similarity in 0.95..1.0)
        require(replay.deterministicReplayRef.isNotBlank())
        if (entries.containsKey(replay.eventId) || entries.values.any { it.sequenceId == replay.sequenceId }) return false
        entries[replay.eventId] = replay
        return true
    }

    fun forSet(setNumber: Int, filter: ReplayFilter = ReplayFilter.ALL): List<MemorableReplay> =
        entries.values.filter { replay ->
            replay.setNumber == setNumber && when (filter) {
                ReplayFilter.ALL -> true
                ReplayFilter.LOCAL -> replay.player == MemorablePlayer.LOCAL
                ReplayFilter.OPPONENT -> replay.player == MemorablePlayer.OPPONENT
            }
        }

    fun postMatchUnwatched(): List<MemorableReplay> = entries.values.filter { !it.watched }

    fun markWatched(eventId: String): Boolean {
        val current = entries[eventId] ?: return false
        if (!current.watched) entries[eventId] = current.copy(watched = true)
        return true
    }

    fun total(): Int = entries.size
}
