package br.com.blaise.rj.push

import br.com.blaise.rj.alerts.AlertNotifier
import br.com.blaise.rj.cities.CitySelectionStore
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
        val now = Instant.now()
        val alert = P0PushParser.parse(message.data, now) ?: return
        val cityStore = CitySelectionStore(this)
        val selectedCities = listOf(cityStore.load(1), cityStore.load(2))
        if (!P0DeliveryPolicy.shouldDeliver(alert, selectedCities)) return

        val firstDelivery = runCatching { P0ReplayStore(this).accept(alert.id, now) }
            .getOrDefault(true)
        if (!firstDelivery) return

        AlertNotifier(this).notify(alert, Entitlement(active = false))
    }

    override fun onNewToken(token: String) {
        if (!FirebaseBootstrap.isConfigured()) return
        runCatching {
            FirebaseMessaging.getInstance().subscribeToTopic(P0_TOPIC)
        }
    }
}
