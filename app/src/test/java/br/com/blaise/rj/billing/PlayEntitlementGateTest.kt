package br.com.blaise.rj.billing

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayEntitlementGateTest {
    private val catalog = SubscriptionCatalog(setOf("blaise_monthly", "blaise_annual"))

    @Test fun `pending purchase never requests verification or grants entitlement`() {
        val candidate = PlayPurchaseCandidate(
            purchaseToken = "token",
            productIds = listOf("blaise_monthly"),
            state = LocalPurchaseState.PENDING,
        )
        assertFalse(PlayEntitlementGate.canRequestVerification(candidate, catalog))
        assertFalse(PlayEntitlementGate.entitlement(candidate, ServerVerification.VERIFIED_ACTIVE).active)
    }

    @Test fun `purchased subscription still fails closed without server verification`() {
        val candidate = PlayPurchaseCandidate(
            purchaseToken = "token",
            productIds = listOf("blaise_annual"),
            state = LocalPurchaseState.PURCHASED,
        )
        assertTrue(PlayEntitlementGate.canRequestVerification(candidate, catalog))
        assertFalse(PlayEntitlementGate.entitlement(candidate, ServerVerification.UNAVAILABLE).active)
        assertFalse(PlayEntitlementGate.entitlement(candidate, ServerVerification.REJECTED).active)
    }

    @Test fun `only purchased configured product with verified server result grants entitlement`() {
        val candidate = PlayPurchaseCandidate(
            purchaseToken = "token",
            productIds = listOf("blaise_monthly"),
            state = LocalPurchaseState.PURCHASED,
        )
        assertTrue(PlayEntitlementGate.canRequestVerification(candidate, catalog))
        assertTrue(PlayEntitlementGate.entitlement(candidate, ServerVerification.VERIFIED_ACTIVE).active)
    }

    @Test fun `unknown product or blank token never enters verification`() {
        assertFalse(
            PlayEntitlementGate.canRequestVerification(
                PlayPurchaseCandidate("token", listOf("other_product"), LocalPurchaseState.PURCHASED),
                catalog,
            ),
        )
        assertFalse(
            PlayEntitlementGate.canRequestVerification(
                PlayPurchaseCandidate("", listOf("blaise_monthly"), LocalPurchaseState.PURCHASED),
                catalog,
            ),
        )
    }

    @Test fun `empty catalog is fail closed`() {
        val emptyCatalog = SubscriptionCatalog(emptySet())
        val candidate = PlayPurchaseCandidate("token", listOf("blaise_monthly"), LocalPurchaseState.PURCHASED)
        assertFalse(emptyCatalog.configured)
        assertFalse(PlayEntitlementGate.canRequestVerification(candidate, emptyCatalog))
    }
}
