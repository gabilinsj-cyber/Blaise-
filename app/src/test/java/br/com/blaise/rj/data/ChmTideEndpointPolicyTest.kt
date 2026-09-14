package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChmTideEndpointPolicyTest {
    @Test
    fun `derives paid tide endpoint only from exact same HTTPS verifier origin`() {
        assertEquals(
            "https://api.example.com/v1/data/chm/tide",
            ChmTideEndpointPolicy.deriveFromEntitlementVerifier(
                "https://api.example.com/v1/entitlements/verify",
            ),
        )
        assertEquals(
            "https://api.example.com:8443/v1/data/chm/tide",
            ChmTideEndpointPolicy.deriveFromEntitlementVerifier(
                "https://api.example.com:8443/v1/entitlements/verify",
            ),
        )
    }

    @Test
    fun `rejects alternate hosts paths credentials query fragments and cleartext`() {
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("http://api.example.com/v1/entitlements/verify"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("https://user@api.example.com/v1/entitlements/verify"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("https://api.example.com/v1/entitlements/verify?next=https://evil.example"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("https://api.example.com/v1/entitlements/verify#fragment"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("https://api.example.com/v1/entitlements/verify/"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier("https://evil.example/v1/data/chm/tide"))
        assertNull(ChmTideEndpointPolicy.deriveFromEntitlementVerifier(""))
    }
}
