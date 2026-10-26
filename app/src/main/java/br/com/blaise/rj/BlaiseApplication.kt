package br.com.blaise.rj

import android.app.Application
import br.com.blaise.rj.push.BlaiseMessagingService
import br.com.blaise.rj.push.FirebaseBootstrap
import br.com.blaise.rj.storage.StorageMaintenance
import com.google.firebase.messaging.FirebaseMessaging

class BlaiseApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Cache is disposable: trim it in a background thread so startup stays responsive
        // and persistent user/application state is never touched.
        StorageMaintenance.schedule(applicationContext)

        if (FirebaseBootstrap.initialize(this)) {
            runCatching {
                FirebaseMessaging.getInstance().subscribeToTopic(BlaiseMessagingService.P0_TOPIC)
            }
        }
    }
}
