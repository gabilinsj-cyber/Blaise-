/**
 * DEPRECATED: legacy meteoblue key-only probe intentionally never contacts
 * the provider. The operator already confirmed HTTP 200 on 2026-11-18.
 *
 * All further real calls MUST go through the atomic Firestore credit ledger
 * in rj-meteoblue-free-collector.mjs, from the private admin-only audit script.
 * A key check without a shared budget can bypass trial spend limits; therefore
 * even explicit legacy CLI flags do not authorize a provider request here.
 *
 * Compatibility export retained so callers fail closed without breaking import.
 */
const blocked=reason=>Object.freeze({
  contract:'BLAISE_METEOBLUE_FREE_SINGLE_AUTH_TEST_V1',
  state:reason,providerContacted:false,credentialsPrinted:false,
  billingEnabled:false,automaticPollingEnabled:false,
  publishedToSubscribers:false,remainingCreditsVerified:false
});
export async function checkMeteoblueFreeKeyOnce(){
  return blocked('LEGACY_UNBUDGETED_PROBE_DISABLED_USE_FIRESTORE_AUDIT');
}
