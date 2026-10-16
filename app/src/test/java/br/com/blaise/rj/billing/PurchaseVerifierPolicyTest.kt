package br.com.blaise.rj.billing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class PurchaseVerifierPolicyTest {
    @Test fun `only absolute https backend endpoints are accepted`() {
        assertEquals(
            "https://api.example.com/v1/play/verify",
            VerifierEndpointPolicy.normalizedHttpsUrl("https://api.example.com/v1/play/verify"),
        )
        assertNull(VerifierEndpointPolicy.normalizedHttpsUrl("http://api.example.com/verify"))
        assertNull(VerifierEndpointPolicy.normalizedHttpsUrl("/relative/verify"))
        assertNull(VerifierEndpointPolicy.normalizedHttpsUrl("https://user:pass@example.com/verify"))
        assertNull(VerifierEndpointPolicy.normalizedHttpsUrl(""))
    }

    @Test fun `missing or insecure backend always selects fail closed verifier`() {
        assertSame(FailClosedPurchaseVerifier, PurchaseVerifierFactory.create("", "br.com.blaise.rj"))
        assertSame(
            FailClosedPurchaseVerifier,
            PurchaseVerifierFactory.create("http://example.com/verify", "br.com.blaise.rj"),
        )
    }
}
