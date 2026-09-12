package com.blaise.opentennis

import org.junit.Assert.*
import org.junit.Test

class MatchmakingPolicyTest {
    @Test fun humanAlwaysHasPriority() {
        assertEquals(MatchmakingPolicy.OpponentKind.REAL, MatchmakingPolicy.chooseOpponentKind(true))
        assertEquals(MatchmakingPolicy.OpponentKind.AI, MatchmakingPolicy.chooseOpponentKind(false))
    }

    @Test fun aiIsAlwaysExplicitlyIdentified() {
        assertEquals("R", MatchmakingPolicy.OpponentLabel(MatchmakingPolicy.OpponentKind.REAL, null).display)
        assertEquals("IA-B", MatchmakingPolicy.OpponentLabel(MatchmakingPolicy.OpponentKind.AI, MatchmakingPolicy.Skill.BASIC).display)
        assertEquals("IA-I", MatchmakingPolicy.OpponentLabel(MatchmakingPolicy.OpponentKind.AI, MatchmakingPolicy.Skill.INTERMEDIATE).display)
        assertEquals("IA-A", MatchmakingPolicy.OpponentLabel(MatchmakingPolicy.OpponentKind.AI, MatchmakingPolicy.Skill.ADVANCED).display)
    }

    @Test fun capacityTracksRealPlayersAndPreservesTotal() {
        val c25 = MatchmakingPolicy.aiCapacity(25)
        assertEquals(25, c25.total)
        assertEquals(5, c25.basic)
        assertEquals(10, c25.intermediate)
        assertEquals(10, c25.advanced)
        assertEquals(18, MatchmakingPolicy.aiCapacity(18).total)
    }

    @Test fun advancedRoomOnlyUsesAdvancedAi() {
        assertEquals(setOf(MatchmakingPolicy.Skill.ADVANCED), MatchmakingPolicy.allowedAiSkills(MatchmakingPolicy.Room.ADVANCED))
    }

    @Test fun roomsAreSkillLocked() {
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.BASIC, MatchmakingPolicy.Skill.BASIC, 5))
        assertFalse(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.BASIC, MatchmakingPolicy.Skill.BASIC, 6))
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.INTERMEDIATE, MatchmakingPolicy.Skill.INTERMEDIATE, 20))
        assertFalse(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.INTERMEDIATE, MatchmakingPolicy.Skill.ADVANCED, 20))
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.ADVANCED, MatchmakingPolicy.Skill.ADVANCED, 20))
    }

    @Test fun basicPromotionRequiresExperienceAndAchievement() {
        assertTrue(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 3, 0)))
        assertTrue(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 0, 3)))
        assertFalse(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(14, 3, 3)))
        assertFalse(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 0, 2)))
    }
}
