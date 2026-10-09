package br.com.blaise.rj.billing

import br.com.blaise.rj.BuildConfig
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import java.util.concurrent.TimeUnit

/**
 * Access to the persistent Firebase Auth session for paid purchases.
 * Call authorizationHeader() only from a network worker, never from the UI thread.
 * The server independently verifies every returned ID token.
 */
object FirebaseSubscriberAccess {
    fun authenticatedUser(): FirebaseUser? {
        if (!BuildConfig.BLAISE_SUBSCRIBER_AUTH_ENABLED) return null
        val user = runCatching { FirebaseAuth.getInstance().currentUser }.getOrNull()
        return user?.takeIf { it.isEmailVerified && !it.isAnonymous }
    }

    fun obfuscatedAccountId(): String? =
        authenticatedUser()?.uid?.let(PlayAccountBindingPolicy::obfuscatedAccountIdForAuthenticatedUid)

    fun authorizationHeader(): String? {
        val user = authenticatedUser() ?: return null
        // Firebase refreshes ID tokens when needed; never persist them to disk/logs.
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) return null
        val result = runCatching {
            Tasks.await(user.getIdToken(false), 7, TimeUnit.SECONDS).token
        }.getOrNull() ?: return null
        return result.takeIf { it.isNotBlank() && it.length < 12_000 }?.let { "Bearer $it" }
    }
}
