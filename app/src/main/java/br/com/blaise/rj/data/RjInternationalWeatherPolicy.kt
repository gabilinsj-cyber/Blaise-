package br.com.blaise.rj.data

/**
 * Policy boundary adopted on 2026-11-16.
 *
 * Public meteorological measurements must come from specifically licensed
 * international products. This is NOT a claim that such a product has been
 * wired to the Android app or is currently transmitting live observations.
 *
 * INMET, Alerta Rio and Defesa Civil meteorology are internal review-only
 * sources on the server. The Android APK must not fetch or publish their
 * readings, or derive displayed values from restricted products.
 *
 * Emergency safety messages are a separate legal/operational channel and
 * must be evaluated independently; this policy never suppresses Android's
 * native Defesa Civil Alerta / cell-broadcast notifications.
 */
object RjInternationalWeatherPolicy {
    const val ALLOW_BRAZILIAN_OBSERVATIONS_IN_APK = false
    const val INTERNAL_BRAZILIAN_REVIEW_INTERVAL_MINUTES = 30L
    const val INTERNATIONAL_FEED_VERIFIED_AND_CONNECTED = false

    val potentialInternationalSources = listOf(
        "NOAA", "EUMETSAT", "JAXA GSMaP", "OpenWeatherMap"
    )
    val internalReviewOnlySources = listOf(
        "INMET", "Defesa Civil RJ"
    )
    const val PUBLIC_UNAVAILABLE_MESSAGE =
        "Dados meteorológicos internacionais atuais ainda não conectados ou " +
        "não validados para esta localidade. Nenhum valor foi inventado."
    const val REASON_CODE = "INTERNATIONAL_OBSERVATION_UNAVAILABLE"

    /**
     * A restrictive policy deliberately returns unavailable until the
     * authenticated backend supplies a fresh, product-licensed international
     * measurement with location, source, timestamp and observation type.
     */
    fun canPublishInternationalMeasurement(
        licensedCommercialUse: Boolean,
        trustedSource: Boolean,
        independentOfRestrictedBrazilianReadings: Boolean,
        isObservation: Boolean,
        isFresh: Boolean,
        exactLocation: Boolean,
    ): Boolean = licensedCommercialUse && trustedSource &&
        independentOfRestrictedBrazilianReadings && isObservation &&
        isFresh && exactLocation
}
