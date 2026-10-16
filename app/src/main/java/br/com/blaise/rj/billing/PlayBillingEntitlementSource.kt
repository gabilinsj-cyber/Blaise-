package br.com.blaise.rj.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

sealed interface BillingEntitlementSnapshot {
    data object Unconfigured : BillingEntitlementSnapshot
    data object Connecting : BillingEntitlementSnapshot
    data object Verifying : BillingEntitlementSnapshot
    data object Inactive : BillingEntitlementSnapshot
    data class Active(val productIds: Set<String>) : BillingEntitlementSnapshot
    data class Unavailable(val responseCode: Int) : BillingEntitlementSnapshot
}

data class SubscriptionOffer(
    val productId: String,
    val name: String,
    val formattedRecurringPrice: String,
    val offerToken: String,
    val basePlanId: String,
    val offerId: String?,
    val hasFreeTrial: Boolean,
)

sealed interface SubscriptionOffersSnapshot {
    data object Unconfigured : SubscriptionOffersSnapshot
    data object Loading : SubscriptionOffersSnapshot
    data class Ready(val offers: List<SubscriptionOffer>) : SubscriptionOffersSnapshot
    data class Unavailable(val responseCode: Int) : SubscriptionOffersSnapshot
}

class PlayBillingEntitlementSource(
    context: Context,
    productIds: Set<String>,
    private val verifier: PurchaseVerifier,
    private val onVerifiedPurchase: (PlayPurchaseCandidate?) -> Unit = {},
) : PurchasesUpdatedListener, BillingClientStateListener {
    private val catalog = SubscriptionCatalog(productIds)
    private var entitlementObserver: ((BillingEntitlementSnapshot) -> Unit)? = null
    private var offersObserver: ((SubscriptionOffersSnapshot) -> Unit)? = null
    private val verificationGeneration = AtomicInteger(0)

    private fun publishEntitlement(snapshot: BillingEntitlementSnapshot) {
        if (snapshot !is BillingEntitlementSnapshot.Active) {
            if (snapshot !is BillingEntitlementSnapshot.Verifying) verificationGeneration.incrementAndGet()
            onVerifiedPurchase(null)
        }
        entitlementObserver?.invoke(snapshot)
    }

    private val billingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build(),
        )
        .enableAutoServiceReconnection()
        .build()

    fun start(
        entitlementObserver: (BillingEntitlementSnapshot) -> Unit,
        offersObserver: (SubscriptionOffersSnapshot) -> Unit = {},
    ) {
        this.entitlementObserver = entitlementObserver
        this.offersObserver = offersObserver
        if (!catalog.configured) {
            publishEntitlement(BillingEntitlementSnapshot.Unconfigured)
            offersObserver(SubscriptionOffersSnapshot.Unconfigured)
            return
        }
        publishEntitlement(BillingEntitlementSnapshot.Connecting)
        offersObserver(SubscriptionOffersSnapshot.Loading)
        if (billingClient.isReady) {
            refreshPurchases()
            refreshOffers()
        } else {
            billingClient.startConnection(this)
        }
    }

    fun refresh() {
        if (!catalog.configured) {
            publishEntitlement(BillingEntitlementSnapshot.Unconfigured)
            offersObserver?.invoke(SubscriptionOffersSnapshot.Unconfigured)
        } else if (billingClient.isReady) {
            refreshPurchases()
            refreshOffers()
        } else {
            publishEntitlement(BillingEntitlementSnapshot.Connecting)
            offersObserver?.invoke(SubscriptionOffersSnapshot.Loading)
            billingClient.startConnection(this)
        }
    }

    fun launchPurchase(
        activity: Activity,
        offer: SubscriptionOffer,
        onLaunchResult: (Int) -> Unit,
    ) {
        if (!catalog.matches(listOf(offer.productId)) || !billingClient.isReady) {
            onLaunchResult(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED)
            return
        }

        queryProductDetails(setOf(offer.productId)) { result, details ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                onLaunchResult(result.responseCode)
                return@queryProductDetails
            }

            val product = details.firstOrNull { it.productId == offer.productId }
            val currentOffer = product?.subscriptionOfferDetails.orEmpty()
                .firstOrNull { it.offerToken == offer.offerToken }
            if (product == null || currentOffer == null) {
                onLaunchResult(BillingClient.BillingResponseCode.ITEM_UNAVAILABLE)
                return@queryProductDetails
            }

            val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(product)
                .setOfferToken(currentOffer.offerToken)
                .build()
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(productParams))
                .build()

            activity.runOnUiThread {
                onLaunchResult(billingClient.launchBillingFlow(activity, flowParams).responseCode)
            }
        }
    }

    fun stop() {
        verificationGeneration.incrementAndGet()
        onVerifiedPurchase(null)
        entitlementObserver = null
        offersObserver = null
        billingClient.endConnection()
    }

    override fun onBillingSetupFinished(result: BillingResult) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            refreshPurchases()
            refreshOffers()
        } else {
            publishEntitlement(BillingEntitlementSnapshot.Unavailable(result.responseCode))
            offersObserver?.invoke(SubscriptionOffersSnapshot.Unavailable(result.responseCode))
        }
    }

    override fun onBillingServiceDisconnected() {
        publishEntitlement(
            BillingEntitlementSnapshot.Unavailable(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED),
        )
        offersObserver?.invoke(
            SubscriptionOffersSnapshot.Unavailable(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED),
        )
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> verifyPurchases(purchases.orEmpty())
            BillingClient.BillingResponseCode.USER_CANCELED -> refresh()
            else -> publishEntitlement(BillingEntitlementSnapshot.Unavailable(result.responseCode))
        }
    }

    private fun refreshPurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                verifyPurchases(purchases)
            } else {
                publishEntitlement(BillingEntitlementSnapshot.Unavailable(result.responseCode))
            }
        }
    }

    private fun refreshOffers() {
        offersObserver?.invoke(SubscriptionOffersSnapshot.Loading)
        queryProductDetails(catalog.productIds) { result, details ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                offersObserver?.invoke(SubscriptionOffersSnapshot.Unavailable(result.responseCode))
                return@queryProductDetails
            }

            val offers = details.flatMap(::toOffers)
                .sortedWith(compareBy(SubscriptionOffer::productId, SubscriptionOffer::basePlanId, SubscriptionOffer::offerId))
            offersObserver?.invoke(SubscriptionOffersSnapshot.Ready(offers))
        }
    }

    private fun queryProductDetails(
        productIds: Set<String>,
        callback: (BillingResult, List<ProductDetails>) -> Unit,
    ) {
        val products = productIds.sorted().map { productId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        if (products.isEmpty()) {
            callback(
                BillingResult.newBuilder().setResponseCode(BillingClient.BillingResponseCode.DEVELOPER_ERROR).build(),
                emptyList(),
            )
            return
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        billingClient.queryProductDetailsAsync(params) { result, queryResult ->
            callback(result, queryResult.productDetailsList)
        }
    }

    private fun toOffers(details: ProductDetails): List<SubscriptionOffer> =
        details.subscriptionOfferDetails.orEmpty().mapNotNull { offer ->
            val phases = offer.pricingPhases.pricingPhaseList
            val recurring = phases.lastOrNull { it.priceAmountMicros > 0L } ?: phases.lastOrNull() ?: return@mapNotNull null
            SubscriptionOffer(
                productId = details.productId,
                name = details.name,
                formattedRecurringPrice = recurring.formattedPrice,
                offerToken = offer.offerToken,
                basePlanId = offer.basePlanId,
                offerId = offer.offerId,
                hasFreeTrial = phases.any { it.priceAmountMicros == 0L },
            )
        }

    private fun verifyPurchases(purchases: List<Purchase>) {
        val generation = verificationGeneration.incrementAndGet()
        onVerifiedPurchase(null)
        val candidates = purchases
            .map(::toCandidate)
            .filter { PlayEntitlementGate.canRequestVerification(it, catalog) }

        if (candidates.isEmpty()) {
            publishEntitlement(BillingEntitlementSnapshot.Inactive)
            return
        }

        publishEntitlement(BillingEntitlementSnapshot.Verifying)
        val remaining = AtomicInteger(candidates.size)
        val granted = AtomicBoolean(false)

        candidates.forEach { candidate ->
            verifier.verify(candidate) { verification ->
                if (generation != verificationGeneration.get() || entitlementObserver == null) return@verify
                val entitlement = PlayEntitlementGate.entitlement(candidate, verification)
                if (entitlement.active && granted.compareAndSet(false, true)) {
                    onVerifiedPurchase(candidate)
                    publishEntitlement(BillingEntitlementSnapshot.Active(candidate.productIds.toSet()))
                }
                if (remaining.decrementAndGet() == 0 && !granted.get()) {
                    publishEntitlement(BillingEntitlementSnapshot.Inactive)
                }
            }
        }
    }

    private fun toCandidate(purchase: Purchase): PlayPurchaseCandidate = PlayPurchaseCandidate(
        purchaseToken = purchase.purchaseToken,
        productIds = purchase.products,
        state = when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> LocalPurchaseState.PURCHASED
            Purchase.PurchaseState.PENDING -> LocalPurchaseState.PENDING
            else -> LocalPurchaseState.UNSPECIFIED
        },
    )
}
