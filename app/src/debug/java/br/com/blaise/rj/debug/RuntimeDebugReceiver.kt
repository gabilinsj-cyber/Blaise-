package br.com.blaise.rj.debug

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.com.blaise.rj.alerts.AlertNotifier
import br.com.blaise.rj.core.Entitlement
import br.com.blaise.rj.core.OfficialAlert
import br.com.blaise.rj.core.Severity
import java.time.Instant

class RuntimeDebugReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_RUNTIME_P0) return
        val now = Instant.now()
        val alert = OfficialAlert(
            id = "runtime-p0",
            city = null,
            title = intent.getStringExtra("title") ?: "BLAISE P0 TEST",
            source = "Defesa Civil • Runtime",
            severity = Severity.P0,
            issuedAt = now,
            expiresAt = now.plusSeconds(600),
        )
        val delivered = AlertNotifier(context).notify(alert, Entitlement(active = false))
        setResultCode(if (delivered) Activity.RESULT_OK else Activity.RESULT_CANCELED)
    }

    companion object {
        const val ACTION_RUNTIME_P0 = "br.com.blaise.rj.debug.RUNTIME_P0"
    }
}
