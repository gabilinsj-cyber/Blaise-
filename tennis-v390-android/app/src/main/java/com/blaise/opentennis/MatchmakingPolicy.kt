package com.blaise.opentennis

/**
 * Server-friendly matchmaking/progression policy for Blaise Open Tennis.
 * AI opponents are always disclosed and never impersonate human players.
 * Eligible real players always have priority over AI.
 */
object MatchmakingPolicy {
    enum class Skill { BASIC, INTERMEDIATE, ADVANCED }
    enum class Room { BASIC, INTERMEDIATE, ADVANCED, GENERAL, PRIVATE }
    enum class OpponentKind { REAL, AI }

    data class OpponentLabel(
        val kind: OpponentKind,
        val skill: Skill?,
        val publicId: String? = null,
        val displayName: String? = null,
    ) {
        val prefix: String
            get() = when (kind) {
                OpponentKind.REAL -> "R"
                OpponentKind.AI -> when (requireNotNull(skill)) {
                    Skill.BASIC -> "IA-B"
                    Skill.INTERMEDIATE -> "IA-I"
                    Skill.ADVANCED -> "IA-A"
                }
            }

        /** Header shown above the court, beside the opponent public ID. */
        val display: String
            get() = buildString {
                append(prefix)
                if (!publicId.isNullOrBlank()) append(" • ID ").append(publicId)
                if (!displayName.isNullOrBlank()) append(" • ").append(displayName)
            }
    }

    data class AiCapacity(val basic: Int, val intermediate: Int, val advanced: Int) {
        val total: Int get() = basic + intermediate + advanced
    }

    data class Progress(
        val completedMatches: Int,
        val basicTitles: Int,
        val basicSemifinals: Int,
        val grandSlamTitles: Int = 0,
    )

    /**
     * Elastic 1:1 capacity: one available AI slot per active real player.
     * Distribution target is 20% Basic, 40% Intermediate, 40% Advanced.
     * Largest-remainder apportionment preserves the exact total for every population size.
     */
    fun aiCapacity(activeRealPlayers: Int): AiCapacity {
        require(activeRealPlayers >= 0)
        if (activeRealPlayers == 0) return AiCapacity(0, 0, 0)

        val weights = intArrayOf(20, 40, 40)
        val floors = IntArray(3) { index -> activeRealPlayers * weights[index] / 100 }
        val remainders = IntArray(3) { index -> activeRealPlayers * weights[index] % 100 }
        var missing = activeRealPlayers - floors.sum()

        // Stable tie order keeps allocation deterministic: Basic, Intermediate, Advanced.
        val order = listOf(0, 1, 2).sortedWith(compareByDescending<Int> { remainders[it] }.thenBy { it })
        var cursor = 0
        while (missing > 0) {
            floors[order[cursor % order.size]] += 1
            missing -= 1
            cursor += 1
        }
        return AiCapacity(floors[0], floors[1], floors[2])
    }

    fun roomAllows(room: Room, skill: Skill, completedMatches: Int): Boolean = when (room) {
        Room.BASIC -> skill == Skill.BASIC && completedMatches < 6
        Room.INTERMEDIATE -> skill == Skill.INTERMEDIATE
        Room.ADVANCED -> skill == Skill.ADVANCED
        Room.GENERAL -> true
        Room.PRIVATE -> true // exact real-player invite rules are enforced by PrivateDuelSecurity.
    }

    /**
     * Basic -> Intermediate:
     * at least 15 completed matches AND either 3 Basic tournament titles,
     * or at least one Basic semifinal as the alternate achievement route.
     */
    fun qualifiesForIntermediate(progress: Progress): Boolean =
        progress.completedMatches >= 15 &&
            (progress.basicTitles >= 3 || progress.basicSemifinals >= 1)

    /** Intermediate -> Advanced: at least 30 completed matches + >=1 Grand Slam title. */
    fun qualifiesForAdvanced(progress: Progress): Boolean =
        progress.completedMatches >= 30 && progress.grandSlamTitles >= 1

    fun promotedSkill(current: Skill, progress: Progress): Skill = when (current) {
        Skill.BASIC -> if (qualifiesForIntermediate(progress)) Skill.INTERMEDIATE else Skill.BASIC
        Skill.INTERMEDIATE -> if (qualifiesForAdvanced(progress)) Skill.ADVANCED else Skill.INTERMEDIATE
        Skill.ADVANCED -> Skill.ADVANCED
    }

    /**
     * AI fallback by room. Basic and Intermediate rooms randomly select only B/I AI.
     * Advanced rooms supplement with Advanced AI only. General may use any AI tier.
     * Private rooms never use AI.
     */
    fun allowedAiSkills(room: Room): Set<Skill> = when (room) {
        Room.ADVANCED -> setOf(Skill.ADVANCED)
        Room.BASIC, Room.INTERMEDIATE -> setOf(Skill.BASIC, Skill.INTERMEDIATE)
        Room.GENERAL -> Skill.entries.toSet()
        Room.PRIVATE -> emptySet()
    }

    /**
     * Server supplies randomIndex from its secure matchmaking RNG.
     * Basic/Intermediate rooms therefore get a random B/I AI; Advanced gets A only.
     */
    fun chooseAiSkill(room: Room, randomIndex: Int): Skill {
        require(randomIndex >= 0)
        val eligible = allowedAiSkills(room).toList().sortedBy { it.ordinal }
        require(eligible.isNotEmpty()) { "AI is forbidden in private rooms" }
        return eligible[randomIndex % eligible.size]
    }

    /** Human-first invariant: AI is considered only when no eligible human exists. */
    fun chooseOpponentKind(eligibleHumanAvailable: Boolean, room: Room = Room.GENERAL): OpponentKind {
        if (eligibleHumanAvailable) return OpponentKind.REAL
        require(room != Room.PRIVATE) { "Private rooms require a real invited player" }
        return OpponentKind.AI
    }

    /** Ranking points do not distinguish Basic/Intermediate/Advanced tiers. */
    fun rankingMultiplier(skill: Skill): Double = 1.0
}
