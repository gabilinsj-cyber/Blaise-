import { createHash } from 'node:crypto';

/**
 * Two REAL paid Google Play accounts, pre-production verification GATE.
 * This function CANNOT purchase anything and cannot infer a monetary charge
 * solely from a subscription being active (free trials and promotions exist).
 * It requires independent trusted merchant ledger and account proofs.
 *
 * Store no payment cards, names, Gmail addresses or full purchase tokens.
 */
export const RJ_TWO_REAL_PAYMENT_AUDIT='BLAISE_RJ_TWO_PAID_ACCOUNTS_PREPROD_V1';
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
const blocked=(reason,extra={})=>Object.freeze({
  contract:RJ_TWO_REAL_PAYMENT_AUDIT,
  status:'BLOCKED',
  reason,
  acceptedAccounts:0,
  realChargesVerified:false,
  noPurchasePerformed:true,
  ...extra,
});
const validToken=t=>typeof t==='string'&&t.length>=8&&t.length<=4096;
const validOrder=o=>typeof o==='string'&&o.length>=6&&o.length<=256;
const validHash=h=>typeof h==='string'&&/^[a-f0-9]{64}$/i.test(h);

/**
 * purchaseTokens: EXACTLY two real tokens fetched from each tester's
 * authorized Android session; supplied through protected runtime memory,
 * never source control or console logs.
 *
 * gateway.getSubscription: authenticated Android Publisher subscriptionsv2
 * ledgerVerifier(orderId): trusted merchant order status including positive
 * settled cash amount; NOT a client-supplied JSON flag.
 * identityVerifier(subscription): trusted per-account external identity
 * commitment (SHA-256) from authenticated Google/Firebase account mapping.
 */
export async function auditTwoRealPaidAccounts({
  purchaseTokens,
  gateway,
  ledgerVerifier,
  identityVerifier,
  allowedProductIds,
  nowMillis=Date.now(),
}={}) {
  if(!Array.isArray(purchaseTokens)||purchaseTokens.length!==2
    ||purchaseTokens.some(t=>!validToken(t))
    ||purchaseTokens[0]===purchaseTokens[1])
    return blocked('TWO_DISTINCT_PURCHASE_TOKENS_REQUIRED');
  if(!gateway||typeof gateway.getSubscription!=='function'
    ||typeof ledgerVerifier!=='function'
    ||typeof identityVerifier!=='function')
    return blocked('TRUSTED_GOOGLE_PLAY_LEDGER_AND_ACCOUNT_CONNECTORS_REQUIRED');
  if(!Array.isArray(allowedProductIds)||allowedProductIds.length<1
    ||!allowedProductIds.every(x=>typeof x==='string'&&x.length>0)
    ||!Number.isFinite(nowMillis))return blocked('INVALID_AUDIT_POLICY');
  const allowed=new Set(allowedProductIds);
  const evidence=[];
  for(const token of purchaseTokens) {
    let purchase,ledger,accountHash;
    try {
      purchase=await gateway.getSubscription(token);
      if(!purchase || purchase.testPurchase!=null ||
        purchase.subscriptionState!=='SUBSCRIPTION_STATE_ACTIVE' ||
        purchase.acknowledgementState!=='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED')
        return blocked('NOT_ACTIVE_ACKNOWLEDGED_REAL_GOOGLE_PLAY_SUBSCRIPTION');
      if(!validOrder(purchase.latestOrderId))
        return blocked('GOOGLE_PLAY_ORDER_ID_MISSING');
      const liveLines=Array.isArray(purchase.lineItems)?purchase.lineItems.filter(line=>
        line && allowed.has(line.productId)
        && Number.isFinite(Date.parse(line.expiryTime))
        && Date.parse(line.expiryTime)>nowMillis):[];
      if(!liveLines.length)return blocked('NO_LIVE_ALLOWED_SUBSCRIPTION_PRODUCT');
      ledger=await ledgerVerifier(purchase.latestOrderId);
      // A Play API "active" flag does not prove a real money movement.
      if(ledger?.trustedOrigin!=='GOOGLE_PLAY_MERCHANT_LEDGER'
        ||ledger?.paymentStatus!=='SETTLED'
        ||!Number.isInteger(ledger.grossAmountMicros)
        ||ledger.grossAmountMicros<=0
        ||typeof ledger.currency!=='string'||!/^[A-Z]{3}$/.test(ledger.currency))
        return blocked('REAL_CHARGE_NOT_CONFIRMED_IN_MERCHANT_LEDGER');
      accountHash=await identityVerifier(purchase);
      if(!validHash(accountHash))
        return blocked('DISTINCT_AUTHENTICATED_ACCOUNT_PROOF_REQUIRED');
    } catch {
      return blocked('TRUSTED_BILLING_OR_ACCOUNT_VERIFICATION_FAILED');
    }
    evidence.push(Object.freeze({
      purchaseTokenDigest:digest(token),
      orderDigest:digest(purchase.latestOrderId),
      accountProofDigest:accountHash.slice(0,24),
      productId:purchase.lineItems.find(x=>allowed.has(x.productId)).productId,
      currency:ledger.currency,
      positiveSettledAmountVerified:true,
      subscriptionActive:true,
      acknowledged:true,
      testPurchase:false,
    }));
  }
  if(new Set(evidence.map(x=>x.accountProofDigest)).size!==2
    ||new Set(evidence.map(x=>x.orderDigest)).size!==2)
    return blocked('TWO_INDEPENDENT_CHARGED_ACCOUNTS_NOT_PROVEN');
  return Object.freeze({
    contract:RJ_TWO_REAL_PAYMENT_AUDIT,status:'PASS',
    acceptedAccounts:2,realChargesVerified:true,
    evidence:Object.freeze(evidence),
    noPurchasePerformed:true,
    deploymentApproval:'NOT_GRANTED_BY_THIS_AUDIT',
    refundsPerformed:false,
    cancellationRenewalAndDeviceValidation:'SEPARATE_PHYSICAL_TEST_REQUIRED',
  });
}
