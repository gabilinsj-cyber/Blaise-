/**
 * Read-only all-provider release audit. No credentials, network, or writes.
 * --assert-private: success only when safety policy stays fail-closed.
 * --require-production: intentionally fails until separate external proof.
 */
import {assessRjMeteorologicalProductionReadiness}
 from '../src/rj-meteorological-production-readiness.mjs';

const audit=assessRjMeteorologicalProductionReadiness();
console.log('RJ_METEOROLOGICAL_PRODUCTION_READINESS='+JSON.stringify(audit));
if(process.argv.includes('--require-production')){
 console.error('BLOCKED: external evidence, product licensing, operational QA and explicit release approval required');
 process.exitCode=2;
}else if(process.argv.includes('--assert-private')&&
 (audit.policyIntegrityPass!==true||
  audit.meteorologicalProductionHomologated!==false||
  audit.publishNewMeteorologicalSourcesToClients!==false||
  audit.allowNewAutomaticCollection!==false||
  audit.noProviderNetworkCalls!==true||
  audit.noCreditReservations!==true)){
 process.exitCode=1;
}
