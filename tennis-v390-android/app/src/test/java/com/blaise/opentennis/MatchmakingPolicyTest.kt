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
        assertEquals("R • ID 1234 • Ana", MatchmakingPolicy.OpponentLabel(MatchmakingPolicy.OpponentKind.REAL, null, "1234", "Ana").display)
    }

    @Test fun capacityTracksRealPlayersAndPreservesExactTotal() {
        val c25 = MatchmakingPolicy.aiCapacity(25)
        assertEquals(25, c25.total)
        assertEquals(5, c25.basic)
        assertEquals(10, c25.intermediate)
        assertEquals(10, c25.advanced)

        val c18 = MatchmakingPolicy.aiCapacity(18)
        assertEquals(18, c18.total)
        assertEquals(4, c18.basic)
        assertEquals(7, c18.intermediate)
        assertEquals(7, c18.advanced)
    }

    @Test fun advancedRoomOnlyUsesAdvancedAi() {
        assertEquals(setOf(MatchmakingPolicy.Skill.ADVANCED), MatchmakingPolicy.allowedAiSkills(MatchmakingPolicy.Room.ADVANCED))
        assertEquals(MatchmakingPolicy.Skill.ADVANCED, MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.ADVANCED, 99))
    }

    @Test fun basicAndIntermediateAiFallbackRandomizesBetweenBasicAndIntermediate() {
        val expected = setOf(MatchmakingPolicy.Skill.BASIC, MatchmakingPolicy.Skill.INTERMEDIATE)
        assertEquals(expected, MatchmakingPolicy.allowedAiSkills(MatchmakingPolicy.Room.BASIC))
        assertEquals(expected, MatchmakingPolicy.allowedAiSkills(MatchmakingPolicy.Room.INTERMEDIATE))
        assertEquals(MatchmakingPolicy.Skill.BASIC, MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.BASIC, 0))
        assertEquals(MatchmakingPolicy.Skill.INTERMEDIATE, MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.BASIC, 1))
        assertEquals(MatchmakingPolicy.Skill.BASIC, MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.INTERMEDIATE, 2))
        assertEquals(MatchmakingPolicy.Skill.INTERMEDIATE, MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.INTERMEDIATE, 3))
    }

    @Test fun privateRoomNeverUsesAi() {
        assertTrue(MatchmakingPolicy.allowedAiSkills(MatchmakingPolicy.Room.PRIVATE).isEmpty())
        try {
            MatchmakingPolicy.chooseOpponentKind(false, MatchmakingPolicy.Room.PRIVATE)
            fail("Private room must not create AI opponent")
        } catch (_: IllegalArgumentException) {
            // expected
        }
        try {
            MatchmakingPolicy.chooseAiSkill(MatchmakingPolicy.Room.PRIVATE, 0)
            fail("Private room must not select AI tier")
        } catch (_: IllegalArgumentException) {
            // expected
        }
    }

    @Test fun roomsAreSkillLocked() {
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.BASIC, MatchmakingPolicy.Skill.BASIC, 5))
        assertFalse(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.BASIC, MatchmakingPolicy.Skill.BASIC, 6))
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.INTERMEDIATE, MatchmakingPolicy.Skill.INTERMEDIATE, 20))
        assertFalse(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.INTERMEDIATE, MatchmakingPolicy.Skill.ADVANCED, 20))
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.ADVANCED, MatchmakingPolicy.Skill.ADVANCED, 30))
        assertTrue(MatchmakingPolicy.roomAllows(MatchmakingPolicy.Room.GENERAL, MatchmakingPolicy.Skill.BASIC, 2))
    }

    @Test fun basicPromotionRequiresExperienceAndAchievement() {
        assertTrue(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 3, 0)))
        assertTrue(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 0, 1)))
        assertTrue(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 1, 4)))
        assertFalse(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(14, 3, 1)))
        assertFalse(MatchmakingPolicy.qualifiesForIntermediate(MatchmakingPolicy.Progress(15, 2, 0)))
    }

    @Test fun advancedPromotionRequiresThirtyMatchesAndGrandSlamTitle() {
        assertTrue(MatchmakingPolicy.qualifiesForAdvanced(MatchmakingPolicy.Progress(30, 0, 0, 1)))
        assertFalse(MatchmakingPolicy.qualifiesForAdvanced(MatchmakingPolicy.Progress(29, 0, 0, 2)))
        assertFalse(MatchmakingPolicy.qualifiesForAdvanced(MatchmakingPolicy.Progress(40, 0, 0, 0)))
    }

    @Test fun rankingHasNoTierMultiplier() {
        MatchmakingPolicy.Skill.entries.forEach { assertEquals(1.0, MatchmakingPolicy.rankingMultiplier(it), 0.0) }
    }
}
