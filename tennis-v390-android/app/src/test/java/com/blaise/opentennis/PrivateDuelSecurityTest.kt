package com.blaise.opentennis

import org.junit.Assert.*
import org.junit.Test

class PrivateDuelSecurityTest {
    private fun real(id: String, name: String) = PrivateDuelSecurity.PlayerRef(id, name, true)

    private fun invite(
        inviteId: String = "invite-1",
        inviter: PrivateDuelSecurity.PlayerRef = real("R100", "Alice"),
        invitee: PrivateDuelSecurity.PlayerRef = real("R200", "Bruno"),
    ) = PrivateDuelSecurity.Invite(
        inviteId = inviteId,
        inviter = inviter,
        invitee = invitee,
        issuedAtEpochMs = 1_000L,
        expiresAtEpochMs = 61_000L,
        serverNonce = "0123456789abcdef",
    )

    @Test fun validInviteReturnsExactAcceptedText() {
        val decision = PrivateDuelSecurity.validateInvite(invite(), "R200", "Bruno", 2_000L, emptySet())
        assertEquals(PrivateDuelSecurity.Decision.Accepted("ok accepted"), decision)
    }

    @Test fun rejectsAiPrivateOpponent() {
        val ai = PrivateDuelSecurity.PlayerRef("AI-1", "CPU", false)
        val decision = PrivateDuelSecurity.validateInvite(invite(invitee = ai), "AI-1", "CPU", 2_000L, emptySet())
        assertEquals(PrivateDuelSecurity.Decision.Rejected("REAL_PLAYERS_ONLY"), decision)
    }

    @Test fun rejectsNameOrIdMismatch() {
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("RECIPIENT_MISMATCH"),
            PrivateDuelSecurity.validateInvite(invite(), "R999", "Bruno", 2_000L, emptySet()),
        )
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("NAME_ID_MISMATCH"),
            PrivateDuelSecurity.validateInvite(invite(), "R200", "Outro", 2_000L, emptySet()),
        )
    }

    @Test fun rejectsReplayAndExpiry() {
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("INVITE_REPLAYED"),
            PrivateDuelSecurity.validateInvite(invite(), "R200", "Bruno", 2_000L, setOf("invite-1")),
        )
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("INVITE_EXPIRED"),
            PrivateDuelSecurity.validateInvite(invite(), "R200", "Bruno", 61_000L, emptySet()),
        )
    }

    @Test fun rejectsSelfInviteAndMalformedNonce() {
        val same = real("R100", "Alice")
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("SELF_INVITE_BLOCKED"),
            PrivateDuelSecurity.validateInvite(invite(invitee = same), "R100", "Alice", 2_000L, emptySet()),
        )
        val malformed = invite().copy(serverNonce = "short")
        assertEquals(
            PrivateDuelSecurity.Decision.Rejected("MALFORMED_INVITE"),
            PrivateDuelSecurity.validateInvite(malformed, "R200", "Bruno", 2_000L, emptySet()),
        )
    }
}
