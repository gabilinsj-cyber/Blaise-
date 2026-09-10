package com.blaise.opentennis

import android.app.Activity
import android.os.Bundle
import android.view.WindowInsets
import android.view.WindowInsetsController

class MainActivity : Activity() {
    private lateinit var gameView: TennisGameView
    private var authoritativeBridge: AuthoritativeMatchEventBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setDecorFitsSystemWindows(false)
        window.insetsController?.let { controller ->
            controller.hide(WindowInsets.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        gameView = TennisGameView(this)
        setContentView(gameView)
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
