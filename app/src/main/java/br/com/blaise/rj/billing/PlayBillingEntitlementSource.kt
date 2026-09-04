package br.com.blaise.rj.billing

import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
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

class PlayBillingEntitlementSource(
    context: Context,
    productIds: Set<String>,
    private val verifier: PurchaseVerifier,
) : PurchasesUpdatedListener, BillingClientStateListener {
    private val catalog = SubscriptionCatalog(productIds)
    private var observer: ((BillingEntitlementSnapshot) -> Unit)? = null

    private val billingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build(),
        )
        .enableAutoServiceReconnection()
        .build()

    fun start(observer: (BillingEntitlementSnapshot) -> Unit) {
        this.observer = observer
        if (!catalog.configured) {
            observer(BillingEntitlementSnapshot.Unconfigured)
            return
        }
        observer(BillingEntitlementSnapshot.Connecting)
        if (billingClient.isReady) refreshPurchases() else billingClient.startConnection(this)
    }

    fun refresh() {
        if (!catalog.configured) {
            observer?.invoke(BillingEntitlementSnapshot.Unconfigured)
        } else if (billingClient.isReady) {
            refreshPurchases()
        } else {
            observer?.invoke(BillingEntitlementSnapshot.Connecting)
            billingClient.startConnection(this)
        }
    }

    fun stop() {
        observer = null
        if (billingClient.isReady) billingClient.endConnection()
    }

    override fun onBillingSetupFinished(result: BillingResult) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            refreshPurchases()
        } else {
            observer?.invoke(BillingEntitlementSnapshot.Unavailable(result.responseCode))
        }
    }

    override fun onBillingServiceDisconnected() {
        observer?.invoke(BillingEntitlementSnapshot.Unavailable(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED))
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> verifyPurchases(purchases.orEmpty())
            BillingClient.BillingResponseCode.USER_CANCELED -> refresh()
            else -> observer?.invoke(BillingEntitlementSnapshot.Unavailable(result.responseCode))
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
                observer?.invoke(BillingEntitlementSnapshot.Unavailable(result.responseCode))
            }
        }
    }

    private fun verifyPurchases(purchases: List<Purchase>) {
        val candidates = purchases
            .map(::toCandidate)
            .filter { PlayEntitlementGate.canRequestVerification(it, catalog) }

        if (candidates.isEmpty()) {
            observer?.invoke(BillingEntitlementSnapshot.Inactive)
            return
        }

        observer?.invoke(BillingEntitlementSnapshot.Verifying)
        val remaining = AtomicInteger(candidates.size)
        val granted = AtomicBoolean(false)

        candidates.forEach { candidate ->
            verifier.verify(candidate) { verification ->
                val entitlement = PlayEntitlementGate.entitlement(candidate, verification)
                if (entitlement.active && granted.compareAndSet(false, true)) {
                    observer?.invoke(BillingEntitlementSnapshot.Active(candidate.productIds.toSet()))
                }
                if (remaining.decrementAndGet() == 0 && !granted.get()) {
                    observer?.invoke(BillingEntitlementSnapshot.Inactive)
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
