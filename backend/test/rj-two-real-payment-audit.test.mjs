import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditTwoRealPaidAccounts} from '../src/rj-two-real-payment-audit.mjs';
const nowMillis=Date.parse('2026-10-11T04:00:00Z');
const tokens=['opaque_token_acc_01','opaque_token_acc_02'];
const ledgerVerifier=async(orderId)=>({
 trustedOrigin:'GOOGLE_PLAY_MERCHANT_LEDGER',paymentStatus:'SETTLED',
 grossAmountMicros:9990000,currency:'BRL',
});
const identityVerifier=async(purchase)=>createHash('sha256')
  .update(purchase.externalAccountIdentifiers.obfuscatedExternalAccountId)
  .digest('hex');
const gateway={async getSubscription(token) {
 return {
  subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  latestOrderId:token+'-order',
  lineItems:[{productId:'blaise_mensal',expiryTime:'2026-11-11T04:00:00Z'}],
  externalAccountIdentifiers:{obfuscatedExternalAccountId:token+'-user'},
 };
}};
const input=(overrides={})=>({
 purchaseTokens:tokens,gateway,ledgerVerifier,identityVerifier,
 allowedProductIds:['blaise_mensal','blaise_anual'],nowMillis,
 ...overrides,
});
test('two distinct real charged active/acknowledged accounts require trusted independent evidence',async()=>{
 const r=await auditTwoRealPaidAccounts(input());
 assert.equal(r.status,'PASS');
 assert.equal(r.acceptedAccounts,2);
 assert.equal(r.realChargesVerified,true);
 assert.equal(r.evidence.length,2);
 assert.equal(r.noPurchasePerformed,true);
 assert.equal(r.deploymentApproval,'NOT_GRANTED_BY_THIS_AUDIT');
 assert.ok(!JSON.stringify(r).includes(tokens[0]));
 assert.ok(!JSON.stringify(r).includes(tokens[1]));
});
test('a single account and duplicated order cannot pass',async()=>{
 for(const p of [[tokens[0],tokens[0]],[tokens[0]]]){
  assert.equal((await auditTwoRealPaidAccounts(input({purchaseTokens:p}))).status,'BLOCKED');
 }
 const sameUser=()=>createHash('sha256').update('same-user').digest('hex');
 const r=await auditTwoRealPaidAccounts(input({identityVerifier:sameUser}));
 assert.equal(r.reason,'TWO_INDEPENDENT_CHARGED_ACCOUNTS_NOT_PROVEN');
 const sameOrder={getSubscription:async(token)=>({
  ...(await gateway.getSubscription(token)),latestOrderId:'one-common-order-2026',
 })};
 assert.equal((await auditTwoRealPaidAccounts(input({gateway:sameOrder}))).status,'BLOCKED');
});
test('cannot mistake a license test, trial, pending, expired, unacknowledged or denied charge as a real payment',async()=>{
 const variants=[
  {testPurchase:{}},
  {subscriptionState:'SUBSCRIPTION_STATE_PENDING'},
  {subscriptionState:'SUBSCRIPTION_STATE_CANCELED'},
  {acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING'},
  {lineItems:[{productId:'blaise_mensal',expiryTime:'2026-10-10T04:00:00Z'}]},
  {lineItems:[{productId:'different_product',expiryTime:'2026-11-11T04:00:00Z'}]},
 ];
 for(const override of variants){
  const bad={getSubscription:async token=>({...await gateway.getSubscription(token),...override})};
  assert.equal((await auditTwoRealPaidAccounts(input({gateway:bad}))).status,'BLOCKED');
 }
 for(const ledger of [
  {...await ledgerVerifier(),paymentStatus:'PENDING'},
  {...await ledgerVerifier(),grossAmountMicros:0},
  {...await ledgerVerifier(),trustedOrigin:'CLIENT_JSON'},
 ]) {
  assert.equal((await auditTwoRealPaidAccounts(input({ledgerVerifier:async()=>ledger}))).status,'BLOCKED');
 }
});
test('a made-up price or an unverified identity never unlocks subscription status',async()=>{
 assert.equal((await auditTwoRealPaidAccounts(input({identityVerifier:async()=>null}))).status,'BLOCKED');
 assert.equal((await auditTwoRealPaidAccounts(input({ledgerVerifier:null}))).status,'BLOCKED');
 assert.equal((await auditTwoRealPaidAccounts(input({purchaseTokens:[]}))).status,'BLOCKED');
});
