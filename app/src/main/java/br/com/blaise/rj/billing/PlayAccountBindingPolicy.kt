package br.com.blaise.rj.billing

import java.security.MessageDigest

/**
 * Preparation only: do not call with a claimed client UID.
 * When sign-in exists, obtain this UID from the authenticated Firebase user,
 * send their Firebase ID token to the backend, and have the backend validate
 * it independently before comparing Play subscription account attribution.
 */
object PlayAccountBindingPolicy {
    private const val SCOPE = "blaise-v6-rj:google-play:account:v1:"
    private const val HEX = "0123456789abcdef"
    private val safeUid = Regex("^[A-Za-z0-9._~:-]{1,128}$")

    fun obfuscatedAccountIdForAuthenticatedUid(uid: String): String? {
        if (!safeUid.matches(uid)) return null
        val digest = MessageDigest.getInstance("SHA-256")
            .digest((SCOPE + uid).toByteArray(Charsets.UTF_8))
        return buildString(digest.size * 2) {
            for (byte in digest) {
                val value = byte.toInt() and 0xff
                append(HEX[value ushr 4])
                append(HEX[value and 0x0f])
            }
        }
    }
}
