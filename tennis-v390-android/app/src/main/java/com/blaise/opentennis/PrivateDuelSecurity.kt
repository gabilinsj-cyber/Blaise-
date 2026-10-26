package com.blaise.opentennis

/**
 * Client/domain guard for private duels. The backend remains authoritative and must
 * validate the same bindings server-side before creating a room.
 */
object PrivateDuelSecurity {
    const val ACCEPTED_TEXT = "ok accepted"

    data class PlayerRef(val publicId: String, val displayName: String, val isReal: Boolean)

    data class Invite(
        val inviteId: String,
        val inviter: PlayerRef,
        val invitee: PlayerRef,
        val issuedAtEpochMs: Long,
        val expiresAtEpochMs: Long,
        val serverNonce: String,
    )

    sealed class Decision {
        data class Accepted(val text: String = ACCEPTED_TEXT) : Decision()
        data class Rejected(val reason: String) : Decision()
    }

    /**
     * Extra fail-closed layer against malformed/replayed/forged private-room requests.
     * This is not a substitute for server authentication/signatures; it is a local
     * invariant layer that mirrors server rules and refuses impossible states early.
     */
    fun validateInvite(
        invite: Invite,
        authenticatedInviteeId: String,
        typedInviteeName: String,
        nowEpochMs: Long,
        alreadyConsumedInviteIds: Set<String>,
    ): Decision {
        if (!invite.inviter.isReal || !invite.invitee.isReal) return Decision.Rejected("REAL_PLAYERS_ONLY")
        if (invite.inviteId.isBlank() || invite.serverNonce.length < 16) return Decision.Rejected("MALFORMED_INVITE")
        if (invite.inviter.publicId == invite.invitee.publicId) return Decision.Rejected("SELF_INVITE_BLOCKED")
        if (authenticatedInviteeId != invite.invitee.publicId) return Decision.Rejected("RECIPIENT_MISMATCH")
        if (!typedInviteeName.trim().equals(invite.invitee.displayName.trim(), ignoreCase = true)) {
            return Decision.Rejected("NAME_ID_MISMATCH")
        }
        if (nowEpochMs < invite.issuedAtEpochMs || nowEpochMs >= invite.expiresAtEpochMs) {
            return Decision.Rejected("INVITE_EXPIRED")
        }
        if (invite.inviteId in alreadyConsumedInviteIds) return Decision.Rejected("INVITE_REPLAYED")
        return Decision.Accepted()
    }
}
