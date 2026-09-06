package br.com.blaise.rj.push

import br.com.blaise.rj.alerts.AlertNotifier
import br.com.blaise.rj.core.Entitlement
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.time.Instant

class BlaiseMessagingService : FirebaseMessagingService() {
    companion object {
        const val P0_TOPIC = "blaise-rj-p0"
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val alert = P0PushParser.parse(message.data, Instant.now()) ?: return
        AlertNotifier(this).notify(alert, Entitlement(active = false))
    }

    override fun onNewToken(token: String) {
        if (!FirebaseBootstrap.isConfigured()) return
        runCatching {
            FirebaseMessaging.getInstance().subscribeToTopic(P0_TOPIC)
        }
    }
}
