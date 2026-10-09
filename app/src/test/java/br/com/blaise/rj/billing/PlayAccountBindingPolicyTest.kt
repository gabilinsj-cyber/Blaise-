package br.com.blaise.rj.billing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlayAccountBindingPolicyTest {
    @Test
    fun matchesBackendSha256ReferenceVector() {
        assertEquals(
            "823efa41574067e32b6c596a8687b985b33c21ce52d71996f8a306f62bac9685",
            PlayAccountBindingPolicy.obfuscatedAccountIdForAuthenticatedUid("uid-123"),
        )
    }

    @Test
    fun differentUidsNeverShareTheSameExpectedIdentifier() {
        assertNotEquals(
            PlayAccountBindingPolicy.obfuscatedAccountIdForAuthenticatedUid("uid-123"),
            PlayAccountBindingPolicy.obfuscatedAccountIdForAuthenticatedUid("uid-124"),
        )
    }

    @Test
    fun rejectsEmailBlankAndUnsafeIdentifiers() {
        for (candidate in listOf("", " ", "person@example.com", "\nuid-123", "é", "a".repeat(129))) {
            assertNull(PlayAccountBindingPolicy.obfuscatedAccountIdForAuthenticatedUid(candidate))
        }
    }
}
