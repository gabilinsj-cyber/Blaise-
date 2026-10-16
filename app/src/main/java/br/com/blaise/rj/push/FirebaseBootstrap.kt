package br.com.blaise.rj.push

import android.content.Context
import br.com.blaise.rj.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

data class FirebaseRuntimeConfig(
    val applicationId: String,
    val apiKey: String,
    val projectId: String,
    val senderId: String,
)

object FirebaseBootstrap {
    fun currentConfig(): FirebaseRuntimeConfig = FirebaseRuntimeConfig(
        applicationId = BuildConfig.BLAISE_FIREBASE_APPLICATION_ID.trim(),
        apiKey = BuildConfig.BLAISE_FIREBASE_API_KEY.trim(),
        projectId = BuildConfig.BLAISE_FIREBASE_PROJECT_ID.trim(),
        senderId = BuildConfig.BLAISE_FIREBASE_SENDER_ID.trim(),
    )

    fun isConfigured(config: FirebaseRuntimeConfig = currentConfig()): Boolean =
        listOf(config.applicationId, config.apiKey, config.projectId, config.senderId).all { it.isNotBlank() }

    fun initialize(context: Context): Boolean {
        val config = currentConfig()
        if (!isConfigured(config)) return false
        if (FirebaseApp.getApps(context).any { it.name == FirebaseApp.DEFAULT_APP_NAME }) return true

        return runCatching {
            val options = FirebaseOptions.Builder()
                .setApplicationId(config.applicationId)
                .setApiKey(config.apiKey)
                .setProjectId(config.projectId)
                .setGcmSenderId(config.senderId)
                .build()
            FirebaseApp.initializeApp(context, options)
            true
        }.getOrDefault(false)
    }
}
