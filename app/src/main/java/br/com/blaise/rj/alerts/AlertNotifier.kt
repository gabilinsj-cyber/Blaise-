package br.com.blaise.rj.alerts

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import br.com.blaise.rj.core.AlertNotificationPolicy
import br.com.blaise.rj.core.Entitlement
import br.com.blaise.rj.core.OfficialAlert
import br.com.blaise.rj.core.Severity

class AlertNotifier(private val context: Context) {
    companion object {
        const val P0_CHANNEL_ID = "blaise_p0"
        const val GENERAL_CHANNEL_ID = "blaise_alerts"
    }

    fun notify(alert: OfficialAlert, entitlement: Entitlement): Boolean {
        val decision = AlertNotificationPolicy.decide(alert, entitlement)
        if (!decision.deliver) return false
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        val urgent = alert.severity == Severity.P0 || alert.severity == Severity.RED
        val channelId = if (urgent) P0_CHANNEL_ID else GENERAL_CHANNEL_ID
        val channelName = if (urgent) "Alertas oficiais P0" else "Alertas Blaise"
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                channelId,
                channelName,
                if (urgent) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT,
            ),
        )

        val notification = Notification.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(alert.title)
            .setContentText("${alert.source} • ${alert.city?.name ?: "Estado do RJ"}")
            .setCategory(if (urgent) Notification.CATEGORY_ALARM else Notification.CATEGORY_EVENT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .apply {
                if (urgent) {
                    setPriority(Notification.PRIORITY_MAX)
                    setDefaults(Notification.DEFAULT_ALL)
                }
            }
            .build()

        manager.notify(alert.id.hashCode(), notification)
        return true
    }
}
