package com.blaise.opentennis

import android.os.SystemClock
import kotlin.math.abs

/**
 * Privacy-safe, in-memory competitive diagnostics.
 * No identifiers, voice, location or raw input coordinates are retained.
 * Metrics are evidence only: a single weak anti-cheat signal can never punish a player.
 */
data class CompetitiveSnapshot(
    val frames: Long,
    val slowFrames: Long,
    val maxFrameMs: Double,
    val inputSamples: Long,
    val maxInputToDrawMs: Double,
    val networkSamples: Long,
    val lastRttMs: Long,
    val serverErrors: Long,
    val tickSamples: Long,
    val maxTickDrift: Long,
    val physicsViolations: Long,
    val weakRiskSignals: Int,
    val strongRiskSignals: Int,
) {
    val punishmentAuthorized: Boolean = false
}

class CompetitiveTelemetry {
    private var lastFrameNs = 0L
    private var frames = 0L
    private var slowFrames = 0L
    private var maxFrameNs = 0L
    private var lastInputNs = 0L
    private var inputSamples = 0L
    private var maxInputToDrawNs = 0L
    private var networkSamples = 0L
    private var lastRttMs = -1L
    private var serverErrors = 0L
    private var tickSamples = 0L
    private var maxTickDrift = 0L
    private var physicsViolations = 0L
    private var weakRiskSignals = 0
    private var strongRiskSignals = 0

    fun onInput(nowNs: Long = SystemClock.elapsedRealtimeNanos()) {
        lastInputNs = nowNs
    }

    fun onDraw(nowNs: Long = SystemClock.elapsedRealtimeNanos()) {
        if (lastFrameNs != 0L) {
            val delta = (nowNs - lastFrameNs).coerceAtLeast(0L)
            frames++
            if (delta > 33_333_334L) slowFrames++
            if (delta > maxFrameNs) maxFrameNs = delta
        }
        lastFrameNs = nowNs
        if (lastInputNs != 0L && nowNs >= lastInputNs) {
            val latency = nowNs - lastInputNs
            inputSamples++
            if (latency > maxInputToDrawNs) maxInputToDrawNs = latency
            lastInputNs = 0L
        }
    }

    fun onNetworkSample(rttMs: Long, serverError: Boolean = false) {
        if (rttMs >= 0L) {
            networkSamples++
            lastRttMs = rttMs
        }
        if (serverError) serverErrors++
    }

    fun onAuthoritativeTick(localTick: Long, authoritativeTick: Long) {
        tickSamples++
        val drift = abs(localTick - authoritativeTick)
        if (drift > maxTickDrift) maxTickDrift = drift
    }

    fun onPhysicsInvariant(valid: Boolean) {
        if (!valid) physicsViolations++
    }

    fun onRiskSignal(strong: Boolean) {
        if (strong) strongRiskSignals++ else weakRiskSignals++
    }

    fun snapshot(): CompetitiveSnapshot = CompetitiveSnapshot(
        frames = frames,
        slowFrames = slowFrames,
        maxFrameMs = maxFrameNs / 1_000_000.0,
        inputSamples = inputSamples,
        maxInputToDrawMs = maxInputToDrawNs / 1_000_000.0,
        networkSamples = networkSamples,
        lastRttMs = lastRttMs,
        serverErrors = serverErrors,
        tickSamples = tickSamples,
        maxTickDrift = maxTickDrift,
        physicsViolations = physicsViolations,
        weakRiskSignals = weakRiskSignals,
        strongRiskSignals = strongRiskSignals,
    )
}
