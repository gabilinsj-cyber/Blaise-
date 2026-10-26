package com.blaise.opentennis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CompetitiveTelemetryTest {
    @Test
    fun frameAndInputMathIsDeterministic() {
        val telemetry = CompetitiveTelemetry()
        telemetry.onDraw(1_000_000_000L)
        telemetry.onInput(1_010_000_000L)
        telemetry.onDraw(1_020_000_000L)
        telemetry.onDraw(1_060_000_000L)

        val snapshot = telemetry.snapshot()
        assertEquals(2L, snapshot.frames)
        assertEquals(1L, snapshot.slowFrames)
        assertEquals(40.0, snapshot.maxFrameMs, 0.0001)
        assertEquals(1L, snapshot.inputSamples)
        assertEquals(10.0, snapshot.maxInputToDrawMs, 0.0001)
    }

    @Test
    fun syntheticNetworkSampleCountsWithoutClaimingRealPerformance() {
        val telemetry = CompetitiveTelemetry()
        telemetry.onNetworkSample(42L, serverError = false)
        telemetry.onNetworkSample(-1L, serverError = true)

        val snapshot = telemetry.snapshot()
        assertEquals(1L, snapshot.networkSamples)
        assertEquals(42L, snapshot.lastRttMs)
        assertEquals(1L, snapshot.serverErrors)
    }

    @Test
    fun authoritativeTickDriftUsesAbsoluteDifference() {
        val telemetry = CompetitiveTelemetry()
        telemetry.onAuthoritativeTick(100L, 103L)
        telemetry.onAuthoritativeTick(110L, 108L)

        val snapshot = telemetry.snapshot()
        assertEquals(2L, snapshot.tickSamples)
        assertEquals(3L, snapshot.maxTickDrift)
    }

    @Test
    fun physicsViolationsCountOnlyInvalidSamples() {
        val telemetry = CompetitiveTelemetry()
        telemetry.onPhysicsInvariant(valid = true)
        telemetry.onPhysicsInvariant(valid = false)
        telemetry.onPhysicsInvariant(valid = false)

        assertEquals(2L, telemetry.snapshot().physicsViolations)
    }

    @Test
    fun weakSignalNeverAuthorizesPunishment() {
        val telemetry = CompetitiveTelemetry()
        telemetry.onRiskSignal(strong = false)

        val snapshot = telemetry.snapshot()
        assertEquals(1, snapshot.weakRiskSignals)
        assertEquals(0, snapshot.strongRiskSignals)
        assertFalse(snapshot.punishmentAuthorized)
    }
}
