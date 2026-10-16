package br.com.blaise.rj.billing

import br.com.blaise.rj.core.Entitlement

enum class LocalPurchaseState { PURCHASED, PENDING, UNSPECIFIED }

data class PlayPurchaseCandidate(
    val purchaseToken: String,
    val productIds: List<String>,
    val state: LocalPurchaseState,
)

enum class ServerVerification { VERIFIED_ACTIVE, REJECTED, UNAVAILABLE }

fun interface PurchaseVerifier {
    fun verify(candidate: PlayPurchaseCandidate, callback: (ServerVerification) -> Unit)
}

class SubscriptionCatalog(productIds: Set<String>) {
    val productIds: Set<String> = productIds.map(String::trim).filter(String::isNotEmpty).toSet()
    val configured: Boolean get() = productIds.isNotEmpty()

    fun matches(products: Collection<String>): Boolean = products.any(productIds::contains)
}

object PlayEntitlementGate {
    fun canRequestVerification(candidate: PlayPurchaseCandidate, catalog: SubscriptionCatalog): Boolean =
        candidate.state == LocalPurchaseState.PURCHASED &&
            candidate.purchaseToken.isNotBlank() &&
            catalog.configured &&
            catalog.matches(candidate.productIds)

    fun entitlement(candidate: PlayPurchaseCandidate, verification: ServerVerification): Entitlement =
        Entitlement(
            active = candidate.state == LocalPurchaseState.PURCHASED &&
                verification == ServerVerification.VERIFIED_ACTIVE,
        )
}

object FailClosedPurchaseVerifier : PurchaseVerifier {
    override fun verify(candidate: PlayPurchaseCandidate, callback: (ServerVerification) -> Unit) {
        callback(ServerVerification.UNAVAILABLE)
    }
}
