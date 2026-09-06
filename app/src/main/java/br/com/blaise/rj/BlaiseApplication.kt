package br.com.blaise.rj

import android.app.Application
import br.com.blaise.rj.push.BlaiseMessagingService
import br.com.blaise.rj.push.FirebaseBootstrap
import com.google.firebase.messaging.FirebaseMessaging

class BlaiseApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (FirebaseBootstrap.initialize(this)) {
            runCatching {
                FirebaseMessaging.getInstance().subscribeToTopic(BlaiseMessagingService.P0_TOPIC)
            }
        }
    }
}
