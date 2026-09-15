package com.blaise.opentennis

/**
 * Deterministic, server-friendly matchmaking policy.
 * AI opponents are always disclosed and never impersonate human players.
 * Human opponents have priority whenever an eligible human is available.
 */
object MatchmakingPolicy {
    enum class Skill { BASIC, INTERMEDIATE, ADVANCED }
    enum class Room { BASIC, INTERMEDIATE, ADVANCED, GENERAL }
    enum class OpponentKind { REAL, AI }

    data class OpponentLabel(val kind: OpponentKind, val skill: Skill?) {
        val display: String
            get() = when (kind) {
                OpponentKind.REAL -> "R"
                OpponentKind.AI -> when (requireNotNull(skill)) {
                    Skill.BASIC -> "IA-B"
                    Skill.INTERMEDIATE -> "IA-I"
                    Skill.ADVANCED -> "IA-A"
                }
            }
    }

    data class AiCapacity(val basic: Int, val intermediate: Int, val advanced: Int) {
        val total: Int get() = basic + intermediate + advanced
    }

    data class Progress(
        val completedMatches: Int,
        val basicTitles: Int,
        val basicSemifinals: Int
    )

    /** Capacity is elastic: at most one AI slot per active real player. */
    fun aiCapacity(activeRealPlayers: Int): AiCapacity {
        require(activeRealPlayers >= 0)
        val basic = activeRealPlayers * 20 / 100
        val intermediate = activeRealPlayers * 40 / 100
        val advanced = activeRealPlayers - basic - intermediate
        return AiCapacity(basic, intermediate, advanced)
    }

    fun roomAllows(room: Room, skill: Skill, completedMatches: Int): Boolean = when (room) {
        Room.BASIC -> skill == Skill.BASIC && completedMatches < 6
        Room.INTERMEDIATE -> skill == Skill.INTERMEDIATE
        Room.ADVANCED -> skill == Skill.ADVANCED
        Room.GENERAL -> true
    }

    /**
     * Promotion from Basic to Intermediate is objective and auditable:
     * 15 completed matches AND either 3 Basic titles OR 3 Basic semifinals.
     */
    fun qualifiesForIntermediate(progress: Progress): Boolean =
        progress.completedMatches >= 15 &&
            (progress.basicTitles >= 3 || progress.basicSemifinals >= 3)

    /** Advanced rooms may only be supplemented by Advanced AI. */
    fun allowedAiSkills(room: Room): Set<Skill> = when (room) {
        Room.ADVANCED -> setOf(Skill.ADVANCED)
        Room.BASIC -> setOf(Skill.BASIC, Skill.INTERMEDIATE)
        Room.INTERMEDIATE -> setOf(Skill.BASIC, Skill.INTERMEDIATE)
        Room.GENERAL -> Skill.entries.toSet()
    }

    /** Human-first invariant: AI is considered only when no eligible human exists. */
    fun chooseOpponentKind(eligibleHumanAvailable: Boolean): OpponentKind =
        if (eligibleHumanAvailable) OpponentKind.REAL else OpponentKind.AI
}
