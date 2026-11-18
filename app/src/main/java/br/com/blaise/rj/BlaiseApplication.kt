package br.com.blaise.rj

import android.app.Application
import br.com.blaise.rj.push.BlaiseMessagingService
import br.com.blaise.rj.push.FirebaseBootstrap
import com.google.firebase.messaging.FirebaseMessaging

class BlaiseApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (FirebaseBootstrap.initialize(this)) {
            // Admin APK authenticates against Firebase but must never enroll
            // itself as a customer P0 push subscriber on startup.
            if (packageName == "br.com.blaise.rj.admin") return
            runCatching {
                FirebaseMessaging.getInstance().subscribeToTopic(BlaiseMessagingService.P0_TOPIC)
            }
        }
    }
}
