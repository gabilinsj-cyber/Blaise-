package com.blaise.opentennis

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.FrameLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var gameView: TennisGameView
    private lateinit var opponentBanner: TextView
    private lateinit var networkBanner: TextView
    private var authoritativeBridge: AuthoritativeMatchEventBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        }

        val root = FrameLayout(this)
        gameView = TennisGameView(this)
        root.addView(
            gameView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ),
        )

        opponentBanner = TextView(this).apply {
            text = "ADVERSÁRIO • aguardando pareamento"
            setTextColor(Color.WHITE)
            setBackgroundColor(0xAA07172D.toInt())
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(18, 8, 18, 8)
        }
        root.addView(
            opponentBanner,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ).apply { topMargin = 8 },
        )

        networkBanner = TextView(this).apply {
            text = ""
            visibility = View.GONE
            setTextColor(Color.WHITE)
            setBackgroundColor(0xCC9A5A00.toInt())
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(16, 6, 16, 6)
        }
        root.addView(
            networkBanner,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ).apply { topMargin = 52 },
        )

        setContentView(root)

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

    /** Explicitly identifies a real or AI opponent above the court. */
    fun setOpponentIdentity(label: MatchmakingPolicy.OpponentLabel) {
        opponentBanner.text = "ADVERSÁRIO • ${label.display}"
    }

    /** Shows only degraded/bad/disconnected notices; healthy links stay unobtrusive. */
    fun updateNetworkNotice(notice: MatchNetworkHealth.Notice) {
        if (notice.quality == MatchNetworkHealth.Quality.GOOD) {
            networkBanner.text = ""
            networkBanner.visibility = View.GONE
        } else {
            networkBanner.text = notice.text
            networkBanner.visibility = View.VISIBLE
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
