package com.blaise.opentennis

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController

class MainActivity : Activity() {
    private lateinit var gameView: TennisGameView
    private var authoritativeBridge: AuthoritativeMatchEventBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        }

        gameView = TennisGameView(this)
        setContentView(gameView)

        // Configure immersive mode only after the DecorView is attached. API 30+
        // uses WindowInsets; Android 8-10 retains the compatible legacy flags.
        window.decorView.post {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.let { controller ->
                    controller.hide(WindowInsets.Type.systemBars())
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility =
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                        View.SYSTEM_UI_FLAG_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            }
        }
    }

    /** Called only after an authenticated competitive session binds its server match id. */
    fun bindAuthoritativeMatch(matchId: String) {
        require(matchId.isNotBlank())
        authoritativeBridge = AuthoritativeMatchEventBridge(matchId, gameView)
    }

    /** Transport ingress. There is deliberately no local/UI path that fabricates this event. */
    fun onAuthoritativeServerEnvelope(envelope: AuthoritativeMatchEventBridge.ServerEnvelope): Boolean {
        return authoritativeBridge?.accept(envelope) ?: false
    }
}
